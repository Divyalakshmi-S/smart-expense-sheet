from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ExpenseBase(BaseModel):
    category: str
    expense_type: str
    name: str
    amount: Optional[float] = None
    payment_date: Optional[str] = None
    incharge: Optional[str] = None
    comments: Optional[str] = None
    necessity_level: Optional[str] = None
    is_recurring: bool = True
    frequency: Optional[str] = None
    data_month: Optional[int] = None
    data_year: Optional[int] = None


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(BaseModel):
    category: Optional[str] = None
    name: Optional[str] = None
    amount: Optional[float] = None
    payment_date: Optional[str] = None
    incharge: Optional[str] = None
    comments: Optional[str] = None
    necessity_level: Optional[str] = None
    is_recurring: Optional[bool] = None
    frequency: Optional[str] = None
    is_active: Optional[bool] = None
    data_month: Optional[int] = None
    data_year: Optional[int] = None


class ExpenseOut(ExpenseBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TransactionCreate(BaseModel):
    expense_id: int
    amount: float
    date: Optional[datetime] = None
    month: int
    year: int
    notes: Optional[str] = None
    is_paid: bool = True


class TransactionOut(TransactionCreate):
    id: int

    class Config:
        from_attributes = True


class MonthlyTrendPoint(BaseModel):
    month: int
    year: int
    month_label: str
    total_expenses: float
    living: float
    debt: float
    investment: float
    insurance: float
    savings: float


class AnalyticsSummary(BaseModel):
    total_monthly_expenses: float
    total_investments: float
    total_insurance_yearly: float
    total_debt: float
    income: float
    savings_rate: float
    expense_by_category: dict
    expense_by_incharge: dict
    necessity_breakdown: dict
    top_expenses: List[dict]


class PredictionResult(BaseModel):
    month: int
    year: int
    predicted_total: float
    by_category: dict
    confidence: float
    recommendations: List[str]
    anomalies: List[dict]
    savings_opportunities: List[dict]


class ChatMessage(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
    sources: List[str] = []
    agent_steps: List[str] = []
