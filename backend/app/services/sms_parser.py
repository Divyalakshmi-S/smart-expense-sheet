"""
SMS Parser Service
Parses Indian bank transaction SMS messages into structured data.
Covers HDFC, ICICI, SBI, Axis, Kotak, YES Bank, IndusInd, IDFC FIRST,
Federal, PNB, Union Bank, RBL, DBS, Paytm Payments Bank, Indian Bank.

SMS classification:
  is_ignorable=True  : OTP, collect-request approvals, vague refund notices,
                       non-account-credit notifications (dividend advisories, etc.)
  txn_type='collect_request' : PhonePe/GPay UPI collect-request (PENDING approval)
  txn_type='debit'/'credit'  : Actual completed transaction
"""
import re
from datetime import datetime
from typing import Optional, Dict, Any

_AMT = re.compile(r'(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)', re.IGNORECASE)
# SBI UPI format: "debited by 329.00" / "credited by 500.00" — no currency symbol
_AMT_BARE = re.compile(r'\b(?:debited|credited)\s+(?:by|for|with)\s+([\d,]+(?:\.\d{1,2})?)\b', re.IGNORECASE)
_DEBIT = re.compile(r'\b(?:debited?|spent|paid|withdrawn?|deducted|purchase[d]?|charged|sent|transferred|payment\s+of|payment\s+done|payment\s+successful)\b', re.IGNORECASE)
_CREDIT = re.compile(r'\b(?:credited?|deposited?|refund(?:ed)?|cashback|reversed?|added|received\s+in|received\s+from|money\s+received)\b', re.IGNORECASE)
_ACCT = re.compile(r'(?:a/?c|acct?|account|card|ac)[\s\w#.]*?(?:no\.?\s*)?(?:x+|ending\s*(?:in\s*)?\.+|\*)(\d{4})\b', re.IGNORECASE)
_UPI_REF = re.compile(r'(?:upi\s*:?\s*(?:ref(?:erence)?\s*(?:no\.?)?|txn|transaction)?\s*:?\s*|ref\s*(?:no\.?\s*)?|txn\s*id\s*:?\s*|refno\s*)(\d{10,12})', re.IGNORECASE)
_BAL = re.compile(
    r'(?:avail?able?\s*(?:bal(?:ance)?|bal\.?)?|avl\.?\s*bal\.?|balance)'
    r'\s*(?:is\s*)?'                # optional "is"
    r'(?:(?:INR|Rs\.?|\u20b9)\s*)?'  # optional currency BEFORE colon/equals
    r'[:=]?\s*'                     # optional colon/equals
    r'(?:(?:INR|Rs\.?|\u20b9)\s*)?'  # optional currency AFTER colon (e.g.  "Available Balance: Rs.")
    r'([\d,]+(?:\.\d{1,2})?)',
    re.IGNORECASE
)
_DATE = re.compile(r'\b(\d{1,2}[\/-]\w{3}[\/-]\d{2,4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+\w{3}\s+\d{4}|\d{1,2}\w{3}\d{2,4})\b', re.IGNORECASE)

