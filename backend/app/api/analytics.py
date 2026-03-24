from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app import models
from app.services import ml_predictor

router = APIRouter()

MONTHLY_INCOME = ml_predictor.MONTHLY_INCOME
MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']


def _expenses_as_dicts(db: Session, month: Optional[int] = None, year: Optional[int] = None):
    q = db.query(models.Expense).filter(models.Expense.is_active == True)
    if month is not None and year is not None:
        q = q.filter(models.Expense.data_month == month, models.Expense.data_year == year)
    elif year is not None:
        q = q.filter(models.Expense.data_year == year)
    return [
        {
            "id": e.id,
            "category": e.category,
            "expense_type": e.expense_type,
            "name": e.name,
            "amount": e.amount,
            "payment_date": e.payment_date,
            "incharge": e.incharge,
            "comments": e.comments,
            "necessity_level": e.necessity_level,
            "frequency": e.frequency,
        }
        for e in q.all()
    ]


def _monthly_amount(e: dict) -> float:
    amt = e.get("amount") or 0
    freq = (e.get("frequency") or "monthly").lower()
    return amt / 12 if freq == "yearly" else amt / 3 if freq == "quarterly" else amt


@router.get("/summary")
def get_summary(
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
):
    expenses = _expenses_as_dicts(db, month=month, year=year)

    living = sum(_monthly_amount(e) for e in expenses if e["expense_type"] == "living")
    debt = sum(_monthly_amount(e) for e in expenses if e["expense_type"] == "debt")
    investment = sum(_monthly_amount(e) for e in expenses if e["expense_type"] == "investment")
    insurance = sum(_monthly_amount(e) for e in expenses if e["expense_type"] == "insurance")
    total_monthly = living + debt + investment + insurance
    savings = MONTHLY_INCOME - total_monthly
    savings_rate = (savings / MONTHLY_INCOME * 100) if MONTHLY_INCOME else 0

    return {
        "income": MONTHLY_INCOME,
        "total_monthly_expenses": round(total_monthly, 2),
        "living": round(living, 2),
        "debt": round(debt, 2),
        "investment": round(investment, 2),
        "insurance": round(insurance, 2),
        "savings": round(savings, 2),
        "savings_rate": round(savings_rate, 1),
        "total_expenses_count": len(expenses),
    }


@router.get("/categories")
def get_categories(
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
):
    expenses = _expenses_as_dicts(db, month=month, year=year)

    by_cat: dict = {}
    for e in expenses:
        cat = e["category"] or "Other"
        monthly = _monthly_amount(e)
        by_cat.setdefault(cat, {"category": cat, "total": 0, "count": 0, "items": []})
        by_cat[cat]["total"] += monthly
        by_cat[cat]["count"] += 1
        by_cat[cat]["items"].append({"name": e["name"], "amount": monthly})

    result = sorted(by_cat.values(), key=lambda x: -x["total"])
    for item in result:
        item["total"] = round(item["total"], 2)
    return result


@router.get("/incharge")
def get_by_incharge(
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
):
    expenses = _expenses_as_dicts(db, month=month, year=year)
    by_person: dict = {}
    for e in expenses:
        person = (e.get("incharge") or "Unknown").strip()
        by_person[person] = by_person.get(person, 0) + _monthly_amount(e)
    return [{"name": k, "value": round(v, 2)} for k, v in sorted(by_person.items(), key=lambda x: -x[1])]


@router.get("/necessity")
def get_necessity_breakdown(
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
):
    expenses = _expenses_as_dicts(db, month=month, year=year)
    counts: dict = {}
    for e in expenses:
        level = (e.get("necessity_level") or "Unknown").strip()
        counts[level] = counts.get(level, 0) + 1
    return [{"level": k, "count": v} for k, v in counts.items()]


@router.get("/top-expenses")
def get_top_expenses(
    limit: int = 10,
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
):
    expenses = _expenses_as_dicts(db, month=month, year=year)
    sorted_exp = sorted(
        [e for e in expenses if (e.get("amount") or 0) > 0],
        key=lambda e: _monthly_amount(e),
        reverse=True,
    )
    return [
        {
            "name": e["name"],
            "category": e["category"],
            "monthly_amount": round(_monthly_amount(e), 2),
            "incharge": e["incharge"],
            "necessity_level": e["necessity_level"],
        }
        for e in sorted_exp[:limit]
    ]


@router.get("/investments")
def get_investments(
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
):
    expenses = _expenses_as_dicts(db, month=month, year=year)
    investments = [e for e in expenses if e["expense_type"] == "investment"]
    projections_5yr = ml_predictor.investment_growth_projection(investments, years=5)
    projections_10yr = ml_predictor.investment_growth_projection(investments, years=10)

    total_monthly = sum((e.get("amount") or 0) for e in investments)
    return {
        "investments": investments,
        "total_monthly_sip": round(total_monthly, 2),
        "projections_5yr": projections_5yr,
        "projections_10yr": projections_10yr,
    }


@router.get("/trend")
def get_trend(months: int = 12, db: Session = Depends(get_db)):
    """Return per-month totals for the last N uploaded months (chronological order)."""
    combos = (
        db.query(models.Expense.data_month, models.Expense.data_year)
        .filter(
            models.Expense.is_active == True,
            models.Expense.data_month.isnot(None),
        )
        .distinct()
        .order_by(models.Expense.data_year, models.Expense.data_month)
        .all()
    )

    # Keep only the last N months
    combos = combos[-months:]

    result = []
    for (m, y) in combos:
        expenses = _expenses_as_dicts(db, month=m, year=y)
        living = sum(_monthly_amount(e) for e in expenses if e["expense_type"] == "living")
        debt = sum(_monthly_amount(e) for e in expenses if e["expense_type"] == "debt")
        investment = sum(_monthly_amount(e) for e in expenses if e["expense_type"] == "investment")
        insurance = sum(_monthly_amount(e) for e in expenses if e["expense_type"] == "insurance")
        total = living + debt + investment + insurance
        savings = MONTHLY_INCOME - total
        result.append({
            "month": m,
            "year": y,
            "month_label": f"{MONTH_NAMES[m - 1]} {y}",
            "total_expenses": round(total, 2),
            "living": round(living, 2),
            "debt": round(debt, 2),
            "investment": round(investment, 2),
            "insurance": round(insurance, 2),
            "savings": round(savings, 2),
        })

    return result

