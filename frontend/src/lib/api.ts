export type Category = { id: number; name: string; color: string; icon: string };
export type Expense = {
  id: number; title: string; amount: string; category_id: number; category: Category;
  date: string; notes: string | null; created_at: string; updated_at: string;
};
export type Alert = { category_id: number; category: string; spent: string; limit: string; percent: number; level: "warning" | "exceeded" };
export type ExpensePage = { items: Expense[]; total: number; page: number; page_size: number; total_pages: number };
export type CategorySpending = Category & { spent: string; budget: string | null; percent: number | null; status: "ok" | "warning" | "exceeded" | "none" };
export type Dashboard = { month: string; total_spent: string; total_budget: string; remaining: string; expense_count: number; categories: CategorySpending[]; alerts: Alert[]; recent: Expense[] };
export type Budget = { id: number; category_id: number; category: Category; monthly_limit: string };
export type Trend = { month: string; total: string }[];
export type User = { id: number; email: string; name: string; picture: string | null };

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    throw new ApiError(Array.isArray(detail) ? detail.map((e: { msg: string }) => e.msg).join(" · ") : detail ?? `Request failed (${response.status})`, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  me: () => request<User>("/auth/me"),
  googleLogin: (credential: string) => request<{ user: User }>("/auth/google", { method: "POST", body: JSON.stringify({ credential }) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  categories: () => request<Category[]>("/categories"),
  expenses: (params: URLSearchParams) => request<ExpensePage>(`/expenses?${params}`),
  createExpense: (value: object) => request<{ expense: Expense; alerts: Alert[] }>("/expenses", { method: "POST", body: JSON.stringify(value) }),
  updateExpense: (id: number, value: object) => request<{ expense: Expense; alerts: Alert[] }>(`/expenses/${id}`, { method: "PUT", body: JSON.stringify(value) }),
  deleteExpense: (id: number) => request<void>(`/expenses/${id}`, { method: "DELETE" }),
  dashboard: (month: string) => request<Dashboard>(`/dashboard/summary?month=${month}`),
  trend: () => request<{ months: Trend }>("/dashboard/trend?months=6"),
  budgets: () => request<Budget[]>("/budgets"),
  saveBudget: (categoryId: number, monthly_limit: string) => request<Budget>(`/budgets/${categoryId}`, { method: "PUT", body: JSON.stringify({ monthly_limit }) }),
  deleteBudget: (categoryId: number) => request<void>(`/budgets/${categoryId}`, { method: "DELETE" }),
};
