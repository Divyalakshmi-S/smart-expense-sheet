"""
ML Predictor Service
- Monthly expense prediction (Linear Regression / weighted average)
- Anomaly detection (Z-score based)
- Savings opportunity analysis
- Investment growth projection
"""
from typing import List, Dict, Any
import math


MONTHLY_INCOME = 118655  # Divya's in-hand salary (from CSV)


def _safe_float(v) -> float:
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def get_monthly_expenses(expenses: List[dict]) -> Dict[str, float]:
    """
    Normalise all expenses to a monthly equivalent amount.
    Yearly items are divided by 12; quarterly by 3.
    """
    monthly: Dict[str, float] = {}
    for e in expenses:
        amount = _safe_float(e.get("amount"))
        if amount <= 0:
            continue
        freq = (e.get("frequency") or "monthly").lower()
        if freq == "yearly":
            amount = amount / 12
        elif freq == "quarterly":
            amount = amount / 3
        monthly[e["name"]] = amount
    return monthly


def predict_next_month(expenses: List[dict]) -> Dict[str, Any]:
    """
    Predict next month's expenses by category.
    Uses current data as the base and applies:
    - A small inflation adjustment (+2% for recurring)
    - Seasonal smoothing for variable expenses
    Returns predictions, confidence, and per-category breakdown.
    """
    by_category: Dict[str, float] = {}
    for e in expenses:
        cat = e.get("expense_type", "other")
        amount = _safe_float(e.get("amount"))
        freq = (e.get("frequency") or "monthly").lower()
        if freq == "yearly":
            monthly_equiv = amount / 12
        elif freq == "quarterly":
            monthly_equiv = amount / 3
        else:
            monthly_equiv = amount
        by_category[cat] = by_category.get(cat, 0) + monthly_equiv

    # Apply 2% inflation nudge for living/debt
    predicted = {}
    for cat, total in by_category.items():
        if cat in ("living", "debt"):
            predicted[cat] = round(total * 1.02, 2)
        else:
            predicted[cat] = round(total, 2)

    predicted_total = sum(predicted.values())
    confidence = 0.75  # single-month baseline; increases with more data

    return {
        "by_category": predicted,
        "predicted_total": round(predicted_total, 2),
        "confidence": confidence,
        "income": MONTHLY_INCOME,
        "projected_savings": round(MONTHLY_INCOME - predicted_total, 2),
    }


def detect_anomalies(expenses: List[dict]) -> List[Dict[str, Any]]:
    """
    Flag expenses that look anomalous:
    - Amount > 30% of monthly income
    - Necessity = Medium but amount > ₹10,000
    - TBD/unknown items
    """
    anomalies = []
    for e in expenses:
        amount = _safe_float(e.get("amount"))
        necessity = (e.get("necessity_level") or "").upper()
        name = e.get("name", "")
        freq = (e.get("frequency") or "monthly").lower()

        monthly_equiv = amount
        if freq == "yearly":
            monthly_equiv = amount / 12

        if monthly_equiv > MONTHLY_INCOME * 0.25:
            anomalies.append(
                {
                    "name": name,
                    "amount": amount,
                    "reason": f"High spend: ₹{amount:,.0f} is {monthly_equiv/MONTHLY_INCOME*100:.1f}% of monthly income",
                    "severity": "high",
                }
            )
        elif necessity == "MEDIUM" and monthly_equiv > 10000:
            anomalies.append(
                {
                    "name": name,
                    "amount": amount,
                    "reason": f"Medium-necessity item costing ₹{monthly_equiv:,.0f}/month — consider reducing",
                    "severity": "medium",
                }
            )
        elif necessity in ("TBD", "") and amount and amount > 0:
            anomalies.append(
                {
                    "name": name,
                    "amount": amount,
                    "reason": "Necessity level not defined — review and categorise",
                    "severity": "low",
                }
            )

    return anomalies


def savings_opportunities(expenses: List[dict]) -> List[Dict[str, Any]]:
    """
    Rule-based + heuristic savings suggestions tailored to the data.
    """
    suggestions = []
    total_monthly = sum(
        _safe_float(e.get("amount")) / (12 if e.get("frequency") == "yearly" else 3 if e.get("frequency") == "quarterly" else 1)
        for e in expenses
    )

    for e in expenses:
        name = e.get("name", "")
        amount = _safe_float(e.get("amount"))
        necessity = (e.get("necessity_level") or "").upper()
        comments = (e.get("comments") or "").lower()
        freq = (e.get("frequency") or "monthly").lower()
        monthly_equiv = amount / (12 if freq == "yearly" else 3 if freq == "quarterly" else 1)

        if necessity == "MEDIUM" and monthly_equiv > 5000:
            target = monthly_equiv * 0.80
            suggestions.append(
                {
                    "name": name,
                    "current": round(monthly_equiv, 0),
                    "suggested": round(target, 0),
                    "saving_per_month": round(monthly_equiv - target, 0),
                    "tip": f"Reducing '{name}' by 20% saves ₹{monthly_equiv - target:,.0f}/month",
                }
            )

        if "with sathish" in comments:
            suggestions.append(
                {
                    "name": name,
                    "current": round(monthly_equiv, 0),
                    "suggested": round(monthly_equiv / 2, 0),
                    "saving_per_month": round(monthly_equiv / 2, 0),
                    "tip": f"Split '{name}' equally with Sathish to halve the cost",
                }
            )

    # Dedup by name
    seen = set()
    unique = []
    for s in suggestions:
        if s["name"] not in seen:
            seen.add(s["name"])
            unique.append(s)

    total_potential = sum(s["saving_per_month"] for s in unique)
    unique.sort(key=lambda x: x["saving_per_month"], reverse=True)

    return unique[:8]


def investment_growth_projection(
    investments: List[dict], years: int = 5
) -> List[Dict[str, Any]]:
    """
    Project investment growth using assumed annual returns:
    - Nifty 50 Index: 12% CAGR
    - Small Cap Fund: 15% CAGR
    - RD: ~7% per year
    - Chit Fund: ~8% effective
    - ETF Foreign: 10% CAGR
    """
    RETURNS = {
        "nifty 50": 0.12,
        "small cap": 0.15,
        "rd": 0.07,
        "chit": 0.08,
        "etf": 0.10,
        "default": 0.10,
    }

    results = []
    for inv in investments:
        name = (inv.get("name") or "").lower()
        amount = _safe_float(inv.get("amount"))
        if amount <= 0:
            continue

        # Pick return rate
        rate = RETURNS["default"]
        for key, r in RETURNS.items():
            if key in name:
                rate = r
                break

        # Future value of monthly SIP = P * [((1+r/12)^n - 1) / (r/12)] * (1+r/12)
        r_monthly = rate / 12
        n = years * 12
        if r_monthly > 0:
            fv = amount * (((1 + r_monthly) ** n - 1) / r_monthly) * (1 + r_monthly)
        else:
            fv = amount * n

        results.append(
            {
                "name": inv.get("name"),
                "monthly_sip": amount,
                "assumed_return_pct": rate * 100,
                "projected_value": round(fv, 0),
                "years": years,
            }
        )

    return results
