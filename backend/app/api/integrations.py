import logging
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta
from app.database import get_db
from app import models, schemas
from app.services.sms_parser import parse_sms, llm_enrich
from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


def _verify_token(authorization: Optional[str] = Header(default=None)):
    """Optional Bearer token guard. Only enforced when SMS_INGEST_TOKEN is set in .env."""
    required = settings.SMS_INGEST_TOKEN
    if not required:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    if authorization.split(" ", 1)[1] != required:
        raise HTTPException(status_code=403, detail="Invalid token")


@router.post("/sms", response_model=schemas.SmsTransactionOut)
def ingest_sms(
    body: schemas.SmsIngest,
    db: Session = Depends(get_db),
    _: None = Depends(_verify_token),
):
    """Ingest a single bank SMS. Called by Android auto-forward or manual paste."""
    logger.info("SMS ingest received | source=%s len=%d preview=%.80s", body.source, len(body.text), body.text)
    parsed = parse_sms(body.text, body.received_at)
    parsed = llm_enrich(parsed, body.text, settings.GROQ_API_KEY)
    logger.info(
        "SMS parsed | bank=%s type=%s amount=%s merchant=%s parseable=%s upi=%s ignore=%s",
        parsed.get("bank"), parsed.get("txn_type"), parsed.get("amount"),
        parsed.get("merchant"), parsed.get("is_parseable"),
        parsed.get("upi_ref"), parsed.get("ignore_reason"),
    )

    # Deduplicate by UPI ref to avoid double-ingesting the same transaction.
    # Exception: if the existing record was unparseable (old/bad parse) and the
    # new parse succeeded, update the existing record with the improved data.
    if parsed["upi_ref"]:
        existing = db.query(models.SmsTransaction).filter_by(upi_ref=parsed["upi_ref"]).first()
        if existing:
            if existing.is_parseable or not parsed["is_parseable"]:
                logger.info("SMS duplicate skipped | upi_ref=%s", parsed["upi_ref"])
                return existing
            logger.info("SMS upgrading unparseable record | upi_ref=%s", parsed["upi_ref"])
            # Upgrade stale unparseable record with better parsed data
            existing.txn_type = parsed["txn_type"]
            existing.amount = parsed["amount"]
            existing.merchant = parsed["merchant"]
            existing.bank = parsed["bank"]
            existing.account_last4 = parsed["account_last4"]
            existing.balance_after = parsed["balance_after"]
            existing.txn_date = parsed["txn_date"]
            existing.auto_category = parsed["auto_category"]
            existing.is_parseable = parsed["is_parseable"]
            existing.ignore_reason = parsed.get("ignore_reason")
            db.commit()
            db.refresh(existing)
            return existing

    txn = models.SmsTransaction(
        raw_text=parsed["raw_text"],
        bank=parsed["bank"],
        txn_type=parsed["txn_type"],
        amount=parsed["amount"],
        merchant=parsed["merchant"],
        account_last4=parsed["account_last4"],
        upi_ref=parsed["upi_ref"],
        balance_after=parsed["balance_after"],
        txn_date=parsed["txn_date"],
        auto_category=parsed["auto_category"],
        source=body.source or "manual",
        is_parseable=parsed["is_parseable"],
        ignore_reason=parsed.get("ignore_reason"),
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    logger.info("SMS saved | id=%d type=%s amount=%s merchant=%s category=%s",
                txn.id, txn.txn_type, txn.amount, txn.merchant, txn.auto_category)
    return txn


@router.post("/sms/batch")
def ingest_sms_batch(
    body: schemas.SmsBatchIngest,
    db: Session = Depends(get_db),
    _: None = Depends(_verify_token),
):
    """Ingest multiple SMS messages at once (e.g. from SMS Backup & Restore XML export)."""
    logger.info("SMS batch ingest started | count=%d", len(body.messages))
    ingested, skipped = 0, 0
    for msg in body.messages:
        parsed = parse_sms(msg.text, msg.received_at)
        parsed = llm_enrich(parsed, msg.text, settings.GROQ_API_KEY)
        # Drop OTPs, biller confirmations, advisory notices — not transactions
        if parsed["txn_type"] == "ignored":
            skipped += 1
            continue
        if parsed["upi_ref"]:
            if db.query(models.SmsTransaction).filter_by(upi_ref=parsed["upi_ref"]).first():
                skipped += 1
                continue
        txn = models.SmsTransaction(
            raw_text=parsed["raw_text"],
            bank=parsed["bank"],
            txn_type=parsed["txn_type"],
            amount=parsed["amount"],
            merchant=parsed["merchant"],
            account_last4=parsed["account_last4"],
            upi_ref=parsed["upi_ref"],
            balance_after=parsed["balance_after"],
            txn_date=parsed["txn_date"],
            auto_category=parsed["auto_category"],
            source=msg.source or "manual",
            is_parseable=parsed["is_parseable"],
            ignore_reason=parsed.get("ignore_reason"),
        )
        db.add(txn)
        ingested += 1
    db.commit()
    logger.info("SMS batch complete | ingested=%d skipped=%d", ingested, skipped)
    return {"ingested": ingested, "skipped": skipped}


@router.get("/sms/transactions", response_model=List[schemas.SmsTransactionOut])
def list_sms_transactions(
    days: int = 30,
    txn_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(days=days)
    q = db.query(models.SmsTransaction).filter(
        models.SmsTransaction.created_at >= since,
        models.SmsTransaction.is_parseable == True,
    )
    if txn_type:
        q = q.filter(models.SmsTransaction.txn_type == txn_type)
    results = q.order_by(models.SmsTransaction.txn_date.desc()).limit(200).all()
    logger.info("SMS transactions query | days=%d txn_type=%s results=%d", days, txn_type, len(results))
    return results


@router.get("/sms/summary")
def sms_summary(days: int = 30, db: Session = Depends(get_db)):
    """Per-category spend + top merchants from SMS transactions for the last N days."""
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.query(models.SmsTransaction)
        .filter(
            models.SmsTransaction.created_at >= since,
            models.SmsTransaction.is_parseable == True,
            models.SmsTransaction.txn_type == "debit",
        )
        .all()
    )
    by_cat: dict = {}
    by_merchant: dict = {}
    total = 0.0
    for r in rows:
        amt = r.amount or 0
        cat = r.auto_category or "other"
        by_cat[cat] = by_cat.get(cat, 0) + amt
        if r.merchant:
            by_merchant[r.merchant] = by_merchant.get(r.merchant, 0) + amt
        total += amt

    top_merchants = sorted(by_merchant.items(), key=lambda x: -x[1])[:10]
    logger.info("SMS summary | days=%d total=%.2f txns=%d categories=%d", days, total, len(rows), len(by_cat))
    return {
        "days": days,
        "total_debited": round(total, 2),
        "transaction_count": len(rows),
        "by_category": {k: round(v, 2) for k, v in sorted(by_cat.items(), key=lambda x: -x[1])},
        "top_merchants": [{"merchant": m, "total": round(a, 2)} for m, a in top_merchants],
    }
