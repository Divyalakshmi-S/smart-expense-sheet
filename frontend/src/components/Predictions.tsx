import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { predictionsApi, analyticsApi } from '../services/api'
import { TrendingDown, TrendingUp, Lightbulb, AlertCircle, Activity, Target } from 'lucide-react'
import type { PredictionResult, Anomaly, SavingsOpportunity, InvestmentProjection, BudgetHealthScore, RuleAnalysis } from '../types'

const INR = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN')
const COLORS = ['#14b8a6', '#0d9488', '#f97316', '#8b5cf6', '#f59e0b', '#3b82f6', '#ec4899']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// ── Score gauge (SVG circle) ──────────────────────────────
function ScoreGauge({ score, grade }: { score: number; grade: string }) {
  const r = 48
  const circ = 2 * Math.PI * r
  const progress = circ - (score / 100) * circ
  const color =
    score >= 85 ? '#10b981' :
    score >= 70 ? '#14b8a6' :
    score >= 55 ? '#f59e0b' :
    score >= 40 ? '#f97316' : '#ef4444'

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={progress}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="60" y="55" textAnchor="middle" className="fill-slate-800 dark:fill-slate-100" fontSize="22" fontWeight="bold">{score}</text>
        <text x="60" y="72" textAnchor="middle" className="fill-slate-500" fontSize="11">/100</text>
      </svg>
      <span className="text-sm font-semibold" style={{ color }}>{grade}</span>
    </div>
  )
}

// ── 50/30/20 bar ──────────────────────────────────────────
function RuleBar({ label, actual, target, color }: { label: string; actual: number; target: number; color: string }) {
  const over = actual > target
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className={over ? 'text-rose-500 font-semibold' : 'text-emerald-600 font-semibold'}>
          {actual}% <span className="text-slate-400 font-normal">/ {target}% target</span>
        </span>
      </div>
      <div className="relative h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(actual, 100)}%`, backgroundColor: color }} />
        {/* target marker */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-slate-900/30 dark:bg-white/30" style={{ left: `${target}%` }} />
      </div>
    </div>
  )
}