# ----- merchant patterns (tried in order) -----
# "to VPA handle@bank" or "to handle@bank"
_MERCHANT_VPA = re.compile(r'\bto\s+(?:VPA\s+)?[\w.\-]+@[\w\-]+\b', re.IGNORECASE)
# "by a/c linked to VPA handle@bank" — for credits from UPI sender
_MERCHANT_VPA_BY = re.compile(r'\bby\s+a/?c\s+linked\s+to\s+VPA\s+([\w.\-]+)@[\w\-]+\b', re.IGNORECASE)# "debited for Rs X; MERCHANT credited" — ICICI bank format
_MERCHANT_ICICI_DEBIT = re.compile(r'debited\s+for\s+Rs\s*[\d,]+(?:\.\d+)?\s+on\s+[\d\-\w]+;\s*([\w][\w .\-&\']{1,40})\s+credited', re.IGNORECASE)# "to MERCHANT_NAME. UPI:ref" — Indian Bank pattern
_MERCHANT_TO_DOT = re.compile(r'\bto\s+([A-Z][\w \-&.]{1,40}?)\s*\.\s*UPI:', re.IGNORECASE)
# "to/for NAME via UPI"
_MERCHANT_TO_VIA = re.compile(r'\b(?:to|for)\s+([A-Z][A-Z0-9 \-&]{2,30})\s+via\s+UPI\b', re.IGNORECASE)
# Info: ACH*MERCHANT*xxx or Info: NEFT-...-DESCRIPTION
_MERCHANT_ACH = re.compile(r'Info[:\s]+ACH\*([A-Z0-9][A-Z0-9 &.\-]{1,40})\*', re.IGNORECASE)
_MERCHANT_NEFT = re.compile(r'Info[:\s]+(?:NEFT|IMPS)-[A-Z0-9]+-([A-Z][A-Z0-9 \-&]{1,30})', re.IGNORECASE)
# "at MERCHANT on/for/via/. " — stop before date-like tokens
# NOTE: use {2,30} (greedy, lookahead stops it); {2,30?} is invalid inside braces.
_MERCHANT_AT = re.compile(
    r'\bat\s+([A-Z0-9][A-Z0-9 \-&\']{2,30})'
    r'(?=\s+on\s+\d|\s+for\b|\s+via\b|\.|,|$)',
    re.IGNORECASE
)
# "MERCHANT has requested money" — PhonePe collect
_MERCHANT_COLLECT = re.compile(r'^([\w][\w &.]{2,40})\s+has\s+requested\s+money', re.IGNORECASE)
# "trf to MERCHANT Refno" — SBI UPI format
_MERCHANT_TRF = re.compile(r'\btrf\s+to\s+([A-Z][A-Z0-9 \-&.]{1,30}?)(?:\s+(?:Refno|Ref\s*no|UPI\b)|[.,]|$)', re.IGNORECASE)

# ----- ignore / classification patterns -----
# True ignore: OTP, PIN, spam — mark is_ignorable=True, store nothing
_IGNORE = re.compile(
    r'\b(?:otp|one.?time.?password|pin.?otp|green.?pin|password|'
    r'login|verification\s+code|security\s+code)\b',
    re.IGNORECASE
)
# "payment received" FROM the user (utility biller confirming they got money)
# NOT a credit to the user's bank account
_PAYMENT_RECEIVED_BY_BILLER = re.compile(
    r'payment\s+of\s+Rs\.?\s*[\d,]+(?:\.\d+)?\s+for\s+your\s+',
    re.IGNORECASE
)
# Vague future/conditional refund notices with no real transaction
_VAGUE_REFUND = re.compile(
    r'(?:will\s+get\s+refunded|refunded\s+within|check\s+back\s+later|'
    r'any\s+amount\s+if\s+debited)',
    re.IGNORECASE
)
# Dividend / corporate action advisories — not a direct account credit alert
_ADVISORY = re.compile(
    r'\b(?:paise\s+per\s+share|dividend\s+of|interim\s+dividend|'
    r'final\s+dividend|bonus\s+issue|stock\s+split)\b',
    re.IGNORECASE
)
# PhonePe / GPay UPI collect requests (pending, not yet approved)
_COLLECT_REQUEST = re.compile(
    r'(?:has\s+requested\s+money\s+from\s+you|will\s+be\s+debited\s+from\s+your\s+account\s+on\s+approving)',
    re.IGNORECASE
)

