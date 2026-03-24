"""
ML Predictor Service
- Monthly expense prediction with multi-month linear regression trend
- Statistical Z-score anomaly detection
- Savings opportunity analysis (50/30/20 rule)
- Budget health score (0-100)
- Investment growth projection
"""
from typing import List, Dict, Any, Tuple
import math
from collections import defaultdict


MONTHLY_INCOME = 118655  # Divya's in-hand salary (from CSV)

# ──────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────

def _linear_regression(points: List[Tuple[float, float]]) -> Tuple[float, float, float]:
    """
    Fit y = a + b*x via ordinary least squares.
    Returns (intercept, slope, r_squared).
    r_squared is -1 if fewer than 2 points.
    """
    n = len(points)
    if n < 2:
        return (points[0][1] if points else 0.0, 0.0, -1.0)
    sx = sum(p[0] for p in points)
    sy = sum(p[1] for p in points)
    sxx = sum(p[0] ** 2 for p in points)
    sxy = sum(p[0] * p[1] for p in points)
    denom = n * sxx - sx * sx
    if denom == 0:
        return (sy / n, 0.0, 0.0)
    b = (n * sxy - sx * sy) / denom
    a = (sy - b * sx) / n
    # R²
    y_mean = sy / n
    ss_tot = sum((p[1] - y_mean) ** 2 for p in points)
    ss_res = sum((p[1] - (a + b * p[0])) ** 2 for p in points)
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0
    return (a, b, max(0.0, r2))


def _month_index(month: int, year: int) -> int:
    """Convert (month, year) to a sequential integer for regression."""
    return year * 12 + month


def _safe_float(v) -> float:
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def _monthly_equiv(amount: float, freq: str) -> float:
    freq = (freq or "monthly").lower()
    if freq == "yearly":
        return amount / 12
    if freq == "quarterly":
        return amount / 3
    return amount


def get_monthly_expenses(expenses: List[dict]) -> Dict[str, float]:
    """Normalise all expenses to a monthly equivalent amount."""
    monthly: Dict[str, float] = {}
    for e in expenses:
        amount = _safe_float(e.get("amount"))
        if amount <= 0:
            continue
        monthly[e["name"]] = _monthly_equiv(amount, e.get("frequency", "monthly"))
    return monthly


