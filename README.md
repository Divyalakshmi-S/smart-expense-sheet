# Smart Expense Analyser 💰

An agentic, full-stack personal finance tool that parses your expense spreadsheet, analyses spending patterns, predicts future expenses, and lets you chat with an AI agent about your finances — all for free.

---

## Features

| Feature                    | Description                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| **CSV Import**             | Upload your multi-section expense sheet (supports Indian number format, TBD values, empty rows) |
| **Dashboard**              | KPI cards, monthly trend charts, category breakdown, responsibility split, top expenses         |
| **Predictions**            | ML-based next-month forecast, anomaly detection, savings opportunities                          |
| **Investment Projections** | 5- and 10-year SIP growth projections per asset class                                           |
| **AI Agent**               | Chat-based agent with 7 built-in analysis tools; uses Groq (free) with rule-based fallback      |
| **Dark Mode**              | Full dark/light theme toggle                                                                    |
| **Free Hosting**           | Deploy on Vercel (frontend) + Render (backend) at zero cost                                     |

---

## Project Structure

```
smart-expense-sheet/
├── divya-expense-sheet.csv       ← Sample expense data
├── render.yaml                   ← Render deployment config (backend)
├── .gitignore
│
├── backend/                      ← FastAPI Python backend
│   ├── main.py                   ← App entry point
│   ├── requirements.txt
│   ├── .env                      ← Local config (not committed)
│   ├── .env.example              ← Config template
│   └── app/
│       ├── config.py             ← Settings (env vars)
│       ├── database.py           ← SQLAlchemy + SQLite setup
│       ├── models.py             ← DB models (Expense, Transaction, etc.)
│       ├── schemas.py            ← Pydantic request/response models
│       ├── api/
│       │   ├── expenses.py       ← CRUD + CSV upload endpoints
│       │   ├── analytics.py      ← Summary, charts, breakdowns
│       │   ├── predictions.py    ← ML predictions, anomalies, savings
│       │   └── agent.py          ← AI agent chat & history
│       └── services/
│           ├── csv_parser.py     ← Parses the expense sheet CSV
│           ├── ml_predictor.py   ← Prediction, anomaly, investment ML
│           └── expense_agent.py  ← LangChain + Groq agentic AI
│
└── frontend/                     ← React 18 + TypeScript + Vite frontend
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── vercel.json               ← Vercel deployment config
    └── src/
        ├── App.tsx               ← Tab navigation, theme toggle
        ├── index.css             ← Tailwind base + custom classes
        ├── main.tsx              ← React root
        ├── types/index.ts        ← TypeScript type definitions
        ├── services/api.ts       ← Axios API client
        └── components/
            ├── Dashboard.tsx     ← Charts, KPIs, top expenses
            ├── ExpenseTable.tsx  ← Searchable/filterable expense list
            ├── Predictions.tsx   ← ML forecasts, anomalies, investments
            ├── AIAgent.tsx       ← Chat UI with AI agent
            └── UploadCSV.tsx     ← Drag-and-drop CSV import
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

# The .env file is already created with defaults.
# Optionally add a free Groq API key for LLM-powered chat
# (get one at https://console.groq.com — no credit card needed)
# edit .env and set: GROQ_API_KEY=your_key_here

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
3. Click **"Load Default (divya-expense-sheet.csv)"** to seed from the bundled CSV, OR drag-and-drop your own CSV file
4. Navigate to **Dashboard** — all charts and tables populate immediately

---

## Environment Variables

The backend reads from `backend/.env`:

| Variable       | Default                                       | Description                                                                                            |
| -------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `GROQ_API_KEY` | _(empty)_                                     | Free Groq LLM key for AI chat. Without it, the agent uses rule-based analysis (still fully functional) |
| `DATABASE_URL` | `sqlite:///./expense_analyser.db`             | SQLite by default. Replace with a PostgreSQL URL for production                                        |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Comma-separated list of allowed frontend origins                                                       |

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
| AI / Agent       | LangChain, Groq (Llama 3)                          |
| State Management | TanStack React Query                               |

---

## Free Hosting (Production)

### Backend → Render

1. Push the repo to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your repo — Render auto-detects `render.yaml`
4. Set the `GROQ_API_KEY` environment variable in the Render dashboard
5. Update `CORS_ORIGINS` to include your Vercel URL

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo, set **Root Directory** to `frontend`
3. Add environment variable: `VITE_API_URL=https://your-render-service.onrender.com/api`
4. Deploy

---

## CSV Format

The parser handles the multi-section expense sheet format with these columns:

```
Category, Expense Name, Amount, Date (If applicable), Incharge, Comments, Neccessity Level
```

Supported automatically:

- Indian number format: `1,18,655` → `118655`
- Multi-line category cells
- TBD / NA / blank amounts
- Empty rows and Total/summary rows skipped
- Sections: Living, Debt, Investments, Insurance