# Ordered list: more specific (multi-word) entries first so they win over shorter ones.
# _parse_bank uses \b word-boundary regex to avoid matching bank names inside IFSC codes.
_BANK_KEYWORDS: list = [
    ('paytm payments bank', 'Paytm Payments Bank'),
    ('paytm bank',          'Paytm Payments Bank'),
    ('idfc first',          'IDFC FIRST Bank'),
    ('idfcfirst',           'IDFC FIRST Bank'),
    ('indian bank',         'Indian Bank'),
    ('yes bank',            'YES Bank'),
    ('federal bank',        'Federal Bank'),
    ('punjab national',     'PNB'),
    ('union bank',          'Union Bank'),
    ('au small',            'AU Small Finance Bank'),
    ('au bank',             'AU Small Finance Bank'),
    ('jana bank',           'Jana Small Finance Bank'),
    ('phone pe',            'PhonePe'),
    ('phonepe',             'PhonePe'),
    ('google pay',          'Google Pay'),
    ('gpay',     'Google Pay'),
    ('hdfc',     'HDFC Bank'),
    ('icici',    'ICICI Bank'),
    ('sbi',      'SBI'),
    ('axis',     'Axis Bank'),
    ('kotak',    'Kotak Bank'),
    ('indusind', 'IndusInd Bank'),
    ('idfc',     'IDFC FIRST Bank'),
    ('pnb',      'PNB'),
    ('rbl',      'RBL Bank'),
    ('dbs',      'DBS Bank'),
    ('canara',   'Canara Bank'),
    ('boi',      'Bank of India'),
    ('baroda',   'Bank of Baroda'),
    ('bob',      'Bank of Baroda'),
    ('equitas',  'Equitas Bank'),
    ('citi',     'Citibank'),
]

_MERCHANT_CATEGORY = [
    (r'zomato|swiggy|dominos?|pizza|burger|kfc|mcdonald|starbucks|cafe|restaurant|food|dunzo|blinkit|zepto', 'food'),
    (r'amazon|flipkart|myntra|ajio|nykaa|meesho|snapdeal|shopclues|paytm\s*mall', 'shopping'),
    (r'uber|ola|rapido|meru|metro|irctc|redbus|makemytrip|goibibo|indigo|spicejet|air\s*india', 'transport'),
    (r'netflix|hotstar|disney|amazon\s*prime|spotify|youtube|zee5|sonyliv|jio\s*cinema', 'entertainment'),
    (r'airtel|jio|bsnl|vodafone|vi\b|idea|tata\s*play|dth|broadband|internet|recharge', 'utilities'),
    (r'electricity|bescom|bses|tata\s*power|adani|mseb|gas|water|piped|mahanagar', 'utilities'),
    (r'apollo|medplus|1mg|pharmeasy|netmeds|chemist|pharmacy|hospital|clinic|doctor|health', 'health'),
    (r'gym|cult\.fit|anytime\s*fitness', 'health'),
    (r'emi|loan|repay|bajaj\s*finance|tvs\s*credit', 'debt'),
    (r'sip|mutual\s*fund|zerodha|groww|smallcase|etf|nifty', 'investment'),
    (r'lic|insurance|max\s*life|sbi\s*life|bajaj\s*allianz|star\s*health|term', 'insurance'),
    (r'rent|housing|pg\b|co[\-\s]?live|nestaway|nobroker', 'living'),
    (r'salary|payroll', 'income'),
    # ATM/cash: match ATM as standalone merchant OR common cash-withdrawal phrases in body
    (r'\batm\b|atm\s*withdrawal|cash\s*withdrawal|cash\s*withdrawn|withdrawn\s+from\s+atm', 'cash'),
]


def _parse_amount(text: str) -> Optional[float]:
    m = _AMT.search(text)
    if m:
        return float(m.group(1).replace(',', ''))
    # Fallback: SBI UPI format uses bare numbers — "debited by 329.00"
    m = _AMT_BARE.search(text)
    return float(m.group(1).replace(',', '')) if m else None


