from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, run_migrations
from app import models
from app.api import expenses, analytics, predictions, agent

models.Base.metadata.create_all(bind=engine)
run_migrations()

app = FastAPI(
    title="Smart Expense Analyser API",
    description="Agentic ML-powered personal finance analyser",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(expenses.router, prefix="/api/expenses", tags=["Expenses"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(predictions.router, prefix="/api/predictions", tags=["Predictions"])
app.include_router(agent.router, prefix="/api/agent", tags=["AI Agent"])


@app.get("/")
def root():
    return {"message": "Smart Expense Analyser API is running 🚀", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
