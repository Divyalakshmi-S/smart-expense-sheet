import type { ElementType } from 'react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from 'recharts'
import {
  TrendingUp, Wallet, PiggyBank, IndianRupee,
  ArrowUpRight, ArrowDownRight, Info, AlertCircle, CheckCircle2, Upload, Calendar
} from 'lucide-react'
import { analyticsApi, expensesApi } from '../services/api'
import type { Summary, CategoryItem, MonthlyTrend, AvailableMonth } from '../types'

const INR = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN')

// Teal/green-led chart palette
const CHART_COLORS = ['#14b8a6', '#0d9488', '#f97316', '#8b5cf6', '#f59e0b', '#3b82f6', '#ec4899', '#10b981']

/* ─── Gradient KPI card ─────────────────────────────────────── */
function KpiCard({
  label, value, sub, icon: Icon, gradient, trend, trendLabel
}: {
  label: string; value: string; sub?: string; icon: ElementType
  gradient: string; trend?: 'up' | 'down' | 'neutral'; trendLabel?: string
}) {
  return (
    <div className={`card-colored ${gradient} relative overflow-hidden`}>
      <Icon className="absolute right-3 bottom-2 w-14 h-14 opacity-10 text-white" />
      <div className="relative z-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/70">{label}</p>
        <p className="text-3xl font-extrabold text-white mt-1">{value}</p>
        {sub && (
          <div className="flex items-center gap-1 mt-1.5">
            {trend === 'up' && <ArrowUpRight className="w-3.5 h-3.5 text-white/80" />}
            {trend === 'down' && <ArrowDownRight className="w-3.5 h-3.5 text-white/80" />}
            <p className="text-xs text-white/80">{sub}</p>
          </div>
        )}
        {trendLabel && <p className="text-xs mt-1 text-white/60">{trendLabel}</p>}
      </div>
    </div>
  )
}

/* ─── Budget progress bar ────────────────────────────────────── */
function BudgetBar({ label, spent, budget, color }: { label: string; spent: number; budget: number; color: string }) {
  const pct = Math.min((spent / budget) * 100, 100)
  const over = spent > budget
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-slate-700 dark:text-slate-300">{label}</span>
        <span className={`font-bold ${over ? 'text-rose-500' : 'text-slate-600 dark:text-slate-300'}`}>
          {INR(spent)} <span className="text-slate-400 font-normal">/ {INR(budget)}</span>
        </span>
      </div>
      <div className="w-full h-2.5 bg-slate-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-2.5 rounded-full transition-all duration-700 ${over ? 'bg-rose-500' : color}`}
          style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-right mt-0.5 text-slate-400">
        {over ? `⚠️ Over by ${INR(spent - budget)}` : `${INR(budget - spent)} remaining`}
      </p>
    </div>
  )
}