def _parse_txn_type(text: str) -> str:
    """
    Determine transaction direction.

    ICICI uses "debited for Rs X; MERCHANT credited" where the trailing
    "credited" refers to the *recipient*, not the sender's account.
    We must check the first verb that applies to the ACCOUNT HOLDER.
    Strategy: find the first occurrence of any debit OR credit keyword that
    is NOT preceded by "to"/";" (which would make it apply to a third party).
    """
    # Pattern: "debited for/Rs/by" — account holder's perspective keyword
    # Find positions of all keyword matches, then pick earliest one whose
    # grammatical subject is the sender's account.

    # Quick path: if only one side present with no ambiguity
    d_match = _DEBIT.search(text)
    c_match = _CREDIT.search(text)

    if d_match and not c_match:
        return 'debit'
    if c_match and not d_match:
        return 'credit'
    if not d_match and not c_match:
        return 'unknown'

    # Both found — need context to choose the right one.
    # If the credit keyword is preceded by ";" or "to " within ~10 chars,
    # it refers to the recipient, not the account holder → it's a debit.
    c_pos = c_match.start()
    preceding = text[max(0, c_pos - 12):c_pos].strip()
    if re.search(r'(?:;|\bto)\s*$', preceding, re.IGNORECASE):
        return 'debit'

    # Otherwise go by whichever keyword appeared first
    return 'credit' if c_pos < d_match.start() else 'debit'


def _parse_bank(text: str) -> str:
    for kw, name in _BANK_KEYWORDS:
        # Word-boundary matching: 'hdfc' won't match inside 'HDFC0001234' (IFSC)
        # because both letters and digits are \w, so there's no \b between them.
        if re.search(r'\b' + re.escape(kw) + r'\b', text, re.IGNORECASE):
            return name
    return 'Unknown Bank'


def _parse_account(text: str) -> Optional[str]:
    m = _ACCT.search(text)
    return m.group(1) if m else None


def _parse_upi_ref(text: str) -> Optional[str]:
    m = _UPI_REF.search(text)
    return m.group(1) if m else None


def _parse_balance(text: str) -> Optional[float]:
    m = _BAL.search(text)
    if not m:
        return None
    try:
        return float(m.group(1).replace(',', ''))
    except ValueError:
        return None


def _parse_date(text: str) -> Optional[datetime]:
    m = _DATE.search(text)
    if not m:
        return None
    raw = m.group(1).strip()
    for fmt in ['%d-%b-%y', '%d-%b-%Y', '%d/%b/%y', '%d/%b/%Y',
                '%d-%m-%Y', '%d/%m/%Y', '%d-%m-%y', '%d/%m/%y',
                '%d %b %Y', '%d %b %y',
                '%d%b%y', '%d%b%Y']:  # compact: 13Mar26
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return None


def _clean_merchant(raw: str) -> Optional[str]:
    """Normalise a raw merchant string; return None if it's just a phone number."""
    name = raw.strip()
    # Strip leading junk like "O " that the VPA regex sometimes captures
    name = re.sub(r'^O\s+', '', name, flags=re.IGNORECASE)
    name = name.upper()
    # Strip trailing date fragments and legal noise words
    name = re.sub(r'\s+ON\s+\d.*$', '', name)  # e.g. "BIG BAZAAR ON 15-MAR-26"
    # Note: do NOT strip INDIA — it's a legitimate part of many brand names (Amazon India, Google India)
    name = re.sub(r'\s+(?:LTD|PVT|PRIVATE|LIMITED|DIGITAL|SERVICES|PVT\s+LTD)\.?$', '', name).strip()
    name = name.rstrip('.,- ')
    if not name or name.isdigit():
        return None
    return name


