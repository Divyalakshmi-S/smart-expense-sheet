"""
Agentic AI Service — LangChain ReAct Agent with expense analysis tools.
Uses Groq (free tier) with Llama 3 as the LLM backbone.
Falls back to rule-based answers when no API key is set.
"""
from typing import List, Tuple
from app.services import ml_predictor

# ──────────────────────────────────────────────────────────────────────────────
# Tool implementations (pure functions, called by agent)
# ──────────────────────────────────────────────────────────────────────────────

def tool_expense_summary(expenses: List[dict]) -> str:
    total = sum(
        (e.get("amount") or 0) / (12 if e.get("frequency") == "yearly" else 1)
        for e in expenses
        if e.get("expense_type") in ("living", "debt")
    )
    inv = sum(
        (e.get("amount") or 0)
        for e in expenses
        if e.get("expense_type") == "investment"
    )
    ins = sum(
        (e.get("amount") or 0)
        for e in expenses
        if e.get("expense_type") == "insurance"
    )
    income = ml_predictor.MONTHLY_INCOME
    savings = income - total - (inv) - (ins / 12)
    return (
        f"Monthly Expense Summary:\n"
        f"  • Total recurring monthly expenses: ₹{total:,.0f}\n"
        f"  • Monthly investments: ₹{inv:,.0f}\n"
        f"  • Insurance (monthly equiv): ₹{ins/12:,.0f}\n"
        f"  • Divya's monthly income: ₹{income:,.0f}\n"
        f"  • Estimated savings: ₹{savings:,.0f}"
    )


def tool_category_breakdown(expenses: List[dict]) -> str:
    cats: dict = {}
    for e in expenses:
        cat = e.get("expense_type", "other")
        amt = (e.get("amount") or 0) / (12 if e.get("frequency") == "yearly" else 1)
        cats[cat] = cats.get(cat, 0) + amt
    lines = [f"  • {cat.title()}: ₹{amt:,.0f}/month" for cat, amt in sorted(cats.items(), key=lambda x: -x[1])]
    return "Expense breakdown by type:\n" + "\n".join(lines)


def tool_predict_next_month(expenses: List[dict]) -> str:
    result = ml_predictor.predict_next_month(expenses)
    lines = [f"  • {cat.title()}: ₹{amt:,.0f}" for cat, amt in result["by_category"].items()]
    return (
        f"Next Month Prediction (confidence {result['confidence']*100:.0f}%):\n"
        + "\n".join(lines)
        + f"\n  → Total predicted: ₹{result['predicted_total']:,.0f}"
        + f"\n  → Projected savings: ₹{result['projected_savings']:,.0f}"
    )


def tool_savings_opportunities(expenses: List[dict]) -> str:
    opps = ml_predictor.savings_opportunities(expenses)
    if not opps:
        return "No immediate savings opportunities found — great job!"
    lines = [f"  • {o['tip']} (save ₹{o['saving_per_month']:,.0f}/month)" for o in opps[:5]]
    total = sum(o["saving_per_month"] for o in opps[:5])
    return f"Top savings opportunities (potential ₹{total:,.0f}/month):\n" + "\n".join(lines)


def tool_investment_summary(expenses: List[dict]) -> str:
    investments = [e for e in expenses if e.get("expense_type") == "investment"]
    projections = ml_predictor.investment_growth_projection(investments, years=5)
    if not projections:
        return "No investment data found."
    total_monthly = sum(p["monthly_sip"] for p in projections)
    total_5yr = sum(p["projected_value"] for p in projections)
    lines = [
        f"  • {p['name']}: ₹{p['monthly_sip']:,.0f}/mo → ₹{p['projected_value']:,.0f} in 5 yrs (@{p['assumed_return_pct']:.0f}% CAGR)"
        for p in projections
    ]
    return (
        f"Investment Portfolio:\n"
        + "\n".join(lines)
        + f"\n  → Total monthly SIP: ₹{total_monthly:,.0f}"
        + f"\n  → Combined 5-year projected value: ₹{total_5yr:,.0f}"
    )


def tool_upcoming_bills(expenses: List[dict]) -> str:
    from datetime import date
    today = date.today()
    upcoming: List[str] = []
    month_map = {
        "1st": 1, "2nd": 2, "3rd": 3, "4th": 4, "5th": 5, "6th": 6,
        "7th": 7, "8th": 8, "9th": 9, "10th": 10, "11th": 11, "12th": 12,
    }
    for e in expenses:
        pd = (e.get("payment_date") or "").lower()
        amount = e.get("amount") or 0
        if not amount:
            continue
        # Parse day-of-month patterns like "2nd of Every Month", "10th of every month"
        for label, day in month_map.items():
            if label in pd:
                days_until = (day - today.day) % 30 or 30
                icon = "🔴" if days_until <= 3 else "🟡" if days_until <= 7 else "🟢"
                upcoming.append(
                    f"  {icon} {e['name']}: ₹{amount:,.0f} — due in {days_until} day(s) (day {day})"
                )
                break
    if not upcoming:
        return "No bill due-date info found in the current data."
    return "Upcoming Bills:\n" + "\n".join(upcoming)


