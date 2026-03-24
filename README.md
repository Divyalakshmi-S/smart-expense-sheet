# Smart Expense Analyser 💰

An agentic, full-stack personal finance tool that parses your expense spreadsheet, ingests bank SMS transactions, analyses spending patterns, predicts future expenses, and lets you chat with an AI agent about your finances — all for free.

---

## Features

| Feature                    | Description                                                                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **CSV Import**             | Upload your multi-section expense sheet (supports Indian number format, TBD values, empty rows)                                                |
| **SMS Ingestion**          | Paste or forward bank SMS alerts — auto-parses ICICI, SBI, HDFC, Indian Bank, Axis, Kotak, YES Bank, IDFC FIRST, Paytm Payments Bank, and more |
| **Dashboard**              | KPI cards, monthly trend charts, category breakdown, responsibility split, top expenses                                                        |
| **Predictions**            | ML-based next-month forecast, anomaly detection, savings opportunities                                                                         |
| **Investment Projections** | 5- and 10-year SIP growth projections per asset class                                                                                          |
| **AI Agent**               | Chat-based agent with 7 built-in analysis tools; uses Groq (free) with rule-based fallback                                                     |
| **Dark Mode**              | Full dark/light theme toggle                                                                                                                   |
| **Free Hosting**           | Deploy on Vercel (frontend) + Render (backend) at zero cost                                                                                    |

---

## Project Structure

```
smart-expense-sheet/
├── render.yaml                    ← Render deployment config (backend)
├── .gitignore
├── README.md
│
├── backend/
│   ├── main.py                    ← App entry point (FastAPI)
│   ├── requirements.txt
│   ├── .env                       ← Local config (not committed)
│   ├── .env.example               ← Config template
│   ├── app/
│   │   ├── config.py              ← Settings (env vars via pydantic-settings)
│   │   ├── database.py            ← SQLAlchemy + SQLite setup + migrations
│   │   ├── models.py              ← DB models: Expense, Transaction, SmsTransaction, …
│   │   ├── schemas.py             ← Pydantic request/response models
│   │   ├── api/
│   │   │   ├── expenses.py        ← CRUD + CSV upload endpoints
│   │   │   ├── analytics.py       ← Summary, charts, category breakdowns
│   │   │   ├── predictions.py     ← ML predictions, anomalies, savings, health score
│   │   │   ├── agent.py           ← AI agent chat & history
│   │   │   └── integrations.py    ← SMS ingest, SMS transactions list & summary
│   │   └── services/
│   │       ├── csv_parser.py      ← Parses the expense sheet CSV
│   │       ├── ml_predictor.py    ← Prediction, anomaly, investment ML
│   │       ├── expense_agent.py   ← LangChain + Groq agentic AI (7 tools)
│   │       └── sms_parser.py      ← Regex-based Indian bank SMS parser (LLM fallback)
│   └── tests/                     ← Dev-only; excluded from prod deploys (.gitignore)
│       ├── test_sms_comprehensive.py  ← 54-case SMS parser test suite
│       ├── divya-expense-sheet.csv    ← Sample expense CSV
│       └── divya-expense-sheet-clean.csv
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── vercel.json                ← Vercel deployment config
    └── src/
        ├── App.tsx                ← Tab navigation, theme toggle
        ├── index.css              ← Tailwind base + custom classes
        ├── types/index.ts         ← TypeScript type definitions
        ├── services/api.ts        ← Axios API client
        └── components/
            ├── Dashboard.tsx      ← Charts, KPIs, top expenses
            ├── ExpenseTable.tsx   ← Searchable/filterable expense list
            ├── Predictions.tsx    ← ML forecasts, anomalies, investments
            ├── AIAgent.tsx        ← Chat UI with AI agent
            ├── UploadCSV.tsx      ← Drag-and-drop CSV import
            └── Integrations.tsx   ← SMS paste/ingest UI + transaction history
```

---

## Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **pip** and **npm**

---

## Running Locally

