import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell, RadarChart, PolarGrid,
  PolarAngleAxis, Radar
} from 'recharts'
import { predictionsApi, analyticsApi } from '../services/api'
import { TrendingDown, Lightbulb, AlertCircle, TrendingUp } from 'lucide-react'
import type { PredictionResult, Anomaly, SavingsOpportunity, InvestmentProjection } from '../types'

const INR = (v: number) => '₹' + Math.round(v).toLocaleString('en-IN')
const COLORS = ['#14b8a6', '#0d9488', '#f97316', '#8b5cf6', '#f59e0b', '#3b82f6', '#ec4899']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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

  const predBarData = pred
    ? Object.entries(pred.by_category).map(([cat, val]) => ({ name: cat.charAt(0).toUpperCase() + cat.slice(1), value: Math.round(val) }))
    : []

  const chartGrowth5 = (growthData?.projections_5yr || []).map(p => ({
    name: p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name,
    monthly: p.monthly_sip,
    projected: Math.round(p.projected_value),
    return: p.assumed_return_pct,
  }))

  return (
    <div className="space-y-6">
      {/* Next Month Prediction */}
      {pred && (
        <div className="card">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="font-semibold text-lg">Next Month Prediction</h3>
              <p className="text-sm text-slate-500">{MONTHS[pred.month - 1]} {pred.year}</p>
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
              <Tooltip formatter={(v: number) => INR(v)} />
              <Bar dataKey="value" name="Predicted" radius={[6, 6, 0, 0]}>
                {predBarData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Savings Opportunities */}
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
              <div key={i} className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                <div className="w-8 h-8 bg-amber-100 dark:bg-amber-800/40 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400 text-sm font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{opp.tip}</p>
                  <div className="flex gap-4 mt-1 text-xs text-slate-500">
                    <span>Current: <strong>{INR(opp.current)}</strong></span>
                    <span>Suggested: <strong className="text-emerald-600">{INR(opp.suggested)}</strong></span>
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

      {/* Anomalies */}
      {anomalies.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-rose-500" />
            <h3 className="font-semibold">Anomaly & Risk Report</h3>
          </div>
          <div className="space-y-2">
            {anomalies.map((a, i) => (
              <div key={i} className={`flex items-start gap-3 rounded-xl p-3 ${
                a.severity === 'high' ? 'bg-rose-50 dark:bg-rose-900/20' :
                a.severity === 'medium' ? 'bg-amber-50 dark:bg-amber-900/20' :
                'bg-slate-50 dark:bg-slate-700/30'
              }`}>
                <span className={`text-lg shrink-0 ${a.severity === 'high' ? '🔴' : a.severity === 'medium' ? '🟡' : '🟢'}`}>
                  {a.severity === 'high' ? '🔴' : a.severity === 'medium' ? '🟡' : '🟢'}
                </span>
                <div>
                  <p className="text-sm font-medium">{a.name} — {INR(a.amount)}</p>
                  <p className="text-xs text-slate-500">{a.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Investment Growth Projection */}
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
