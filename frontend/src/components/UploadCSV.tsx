import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, FileText, CheckCircle, AlertCircle, Database, Calendar } from 'lucide-react'
import { expensesApi } from '../services/api'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const CURRENT_YEAR = new Date().getFullYear()
const CURRENT_MONTH = new Date().getMonth() + 1

export default function UploadCSV() {
  const qc = useQueryClient()
  const [dragging, setDragging] = useState(false)
  const [result, setResult] = useState<{ inserted: number; label?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadMonth, setUploadMonth] = useState<number>(CURRENT_MONTH)
  const [uploadYear, setUploadYear] = useState<number>(CURRENT_YEAR)


  const uploadMutation = useMutation({
    mutationFn: (file: File) => expensesApi.upload(file, uploadMonth, uploadYear),
    onSuccess: (data) => {
      setResult(data)
      setError(null)
      qc.invalidateQueries()
    },
    onError: (e: any) => {
      setError(e.response?.data?.detail || 'Upload failed. Check that the file is a valid expense CSV.')
    },
  })

  const seedMutation = useMutation({
    mutationFn: () => expensesApi.seedDefault(uploadMonth, uploadYear),
    onSuccess: (data) => {
      setResult(data)
      setError(null)
      qc.invalidateQueries()
    },
    onError: () => setError('Could not load default CSV. Make sure the backend can find divya-expense-sheet.csv'),
  })


  const handleFile = (file: File) => {
    setResult(null)
    setError(null)
    uploadMutation.mutate(file)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const loading = uploadMutation.isPending || seedMutation.isPending

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="card">
        <h2 className="text-xl font-bold mb-1">Import Expense Data</h2>
        <p className="text-sm text-slate-500 mb-6">
          Upload your expense spreadsheet CSV file. The parser handles the multi-section format
          (Living, Investments, Insurance, Debt) with Indian number formatting.
        </p>

        {/* Month / Year selector */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-teal-500" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Tag this data to which month?
            </span>
            <span className="ml-auto text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded-full">
              {MONTH_NAMES[uploadMonth - 1]} {uploadYear}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {MONTH_NAMES.map((name, i) => (
              <button
                key={name}
                onClick={() => setUploadMonth(i + 1)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  uploadMonth === i + 1
                    ? 'bg-teal-500 text-white'
                    : 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300 hover:bg-teal-100 dark:hover:bg-teal-900/30'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Year:</span>
            {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => (
              <button
                key={y}
                onClick={() => setUploadYear(y)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  uploadYear === y
                    ? 'bg-teal-500 text-white'
                    : 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300 hover:bg-teal-100 dark:hover:bg-teal-900/30'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>


        {/* Drop zone */}
        <div
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer ${
            dragging
              ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
              : 'border-slate-300 dark:border-slate-600 hover:border-brand-400 hover:bg-slate-50 dark:hover:bg-slate-700/30'
          }`}
          onClick={() => document.getElementById('csv-input')?.click()}
        >
          <Upload className={`w-10 h-10 mx-auto mb-3 ${dragging ? 'text-brand-500' : 'text-slate-400'}`} />
          <p className="font-medium text-slate-700 dark:text-slate-300">
            {loading ? 'Parsing...' : 'Drop your CSV here or click to browse'}
          </p>
          <p className="text-sm text-slate-400 mt-1">Supports the multi-section expense sheet format</p>
          <input id="csv-input" type="file" accept=".csv" className="hidden" onChange={onFileInput} />
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
          <span className="text-xs text-slate-400">or</span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        </div>

        {/* Seed default */}
        <button
          onClick={() => { setResult(null); setError(null); seedMutation.mutate() }}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 btn-primary disabled:opacity-50"
        >
          <Database className="w-4 h-4" />
          Load Default (divya-expense-sheet.csv)
        </button>
      </div>

      {/* Success */}
      {result && (
        <div className="card border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-500 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                Successfully imported {result.inserted} expenses
                {result.label ? ` for ${result.label}` : ''}!
              </p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                Head to the Dashboard to see your analysis. Upload another month to build trends.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
          </div>
        </div>
      )}

      {/* Format guide */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-5 h-5 text-slate-400" />
          <h3 className="font-semibold">Expected CSV Format</h3>
        </div>
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
          <p>The parser handles your expense sheet format with these columns:</p>
          <div className="grid grid-cols-2 gap-2">
            {['Category', 'Expense Name', 'Amount', 'Date (If applicable)', 'Incharge', 'Comments', 'Neccessity Level'].map(col => (
              <code key={col} className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded font-mono">{col}</code>
            ))}
          </div>
          <p className="mt-2">✅ Handles Indian number format (₹1,18,655)</p>
          <p>✅ Skips empty rows and Total/summary rows</p>
          <p>✅ Parses multi-section format (Living, Debt, Investments, Insurance)</p>
          <p>✅ Handles TBD and missing values gracefully</p>
        </div>
      </div>
    </div>
  )
}