### 1. Clone / open the project

```bash
cd smart-expense-sheet
```

### 2. Backend

```bash
cd backend

# Install dependencies
pip3 install -r requirements.txt

# Copy the config template and optionally add your free Groq API key
# (get one at https://console.groq.com — no credit card needed)
cp .env.example .env
# edit .env → set GROQ_API_KEY=your_key_here

# Start the API server
uvicorn main:app --reload
```

API runs at **http://localhost:8000**  
Interactive API docs at **http://localhost:8000/docs**

### 3. Frontend

Open a new terminal tab:

```bash
cd frontend
npm install
npm run dev
```

App runs at **http://localhost:5173**

### 4. Load your expense data

1. Open `http://localhost:5173`
2. Go to the **Import** tab
3. Drag-and-drop your CSV, or click **"Load Default CSV"** to seed from the bundled sample
4. Navigate to **Dashboard** — charts and tables populate immediately

---

## Environment Variables

The backend reads from `backend/.env`:

| Variable           | Default                                       | Description                                                                                                             |
| ------------------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `GROQ_API_KEY`     | _(empty)_                                     | Free Groq LLM key for AI chat & SMS enrichment. Without it, the agent uses rule-based analysis (still fully functional) |
| `DATABASE_URL`     | `sqlite:///./expense_analyser.db`             | SQLite by default. Replace with a PostgreSQL URL for production                                                         |
| `CORS_ORIGINS`     | `http://localhost:5173,http://localhost:3000` | Comma-separated list of allowed frontend origins                                                                        |
| `SMS_INGEST_TOKEN` | _(empty)_                                     | Optional Bearer token to secure the `/api/integrations/sms` endpoint. Leave blank to disable auth                       |

The frontend reads from environment at build time:

| Variable       | Default                     | Description          |
| -------------- | --------------------------- | -------------------- |
| `VITE_API_URL` | `http://localhost:8000/api` | Backend API base URL |

---

## API Reference

### Expenses — `/api/expenses`

| Method   | Path                | Description                              |
| -------- | ------------------- | ---------------------------------------- |
| `GET`    | `/available-months` | Distinct months with data (newest first) |
| `GET`    | `/`                 | List expenses (filter by month/year)     |
| `POST`   | `/`                 | Create a new expense                     |
| `PUT`    | `/{id}`             | Update an expense                        |
| `DELETE` | `/{id}`             | Soft-delete an expense                   |
| `POST`   | `/upload`           | Upload CSV file                          |
| `POST`   | `/seed-default`     | Seed DB from bundled sample CSV          |

### Analytics — `/api/analytics`

| Method | Path            | Description                                          |
| ------ | --------------- | ---------------------------------------------------- |
| `GET`  | `/summary`      | Monthly totals, savings rate                         |
| `GET`  | `/categories`   | Breakdown by category                                |
| `GET`  | `/incharge`     | Breakdown by person responsible                      |
| `GET`  | `/necessity`    | Count by necessity level (High / Medium / Low / TBD) |
| `GET`  | `/top-expenses` | Top N expenses by amount                             |
| `GET`  | `/investments`  | Investment breakdown + 5/10-year projections         |
| `GET`  | `/trend`        | Per-month totals for last N months                   |

### Predictions — `/api/predictions`

| Method | Path                 | Description                                  |
| ------ | -------------------- | -------------------------------------------- |
| `GET`  | `/next-month`        | ML-based next-month forecast with confidence |
| `GET`  | `/anomalies`         | Detect spending anomalies (Z-score)          |
| `GET`  | `/savings`           | Savings opportunities using 50/30/20 rule    |
| `GET`  | `/investment-growth` | Investment projection for N years            |
| `GET`  | `/health-score`      | Budget health score (0–100)                  |
| `GET`  | `/rule-analysis`     | Validate 50/30/20 rule against actuals       |

### AI Agent — `/api/agent`

