from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.services.expense_agent import run_agent, TOOL_DESCRIPTIONS
from app.config import settings

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
        }
        for e in db.query(models.Expense).filter(models.Expense.is_active == True).all()
    ]


@router.post("/chat", response_model=schemas.ChatResponse)
async def chat_with_agent(body: schemas.ChatMessage, db: Session = Depends(get_db)):
    expenses = _expenses_as_dicts(db)

    # Persist user message
    db.add(models.ChatHistory(role="user", content=body.message))
    db.commit()

    result = await run_agent(body.message, expenses, groq_api_key=settings.GROQ_API_KEY)

    # Persist assistant reply
    db.add(models.ChatHistory(role="assistant", content=result["reply"]))
    db.commit()

    return schemas.ChatResponse(
        reply=result["reply"],
        sources=result.get("sources", []),
        agent_steps=result.get("agent_steps", []),
    )


@router.get("/history")
def get_chat_history(db: Session = Depends(get_db), limit: int = 50):
    history = (
        db.query(models.ChatHistory)
        .order_by(models.ChatHistory.created_at.desc())
        .limit(limit)
        .all()
    )
    return [{"role": h.role, "content": h.content, "ts": h.created_at} for h in reversed(history)]


@router.get("/insights")
async def get_proactive_insights(db: Session = Depends(get_db)):
    """Auto-generate a proactive insight report without user prompting."""
    expenses = _expenses_as_dicts(db)
    result = await run_agent(
        "Give me a complete financial health check: summary, anomalies, savings opportunities, and investment outlook.",
        expenses,
        groq_api_key=settings.GROQ_API_KEY,
    )
    return result


@router.get("/tools")
def list_tools():
    return [{"name": k, "description": v[0]} for k, v in TOOL_DESCRIPTIONS.items()]
