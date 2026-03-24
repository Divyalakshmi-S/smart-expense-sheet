import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({ baseURL: BASE });

function timeParams(month?: number | null, year?: number | null): string {
  if (month != null && year != null) return `?month=${month}&year=${year}`;
  if (year != null) return `?year=${year}`;
  return "";
}

export const expensesApi = {
  getAll: (month?: number | null, year?: number | null) =>
    api.get(`/expenses/${timeParams(month, year)}`).then((r) => r.data),
  create: (data: object) => api.post("/expenses/", data).then((r) => r.data),
  update: (id: number, data: object) =>
    api.put(`/expenses/${id}`, data).then((r) => r.data),
  delete: (id: number) => api.delete(`/expenses/${id}`).then((r) => r.data),
  upload: (file: File, month?: number | null, year?: number | null) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post(`/expenses/upload${timeParams(month, year)}`, form)
      .then((r) => r.data);
  },
  seedDefault: (month?: number | null, year?: number | null) =>
    api
      .post(`/expenses/seed-default${timeParams(month, year)}`)
      .then((r) => r.data),
  availableMonths: () =>
    api.get("/expenses/available-months").then((r) => r.data),
};

export const analyticsApi = {
  summary: (month?: number | null, year?: number | null) =>
    api.get(`/analytics/summary${timeParams(month, year)}`).then((r) => r.data),
  categories: (month?: number | null, year?: number | null) =>
    api
      .get(`/analytics/categories${timeParams(month, year)}`)
      .then((r) => r.data),
  incharge: (month?: number | null, year?: number | null) =>
    api
      .get(`/analytics/incharge${timeParams(month, year)}`)
      .then((r) => r.data),
  necessity: (month?: number | null, year?: number | null) =>
    api
      .get(`/analytics/necessity${timeParams(month, year)}`)
      .then((r) => r.data),
  topExpenses: (limit = 10, month?: number | null, year?: number | null) => {
    const base = `/analytics/top-expenses?limit=${limit}`;
    const extra =
      month != null && year != null ? `&month=${month}&year=${year}` : "";
    return api.get(`${base}${extra}`).then((r) => r.data);
  },
  investments: (month?: number | null, year?: number | null) =>
    api
      .get(`/analytics/investments${timeParams(month, year)}`)
      .then((r) => r.data),
  trend: (months = 12) =>
    api.get(`/analytics/trend?months=${months}`).then((r) => r.data),
};

export const predictionsApi = {
  nextMonth: () => api.get("/predictions/next-month").then((r) => r.data),
  anomalies: () => api.get("/predictions/anomalies").then((r) => r.data),
  savings: () => api.get("/predictions/savings").then((r) => r.data),
  investmentGrowth: (years = 5) =>
    api
      .get(`/predictions/investment-growth?years=${years}`)
      .then((r) => r.data),
};

export const agentApi = {
  chat: (message: string) =>
    api.post("/agent/chat", { message }).then((r) => r.data),
  history: () => api.get("/agent/history").then((r) => r.data),
  insights: () => api.get("/agent/insights").then((r) => r.data),
  tools: () => api.get("/agent/tools").then((r) => r.data),
};