| Method | Path        | Description                                   |
| ------ | ----------- | --------------------------------------------- |
| `POST` | `/chat`     | Chat with the AI agent                        |
| `GET`  | `/history`  | Retrieve last 50 chat messages                |
| `GET`  | `/insights` | Auto-generate a proactive health check report |
| `GET`  | `/tools`    | List available analysis tools                 |

### Integrations (SMS) — `/api/integrations`

| Method | Path                | Description                                  |
| ------ | ------------------- | -------------------------------------------- |
| `POST` | `/sms`              | Ingest a single bank SMS transaction         |
| `POST` | `/sms/batch`        | Ingest multiple SMS messages in one call     |
| `GET`  | `/sms/transactions` | List SMS transactions (filter by days, type) |
| `GET`  | `/sms/summary`      | Per-category spend + top merchants from SMS  |

The ingest endpoints accept `Authorization: Bearer <SMS_INGEST_TOKEN>` when `SMS_INGEST_TOKEN` is set.

---

## SMS Feature

The **Integrations** tab lets you paste bank SMS messages directly into the UI. The parser handles:

- **Banks**: ICICI, SBI, HDFC, Indian Bank, Axis, Kotak, YES Bank, IDFC FIRST, IndusInd, Paytm Payments Bank, PhonePe, and more
- **Transaction types**: UPI debit/credit, NEFT, IMPS, RTGS, ATM withdrawal, card swipe (POS), EMI, ACH, collect requests
- **Auto-ignored**: OTPs, PINs, biller payment confirmations, vague refund notices, dividend advisories
- **Auto-category**: food, shopping, transport, entertainment, utilities, health, debt, investment, insurance, cash, living
- **LLM enrichment**: if `GROQ_API_KEY` is set and a merchant/category can't be determined by regex, Groq Llama3 fills it in

**Run the parser test suite** (dev only):

```bash
cd backend/tests
python3 test_sms_comprehensive.py
# Expected: 54/54 passed
```

---

## AI Agent

The AI Agent tab understands plain-English questions about your finances:

- _"Give me a complete financial health check"_
- _"Where can I save the most money?"_
- _"What bills are due this month?"_
- _"How are my investments growing?"_
- _"Any unusual or risky expenses?"_
- _"Predict my next month expenses"_

**Without a Groq key:** the agent uses keyword-based routing across 7 built-in analysis tools — fully functional, no internet needed.

**With a Groq key:** responses are generated by Llama 3 (8B) using all tool outputs as context, giving natural conversational answers.

---

## Tech Stack

| Layer            | Technology                                         |
| ---------------- | -------------------------------------------------- |
| Frontend         | React 18, TypeScript, Vite, Tailwind CSS, Recharts |
| Backend          | FastAPI, SQLAlchemy, SQLite                        |
| ML               | scikit-learn, pandas, numpy                        |
| AI / Agent       | LangChain, Groq (Llama 3 8B)                       |
| State Management | TanStack React Query                               |

---

## Free Hosting (Production)

### Backend → Render

1. Push the repo to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your repo — Render auto-detects `render.yaml`
4. Set environment variables in the Render dashboard:
   - `GROQ_API_KEY` — your Groq key
   - `CORS_ORIGINS` — `https://smartbudget-henna.vercel.app,http://localhost:5173`
   - `SMS_INGEST_TOKEN` — any random secret string to secure SMS ingestion

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo, set **Root Directory** to `frontend`
3. Add environment variable: `VITE_API_URL=https://smartbudget-me8c.onrender.com/api`
4. Deploy

---

## CSV Format

The parser handles the multi-section expense sheet format:

```
Category, Expense Name, Amount, Date (If applicable), Incharge, Comments, Neccessity Level
```

Supported automatically:

- Indian number format: `1,18,655` → `118655`
- Multi-line / merged category cells
- `TBD` / `NA` / blank amounts (treated as null)
- Expense types auto-classified from category name: `investment`, `insurance`, `debt`, `living`, `other`

- Empty rows and Total/summary rows skipped
- Sections: Living, Debt, Investments, Insurance
