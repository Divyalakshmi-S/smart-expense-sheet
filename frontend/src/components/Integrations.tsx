import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { integrationsApi } from '../services/api'
import type { SmsTransaction, SmsSummary } from '../types'
import { Smartphone, Send, CheckCircle, XCircle, Info } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const INR = (v: number) => '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const COLORS = ['#14b8a6', '#0d9488', '#f97316', '#8b5cf6', '#f59e0b', '#3b82f6', '#ec4899']
const CAT_ICON: Record<string, string> = {
  food: '🍔', shopping: '🛒', transport: '🚗', entertainment: '🎬',
  utilities: '💡', health: '💊', debt: '💳', investment: '📈',
  insurance: '🛡️', living: '🏠', income: '💰', cash: '💵', other: '📦',
}

const SAMPLE_SMS = [
  'INR 1,200.00 debited from A/c XX4321 on 24-Mar-26. Available Bal: INR 32,400.00. Ref:UPI/123456789012',
  'Rs.2500 paid to zomato@icici via UPI on 23-Mar-26. UPI Ref 987654321098. Avl Bal INR 29,900.00',
].join('\n')

export default function Integrations() {
  const qc = useQueryClient()
  const [smsText, setSmsText] = useState('')
  const [lastParsed, setLastParsed] = useState<SmsTransaction | null>(null)
  const [pasteCount, setPasteCount] = useState(0)

  const { data: summary } = useQuery<SmsSummary>({
    queryKey: ['sms-summary'],
    queryFn: () => integrationsApi.summary(30),
  })
  const { data: txns = [] } = useQuery<SmsTransaction[]>({
    queryKey: ['sms-transactions'],
    queryFn: () => integrationsApi.transactions(30),
  })

  const ingest = useMutation({
    mutationFn: (text: string) => integrationsApi.ingestSms(text),
    onSuccess: (data) => {
      setLastParsed(data)
      qc.invalidateQueries({ queryKey: ['sms-summary'] })
      qc.invalidateQueries({ queryKey: ['sms-transactions'] })
    },
  })

  const handleSubmit = () => {
    const lines = smsText.split('\n').map(l => l.trim()).filter(Boolean)
    setPasteCount(lines.length)
    lines.forEach(line => ingest.mutate(line))
    setSmsText('')
  }

  const catChartData = summary
    ? Object.entries(summary.by_category).map(([cat, total]) => ({ name: cat, value: total }))
    : []

  const apiBase = window.location.origin.replace(':5173', ':8000').replace(':3000', ':8000')

  return (
    <div className="space-y-6">

      {/* Android auto-forward setup card */}
      <div className="card border-l-4 border-brand-500">
        <div className="flex items-start gap-3">
          <Smartphone className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold mb-2">Android Auto-Forward Setup</h3>
            <p className="text-sm text-slate-500 mb-3">
              Forward bank SMS to this app automatically as they arrive using <strong>MacroDroid</strong> (free on Play Store):
            </p>
            <ol className="text-sm text-slate-600 dark:text-slate-300 space-y-2 list-decimal list-inside">
              <li>Install <strong>MacroDroid</strong> on your Android phone</li>
              <li>
                Create a macro → Trigger: <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs">SMS Received</code>,
                filter sender containing <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs">HDFC</code> /
                <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs">ICICI</code> /
                <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs">SBI</code> etc.
              </li>
              <li>
                Action: <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs">HTTP Request → POST</code> to:<br />
                <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs break-all">{apiBase}/api/integrations/sms</code>
              </li>
              <li>
                Body (JSON):{' '}
                <code className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs">
                  {`{"text": "[sms_body]", "source": "android"}`}
                </code>
              </li>
              <li>That's it — new bank SMS will appear here within seconds 🎉</li>
            </ol>
            <p className="text-xs text-slate-400 mt-3 flex items-start gap-1">
              <Info className="w-3 h-3 shrink-0 mt-0.5" />
              No data leaves your device except to your own backend. Optionally set
              <code className="mx-1 bg-slate-100 dark:bg-slate-700 px-1 rounded">SMS_INGEST_TOKEN=yourtoken</code>
              in <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">.env</code> and add a
              <code className="mx-1 bg-slate-100 dark:bg-slate-700 px-1 rounded">Authorization: Bearer yourtoken</code>
              header in MacroDroid to secure the endpoint.
            </p>
          </div>
        </div>
      </div>

      {/* Manual SMS paste */}
      <div className="card">
        <h3 className="font-semibold mb-1">Paste SMS Manually</h3>
        <p className="text-xs text-slate-400 mb-3">
          Paste one or more bank transaction SMS messages (one per line). The parser extracts amount, merchant, bank, and date automatically.
        </p>
        <textarea
          rows={4}
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-sm font-mono resize-none focus:ring-2 focus:ring-brand-400 outline-none"
          placeholder={SAMPLE_SMS}
          value={smsText}
          onChange={e => setSmsText(e.target.value)}
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={handleSubmit}
            disabled={!smsText.trim() || ingest.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Send className="w-4 h-4" />
            {ingest.isPending ? 'Parsing…' : 'Parse & Save'}
          </button>
          {pasteCount > 0 && !ingest.isPending && (
            <span className="text-xs text-slate-400">Processed {pasteCount} message{pasteCount > 1 ? 's' : ''}</span>
          )}
        </div>

        {/* Last parsed result */}
        {lastParsed && (() => {
          const isIgnored = lastParsed.txn_type === 'ignored';
          const isCollect = lastParsed.txn_type === 'collect_request';
          const bgClass = isIgnored
            ? 'bg-slate-50 dark:bg-slate-700/40'
            : isCollect
              ? 'bg-amber-50 dark:bg-amber-900/20'
              : lastParsed.is_parseable
                ? 'bg-emerald-50 dark:bg-emerald-900/20'
                : 'bg-rose-50 dark:bg-rose-900/20';
          const IGNORE_LABELS: Record<string, string> = {
            otp: 'OTP / PIN message — not stored',
            biller_confirm: 'Biller payment confirmation (not a bank credit) — not stored',
            refund_notice: 'Refund notice (no settled amount yet) — not stored',
            advisory: 'Corporate action advisory — not stored',
          };
          return (
            <div className={`mt-4 rounded-xl p-3 text-sm ${bgClass}`}>
              <div className="flex items-center gap-2 font-medium mb-2">
                {isIgnored
                  ? <><XCircle className="w-4 h-4 text-slate-400" /> {IGNORE_LABELS[lastParsed.ignore_reason ?? ''] ?? 'Ignored — not a transaction SMS'}</>
                  : isCollect
                    ? <><CheckCircle className="w-4 h-4 text-amber-500" /> UPI Collect Request (pending approval) — logged</>
                    : lastParsed.is_parseable
                      ? <><CheckCircle className="w-4 h-4 text-emerald-600" /> Parsed successfully</>
                      : <><XCircle className="w-4 h-4 text-rose-500" /> Could not parse — not a bank transaction SMS</>}
              </div>
              {(lastParsed.is_parseable || isCollect) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span>Bank: <strong>{lastParsed.bank}</strong></span>
                  <span>Type: <strong className={
                    lastParsed.txn_type === 'debit' ? 'text-rose-500'
                    : lastParsed.txn_type === 'credit' ? 'text-emerald-600'
                    : 'text-amber-500'
                  }>{lastParsed.txn_type === 'collect_request' ? 'Collect Request' : lastParsed.txn_type}</strong></span>
                  <span>Amount: <strong>{INR(lastParsed.amount ?? 0)}</strong></span>
                  <span>Merchant: <strong>{lastParsed.merchant ?? '—'}</strong></span>
                  <span>Category: <strong>{CAT_ICON[lastParsed.auto_category ?? ''] ?? ''} {lastParsed.auto_category}</strong></span>
                  {lastParsed.balance_after && <span>Balance: <strong>{INR(lastParsed.balance_after)}</strong></span>}
                  {lastParsed.upi_ref && <span className="col-span-2">UPI Ref: <strong>{lastParsed.upi_ref}</strong></span>}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Summary stats */}
      {summary && summary.transaction_count > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-4">Spend Summary — Last 30 Days (from SMS)</h3>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-rose-50 dark:bg-rose-900/20 rounded-xl p-3">
              <p className="text-xs text-slate-500">Total Debited</p>
              <p className="text-xl font-bold text-rose-500">{INR(summary.total_debited)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-3">
              <p className="text-xs text-slate-500">Transactions</p>
              <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{summary.transaction_count}</p>
            </div>
          </div>

          {catChartData.length > 0 && (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={catChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => INR(v)} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {catChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {summary.top_merchants.length > 0 && (
            <>
              <h4 className="font-medium text-sm mt-5 mb-2">Top Merchants</h4>
              <div className="space-y-2">
                {summary.top_merchants.map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-4 text-right">{i + 1}</span>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full"
                        style={{ width: `${(m.total / summary.top_merchants[0].total) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200 w-32 truncate">{m.merchant}</span>
                    <span className="text-xs font-bold text-rose-500 ml-auto">{INR(m.total)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Transaction log */}
      {txns.length > 0 && (
        <div className="card">
          <h3 className="font-semibold mb-3">Recent SMS Transactions</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {txns.map(t => (
              <div key={t.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                t.txn_type === 'debit'
                  ? 'bg-rose-50 dark:bg-rose-900/20'
                  : t.txn_type === 'collect_request'
                    ? 'bg-amber-50 dark:bg-amber-900/20'
                    : 'bg-emerald-50 dark:bg-emerald-900/20'
              }`}>
                <span className="text-base shrink-0">{CAT_ICON[t.auto_category ?? ''] ?? '📦'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{t.merchant ?? t.bank ?? 'Unknown'}</p>
                  <p className="text-xs text-slate-400">
                    {t.bank} · {t.txn_date ? new Date(t.txn_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    {t.source === 'android' && <span className="ml-1.5 text-brand-500 font-medium">● live</span>}
                    {t.txn_type === 'collect_request' && <span className="ml-1.5 text-amber-500 font-medium">● pending</span>}
                  </p>
                </div>
                <span className={`font-bold shrink-0 ${
                  t.txn_type === 'debit' ? 'text-rose-500'
                  : t.txn_type === 'collect_request' ? 'text-amber-500'
                  : 'text-emerald-600'
                }`}>
                  {t.txn_type === 'debit' ? '−' : t.txn_type === 'collect_request' ? '?' : '+'}{INR(t.amount ?? 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {txns.length === 0 && (
        <div className="text-center py-14 text-slate-400">
          <Smartphone className="w-10 h-10 mx-auto mb-3 opacity-25" />
          <p className="text-sm font-medium">No SMS transactions yet</p>
          <p className="text-xs mt-1">Paste a bank SMS above, or set up Android auto-forward to send them automatically.</p>
        </div>
      )}
    </div>
  )
}
