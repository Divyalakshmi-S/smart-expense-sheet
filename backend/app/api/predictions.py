from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.services import ml_predictor
from datetime import date

router = APIRouter()


def _expenses_as_dicts(db: Session):
    return [
        {
            "category": e.category,
            "expense_type": e.expense_type,
            "name": e.name,
            "amount": e.amount,
            "payment_date": e.payment_date,
            "incharge": e.incharge,
            "comments": e.comments,
            "necessity_level": e.necessity_level,
            "frequency": e.frequency,
            "data_month": e.data_month,
            "data_year": e.data_year,
        }
        for e in db.query(models.Expense).filter(models.Expense.is_active == True).all()
    ]


@router.get("/next-month")
def predict_next_month(db: Session = Depends(get_db)):
    expenses = _expenses_as_dicts(db)
    today = date.today()
    result = ml_predictor.predict_next_month(expenses)
    next_month = today.month % 12 + 1
    next_year = today.year + (1 if today.month == 12 else 0)
    return {
        "month": next_month,
        "year": next_year,
        **result,
    }


@router.get("/anomalies")
def get_anomalies(db: Session = Depends(get_db)):
    expenses = _expenses_as_dicts(db)
    return ml_predictor.detect_anomalies(expenses)


@router.get("/savings")
def get_savings_opportunities(db: Session = Depends(get_db)):
    expenses = _expenses_as_dicts(db)
    opportunities = ml_predictor.savings_opportunities(expenses)
    total_potential = sum(o["saving_per_month"] for o in opportunities)
    return {
        "opportunities": opportunities,
        "total_monthly_savings_potential": round(total_potential, 2),
        "total_yearly_savings_potential": round(total_potential * 12, 2),
    }


@router.get("/investment-growth")
def get_investment_growth(years: int = 5, db: Session = Depends(get_db)):
    expenses = _expenses_as_dicts(db)
    investments = [e for e in expenses if e["expense_type"] == "investment"]
    return ml_predictor.investment_growth_projection(investments, years=years)


@router.get("/health-score")
def get_health_score(db: Session = Depends(get_db)):
    expenses = _expenses_as_dicts(db)
    return ml_predictor.budget_health_score(expenses)


@router.get("/rule-analysis")
def get_rule_analysis(db: Session = Depends(get_db)):
    expenses = _expenses_as_dicts(db)
    return ml_predictor.rule_analysis(expenses)
