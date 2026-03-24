from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String, index=True)
    expense_type = Column(String, index=True)  # living, debt, investment, insurance, other
    name = Column(String)
    amount = Column(Float, nullable=True)
    payment_date = Column(String, nullable=True)
    incharge = Column(String, nullable=True)   # Divya, Sathish, Both
    comments = Column(Text, nullable=True)
    necessity_level = Column(String, nullable=True)  # High, Medium, Low, TBD
    is_recurring = Column(Boolean, default=True)
    frequency = Column(String, nullable=True)   # monthly, yearly, quarterly, one-time
    data_month = Column(Integer, nullable=True, index=True)   # month this row belongs to (1-12)
    data_year = Column(Integer, nullable=True, index=True)    # year this row belongs to
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    transactions = relationship("Transaction", back_populates="expense")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    expense_id = Column(Integer, ForeignKey("expenses.id"))
    amount = Column(Float)
    date = Column(DateTime, default=datetime.utcnow)
    month = Column(Integer)
    year = Column(Integer)
    notes = Column(Text, nullable=True)
    is_paid = Column(Boolean, default=True)

    expense = relationship("Expense", back_populates="transactions")


class MonthlySnapshot(Base):
    __tablename__ = "monthly_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    month = Column(Integer)
    year = Column(Integer)
    total_income = Column(Float, nullable=True)
    total_expenses = Column(Float, default=0)
    total_investments = Column(Float, default=0)
    total_insurance = Column(Float, default=0)
    total_debt = Column(Float, default=0)
    savings = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String)  # user / assistant
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