def _parse_merchant(text: str) -> Optional[str]:
    # 0. "by a/c linked to VPA" must be checked BEFORE generic _MERCHANT_VPA
    #    to avoid matching the "to VPA..." part of the same string
    m = _MERCHANT_VPA_BY.search(text)
    if m:
        return _clean_merchant(m.group(1))

    # 1. "debited for Rs X on DATE; MERCHANT credited" — ICICI debit format
    m = _MERCHANT_ICICI_DEBIT.search(text)
    if m:
        return _clean_merchant(m.group(1))

    # 2. "to VPA handle@bank" (debit UPI)
    m = _MERCHANT_VPA.search(text)
    if m:
        # Strip leading "to (VPA )" prefix; lazy r'^.*?to\s+' avoids leaving "O " artifact
        raw = re.sub(r'^.*?\bto\s+(?:VPA\s+)?', '', m.group(0), flags=re.IGNORECASE)
        handle = raw.split('@')[0].strip()
        return _clean_merchant(handle)

    # 3. "to NAME. UPI:ref" — Indian Bank / similar format
    m = _MERCHANT_TO_DOT.search(text)
    if m:
        return _clean_merchant(m.group(1))

    # 4. "trf to MERCHANT Refno" — SBI UPI format
    m = _MERCHANT_TRF.search(text)
    if m:
        return _clean_merchant(m.group(1))

    # 5. "MERCHANT has requested money" — PhonePe collect request
    m = _MERCHANT_COLLECT.search(text)
    if m:
        return _clean_merchant(m.group(1))

    # 6. Info: ACH*MERCHANT*ref
    m = _MERCHANT_ACH.search(text)
    if m:
        return _clean_merchant(m.group(1))

    # 7. Info: NEFT-CODE-DESCRIPTION
    m = _MERCHANT_NEFT.search(text)
    if m:
        return _clean_merchant(m.group(1))

    # 8. "to NAME via UPI"
    m = _MERCHANT_TO_VIA.search(text)
    if m:
        return _clean_merchant(m.group(1))

    # 9. "at MERCHANT on/for/via"
    m = _MERCHANT_AT.search(text)
    if m:
        return _clean_merchant(m.group(1))

    return None


def _auto_category(merchant: Optional[str], txn_type: str, text: str = '') -> str:
    if txn_type in ('ignored', 'collect_request'):
        return txn_type
    if txn_type == 'credit':
        return 'income'
    # Check merchant name first, then fall back to raw SMS text for keywords
    search_targets = [merchant or '', text]
    for target in search_targets:
        if not target:
            continue
        for pattern, cat in _MERCHANT_CATEGORY:
            if re.search(pattern, target, re.IGNORECASE):
                return cat
    return 'other'


def _classify_ignore(text: str) -> Optional[str]:
    """
    Return a reason string if this SMS should be silently ignored,
    or None if it's a real transaction/collect-request.

    Ignored categories:
      'otp'              : OTP / PIN-set messages
      'biller_confirm'   : Biller confirming receipt of YOUR payment (not a bank credit)
      'refund_notice'    : Vague "will be refunded" notices with no settled amount
      'advisory'         : Dividend / corporate-action advisories
    """
    if _IGNORE.search(text):
        return 'otp'
    if _VAGUE_REFUND.search(text):
        return 'refund_notice'
    if _ADVISORY.search(text):
        return 'advisory'
    if _PAYMENT_RECEIVED_BY_BILLER.search(text):
        return 'biller_confirm'
    return None


def parse_sms(text: str, received_at: Optional[str] = None) -> Dict[str, Any]:
    """Parse a single Indian bank SMS string into a structured dict."""
    received_dt = None
    if received_at:
        try:
            received_dt = datetime.fromisoformat(received_at)
        except ValueError:
            pass

    # 1. Check if this SMS should be completely ignored
    ignore_reason = _classify_ignore(text)
    if ignore_reason:
        return {
            'raw_text': text,
            'bank': _parse_bank(text),
            'txn_type': 'ignored',
            'amount': None,
            'merchant': None,
            'account_last4': None,
            'upi_ref': None,
            'balance_after': None,
            'txn_date': received_dt or datetime.utcnow(),
            'auto_category': 'ignored',
            'is_parseable': False,
            'ignore_reason': ignore_reason,
        }

    # 2. UPI collect request (pending approval) — record with special type
    is_collect = bool(_COLLECT_REQUEST.search(text))

    amount = _parse_amount(text)
    txn_type = 'collect_request' if is_collect else _parse_txn_type(text)
    merchant = _parse_merchant(text)
    txn_date = _parse_date(text)

    return {
        'raw_text': text,
        'bank': _parse_bank(text),
        'txn_type': txn_type,
        'amount': amount,
        'merchant': merchant,
        'account_last4': _parse_account(text),
        'upi_ref': _parse_upi_ref(text),
        'balance_after': _parse_balance(text),
        'txn_date': txn_date or received_dt or datetime.utcnow(),
        'auto_category': _auto_category(merchant, txn_type, text),
        'is_parseable': amount is not None and txn_type not in ('unknown', 'ignored', 'collect_request'),
        'ignore_reason': None,
    }


