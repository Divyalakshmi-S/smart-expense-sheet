import logging
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta
from app.database import get_db
from app import models, schemas
from app.services.sms_parser import parse_sms, llm_enrich
from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


def _save_sms(text: str, source: str, received_at, db: Session):
    """Shared logic: parse + save a single SMS text. Returns the saved model instance."""
    parsed = parse_sms(text, received_at)
    parsed = llm_enrich(parsed, text, settings.GROQ_API_KEY)
    logger.info(
        "SMS ingest | source=%s bank=%s type=%s amount=%s merchant=%s parseable=%s upi=%s",
        source,
        parsed.get("bank") or "unknown",
        parsed.get("txn_type"),
        parsed.get("amount"),
        parsed.get("merchant") or "—",
        parsed.get("is_parseable"),
        parsed.get("upi_ref") or "—",
    )
    if parsed["upi_ref"]:
        existing = db.query(models.SmsTransaction).filter_by(upi_ref=parsed["upi_ref"]).first()
        if existing:
            if existing.is_parseable or not parsed["is_parseable"]:
                logger.info("SMS duplicate skipped | upi_ref=%s", parsed["upi_ref"])
                return existing
            logger.info("SMS upgrade: replacing unparseable record | upi_ref=%s", parsed["upi_ref"])
            for field in ["txn_type", "amount", "merchant", "bank", "account_last4",
                          "balance_after", "txn_date", "auto_category", "is_parseable"]:
                setattr(existing, field, parsed[field])
            existing.ignore_reason = parsed.get("ignore_reason")
            db.commit()
            db.refresh(existing)
            return existing
    txn = models.SmsTransaction(
        raw_text=parsed["raw_text"], bank=parsed["bank"], txn_type=parsed["txn_type"],
        amount=parsed["amount"], merchant=parsed["merchant"], account_last4=parsed["account_last4"],
        upi_ref=parsed["upi_ref"], balance_after=parsed["balance_after"], txn_date=parsed["txn_date"],
        auto_category=parsed["auto_category"], source=source,
        is_parseable=parsed["is_parseable"], ignore_reason=parsed.get("ignore_reason"),
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    logger.info("SMS saved | id=%d type=%s amount=%s merchant=%s category=%s",
                txn.id, txn.txn_type, txn.amount, txn.merchant, txn.auto_category)
    return txn


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
    """Ingest a single bank SMS via JSON body."""
    if body.text.strip() in ("[sms_body]", "[sms_message]", "{sms_message}", ""):
        raise HTTPException(status_code=400,
            detail="MacroDroid variable not substituted — see /api/integrations/sms/plain for a simpler setup.")
    return _save_sms(body.text, body.source or "manual", body.received_at, db)


@router.post("/sms/plain", response_model=schemas.SmsTransactionOut)
async def ingest_sms_plain(
    request: Request,
    source: str = "android",
    db: Session = Depends(get_db),
    _: None = Depends(_verify_token),
):
    """
    Ingest SMS from plain-text body — avoids JSON quoting issues with MacroDroid.

    MacroDroid HTTP Action setup (SIMPLEST):
      Method:       POST
      URL:          https://smartbudget-me8c.onrender.com/api/integrations/sms/plain?source=android
      Content-Type: text/plain
      Body:         [insert SMS Body magic-variable here — appears as a blue chip]
    """
    raw = await request.body()
    text = raw.decode("utf-8", errors="replace").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty body")
    logger.info("SMS plain ingest | source=%s len=%d preview=%.80s", source, len(text), text)
    return _save_sms(text, source, None, db)



@router.post("/sms/batch")
def ingest_sms_batch(
    body: schemas.SmsBatchIngest,
    db: Session = Depends(get_db),
    _: None = Depends(_verify_token),
):
    """Ingest multiple SMS messages at once (e.g. from SMS Backup & Restore XML export)."""
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
    logger.info("SMS batch complete | ingested=%d skipped=%d total=%d", ingested, skipped, ingested + skipped)
    return {"ingested": ingested, "skipped": skipped}


@router.get("/sms/debug")
def sms_debug(db: Session = Depends(get_db)):
    """Temporary debug endpoint — shows last 20 raw SMS records regardless of parseable status."""
    rows = db.query(models.SmsTransaction).order_by(models.SmsTransaction.id.desc()).limit(20).all()
    return [
        {
            "id": r.id,
            "txn_type": r.txn_type,
            "is_parseable": r.is_parseable,
            "ignore_reason": r.ignore_reason,
            "bank": r.bank,
            "merchant": r.merchant,
            "amount": r.amount,
            "auto_category": r.auto_category,
            "source": r.source,
            "created_at": str(r.created_at),
            "raw_text_preview": (r.raw_text or "")[:120],
        }
        for r in rows
    ]


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
    return q.order_by(models.SmsTransaction.txn_date.desc()).limit(200).all()


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
    return {
        "days": days,
        "total_debited": round(total, 2),
        "transaction_count": len(rows),
        "by_category": {k: round(v, 2) for k, v in sorted(by_cat.items(), key=lambda x: -x[1])},
        "top_merchants": [{"merchant": m, "total": round(a, 2)} for m, a in top_merchants],
    }
