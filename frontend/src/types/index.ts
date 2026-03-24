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
  growth_rates: Record<string, number>;
  confidence: number;
  income: number;
  projected_savings: number;
  months_of_data: number;
}

export interface Anomaly {
  name: string;
  amount: number;
  reason: string;
  severity: "high" | "medium" | "low";
  z_score: number | null;
}

export interface SavingsOpportunity {
  name: string;
  current: number;
  suggested: number;
  saving_per_month: number;
  tip: string;
  category: "rule" | "discretionary" | "shared";
}

export interface BudgetHealthScore {
  score: number;
  grade: string;
  pillars: {
    savings_rate: {
      score: number;
      max: number;
      actual_pct: number;
      target_pct: number;
    };
    debt_load: {
      score: number;
      max: number;
      actual_pct: number;
      target_pct: number;
    };
    investment_rate: {
      score: number;
      max: number;
      actual_pct: number;
      target_pct: number;
    };
    categorisation: {
      score: number;
      max: number;
      actual_pct: number;
      target_pct: number;
    };
  };
  income: number;
  total_monthly_expenses: number;
  monthly_savings: number;
}

export interface RuleBucket {
  total: number;
  pct_of_income: number;
  target_pct: number;
  items: { name: string; monthly: number }[];
}

export interface RuleAnalysis {
  income: number;
  needs: RuleBucket;
  wants: RuleBucket;
  savings: RuleBucket;
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

export type Tab =
  | "dashboard"
  | "expenses"
  | "predictions"
  | "agent"
  | "upload"
  | "integrations";

export interface SmsTransaction {
  id: number;
  raw_text: string;
  bank: string | null;
  txn_type: "debit" | "credit" | "collect_request" | "unknown" | "ignored";
  amount: number | null;
  merchant: string | null;
  account_last4: string | null;
  upi_ref: string | null;
  balance_after: number | null;
  txn_date: string | null;
  auto_category: string | null;
  source: string;
  is_parseable: boolean;
  ignore_reason: string | null;
  created_at: string;
}

export interface SmsSummary {
  days: number;
  total_debited: number;
  transaction_count: number;
  by_category: Record<string, number>;
  top_merchants: { merchant: string; total: number }[];
}