/* ─── Insight pill ───────────────────────────────────────────── */
function Insight({ type, text }: { type: 'good' | 'warn' | 'info'; text: string }) {
  const styles = {
    good: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
    warn: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    info: 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300',
  }
  const Icon = type === 'good' ? CheckCircle2 : type === 'warn' ? AlertCircle : Info
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${styles[type]}`}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  )
}

/* ─── Custom recharts tooltip ────────────────────────────────── */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl shadow-lg px-3 py-2 text-sm">
      {label && <p className="font-semibold text-slate-600 dark:text-slate-300 mb-1">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-medium">
          {p.name}: {INR(p.value)}
        </p>
      ))}
    </div>
  )
}

/* ─── Empty state ────────────────────────────────────────────── */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-28 gap-5 text-center">
      <div className="w-20 h-20 bg-gradient-to-br from-teal-100 to-emerald-100 dark:from-teal-900/30 dark:to-emerald-900/30 rounded-3xl flex items-center justify-center">
        <Upload className="w-9 h-9 text-teal-500" />
      </div>
      <div>
        <p className="text-xl font-bold text-slate-700 dark:text-slate-200">No data yet</p>
        <p className="text-sm text-slate-400 mt-1">
          Go to <strong>Import CSV</strong> tab and click <strong>"Load Default"</strong> to get started in seconds
        </p>
      </div>
      <div className="flex gap-4 text-xs text-slate-400 mt-2">
        {['Upload CSV', 'Auto-parse', 'View insights'].map((s, i) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-[11px]">{i + 1}</span>
            {s}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Main Dashboard ─────────────────────────────────────────── */
export default function Dashboard() {
  const [filterMonth, setFilterMonth] = useState<number | null>(null)
  const [filterYear, setFilterYear] = useState<number | null>(null)

  const { data: availableMonths } = useQuery<AvailableMonth[]>({
    queryKey: ['available-months'],
    queryFn: expensesApi.availableMonths,
  })
  const { data: summary } = useQuery<Summary>({
    queryKey: ['summary', filterMonth, filterYear],
    queryFn: () => analyticsApi.summary(filterMonth, filterYear),
  })
  const { data: categories } = useQuery<CategoryItem[]>({
    queryKey: ['categories', filterMonth, filterYear],
    queryFn: () => analyticsApi.categories(filterMonth, filterYear),
  })
  const { data: incharge } = useQuery({
    queryKey: ['incharge', filterMonth, filterYear],
    queryFn: () => analyticsApi.incharge(filterMonth, filterYear),
  })
  const { data: top } = useQuery({
    queryKey: ['top-expenses', filterMonth, filterYear],
    queryFn: () => analyticsApi.topExpenses(10, filterMonth, filterYear),
  })
  const { data: trendData } = useQuery<MonthlyTrend[]>({
    queryKey: ['trend'],
    queryFn: () => analyticsApi.trend(12),
  })

  if (!summary || summary.total_expenses_count === 0) return <EmptyState />

  const expPct = Math.round((summary.total_monthly_expenses / summary.income) * 100)
  const invPct = Math.round((summary.investment / summary.income) * 100)
  const savPct = summary.savings_rate

  // Use real trend data from API; fall back to a single point if only one month loaded
  const chartTrend = (trendData && trendData.length > 0)
    ? trendData.map(t => ({ month: t.month_label, expenses: t.total_expenses, savings: t.savings }))
    : [{ month: filterMonth && filterYear
            ? `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][filterMonth-1]} ${filterYear}`
            : 'Now',
         expenses: summary.total_monthly_expenses, savings: summary.savings }]

  const pieData = categories?.slice(0, 8).map((c: CategoryItem) => ({ name: c.category, value: Math.round(c.total) })) || []

  const typeData = [
    { name: 'Living',      value: Math.round(summary.living),    fill: '#14b8a6' },
    { name: 'Investments', value: Math.round(summary.investment), fill: '#10b981' },
    { name: 'Insurance',   value: Math.round(summary.insurance),  fill: '#8b5cf6' },
    { name: 'Debt',        value: Math.round(summary.debt),       fill: '#f97316' },
  ]

  const insights: { type: 'good' | 'warn' | 'info'; text: string }[] = []
  if (savPct >= 20)
    insights.push({ type: 'good', text: `Excellent! You're saving ${savPct}% of income — above the recommended 20% target.` })
  else if (savPct >= 10)
    insights.push({ type: 'warn', text: `Savings rate is ${savPct}%. Try to reach 20% by trimming discretionary spend.` })
  else
    insights.push({ type: 'warn', text: `Savings rate is only ${savPct}%. Review Medium-priority expenses to free up cash.` })

  if (expPct > 60)
    insights.push({ type: 'warn', text: `Expenses are ${expPct}% of income. Aim to keep living costs under 50%.` })
  else
    insights.push({ type: 'good', text: `Living expenses are ${expPct}% of income — within a healthy range.` })

  if (invPct >= 15)
    insights.push({ type: 'good', text: `You invest ${invPct}% of income. Great wealth-building habit!` })
  else
    insights.push({ type: 'info', text: `You invest ${invPct}% of income. Increasing SIPs by ₹1,000/month can meaningfully grow wealth over 10 years.` })

  const topExpenses = top as { name: string; category: string; incharge: string; monthly_amount: number; necessity_level: string }[] | undefined

  return (
    <div className="space-y-5">

      {/* ── Month Filter ───────────────────────────────────────── */}
      {availableMonths && availableMonths.length > 0 && (
        <div className="card py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="w-4 h-4 text-teal-500 shrink-0" />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">View:</span>
            <button
              onClick={() => { setFilterMonth(null); setFilterYear(null) }}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                filterMonth === null
                  ? 'bg-teal-500 text-white'
                  : 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300 hover:bg-teal-100'
              }`}
            >
              All Time
            </button>
            {availableMonths.map(am => (
              <button
                key={`${am.month}-${am.year}`}
                onClick={() => { setFilterMonth(am.month); setFilterYear(am.year) }}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  filterMonth === am.month && filterYear === am.year
                    ? 'bg-teal-500 text-white'
                    : 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300 hover:bg-teal-100'
                }`}
              >
                {am.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── KPI Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Monthly Income" value={INR(summary.income)}
          sub="Divya's in-hand salary" trendLabel="Gross take-home"
          icon={IndianRupee} gradient="bg-gradient-to-br from-teal-500 to-teal-700" trend="neutral"
        />
        <KpiCard
          label="Total Expenses" value={INR(summary.total_monthly_expenses)}
          sub={`${expPct}% of income`} trendLabel="Living + Debt + Insurance"
          icon={Wallet} gradient="bg-gradient-to-br from-rose-500 to-pink-600" trend="down"
        />
        <KpiCard
          label="Investments" value={INR(summary.investment)}
          sub={`${invPct}% of income invested`} trendLabel="SIPs + RD + Chit Fund"
          icon={TrendingUp} gradient="bg-gradient-to-br from-emerald-500 to-green-600" trend="up"
        />
        <KpiCard
          label="Net Savings" value={INR(summary.savings)}
          sub={`${savPct}% savings rate`} trendLabel={savPct >= 20 ? '✅ Above 20% target' : '⚠️ Below 20% target'}
          icon={PiggyBank}
          gradient={summary.savings > 0 ? 'bg-gradient-to-br from-violet-500 to-purple-700' : 'bg-gradient-to-br from-orange-500 to-amber-600'}
          trend={summary.savings > 0 ? 'up' : 'down'}
        />
      </div>

      {/* ── Budget vs Actual ──────────────────────────────────── */}
      <div className="card">
        <p className="section-title">Where does your ₹{(summary.income / 1000).toFixed(0)}k go each month?</p>
        <p className="section-sub">Actual spend vs recommended budget limits for your income</p>
        <div className="space-y-4 mt-4">
          <BudgetBar label="🏠 Living Expenses (50% limit)"   spent={summary.living}     budget={summary.income * 0.50} color="bg-rose-400" />
          <BudgetBar label="📈 Investments (20% target)"       spent={summary.investment}  budget={summary.income * 0.20} color="bg-emerald-400" />
          <BudgetBar label="🛡️ Insurance (8% guide)"          spent={summary.insurance}   budget={summary.income * 0.08} color="bg-violet-400" />
          <BudgetBar label="💳 Debt / EMIs (15% limit)"        spent={summary.debt}        budget={summary.income * 0.15} color="bg-orange-400" />
        </div>
        <div className="mt-5 flex items-center gap-3 bg-teal-50 dark:bg-teal-900/20 rounded-xl px-4 py-3 border border-teal-100 dark:border-teal-800">
          <PiggyBank className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">
              Net Savings after all deductions: <strong>{INR(summary.savings)}</strong>
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Rules of thumb: 50% needs · 20% savings/invest · 30% wants</p>
          </div>
        </div>
      </div>

      {/* ── Smart Insights ────────────────────────────────────── */}
      <div className="card">
        <p className="section-title">💡 Smart Insights</p>
        <p className="section-sub">Automatically generated recommendations based on your expense data</p>
        <div className="space-y-2.5 mt-3">
          {insights.map((ins, i) => <Insight key={i} type={ins.type} text={ins.text} />)}
        </div>
      </div>

      {/* ── Charts Row 1 ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <p className="section-title">📊 Spending Trend {trendData && trendData.length > 1 ? `(${trendData.length} months)` : ''}</p>
          <p className="section-sub">Monthly expenses vs net savings — more green bars is better</p>
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={chartTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f43f5e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gSav" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#14b8a6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={48} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="expenses" stroke="#f43f5e" fill="url(#gExp)" name="Expenses" strokeWidth={2} />
              <Area type="monotone" dataKey="savings"  stroke="#14b8a6" fill="url(#gSav)" name="Savings"  strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <p className="section-title">🗂️ Expense by Type</p>
          <p className="section-sub">Monthly-equivalent amounts across spending categories</p>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={typeData} layout="vertical" margin={{ left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={90} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" name="Amount" radius={[0, 8, 8, 0]}>
                {typeData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Charts Row 2 ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <p className="section-title">🍩 Category Breakdown</p>
          <p className="section-sub">Which categories consume the most per month</p>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={95}
                dataKey="value" paddingAngle={2}
                label={({ name, percent }) => `${(name as string).split(' ')[0]} ${((percent as number) * 100).toFixed(0)}%`}
                labelLine={false}>
                {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <p className="section-title">👤 Responsibility Split</p>
          <p className="section-sub">Who manages which portion of monthly expenses</p>
          {incharge && (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={incharge as { name: string; value: number }[]} cx="50%" cy="50%" outerRadius={80}
                    dataKey="value" nameKey="name" paddingAngle={3}
                    label={({ name, percent }) => `${name as string} ${((percent as number) * 100).toFixed(0)}%`}>
                    {(incharge as { name: string; value: number }[]).map((_, i) => (
                      <Cell key={i} fill={['#14b8a6', '#f97316', '#8b5cf6'][i % 3]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {(incharge as { name: string; value: number }[]).map((p, i) => (
                  <div key={p.name} className="flex items-center gap-1.5 text-xs bg-slate-50 dark:bg-gray-800 rounded-full px-3 py-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: ['#14b8a6', '#f97316', '#8b5cf6'][i % 3] }} />
                    <span className="font-medium">{p.name}</span>
                    <span className="text-slate-400">{INR(p.value)}/mo</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Top Expenses Table ────────────────────────────────── */}
      <div className="card">
        <p className="section-title">🏆 Top 10 Monthly Expenses</p>
        <p className="section-sub">Ranked by highest monthly cost — bar shows relative size</p>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-100 dark:border-gray-800">
                <th className="pb-2.5 font-semibold text-slate-400 w-6">#</th>
                <th className="pb-2.5 font-semibold text-slate-500 dark:text-slate-400">Expense</th>
                <th className="pb-2.5 font-semibold text-slate-500 dark:text-slate-400 hidden sm:table-cell">Category</th>
                <th className="pb-2.5 font-semibold text-slate-500 dark:text-slate-400 hidden md:table-cell">Owner</th>
                <th className="pb-2.5 font-semibold text-slate-500 dark:text-slate-400 text-right">Amt/month</th>
                <th className="pb-2.5 font-semibold text-slate-500 dark:text-slate-400 pl-3">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-gray-800/50">
              {topExpenses?.map((e, i) => {
                const barPct = Math.min((e.monthly_amount / (topExpenses[0]?.monthly_amount || 1)) * 100, 100)
                return (
                  <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="py-3 text-slate-300 dark:text-gray-600 font-mono text-xs">{String(i + 1).padStart(2, '0')}</td>
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[160px]">{e.name}</div>
                      <div className="w-full h-1 bg-slate-100 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
                        <div className="h-1 bg-teal-400 rounded-full" style={{ width: `${barPct}%` }} />
                      </div>
                    </td>
                    <td className="py-3 text-slate-400 text-xs hidden sm:table-cell">
                      <span className="bg-slate-100 dark:bg-gray-700 px-2 py-0.5 rounded-lg">{e.category}</span>
                    </td>
                    <td className="py-3 text-slate-500 text-xs hidden md:table-cell">{e.incharge}</td>
                    <td className="py-3 text-right font-bold text-slate-800 dark:text-slate-100 tabular-nums">{INR(e.monthly_amount)}</td>
                    <td className="py-3 pl-3">
                      <span className={
                        e.necessity_level === 'High' ? 'badge-high' :
                        e.necessity_level === 'Medium' ? 'badge-medium' : 'badge-low'
                      }>{e.necessity_level}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Financial Health Score ────────────────────────────── */}
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="section-title mb-0">📈 Financial Health Score</p>
            <p className="text-xs text-slate-400 mt-0.5">Based on savings rate, investment ratio, and expense distribution</p>
          </div>
          <div className={`text-2xl font-black px-4 py-1.5 rounded-xl whitespace-nowrap ${
            savPct >= 20 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' :
            savPct >= 10 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' :
            'bg-rose-100 dark:bg-rose-900/30 text-rose-600'
          }`}>
            {savPct >= 20 ? '🟢' : savPct >= 10 ? '🟡' : '🔴'} {savPct}% saved
          </div>
        </div>

        {/* Segmented income allocation bar */}
        <div className="flex h-5 rounded-full overflow-hidden gap-0.5 mb-1">
          {([
            { label: 'Living',     pct: Math.round((summary.living / summary.income) * 100),     color: 'bg-rose-400' },
            { label: 'Invested',   pct: Math.round((summary.investment / summary.income) * 100), color: 'bg-emerald-400' },
            { label: 'Insurance',  pct: Math.round((summary.insurance / summary.income) * 100),  color: 'bg-violet-400' },
            { label: 'Debt',       pct: Math.round((summary.debt / summary.income) * 100),       color: 'bg-orange-400' },
            { label: 'Savings',    pct: Math.max(0, savPct),                                     color: 'bg-teal-400' },
          ] as { label: string; pct: number; color: string }[]).map(seg => seg.pct > 0 && (
            <div key={seg.label} title={`${seg.label}: ${seg.pct}%`}
              className={`${seg.color} flex items-center justify-center text-white font-bold transition-all`}
              style={{ width: `${seg.pct}%`, fontSize: '10px' }}>
              {seg.pct > 8 ? `${seg.pct}%` : ''}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-400 mb-4">
          {[
            { c: 'bg-rose-400', l: 'Living' }, { c: 'bg-emerald-400', l: 'Invested' },
            { c: 'bg-violet-400', l: 'Insurance' }, { c: 'bg-orange-400', l: 'Debt' },
            { c: 'bg-teal-400', l: 'Savings' },
          ].map(({ c, l }) => (
            <span key={l} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${c}`} />{l}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: '🏠 Living',     value: summary.living,     color: 'text-rose-500' },
            { label: '📈 Invested',   value: summary.investment,  color: 'text-emerald-500' },
            { label: '🛡️ Insurance', value: summary.insurance,  color: 'text-violet-500' },
            { label: '💰 Savings',    value: summary.savings,    color: 'text-teal-500' },
          ].map(item => (
            <div key={item.label} className="bg-slate-50 dark:bg-gray-800 rounded-xl p-3 text-center">
              <div className={`text-lg font-extrabold ${item.color}`}>{INR(item.value)}</div>
              <div className="text-xs text-slate-500 mt-0.5">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