def _group_by_month(expenses: List[dict]) -> Dict[Tuple[int, int], Dict[str, float]]:
    """
    Group expenses by (data_year, data_month) → {category: total_monthly_equiv}.
    Expenses without data_month/data_year land in a sentinel (0, 0) bucket.
    """
    buckets: Dict[Tuple[int, int], Dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for e in expenses:
        amount = _safe_float(e.get("amount"))
        if amount <= 0:
            continue
        m = e.get("data_month") or 0
        y = e.get("data_year") or 0
        cat = e.get("expense_type") or "other"
        buckets[(y, m)][cat] += _monthly_equiv(amount, e.get("frequency", "monthly"))
    return dict(buckets)


def predict_next_month(expenses: List[dict]) -> Dict[str, Any]:
    """
    Predict next month's expenses by category.
    - When ≥2 months of historical data exist for a category, uses
      Ordinary Least Squares linear regression to project the trend.
    - For single-month categories, applies a 2% inflation nudge.
    - Confidence is computed from the average regression R² and the
      number of distinct months in the data set.
    """
    # Collect per-month category totals (skip sentinel bucket)
    buckets = _group_by_month(expenses)
    real_buckets = {k: v for k, v in buckets.items() if k != (0, 0)}

    # Current snapshot (latest month or sentinel)
    if real_buckets:
        latest_key = max(real_buckets.keys())
        current = real_buckets[latest_key]
        next_idx = _month_index(latest_key[1], latest_key[0]) + 1
    else:
        # Fall back to sentinel bucket
        current = buckets.get((0, 0), {})
        next_idx = None

    # Collect all categories across all months
    all_cats = set(current.keys())
    for v in real_buckets.values():
        all_cats.update(v.keys())
    if not all_cats:
        for e in expenses:
            all_cats.add(e.get("expense_type") or "other")

    predicted: Dict[str, float] = {}
    r2_scores: List[float] = []

    for cat in all_cats:
        if len(real_buckets) >= 2 and next_idx is not None:
            sorted_keys = sorted(real_buckets.keys())
            # Use relative indices (0, 1, 2...) for numerical stability
            points = []
            for idx, k in enumerate(sorted_keys):
                val = real_buckets[k].get(cat, 0.0)
                if val > 0:
                    points.append((float(idx), val))

            if len(points) >= 2:
                a, b, r2 = _linear_regression(points)
                next_rel = float(len(sorted_keys))  # one step beyond last
                raw = a + b * next_rel
                # Safety cap: don't extrapolate more than 30% beyond last observed
                last_val = real_buckets[sorted_keys[-1]].get(cat, points[-1][1])
                raw = max(last_val * 0.70, min(raw, last_val * 1.30))
                r2_scores.append(r2)
            else:
                raw = current.get(cat, 0.0) * 1.02
                r2_scores.append(0.5)
        else:
            # Single month → 2% nudge for recurring categories
            raw = current.get(cat, 0.0)
            if cat in ("living", "debt"):
                raw *= 1.02
            r2_scores.append(0.5)

        predicted[cat] = round(max(0.0, raw), 2)

    n_months = len(real_buckets)
    avg_r2 = sum(r2_scores) / len(r2_scores) if r2_scores else 0.5
    # Confidence scales from 0.60 (1 month) to 0.95 (6+ months), weighted by R²
    month_factor = min(1.0, n_months / 6) if n_months > 0 else 0.0
    confidence = round(0.55 + 0.40 * month_factor * (0.5 + 0.5 * avg_r2), 2)

    predicted_total = sum(predicted.values())

    # Category growth rates (% vs current month)
    growth_rates: Dict[str, float] = {}
    for cat, val in predicted.items():
        base = current.get(cat, 0.0)
        if base > 0:
            growth_rates[cat] = round((val - base) / base * 100, 1)
        else:
            growth_rates[cat] = 0.0

    return {
        "by_category": predicted,
        "growth_rates": growth_rates,
        "predicted_total": round(predicted_total, 2),
        "confidence": confidence,
        "income": MONTHLY_INCOME,
        "projected_savings": round(MONTHLY_INCOME - predicted_total, 2),
        "months_of_data": n_months,
    }


def detect_anomalies(expenses: List[dict]) -> List[Dict[str, Any]]:
    """
    Flag expenses that look anomalous using:
    1. Z-score within each category (flags items > 2σ above mean)
    2. Hardcoded threshold: monthly equiv > 25% of income
    3. Medium-necessity items costing > ₹10,000/month
    4. Items with undefined necessity level
    """
    # Compute per-category statistics
    cat_amounts: Dict[str, List[float]] = defaultdict(list)
    for e in expenses:
        amount = _safe_float(e.get("amount"))
        if amount <= 0:
            continue
        cat = e.get("expense_type") or "other"
        cat_amounts[cat].append(_monthly_equiv(amount, e.get("frequency", "monthly")))

    cat_stats: Dict[str, Tuple[float, float]] = {}  # cat → (mean, std)
    for cat, vals in cat_amounts.items():
        mean = sum(vals) / len(vals)
        variance = sum((v - mean) ** 2 for v in vals) / len(vals) if len(vals) > 1 else 0
        cat_stats[cat] = (mean, math.sqrt(variance))

    anomalies = []
    for e in expenses:
        amount = _safe_float(e.get("amount"))
        if amount <= 0:
            continue
        necessity = (e.get("necessity_level") or "").upper()
        name = e.get("name", "Unknown")
        cat = e.get("expense_type") or "other"
        monthly_equiv = _monthly_equiv(amount, e.get("frequency", "monthly"))

        mean, std = cat_stats.get(cat, (monthly_equiv, 0))

        # Z-score anomaly within category
        if std > 0:
            z = (monthly_equiv - mean) / std
            if z > 2.0:
                anomalies.append({
                    "name": name,
                    "amount": amount,
                    "reason": (
                        f"Statistical outlier in '{cat}': ₹{monthly_equiv:,.0f}/mo is "
                        f"{z:.1f}σ above the category average of ₹{mean:,.0f}"
                    ),
                    "severity": "high" if z > 3.0 else "medium",
                    "z_score": round(z, 2),
                })
                continue  # don't double-flag

        # High absolute share of income
        if monthly_equiv > MONTHLY_INCOME * 0.25:
            anomalies.append({
                "name": name,
                "amount": amount,
                "reason": (
                    f"High spend: ₹{monthly_equiv:,.0f}/mo is "
                    f"{monthly_equiv / MONTHLY_INCOME * 100:.1f}% of monthly income"
                ),
                "severity": "high",
                "z_score": None,
            })
        elif necessity == "MEDIUM" and monthly_equiv > 10000:
            anomalies.append({
                "name": name,
                "amount": amount,
                "reason": (
                    f"Medium-necessity item costing ₹{monthly_equiv:,.0f}/mo — consider reducing"
                ),
                "severity": "medium",
                "z_score": None,
            })
        elif necessity in ("TBD", "") and amount > 0:
            anomalies.append({
                "name": name,
                "amount": amount,
                "reason": "Necessity level not defined — review and categorise",
                "severity": "low",
                "z_score": None,
            })

    # Sort by severity then amount
    severity_order = {"high": 0, "medium": 1, "low": 2}
    anomalies.sort(key=lambda x: (severity_order.get(x["severity"], 3), -x["amount"]))
    return anomalies


def savings_opportunities(expenses: List[dict]) -> List[Dict[str, Any]]:
    """
    Rule-based + heuristic savings suggestions.
    Now includes 50/30/20 rule breaches as suggestions.
    """
    suggestions = []

    # 50/30/20 analysis
    needs_total = 0.0
    wants_total = 0.0
    savings_total = 0.0
    for e in expenses:
        amount = _safe_float(e.get("amount"))
        if amount <= 0:
            continue
        mequiv = _monthly_equiv(amount, e.get("frequency", "monthly"))
        etype = (e.get("expense_type") or "other").lower()
        necessity = (e.get("necessity_level") or "").upper()

        if etype in ("investment",):
            savings_total += mequiv
        elif etype in ("debt", "insurance"):
            needs_total += mequiv
        elif etype == "living":
            if necessity == "HIGH":
                needs_total += mequiv
            else:
                wants_total += mequiv
        else:
            wants_total += mequiv

    target_needs = MONTHLY_INCOME * 0.50
    target_wants = MONTHLY_INCOME * 0.30
    target_savings = MONTHLY_INCOME * 0.20

    if needs_total > target_needs:
        over = needs_total - target_needs
        suggestions.append({
            "name": "Needs spending (50% rule)",
            "current": round(needs_total, 0),
            "suggested": round(target_needs, 0),
            "saving_per_month": round(over, 0),
            "tip": f"Needs are ₹{over:,.0f}/mo over the 50% guideline — review fixed living costs",
            "category": "rule",
        })

    if wants_total > target_wants:
        over = wants_total - target_wants
        suggestions.append({
            "name": "Wants spending (30% rule)",
            "current": round(wants_total, 0),
            "suggested": round(target_wants, 0),
            "saving_per_month": round(over, 0),
            "tip": f"Discretionary spend is ₹{over:,.0f}/mo over the 30% guideline — trim non-essentials",
            "category": "rule",
        })

    if savings_total < target_savings:
        gap = target_savings - savings_total
        suggestions.append({
            "name": "Savings gap (20% rule)",
            "current": round(savings_total, 0),
            "suggested": round(target_savings, 0),
            "saving_per_month": round(gap, 0),
            "tip": f"Investing ₹{gap:,.0f}/mo more would hit the 20% savings target",
            "category": "rule",
        })

    # Per-item heuristics
    for e in expenses:
        name = e.get("name", "")
        amount = _safe_float(e.get("amount"))
        necessity = (e.get("necessity_level") or "").upper()
        comments = (e.get("comments") or "").lower()
        monthly_equiv = _monthly_equiv(amount, e.get("frequency", "monthly"))

        if necessity == "MEDIUM" and monthly_equiv > 5000:
            target = monthly_equiv * 0.80
            suggestions.append({
                "name": name,
                "current": round(monthly_equiv, 0),
                "suggested": round(target, 0),
                "saving_per_month": round(monthly_equiv - target, 0),
                "tip": f"Reducing '{name}' by 20% saves ₹{monthly_equiv - target:,.0f}/mo",
                "category": "discretionary",
            })

        if "with sathish" in comments:
            suggestions.append({
                "name": name,
                "current": round(monthly_equiv, 0),
                "suggested": round(monthly_equiv / 2, 0),
                "saving_per_month": round(monthly_equiv / 2, 0),
                "tip": f"Split '{name}' equally with Sathish to halve the cost",
                "category": "shared",
            })

    # Dedup by name
    seen: set = set()
    unique = []
    for s in suggestions:
        if s["name"] not in seen:
            seen.add(s["name"])
            unique.append(s)

    unique.sort(key=lambda x: x["saving_per_month"], reverse=True)
    return unique[:10]


def budget_health_score(expenses: List[dict]) -> Dict[str, Any]:
    """
    Return a 0-100 budget health score with a breakdown by pillar:
    - Savings rate (35 pts): target ≥ 20% of income
    - Debt load      (25 pts): target ≤ 20% of income
    - Investment rate (25 pts): target ≥ 15% of income
    - Categorisation  (15 pts): % of items with fully-defined necessity + type
    """
    total_monthly = 0.0
    debt_monthly = 0.0
    invest_monthly = 0.0
    defined_items = 0
    total_items = 0

    for e in expenses:
        amount = _safe_float(e.get("amount"))
        if amount <= 0:
            continue
        mequiv = _monthly_equiv(amount, e.get("frequency", "monthly"))
        etype = (e.get("expense_type") or "").lower()
        necessity = (e.get("necessity_level") or "").upper()

        total_monthly += mequiv
        total_items += 1

        if etype == "debt":
            debt_monthly += mequiv
        if etype == "investment":
            invest_monthly += mequiv
        if necessity not in ("TBD", "") and etype not in ("", "other"):
            defined_items += 1

    savings_monthly = max(0.0, MONTHLY_INCOME - total_monthly)

    # Component scores
    savings_rate = savings_monthly / MONTHLY_INCOME if MONTHLY_INCOME > 0 else 0
    debt_rate = debt_monthly / MONTHLY_INCOME if MONTHLY_INCOME > 0 else 0
    invest_rate = invest_monthly / MONTHLY_INCOME if MONTHLY_INCOME > 0 else 0
    defined_rate = defined_items / total_items if total_items > 0 else 0

    savings_score = min(35, round(35 * min(1.0, savings_rate / 0.20)))
    debt_score = min(25, round(25 * max(0.0, 1 - debt_rate / 0.20)))
    invest_score = min(25, round(25 * min(1.0, invest_rate / 0.15)))
    cat_score = min(15, round(15 * defined_rate))
    total_score = savings_score + debt_score + invest_score + cat_score

    def grade(s: int) -> str:
        if s >= 85: return "Excellent"
        if s >= 70: return "Good"
        if s >= 55: return "Fair"
        if s >= 40: return "Needs Work"
        return "At Risk"

    return {
        "score": total_score,
        "grade": grade(total_score),
        "pillars": {
            "savings_rate": {
                "score": savings_score,
                "max": 35,
                "actual_pct": round(savings_rate * 100, 1),
                "target_pct": 20,
            },
            "debt_load": {
                "score": debt_score,
                "max": 25,
                "actual_pct": round(debt_rate * 100, 1),
                "target_pct": 20,
            },
            "investment_rate": {
                "score": invest_score,
                "max": 25,
                "actual_pct": round(invest_rate * 100, 1),
                "target_pct": 15,
            },
            "categorisation": {
                "score": cat_score,
                "max": 15,
                "actual_pct": round(defined_rate * 100, 1),
                "target_pct": 100,
            },
        },
        "income": MONTHLY_INCOME,
        "total_monthly_expenses": round(total_monthly, 2),
        "monthly_savings": round(savings_monthly, 2),
    }


def rule_analysis(expenses: List[dict]) -> Dict[str, Any]:
    """
    50/30/20 breakdown — actual vs recommended.
    Returns allocations and per-bucket item lists.
    """
    needs: List[dict] = []
    wants: List[dict] = []
    savings_bucket: List[dict] = []

    for e in expenses:
        amount = _safe_float(e.get("amount"))
        if amount <= 0:
            continue
        mequiv = _monthly_equiv(amount, e.get("frequency", "monthly"))
        etype = (e.get("expense_type") or "other").lower()
        necessity = (e.get("necessity_level") or "").upper()
        item = {"name": e.get("name", ""), "monthly": round(mequiv, 0)}

        if etype == "investment":
            savings_bucket.append(item)
        elif etype in ("debt", "insurance"):
            needs.append(item)
        elif etype == "living":
            if necessity == "HIGH":
                needs.append(item)
            else:
                wants.append(item)
        else:
            wants.append(item)

    def _total(bucket): return sum(i["monthly"] for i in bucket)

    needs_total = _total(needs)
    wants_total = _total(wants)
    savings_total = _total(savings_bucket)
    grand_total = needs_total + wants_total + savings_total

    def _pct(v): return round(v / MONTHLY_INCOME * 100, 1) if MONTHLY_INCOME > 0 else 0

    return {
        "income": MONTHLY_INCOME,
        "needs": {
            "total": round(needs_total, 0),
            "pct_of_income": _pct(needs_total),
            "target_pct": 50,
            "items": sorted(needs, key=lambda x: -x["monthly"])[:10],
        },
        "wants": {
            "total": round(wants_total, 0),
            "pct_of_income": _pct(wants_total),
            "target_pct": 30,
            "items": sorted(wants, key=lambda x: -x["monthly"])[:10],
        },
        "savings": {
            "total": round(savings_total, 0),
            "pct_of_income": _pct(savings_total),
            "target_pct": 20,
            "items": sorted(savings_bucket, key=lambda x: -x["monthly"])[:10],
        },
    }


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
