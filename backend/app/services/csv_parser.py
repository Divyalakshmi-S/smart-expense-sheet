"""
CSV Parser Service
Handles the messy multi-section CSV format from the expense sheet.
"""
import csv
import io
import re
from typing import List, Optional


def parse_indian_amount(amount_str: str) -> Optional[float]:
    """Parse amounts formatted in Indian number system (e.g. 1,18,655 → 118655)."""
    if not amount_str:
        return None
    cleaned = amount_str.strip()
    if cleaned in ["-", "TBD", "NA", "", "0.00", "0"]:
        return 0.0 if cleaned == "0" or cleaned == "0.00" else None
    # Remove commas and parse
    cleaned = re.sub(r",", "", cleaned)
    try:
        return float(cleaned)
    except ValueError:
        return None


def determine_expense_type(category: str) -> str:
    c = category.lower().strip()
    if "investment" in c:
        return "investment"
    if "insurance" in c:
        return "insurance"
    if "debt" in c:
        return "debt"
    if any(k in c for k in ["living", "rental", "household", "family"]):
        return "living"
    return "other"


def infer_frequency(payment_date: str) -> str:
    d = payment_date.lower().strip()
    # Non-date placeholders — default to monthly
    if d in ("tbd", "na", "", "in need"):
        return "monthly"
    if "every month" in d or "monthly" in d or "of every month" in d:
        return "monthly"
    if "every year" in d or "yearly" in d or "annual" in d:
        return "yearly"
    # Named months only when followed by year context
    if ("may" in d or "august" in d) and "year" in d:
        return "yearly"
    if "dec" in d and ("year" in d or "every" in d):
        return "yearly"
    if "quarterly" in d:
        return "quarterly"
    return "monthly"


def parse_expense_csv(file_content: str) -> List[dict]:
    """
    Parse the expense sheet CSV into a list of structured expense dicts.
    Handles: empty rows, summary/total rows, Indian number format, TBD values.
    """
    reader = csv.DictReader(io.StringIO(file_content))
    expenses = []
    seen_names = set()

    for row in reader:
        # Skip fully empty rows
        values = [v.strip() for v in row.values() if v]
        if not values:
            continue

        category = (row.get("Category") or "").strip()
        name = (row.get("Expense Name") or "").strip()

        # Skip summary/total rows
        if name.lower() in {"total", ""}:
            continue
        if not name:
            continue

        # Skip duplicate header-like or TBD placeholder rows
        if category.upper() == "CATEGORY":
            continue

        amount_raw = (row.get("Amount") or "").strip()
        amount = parse_indian_amount(amount_raw)

        payment_date = (row.get("Date (If applicable)") or "").strip()
        incharge = (row.get("Incharge") or "").strip()
        comments = (row.get("Comments") or "").strip()
        necessity = (row.get("Neccessity Level") or "").strip()

        # Normalise category for multi-line cells
        category = " ".join(category.splitlines()).strip()
        name = " ".join(name.splitlines()).strip()

        # Deduplicate — include incharge so the same expense for different
        # people (e.g. Term Insurance for Divya vs Sathish) is kept
        key = f"{category}||{name}||{incharge}"
        if key in seen_names:
            continue
        seen_names.add(key)

        expense_type = determine_expense_type(category)
        frequency = infer_frequency(payment_date) if payment_date else "monthly"

        expenses.append(
            {
                "category": category or "Other",
                "expense_type": expense_type,
                "name": name,
                "amount": amount,
                "payment_date": payment_date,
                "incharge": incharge or "Unknown",
                "comments": comments,
                "necessity_level": necessity or "Medium",
                "is_recurring": True,
                "frequency": frequency,
            }
        )

    return expenses
