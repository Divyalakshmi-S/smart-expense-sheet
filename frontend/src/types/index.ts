export interface Expense {
  id: number;
  category: string;
  expense_type: "living" | "debt" | "investment" | "insurance" | "other";
  name: string;
  amount: number | null;
  payment_date: string | null;
  incharge: string | null;
  comments: string | null;
  necessity_level: string | null;
  is_recurring: boolean;
  frequency: string | null;
  data_month: number | null;
  data_year: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AvailableMonth {
  month: number;
  year: number;
  label: string;
}

export interface MonthlyTrend {
  month: number;
  year: number;
  month_label: string;
  total_expenses: number;
  living: number;
  debt: number;
  investment: number;
  insurance: number;
  savings: number;
}

export interface Summary {
  income: number;
  total_monthly_expenses: number;
  living: number;
  debt: number;
  investment: number;
  insurance: number;
  savings: number;
  savings_rate: number;
  total_expenses_count: number;
}

export interface CategoryItem {
  category: string;
  total: number;
  count: number;
  items: { name: string; amount: number }[];
}

export interface PredictionResult {
  month: number;
  year: number;
  predicted_total: number;
  by_category: Record<string, number>;
  confidence: number;
  income: number;
  projected_savings: number;
}

export interface Anomaly {
  name: string;
  amount: number;
  reason: string;
  severity: "high" | "medium" | "low";
}

export interface SavingsOpportunity {
  name: string;
  current: number;
  suggested: number;
  saving_per_month: number;
  tip: string;
}

export interface InvestmentProjection {
  name: string;
  monthly_sip: number;
  assumed_return_pct: number;
  projected_value: number;
  years: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  ts?: string;
}

export type Tab = "dashboard" | "expenses" | "predictions" | "agent" | "upload";
