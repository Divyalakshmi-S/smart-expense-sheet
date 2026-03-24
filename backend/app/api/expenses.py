from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date as date_type
from app.database import get_db
from app import models, schemas
from app.services.csv_parser import parse_expense_csv

router = APIRouter()

MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']


@router.get("/available-months")
def get_available_months(db: Session = Depends(get_db)):
    """Return distinct month/year combos that have expense data, newest first."""
    rows = (
        db.query(models.Expense.data_month, models.Expense.data_year)
        .filter(models.Expense.data_month.isnot(None))
        .distinct()
        .order_by(models.Expense.data_year.desc(), models.Expense.data_month.desc())
        .all()
    )
    return [
        {"month": m, "year": y, "label": f"{MONTH_NAMES[m - 1]} {y}"}
        for m, y in rows
    ]


@router.get("/", response_model=List[schemas.ExpenseOut])
def get_expenses(
    month: Optional[int] = None,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.Expense).filter(models.Expense.is_active == True)
    if month is not None and year is not None:
        q = q.filter(models.Expense.data_month == month, models.Expense.data_year == year)
    elif year is not None:
        q = q.filter(models.Expense.data_year == year)
    return q.all()


@router.post("/", response_model=schemas.ExpenseOut, status_code=201)
def create_expense(expense: schemas.ExpenseCreate, db: Session = Depends(get_db)):
    db_expense = models.Expense(**expense.model_dump())
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense


@router.put("/{expense_id}", response_model=schemas.ExpenseOut)
def update_expense(expense_id: int, update: schemas.ExpenseUpdate, db: Session = Depends(get_db)):
    expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(expense, field, value)
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    expense.is_active = False
    db.commit()
    return {"message": "Deleted"}


@router.post("/upload", status_code=201)
async def upload_csv(
    file: UploadFile = File(...),
    month: Optional[int] = Query(default=None, ge=1, le=12),
    year: Optional[int] = Query(default=None, ge=2000, le=2100),
    db: Session = Depends(get_db),
):
    """Upload an expense CSV tagged to a specific month/year.
    Replaces only that month's data — all other months are preserved.
    """
    today = date_type.today()
    data_month = month or today.month
    data_year = year or today.year

    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    parsed = parse_expense_csv(text)
    if not parsed:
        raise HTTPException(status_code=422, detail="No valid expenses found in CSV")

    # Replace only this month's data — other months are untouched
    db.query(models.Expense).filter(
        models.Expense.data_month == data_month,
        models.Expense.data_year == data_year,
    ).delete()
    db.commit()

    for item in parsed:
        item["data_month"] = data_month
        item["data_year"] = data_year
        db.add(models.Expense(**item))

    db.commit()
    return {
        "inserted": len(parsed),
        "month": data_month,
        "year": data_year,
        "label": f"{MONTH_NAMES[data_month - 1]} {data_year}",
    }


@router.post("/seed-default")
def seed_default_csv(
    month: Optional[int] = Query(default=None, ge=1, le=12),
    year: Optional[int] = Query(default=None, ge=2000, le=2100),
    db: Session = Depends(get_db),
):
    """Seed the DB with the bundled divya-expense-sheet-clean.csv for a given month."""
    import os

    today = date_type.today()
    data_month = month or today.month
    data_year = year or today.year

    base = os.path.join(os.path.dirname(__file__), "..", "..", "..")
    for filename in ("divya-expense-sheet-clean.csv", "divya-expense-sheet.csv"):
        csv_path = os.path.abspath(os.path.join(base, filename))
        if os.path.exists(csv_path):
            break
    else:
        raise HTTPException(status_code=404, detail="Default CSV file not found")

    with open(csv_path, encoding="utf-8") as f:
        text = f.read()

    parsed = parse_expense_csv(text)

    db.query(models.Expense).filter(
        models.Expense.data_month == data_month,
        models.Expense.data_year == data_year,
    ).delete()
    db.commit()

    for item in parsed:
        item["data_month"] = data_month
        item["data_year"] = data_year
        db.add(models.Expense(**item))
    db.commit()
    return {
        "inserted": len(parsed),
        "source": os.path.basename(csv_path),
        "month": data_month,
        "year": data_year,
        "label": f"{MONTH_NAMES[data_month - 1]} {data_year}",
    }