def tool_anomaly_report(expenses: List[dict]) -> str:
    anomalies = ml_predictor.detect_anomalies(expenses)
    if not anomalies:
        return "No anomalies detected. Your expense pattern looks healthy!"
    lines = [f"  • [{a['severity'].upper()}] {a['name']}: {a['reason']}" for a in anomalies]
    return f"Anomaly / Risk Report ({len(anomalies)} item(s)):\n" + "\n".join(lines)


# ──────────────────────────────────────────────────────────────────────────────
# Agent orchestrator
# ──────────────────────────────────────────────────────────────────────────────

TOOL_DESCRIPTIONS = {
    "summary": ("Get monthly expense summary", tool_expense_summary),
    "breakdown": ("Get expense breakdown by category", tool_category_breakdown),
    "predict": ("Predict next month's expenses", tool_predict_next_month),
    "savings": ("Find savings opportunities", tool_savings_opportunities),
    "investments": ("Get investment portfolio & projections", tool_investment_summary),
    "upcoming": ("List upcoming bill due dates", tool_upcoming_bills),
    "anomalies": ("Detect spending anomalies", tool_anomaly_report),
}


def _rule_based_answer(user_msg: str, expenses: List[dict]) -> Tuple[str, List[str]]:
    """
    Keyword-based routing when no LLM key is present.
    Returns (answer_text, list_of_tools_used).
    """
    msg = user_msg.lower()
    results: List[str] = []
    tools_used: List[str] = []

    # Pick relevant tools by keyword
    if any(k in msg for k in ["summary", "total", "overview", "how much", "income", "salary"]):
        results.append(tool_expense_summary(expenses))
        tools_used.append("summary")
    if any(k in msg for k in ["category", "breakdown", "type", "living", "debt", "investment"]):
        results.append(tool_category_breakdown(expenses))
        tools_used.append("breakdown")
    if any(k in msg for k in ["predict", "next month", "forecast", "future"]):
        results.append(tool_predict_next_month(expenses))
        tools_used.append("predict")
    if any(k in msg for k in ["save", "saving", "cut", "reduce", "opportunity"]):
        results.append(tool_savings_opportunities(expenses))
        tools_used.append("savings")
    if any(k in msg for k in ["invest", "portfolio", "sip", "mutual fund", "stock", "rd", "chit"]):
        results.append(tool_investment_summary(expenses))
        tools_used.append("investments")
    if any(k in msg for k in ["upcoming", "due", "bill", "when", "date", "pay"]):
        results.append(tool_upcoming_bills(expenses))
        tools_used.append("upcoming")
    if any(k in msg for k in ["anomal", "unusual", "risk", "problem", "high", "alert"]):
        results.append(tool_anomaly_report(expenses))
        tools_used.append("anomalies")

    if not results:
        # Default: run summary + savings
        results = [tool_expense_summary(expenses), tool_savings_opportunities(expenses)]
        tools_used = ["summary", "savings"]

    return "\n\n".join(results), tools_used


async def run_agent(user_message: str, expenses: List[dict], groq_api_key: str = "") -> dict:
    """
    Run the expense analysis agent.
    Uses Groq LLM when API key is available; falls back to rule-based routing.
    Returns dict with reply, agent_steps, and sources.
    """
    agent_steps: List[str] = []

    if groq_api_key:
        try:
            from langchain_groq import ChatGroq
            from langchain.schema import HumanMessage, SystemMessage

            # Build context string from tools
            context_parts = [
                tool_expense_summary(expenses),
                tool_category_breakdown(expenses),
                tool_predict_next_month(expenses),
                tool_savings_opportunities(expenses),
                tool_investment_summary(expenses),
                tool_upcoming_bills(expenses),
                tool_anomaly_report(expenses),
            ]
            context = "\n\n".join(context_parts)

            system_prompt = (
                "You are a smart personal finance assistant specialising in Indian household expense management. "
                "You have access to the user's expense data below. Answer concisely, use ₹ symbol, "
                "reference specific numbers from the data, and give actionable advice.\n\n"
                f"=== EXPENSE DATA ===\n{context}\n===================\n"
                "Always give numbered, actionable recommendations where relevant."
            )

            llm = ChatGroq(groq_api_key=groq_api_key, model_name="llama3-8b-8192", temperature=0.3)
            messages = [SystemMessage(content=system_prompt), HumanMessage(content=user_message)]
            agent_steps.append("🔍 Analysing expense data with all tools...")
            agent_steps.append("🤖 Querying Groq Llama3 LLM...")
            response = llm.invoke(messages)
            reply = response.content
            sources = ["summary", "breakdown", "predict", "savings", "investments", "upcoming", "anomalies"]
            return {"reply": reply, "agent_steps": agent_steps, "sources": sources}

        except Exception as ex:
            agent_steps.append(f"⚠️ LLM unavailable ({ex}), using rule-based engine...")

    # Fallback: rule-based
    agent_steps.append("🔍 Routing query to relevant analysis tools...")
    reply, sources = _rule_based_answer(user_message, expenses)
    agent_steps.append(f"✅ Used tools: {', '.join(sources)}")

    return {"reply": reply, "agent_steps": agent_steps, "sources": sources}