export default function Predictions() {
  const { data: pred } = useQuery<PredictionResult>({
    queryKey: ['prediction'],
    queryFn: predictionsApi.nextMonth,
  })
  const { data: anomalies = [] } = useQuery<Anomaly[]>({
    queryKey: ['anomalies'],
    queryFn: predictionsApi.anomalies,
  })
  const { data: savings } = useQuery<{ opportunities: SavingsOpportunity[]; total_monthly_savings_potential: number; total_yearly_savings_potential: number }>({
    queryKey: ['savings'],
    queryFn: predictionsApi.savings,
  })
  const { data: growthData } = useQuery<{ investments: object[]; projections_5yr: InvestmentProjection[]; projections_10yr: InvestmentProjection[] }>({
    queryKey: ['investments'],
    queryFn: () => analyticsApi.investments(),
  })
  const { data: health } = useQuery<BudgetHealthScore>({
    queryKey: ['health-score'],
    queryFn: predictionsApi.healthScore,
  })
  const { data: rule } = useQuery<RuleAnalysis>({
    queryKey: ['rule-analysis'],
    queryFn: predictionsApi.ruleAnalysis,
  })

  const predBarData = pred
    ? Object.entries(pred.by_category).map(([cat, val]) => ({
        name: cat.charAt(0).toUpperCase() + cat.slice(1),
        value: Math.round(val),
        growth: pred.growth_rates?.[cat] ?? 0,
      }))
    : []

  const chartGrowth5 = (growthData?.projections_5yr || []).map(p => ({
    name: p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name,
    monthly: p.monthly_sip,
    projected: Math.round(p.projected_value),
    return: p.assumed_return_pct,
  }))

  return (
    <div className="space-y-6">

      {/* ── Budget Health Score ── */}
      {health && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-brand-500" />
            <h3 className="font-semibold">Budget Health Score</h3>
          </div>
          <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
            <ScoreGauge score={health.score} grade={health.grade} />
            <div className="flex-1 space-y-4 w-full">
              {Object.entries(health.pillars).map(([key, p]) => {
                const labels: Record<string, string> = {
                  savings_rate: 'Savings Rate',
                  debt_load: 'Debt Load',
                  investment_rate: 'Investment Rate',
                  categorisation: 'Data Quality',
                }
                const colors: Record<string, string> = {
                  savings_rate: '#10b981',
                  debt_load: '#f97316',
                  investment_rate: '#8b5cf6',
                  categorisation: '#3b82f6',
                }
                const pct = Math.round((p.score / p.max) * 100)
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-300">{labels[key]}</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {p.actual_pct}% <span className="text-slate-400 font-normal">/ {p.target_pct}% target</span>
                      </span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: colors[key] }} />
                    </div>
                    <p className="text-[11px] text-slate-400">{p.score}/{p.max} pts</p>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-5">
            <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500">Monthly Income</p>
              <p className="text-base font-bold text-slate-700 dark:text-slate-200">{INR(health.income)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500">Total Expenses</p>
              <p className="text-base font-bold text-rose-500">{INR(health.total_monthly_expenses)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500">Monthly Savings</p>
              <p className={`text-base font-bold ${health.monthly_savings >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{INR(health.monthly_savings)}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Next Month Prediction ── */}
      {pred && (
        <div className="card">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="font-semibold text-lg">Next Month Prediction</h3>
              <p className="text-sm text-slate-500">
                {MONTHS[pred.month - 1]} {pred.year}
                {pred.months_of_data > 1 && (
                  <span className="ml-2 text-brand-500">· {pred.months_of_data}-month trend</span>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-brand-600">{INR(pred.predicted_total)}</p>
              <p className="text-xs text-slate-400">{Math.round(pred.confidence * 100)}% confidence</p>
            </div>
          </div>

          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-4 overflow-hidden">
            <div className="h-2 bg-brand-500 rounded-full" style={{ width: `${pred.confidence * 100}%` }} />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3">
              <p className="text-xs text-slate-500">Predicted Total</p>
              <p className="text-xl font-bold text-rose-500">{INR(pred.predicted_total)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3">
              <p className="text-xs text-slate-500">Projected Savings</p>
              <p className={`text-xl font-bold ${pred.projected_savings >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{INR(pred.projected_savings)}</p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={predBarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number, _: string, entry: any) => {
                  const g = entry?.payload?.growth
                  return [INR(v), g != null ? `(${g > 0 ? '+' : ''}${g}% vs now)` : '']
                }}
              />
              <Bar dataKey="value" name="Predicted" radius={[6, 6, 0, 0]}>
                {predBarData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Category growth badges */}
          {pred.growth_rates && (
            <div className="flex flex-wrap gap-2 mt-3">
              {Object.entries(pred.growth_rates).map(([cat, g]) => (
                <span
                  key={cat}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    g > 2 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                    g < -2 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {g > 2 ? <TrendingUp className="w-3 h-3" /> : g < -2 ? <TrendingDown className="w-3 h-3" /> : null}
                  {cat} {g > 0 ? '+' : ''}{g}%
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 50/30/20 Rule Analysis ── */}
      {rule && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-violet-500" />
            <h3 className="font-semibold">50/30/20 Rule Analysis</h3>
          </div>
          <div className="space-y-4">
            <RuleBar label="Needs (housing, debt, insurance, essentials)" actual={rule.needs.pct_of_income} target={50} color="#f97316" />
            <RuleBar label="Wants (discretionary, lifestyle)" actual={rule.wants.pct_of_income} target={30} color="#8b5cf6" />
            <RuleBar label="Savings & Investments" actual={rule.savings.pct_of_income} target={20} color="#10b981" />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-5">
            {(['needs', 'wants', 'savings'] as const).map((bucket) => {
              const b = rule[bucket]
              const over = b.pct_of_income > b.target_pct
              const relevant = bucket !== 'savings' ? over : !over
              return (
                <div key={bucket} className={`rounded-xl p-3 text-center ${relevant ? 'bg-rose-50 dark:bg-rose-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                  <p className="text-xs capitalize text-slate-500">{bucket}</p>
                  <p className="text-base font-bold text-slate-700 dark:text-slate-200">{INR(b.total)}/mo</p>
                  <p className={`text-xs font-semibold ${relevant ? 'text-rose-500' : 'text-emerald-600'}`}>
                    {b.pct_of_income}% <span className="font-normal text-slate-400">of income</span>
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Savings Opportunities ── */}
      {savings && savings.opportunities.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold">Savings Opportunities</h3>
            <span className="ml-auto text-sm font-semibold text-emerald-600">
              Potential: {INR(savings.total_monthly_savings_potential)}/mo ({INR(savings.total_yearly_savings_potential)}/yr)
            </span>
          </div>
          <div className="space-y-3">
            {savings.opportunities.map((opp, i) => (
              <div key={i} className={`flex items-center gap-3 rounded-xl p-3 ${
                opp.category === 'rule'
                  ? 'bg-violet-50 dark:bg-violet-900/20'
                  : opp.category === 'shared'
                  ? 'bg-blue-50 dark:bg-blue-900/20'
                  : 'bg-amber-50 dark:bg-amber-900/20'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  opp.category === 'rule'
                    ? 'bg-violet-100 dark:bg-violet-800/40 text-violet-600 dark:text-violet-400'
                    : 'bg-amber-100 dark:bg-amber-800/40 text-amber-600 dark:text-amber-400'
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{opp.tip}</p>
                  <div className="flex gap-4 mt-1 text-xs text-slate-500">
                    <span>Current: <strong>{INR(opp.current)}</strong></span>
                    <span>Target: <strong className="text-emerald-600">{INR(opp.suggested)}</strong></span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-emerald-600">-{INR(opp.saving_per_month)}</p>
                  <p className="text-xs text-slate-400">per month</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Anomaly & Risk Report ── */}
      {anomalies.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-rose-500" />
            <h3 className="font-semibold">Anomaly & Risk Report</h3>
            <span className="ml-auto text-xs text-slate-400">{anomalies.length} flagged</span>
          </div>
          <div className="space-y-2">
            {anomalies.map((a, i) => (
              <div key={i} className={`flex items-start gap-3 rounded-xl p-3 ${
                a.severity === 'high' ? 'bg-rose-50 dark:bg-rose-900/20' :
                a.severity === 'medium' ? 'bg-amber-50 dark:bg-amber-900/20' :
                'bg-slate-50 dark:bg-slate-700/30'
              }`}>
                <span className="text-lg shrink-0">
                  {a.severity === 'high' ? '🔴' : a.severity === 'medium' ? '🟡' : '🟢'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{a.name} — {INR(a.amount)}</p>
                  <p className="text-xs text-slate-500">{a.reason}</p>
                </div>
                {a.z_score != null && (
                  <span className="shrink-0 text-xs text-rose-500 font-semibold">z={a.z_score}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Investment Growth Projection ── */}
      {chartGrowth5.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            <h3 className="font-semibold">Investment Growth Projection (5 Years)</h3>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartGrowth5} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tickFormatter={v => `₹${(v / 100000).toFixed(1)}L`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => INR(v)} />
              <Legend />
              <Bar dataKey="monthly" name="Monthly SIP" fill="#14b8a6" radius={[0, 4, 4, 0]} />
              <Bar dataKey="projected" name="5yr Value" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-400 mt-2 text-center">
            Based on assumed CAGR per asset class. Actual returns may vary.
          </p>
        </div>
      )}
    </div>
  )
}