def parse_sms_batch(messages: list) -> list:
    """Parse a list of {text, received_at?} dicts."""
    return [parse_sms(m.get('text', ''), m.get('received_at')) for m in messages]


def _needs_llm(parsed: Dict[str, Any], text: str) -> bool:
    """True when regex parse is too ambiguous to trust (never call for ignored/collect SMS)."""
    if parsed['txn_type'] in ('ignored', 'collect_request'):
        return False
    return (
        parsed['txn_type'] == 'unknown'
        or parsed['amount'] is None
        or (parsed['merchant'] is None and '@' in text)
    )


def llm_enrich(parsed: Dict[str, Any], text: str, groq_api_key: str) -> Dict[str, Any]:
    """
    Fill in fields the regex couldn't determine using an LLM.

    Only called for ~5-10% of messages — when txn_type is unknown, amount is
    missing, or the merchant turned out to be a phone-number VPA that was
    filtered out.  Uses existing Groq/Llama via langchain_groq so no extra
    dependencies are needed.
    """
    if not _needs_llm(parsed, text) or not groq_api_key:
        return parsed

    try:
        from langchain_groq import ChatGroq
        from langchain_core.messages import HumanMessage
        import json

        llm = ChatGroq(api_key=groq_api_key, model="llama3-8b-8192", temperature=0)
        prompt = (
            "You are a bank SMS parser. Extract transaction details from this Indian bank "
            "SMS and return ONLY a valid JSON object with no extra text.\n\n"
            f"SMS: {text}\n\n"
            "Return JSON with these exact keys (use null if not found):\n"
            '- "txn_type": "debit", "credit", or "unknown"\n'
            '- "amount": number like 1234.56, or null\n'
            '- "merchant": business or person name as a string, or null '
            "(do NOT return a phone number or raw UPI VPA ID)\n"
            '- "bank": bank name as a string\n\n'
            'Example: {"txn_type": "debit", "amount": 500.00, "merchant": "Swiggy", "bank": "HDFC Bank"}'
        )

        response = llm.invoke([HumanMessage(content=prompt)])
        content = response.content.strip()

        # Strip markdown code fences if the model wraps its response
        fence = re.search(r'```(?:json)?\s*(.*?)\s*```', content, re.DOTALL)
        if fence:
            content = fence.group(1)

        llm_data = json.loads(content)

        if parsed['txn_type'] == 'unknown' and llm_data.get('txn_type') in ('debit', 'credit'):
            parsed['txn_type'] = llm_data['txn_type']
            parsed['auto_category'] = _auto_category(parsed['merchant'], parsed['txn_type'])

        if parsed['amount'] is None and llm_data.get('amount') is not None:
            try:
                parsed['amount'] = float(llm_data['amount'])
            except (TypeError, ValueError):
                pass

        if parsed['merchant'] is None and llm_data.get('merchant'):
            parsed['merchant'] = str(llm_data['merchant']).upper()
            parsed['auto_category'] = _auto_category(parsed['merchant'], parsed['txn_type'])

        parsed['is_parseable'] = parsed['amount'] is not None and parsed['txn_type'] != 'unknown'

    except Exception:
        pass  # Silently fall back to pure regex result

    return parsed
