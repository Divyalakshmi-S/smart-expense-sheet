import logging
import sys
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, run_migrations
from app import models
from app.api import expenses, analytics, predictions, agent, integrations

# ---------------------------------------------------------------------------
# Logging — stdout so Render/Vercel captures it automatically in the dashboard
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger("smartbudget")

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


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start) * 1000
    # Skip noisy health-check logs
    if request.url.path != "/health":
        logger.info(
            "%s %s → %d (%.0fms) | client=%s",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            request.client.host if request.client else "unknown",
        )
    return response


app.include_router(expenses.router, prefix="/api/expenses", tags=["Expenses"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(predictions.router, prefix="/api/predictions", tags=["Predictions"])
app.include_router(agent.router, prefix="/api/agent", tags=["AI Agent"])
app.include_router(integrations.router, prefix="/api/integrations", tags=["Integrations"])


@app.get("/")
def root():
    return {"message": "Smart Expense Analyser API is running 🚀", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
