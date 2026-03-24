import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Filter, Edit2, Trash2, ChevronDown } from 'lucide-react'
import { expensesApi } from '../services/api'
import type { Expense } from '../types'
import clsx from 'clsx'

const INR = (v: number | null) => v != null ? '₹' + Math.round(v).toLocaleString('en-IN') : '—'

const TYPE_COLORS: Record<string, string> = {
  living: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  investment: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  insurance: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  debt: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  other: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
}

export default function ExpenseTable() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'amount' | 'name' | 'category'>('amount')

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ['expenses'],
    queryFn: () => expensesApi.getAll(),
  })

  const deleteMutation = useMutation({
    mutationFn: expensesApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })

  const filtered = expenses
    .filter(e => {
      const q = search.toLowerCase()
      const matchSearch = !q || e.name.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
      const matchType = typeFilter === 'all' || e.expense_type === typeFilter
      return matchSearch && matchType
    })
    .sort((a, b) => {
      if (sortBy === 'amount') return (b.amount || 0) - (a.amount || 0)
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      return a.category.localeCompare(b.category)
    })

  const types = ['all', 'living', 'investment', 'insurance', 'debt', 'other']

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Search expenses..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-slate-400" />
          {types.map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors',
                typeFilter === t
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Sort:</span>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none"
          >
            <option value="amount">Amount</option>
            <option value="name">Name</option>
            <option value="category">Category</option>
          </select>
        </div>
      </div>

      <div className="text-sm text-slate-500">
        Showing <strong>{filtered.length}</strong> of {expenses.length} expenses
      </div>

      {/* Table */}
      <div className="card p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <th className="text-left px-4 py-3 font-medium text-slate-500">Expense</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Category</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Type</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500">Amount</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Incharge</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Due</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Priority</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {filtered.map(e => (
              <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                <td className="px-4 py-3 font-medium max-w-[180px] truncate" title={e.name}>{e.name}</td>
                <td className="px-4 py-3 text-slate-500 text-xs max-w-[140px] truncate" title={e.category}>{e.category}</td>
                <td className="px-4 py-3">
                  <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full capitalize', TYPE_COLORS[e.expense_type] || TYPE_COLORS.other)}>
                    {e.expense_type}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold">{INR(e.amount)}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{e.incharge || '—'}</td>
                <td className="px-4 py-3 text-slate-500 text-xs max-w-[120px] truncate" title={e.payment_date || ''}>{e.payment_date || '—'}</td>
                <td className="px-4 py-3">
                  {e.necessity_level && (
                    <span className={
                      e.necessity_level === 'High' ? 'badge-high' :
                      e.necessity_level === 'Medium' ? 'badge-medium' : 'badge-low'
                    }>{e.necessity_level}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => { if (confirm('Delete this expense?')) deleteMutation.mutate(e.id) }}
                    className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-600 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400">No expenses found</div>
        )}
      </div>
    </div>
  )
}
