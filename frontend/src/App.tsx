import { useState, useEffect } from 'react'
import type { ElementType } from 'react'
import { LayoutDashboard, Table2, TrendingUp, BrainCircuit, FileUp, Moon, Sun, Wallet, Smartphone } from 'lucide-react'
import Dashboard from './components/Dashboard'
import ExpenseTable from './components/ExpenseTable'
import Predictions from './components/Predictions'
import AIAgent from './components/AIAgent'
import UploadCSV from './components/UploadCSV'
import Integrations from './components/Integrations'
import type { Tab } from './types'
import clsx from 'clsx'

const TABS: { id: Tab; label: string; icon: ElementType; desc: string }[] = [
  { id: 'dashboard',     label: 'Overview',     icon: LayoutDashboard, desc: 'Charts & KPIs'         },
  { id: 'expenses',      label: 'Expenses',      icon: Table2,          desc: 'All line items'        },
  { id: 'predictions',   label: 'Forecast',      icon: TrendingUp,      desc: 'ML predictions'        },
  { id: 'agent',         label: 'Ask AI',        icon: BrainCircuit,    desc: 'Chat with your data'   },
  { id: 'upload',        label: 'Import CSV',    icon: FileUp,          desc: 'Upload expense sheet'  },
  { id: 'integrations',  label: 'SMS Sync',      icon: Smartphone,      desc: 'Auto-ingest bank SMS'  },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [dark, setDark] = useState(() =>
    localStorage.getItem('theme') === 'dark' ||
    (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-brand-50/30 to-emerald-50/30 dark:bg-none dark:bg-gray-950">
      {/* Topbar */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-gray-950/90 backdrop-blur-md border-b border-slate-200/60 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-sm">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <div className="leading-tight">
              <h1 className="text-sm font-extrabold tracking-tight gradient-text">SmartSheet</h1>
              <p className="text-[9px] text-slate-400 leading-none uppercase tracking-widest">Expense Analyser</p>
            </div>
          </div>

          {/* Desktop tabs */}
          <nav className="hidden md:flex items-center gap-0.5 ml-8 bg-slate-100/80 dark:bg-gray-800/60 rounded-2xl p-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                title={t.desc}
                className={clsx(
                  'flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all duration-200',
                  tab === t.id
                    ? 'bg-white dark:bg-gray-700 text-brand-700 dark:text-brand-300 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                )}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
                {t.id === 'agent' && (
                  <span className="text-[9px] bg-gradient-to-r from-brand-500 to-emerald-500 text-white px-1.5 py-0.5 rounded-full font-bold leading-none">AI</span>
                )}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setDark(d => !d)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle dark mode"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="md:hidden flex overflow-x-auto gap-1 px-3 pb-2">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={clsx(
                'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
                tab === t.id
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-gray-800'
              )}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Page header hint */}
        <div className="mb-5">
          {tab === 'dashboard'     && <PageHeader title="Financial Overview" sub="Your complete money picture for March 2026" />}
          {tab === 'expenses'      && <PageHeader title="All Expenses" sub="Search, filter and manage every line item" />}
          {tab === 'predictions'   && <PageHeader title="Forecast & Insights" sub="ML predictions, savings opportunities and anomalies" />}
          {tab === 'agent'         && <PageHeader title="Ask AI" sub="Chat with your expense data in plain English" />}
          {tab === 'upload'        && <PageHeader title="Import CSV" sub="Upload your expense spreadsheet to get started" />}
          {tab === 'integrations'  && <PageHeader title="SMS Integration" sub="Auto-ingest bank & UPI transaction alerts in real time" />}
        </div>
        {tab === 'dashboard'     && <Dashboard />}
        {tab === 'expenses'      && <ExpenseTable />}
        {tab === 'predictions'   && <Predictions />}
        {tab === 'agent'         && <AIAgent />}
        {tab === 'upload'        && <UploadCSV />}
        {tab === 'integrations'  && <Integrations />}
      </main>
    </div>
  )
}

function PageHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-slate-800 dark:text-white">{title}</h2>
      <p className="text-sm text-slate-400 mt-0.5">{sub}</p>
    </div>
  )
}
