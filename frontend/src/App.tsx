import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Car, Check, ChevronLeft, ChevronRight, CircleAlert, CircleDollarSign, Clapperboard, Coffee, CreditCard, Ellipsis, GraduationCap, HeartPulse, Home, LayoutDashboard, LoaderCircle, LogOut, Moon, Plane, Plus, Search, ShieldCheck, ShoppingBag, Sun, Tag, Trash2, Utensils, Wallet, X, Zap, type LucideIcon } from "lucide-react";
import { toast, Toaster } from "sonner";
import { api, ApiError, type Category, type Dashboard, type Expense, type User } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 1 } } });
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: { theme: "outline"; size: "large"; text: "signin_with" | "signup_with"; shape: "rectangular"; width: number }) => void;
        };
      };
    };
  }
}
const money = (amount: string | number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(amount));
const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const currentMonth = () => localDate().slice(0, 7);
const monthLabel = (month: string) => new Date(`${month}-02T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const toMonth = (month: string, delta: number) => { const [y, m] = month.split("-").map(Number); return localDate(new Date(y, m - 1 + delta, 1)).slice(0, 7); };
const shortDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const categoryIcons: Record<string, LucideIcon> = { utensils: Utensils, car: Car, home: Home, zap: Zap, "shopping-bag": ShoppingBag, "heart-pulse": HeartPulse, clapperboard: Clapperboard, "graduation-cap": GraduationCap, plane: Plane, ellipsis: Ellipsis };
function CategoryGlyph({ category, size = 16 }: { category: Category; size?: number }) { const Icon = categoryIcons[category.icon] ?? Tag; return <Icon size={size} />; }

function Shell({ user, onSignOut }: { user: User; onSignOut: () => Promise<void> }) {
  const [dark, setDark] = useState(() => localStorage.getItem("expenny-theme") === "dark");
  const [mobileMenu, setMobileMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); localStorage.setItem("expenny-theme", dark ? "dark" : "light"); }, [dark]);
  useEffect(() => setMobileMenu(false), [loc.pathname]);
  const links = [
    { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/expenses", label: "Expenses", icon: CreditCard },
    { to: "/budgets", label: "Budgets", icon: Wallet },
  ];
  return <div className="min-h-screen bg-[#f5f6f8] text-slate-900 dark:bg-[#101411] dark:text-slate-100">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-slate-200/80 bg-white px-5 py-7 dark:border-white/10 dark:bg-[#151a16] lg:flex">
      <Brand />
      <p className="mb-3 mt-12 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Workspace</p>
      <nav className="space-y-1">{links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5"}`}><Icon size={18} strokeWidth={1.8} />{label}</NavLink>)}</nav>
      <div className="mt-auto rounded-2xl bg-[#eff6f1] p-4 dark:bg-emerald-950/40"><div className="mb-3 flex size-9 items-center justify-center rounded-xl bg-white text-emerald-700 dark:bg-white/10 dark:text-emerald-300"><CircleDollarSign size={18} /></div><p className="text-sm font-semibold">Small steps add up.</p><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Keep your spending visible and your goals within reach.</p></div>
      <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-5 dark:border-white/10"><Avatar user={user} /><div className="min-w-0"><p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-xs text-slate-400">{user.email}</p></div><button aria-label="Sign out" title="Sign out" onClick={() => void onSignOut()} className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-white/5"><LogOut size={16}/></button></div>
    </aside>
    <div className="lg:pl-[248px]">
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#151a16]/90 sm:px-8">
        <div className="flex items-center gap-3"><button onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle navigation" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden">{mobileMenu ? <X size={19} /> : <span className="text-lg">☰</span>}</button><div className="lg:hidden"><Brand /></div><span className="hidden text-sm text-slate-400 sm:block">Personal finance / <span className="text-slate-700 dark:text-slate-200">{loc.pathname === "/" ? "Overview" : loc.pathname.slice(1).replace(/^./, s => s.toUpperCase())}</span></span></div>
        <div className="flex items-center gap-2"><div className="hidden items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-500 sm:flex"><span className="size-2 rounded-full bg-emerald-500" />Your data is private</div><button aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={() => setDark(!dark)} className="flex size-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5">{dark ? <Sun size={17} /> : <Moon size={17} />}</button><button aria-label="Sign out" title="Sign out" onClick={() => void onSignOut()} className="flex size-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:hover:bg-white/5"><LogOut size={16}/></button><Avatar user={user}/></div>
      </header>
      {mobileMenu && <nav className="absolute z-30 w-full space-y-1 border-b bg-white p-4 shadow-lg dark:bg-[#151a16] lg:hidden">{links.map(({to,label,icon:Icon,end})=><NavLink key={to} to={to} end={end} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm hover:bg-slate-50 dark:hover:bg-white/5"><Icon size={18}/>{label}</NavLink>)}</nav>}
      <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-8 sm:py-9"><Routes><Route path="/" element={<DashboardPage />} /><Route path="/expenses" element={<ExpensesPage />} /><Route path="/budgets" element={<BudgetsPage />} /></Routes></main>
    </div><Toaster richColors position="top-right" />
  </div>;
}

function Avatar({ user }: { user: User }) {
  return user.picture
    ? <img src={user.picture} alt="" referrerPolicy="no-referrer" className="size-9 shrink-0 rounded-full bg-emerald-100 object-cover" />
    : <div aria-label={user.name} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#dbece0] text-xs font-bold text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">{user.name.trim().slice(0, 1).toUpperCase()}</div>;
}

type AuthMode = "signin" | "signup";

function AuthPage({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const buttonRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef<(credential: string) => void>(() => undefined);
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "").trim();

  callbackRef.current = (credential) => {
    setBusy(true);
    setError("");
    void api.googleLogin(credential)
      .then(({ user }) => onSignedIn(user))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Google sign-in failed. Please try again."))
      .finally(() => setBusy(false));
  };

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    const script = document.getElementById("google-identity-services") as HTMLScriptElement | null
      ?? document.createElement("script");
    const renderButton = () => {
      if (cancelled || !buttonRef.current || !window.google) return;
      buttonRef.current.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => callbackRef.current(response.credential),
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        text: mode === "signup" ? "signup_with" : "signin_with",
        shape: "rectangular",
        width: Math.min(buttonRef.current.clientWidth || 320, 320),
      });
    };
    const onScriptError = () => setError("Google sign-in could not load. Check your connection and try again.");
    if (window.google) {
      renderButton();
      return () => { cancelled = true; };
    }
    script.id = "google-identity-services";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", renderButton);
    script.addEventListener("error", onScriptError);
    if (!script.isConnected) document.head.appendChild(script);
    return () => {
      cancelled = true;
      script.removeEventListener("load", renderButton);
      script.removeEventListener("error", onScriptError);
    };
  }, [clientId, mode]);

  const isSignup = mode === "signup";
  return <div className="flex min-h-screen items-center justify-center overflow-hidden bg-[#f3f6f3] px-4 py-10 dark:bg-[#101411]">
    <div className="pointer-events-none fixed -left-28 -top-28 size-[430px] rounded-full bg-emerald-200/35 blur-3xl dark:bg-emerald-900/15" />
    <div className="pointer-events-none fixed -bottom-40 -right-24 size-[500px] rounded-full bg-lime-100/60 blur-3xl dark:bg-emerald-950/25" />
    <div className="relative grid w-full max-w-[960px] overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_30px_100px_rgba(15,45,29,.12)] dark:border-white/10 dark:bg-[#151a16] lg:min-h-[590px] lg:grid-cols-[.95fr_1.05fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#174b36] p-10 text-white lg:flex">
        <div className="absolute -right-24 top-20 size-80 rounded-full border border-white/10" /><div className="absolute -right-12 top-32 size-56 rounded-full border border-white/10" /><div className="absolute -bottom-28 -left-20 size-72 rounded-full bg-emerald-400/10" />
        <div className="relative"><Brand/><p className="mt-20 max-w-sm text-4xl font-semibold leading-[1.15] tracking-tight">A clearer picture of your money starts here.</p><p className="mt-5 max-w-sm text-sm leading-6 text-emerald-50/75">Keep your spending organized, your plans personal, and your goals in view.</p></div>
        <div className="relative flex items-center gap-2 text-xs text-emerald-50/70"><ShieldCheck size={15}/> Your expenses stay private to your account.</div>
      </section>
      <section className="flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-14">
        <div className="mb-9 lg:hidden"><Brand/></div>
        <p className="text-[10px] font-bold uppercase tracking-[.2em] text-emerald-700 dark:text-emerald-400">Personal finance, made simple</p>
        <h1 className="mt-3 text-[30px] font-semibold tracking-tight">{isSignup ? "Make room for better habits." : "Welcome back."}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{isSignup ? "Create your private ExPenny account to get started." : "Sign in to pick up where you left off."}</p>
        <div className="mt-7 grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-white/[.06]" role="tablist" aria-label="Account access">
          <button role="tab" aria-selected={!isSignup} onClick={() => { setMode("signin"); setError(""); }} className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${!isSignup ? "bg-white text-slate-900 shadow-sm dark:bg-[#252d27] dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400"}`}>Sign in</button>
          <button role="tab" aria-selected={isSignup} onClick={() => { setMode("signup"); setError(""); }} className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${isSignup ? "bg-white text-slate-900 shadow-sm dark:bg-[#252d27] dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400"}`}>Create account</button>
        </div>
        <div className="mt-6 rounded-2xl border border-slate-200 p-5 dark:border-white/10 sm:p-6">
          <p className="mb-4 text-sm font-semibold">{isSignup ? "Continue with Google to create your account" : "Continue with Google to sign in"}</p>
          {clientId ? <div className="flex min-h-11 justify-center" ref={buttonRef} /> : <div className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Google sign-in needs a client ID. Set <code>VITE_GOOGLE_CLIENT_ID</code> in <code>frontend/.env.local</code> and <code>GOOGLE_CLIENT_ID</code> in <code>backend/.env</code>.</div>}
          {busy && <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500"><LoaderCircle size={14} className="animate-spin"/> Verifying your Google account…</div>}
          {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-xs leading-5 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
        </div>
        <div className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-400"><ShieldCheck className="mt-0.5 shrink-0" size={15}/><span>Google securely confirms your identity. ExPenny receives your name and email and never sees your Google password.</span></div>
        <p className="mt-8 text-center text-[11px] text-slate-400">By continuing, you agree to use ExPenny responsibly.</p>
      </section>
    </div>
  </div>;
}

function AuthGate() {
  const queryClient = useQueryClient();
  const [signedOut, setSignedOut] = useState(false);
  const account = useQuery({ queryKey: ["account"], queryFn: api.me, retry: false });
  if (signedOut || (account.isError && account.error instanceof ApiError && account.error.status === 401)) {
    return <AuthPage onSignedIn={(user) => { queryClient.setQueryData(["account"], user); setSignedOut(false); }} />;
  }
  if (account.isLoading) return <Loading />;
  if (account.isError || !account.data) {
    return <div className="min-h-screen bg-[#f5f6f8] px-4 py-16 dark:bg-[#101411]"><div className="mx-auto max-w-2xl"><ErrorState message={account.error instanceof Error ? account.error.message : "Could not connect to ExPenny."} retry={() => { void account.refetch(); }} /></div></div>;
  }
  const signOut = async () => {
    try {
      await api.logout();
      setSignedOut(true);
      queryClient.clear();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out.");
    }
  };
  return <Shell user={account.data} onSignOut={signOut} />;
}

function Brand() { return <Link to="/" className="flex items-center gap-2.5"><span className="flex size-9 items-center justify-center rounded-xl bg-[#184e38] text-white"><Wallet size={19} strokeWidth={2.3} /></span><span className="text-[19px] font-bold tracking-tight">ex<span className="text-emerald-700 dark:text-emerald-400">penny</span><span className="ml-1 text-emerald-600">.</span></span></Link>; }

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) { return <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-emerald-700 dark:text-emerald-400">{eyebrow}</p><h1 className="text-[27px] font-semibold tracking-tight sm:text-[32px]">{title}</h1><p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{description}</p></div>{action}</div>; }

function Loading() { return <div className="flex min-h-56 items-center justify-center text-slate-400"><LoaderCircle className="animate-spin" size={25} /></div>; }
function ErrorState({ message, retry }: { message: string; retry: () => void }) { return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/30"><p className="font-semibold text-red-800 dark:text-red-300">Could not load this page</p><p className="mt-1 text-sm text-red-700/80 dark:text-red-300/70">{message}</p><Button variant="outline" className="mt-4" onClick={retry}>Try again</Button></div>; }
function Stat({ label, amount, note, icon: Icon, tint, trend }: { label: string; amount: string; note: string; icon: typeof Wallet; tint: string; trend?: string }) { return <Card className="gap-0 rounded-2xl border-slate-200/80 py-0 shadow-[0_2px_12px_rgba(15,23,42,.025)] dark:border-white/10"><CardContent className="p-5 sm:p-5"><div className="flex items-start justify-between"><div><p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">{label}</p><p className="mt-3 text-[25px] font-semibold tracking-tight tabular-nums">{amount}</p></div><span className={`flex size-10 items-center justify-center rounded-xl ${tint}`}><Icon size={19}/></span></div><div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">{trend && <span className="flex items-center text-emerald-700 dark:text-emerald-400"><ArrowUpRight size={14}/>{trend}</span>}{note}</div></CardContent></Card>; }

function DashboardPage() {
  const [month, setMonth] = useState(currentMonth);
  const summary = useQuery({ queryKey: ["dashboard", month], queryFn: () => api.dashboard(month) });
  const trend = useQuery({ queryKey: ["trend"], queryFn: api.trend });
  if (summary.isLoading) return <Loading />;
  if (summary.isError || !summary.data) return <ErrorState message={(summary.error as Error)?.message ?? "Please try again."} retry={() => summary.refetch()} />;
  const data = summary.data;
  const months = trend.data?.months.map(m => ({ ...m, total: Number(m.total), label: new Date(`${m.month}-02`).toLocaleDateString("en-IN", { month: "short" }) })) ?? [];
  const pie = data.categories.filter(c => Number(c.spent) > 0).map(c => ({ name: c.name, value: Number(c.spent), color: c.color }));
  return <>
    <PageHeading eyebrow="Your money, in focus" title="Good things are growing." description="Here’s your spending snapshot for the month." action={<div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-[#151a16]"><Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => setMonth(toMonth(month, -1))}><ChevronLeft size={17}/></Button><span className="min-w-28 text-center text-sm font-medium">{monthLabel(month)}</span><Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => setMonth(toMonth(month, 1))}><ChevronRight size={17}/></Button></div>} />
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Total spent" amount={money(data.total_spent)} note="Across all categories" icon={ArrowDownRight} tint="bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" trend="This month"/><Stat label="Monthly budget" amount={money(data.total_budget)} note="Set across categories" icon={Wallet} tint="bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"/><Stat label="Left to spend" amount={money(data.remaining)} note="Budget minus spending" icon={CircleDollarSign} tint="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"/><Stat label="Transactions" amount={String(data.expense_count)} note="Recorded this month" icon={CreditCard} tint="bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"/></div>
    {data.alerts.length > 0 && <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-900/70 dark:bg-amber-950/30"><div className="flex items-start gap-3"><CircleAlert size={20} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300"/><div><p className="font-semibold text-amber-950 dark:text-amber-200">A little heads up</p><div className="mt-1 space-y-1 text-sm text-amber-900/80 dark:text-amber-200/80">{data.alerts.map(a => <p key={a.category_id}><strong>{a.category}</strong> is {a.level === "exceeded" ? `over budget by ${money(Number(a.spent) - Number(a.limit))}` : `at ${a.percent}% of its budget`} ({money(a.spent)} of {money(a.limit)}).</p>)}</div></div></div></div>}
    <div className="mb-6 grid gap-5 xl:grid-cols-[1.55fr_1fr]"><Card className="gap-0 rounded-2xl border-slate-200/80 py-0 dark:border-white/10"><CardContent className="p-5 sm:p-6"><div className="mb-6 flex items-start justify-between"><div><h2 className="font-semibold">Spending rhythm</h2><p className="mt-1 text-xs text-slate-500">Your month-by-month overview</p></div><span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Last 6 months</span></div><div className="h-[230px]" aria-label="Monthly spending trend"><ResponsiveContainer width="100%" height="100%"><AreaChart data={months} margin={{ left: -18, right: 6, top: 8, bottom: 0 }}><defs><linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#26835d" stopOpacity={0.2}/><stop offset="95%" stopColor="#26835d" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="4 5" stroke="#e7ebe8"/><XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#89938d" }} dy={10}/><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#89938d" }} tickFormatter={v => v >= 1000 ? `₹${v / 1000}k` : `₹${v}`}/><Tooltip formatter={v => money(Number(v))} contentStyle={{ borderRadius: 12, borderColor: "#e5e7eb", fontSize: 12 }}/><Area type="monotone" dataKey="total" stroke="#287b59" strokeWidth={2.5} fill="url(#spendFill)" activeDot={{ r: 5 }}/></AreaChart></ResponsiveContainer></div></CardContent></Card>
      <Card className="gap-0 rounded-2xl border-slate-200/80 py-0 dark:border-white/10"><CardContent className="p-5 sm:p-6"><div><h2 className="font-semibold">Where it goes</h2><p className="mt-1 text-xs text-slate-500">Spending split this month</p></div>{pie.length ? <><div className="mx-auto mt-3 h-[185px] max-w-[280px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={61} outerRadius={83} paddingAngle={3} stroke="none">{pie.map(entry=><Cell key={entry.name} fill={entry.color}/>)}</Pie><Tooltip formatter={v => money(Number(v))} contentStyle={{ borderRadius: 12, borderColor: "#e5e7eb", fontSize: 12 }} labelStyle={{ color: "#475569", fontWeight: 600 }} itemStyle={{ color: "#334155" }}/></PieChart></ResponsiveContainer></div><div className="mb-4 flex items-center justify-center gap-2 text-xs"><span className="text-slate-400">Total spent</span><b className="text-sm text-slate-900 dark:text-white">{money(data.total_spent)}</b></div><div className="grid grid-cols-2 gap-x-3 gap-y-2">{pie.slice(0,6).map(c=><div key={c.name} className="flex min-w-0 items-center gap-2 text-xs"><span className="size-2 shrink-0 rounded-full" style={{backgroundColor:c.color}}/><span className="truncate text-slate-500">{c.name}</span><b className="ml-auto">{Math.round(c.value / (Number(data.total_spent) || 1) * 100)}%</b></div>)}</div></> : <div className="flex h-[255px] flex-col items-center justify-center text-center"><span className="mb-3 rounded-2xl bg-slate-50 p-3 text-slate-400 dark:bg-white/5"><Coffee size={22}/></span><p className="text-sm font-medium">No spending yet</p><p className="mt-1 text-xs text-slate-400">Add an expense to see your breakdown.</p></div>}</CardContent></Card></div>
    <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]"><Card className="gap-0 rounded-2xl border-slate-200/80 py-0 dark:border-white/10"><CardContent className="p-5 sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">Category budgets</h2><p className="mt-1 text-xs text-slate-500">How you’re tracking this month</p></div><Link to="/budgets" className="text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-300">Manage budgets <ArrowRight className="ml-1 inline" size={13}/></Link></div><div className="space-y-4">{data.categories.filter(c => c.budget !== null).slice(0,5).map(c=><BudgetLine key={c.id} category={c} />)}{data.categories.every(c => c.budget === null) && <EmptyLine text="No budgets set yet." link="/budgets" label="Set your first budget"/>}</div></CardContent></Card>
      <Card className="gap-0 rounded-2xl border-slate-200/80 py-0 dark:border-white/10"><CardContent className="p-5 sm:p-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Recent activity</h2><p className="mt-1 text-xs text-slate-500">Your latest transactions</p></div><Link to="/expenses" className="text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-300">See all <ArrowRight className="ml-1 inline" size={13}/></Link></div>{data.recent.length ? <div className="divide-y divide-slate-100 dark:divide-white/5">{data.recent.map(e=><ExpenseRow key={e.id} expense={e}/>)}</div> : <EmptyLine text="No expenses this month." link="/expenses" label="Add an expense"/>}</CardContent></Card></div>
  </>;
}

function BudgetLine({ category }: { category: Dashboard["categories"][number] }) { const percent = category.percent ?? 0; const color = category.status === "exceeded" ? "bg-rose-500" : category.status === "warning" ? "bg-amber-500" : "bg-emerald-600"; return <div><div className="mb-2 flex items-center justify-between text-xs"><span className="font-medium">{category.name}</span><span className="text-slate-500">{money(category.spent)} <span className="text-slate-300">/</span> {money(category.budget ?? 0)}</span></div><div className="flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className={`h-full rounded-full ${color}`} style={{width:`${Math.min(percent,100)}%`}}/></div><span className="w-10 text-right text-[10px] text-slate-400">{percent.toFixed(0)}%</span></div></div>; }
function ExpenseRow({ expense }: { expense: Expense }) { return <div className="flex items-center gap-3 py-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{backgroundColor:`${expense.category.color}17`, color:expense.category.color}}><CategoryGlyph category={expense.category} size={15}/></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{expense.title}</p><p className="mt-1 text-[10px] text-slate-400">{expense.category.name} · {shortDate(expense.date)}</p></div><span className="text-xs font-semibold tabular-nums">−{money(expense.amount)}</span></div>; }
function EmptyLine({ text, link, label }: {text:string;link:string;label:string}) {return <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 text-center dark:border-white/10"><p className="text-sm text-slate-500">{text}</p><Link className="mt-2 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400" to={link}>{label} <ArrowRight className="ml-1 inline" size={12}/></Link></div>;}

function ExpensesPage() {
  const qc = useQueryClient(); const cats = useQuery({queryKey:["categories"],queryFn:api.categories});
  const [text,setText] = useState(""); const [q,setQ] = useState(""); const [category,setCategory] = useState(""); const [from,setFrom] = useState(""); const [to,setTo] = useState(""); const [page,setPage] = useState(1); const [editing,setEditing] = useState<Expense | null>(null); const [open,setOpen] = useState(false);
  useEffect(()=>{const timer=setTimeout(()=>{setQ(text);setPage(1)},300);return()=>clearTimeout(timer)},[text]);
  const params = useMemo(()=>{const p=new URLSearchParams({page:String(page),page_size:"20"});if(q)p.set("q",q);if(category)p.set("category_id",category);if(from)p.set("date_from",from);if(to)p.set("date_to",to);return p},[page,q,category,from,to]);
  const result = useQuery({queryKey:["expenses",params.toString()],queryFn:()=>api.expenses(params)});
  const del = useMutation({mutationFn:api.deleteExpense,onSuccess:()=>{toast.success("Expense removed");void qc.invalidateQueries();},onError:e=>toast.error((e as Error).message)});
  const clear=()=>{setText("");setQ("");setCategory("");setFrom("");setTo("");setPage(1)};
  return <><PageHeading eyebrow="Every little detail" title="Your expenses" description="A clear view of where your money is going." action={<Button className="rounded-xl bg-[#184e38] hover:bg-[#246746]" onClick={()=>{setEditing(null);setOpen(true)}}><Plus size={16}/> Add expense</Button>}/>
    <div className="mb-5 grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-[#151a16] md:grid-cols-[minmax(200px,1fr)_180px_150px_150px_auto]"><label className="relative"><span className="sr-only">Search expenses</span><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><Input placeholder="Search title or notes" value={text} onChange={e=>setText(e.target.value)} className="pl-9"/></label><label><span className="sr-only">Filter by category</span><select value={category} onChange={e=>{setCategory(e.target.value);setPage(1)}} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm dark:bg-[#151a16]"><option value="">All categories</option>{cats.data?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="relative"><span className="sr-only">Start date</span><CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15}/><Input type="date" aria-label="Start date" value={from} onChange={e=>{setFrom(e.target.value);setPage(1)}} className="pl-9"/></label><label className="relative"><span className="sr-only">End date</span><CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15}/><Input type="date" aria-label="End date" value={to} onChange={e=>{setTo(e.target.value);setPage(1)}} className="pl-9"/></label><Button variant="ghost" onClick={clear} className="text-slate-500">Clear</Button></div>
    {result.isLoading ? <Loading/> : result.isError ? <ErrorState message={(result.error as Error).message} retry={()=>result.refetch()}/> : <Card className="gap-0 overflow-hidden rounded-2xl border-slate-200/80 py-0 dark:border-white/10"><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b bg-slate-50/80 text-[10px] font-bold uppercase tracking-[.13em] text-slate-400 dark:border-white/10 dark:bg-white/[.025]"><tr><th className="px-5 py-3.5">Transaction</th><th className="px-5 py-3.5">Category</th><th className="px-5 py-3.5">Date</th><th className="px-5 py-3.5 text-right">Amount</th><th className="px-5 py-3.5 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-white/5">{result.data?.items.map(e=><tr key={e.id} className="hover:bg-slate-50/70 dark:hover:bg-white/[.025]"><td className="px-5 py-4"><p className="font-semibold">{e.title}</p>{e.notes&&<p className="mt-1 max-w-72 truncate text-xs text-slate-400">{e.notes}</p>}</td><td className="px-5 py-4"><span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-2.5 py-1 text-xs dark:bg-white/5"><CategoryGlyph category={e.category} size={14}/>{e.category.name}</span></td><td className="px-5 py-4 text-xs text-slate-500">{shortDate(e.date)}</td><td className="px-5 py-4 text-right font-semibold tabular-nums">{money(e.amount)}</td><td className="px-5 py-4 text-right"><Button size="sm" variant="ghost" onClick={()=>{setEditing(e);setOpen(true)}}>Edit</Button><Button size="icon-sm" variant="ghost" aria-label={`Delete ${e.title}`} onClick={()=>{if(window.confirm(`Delete “${e.title}”?`))del.mutate(e.id)}}><Trash2 size={15} className="text-slate-400"/></Button></td></tr>)}{!result.data?.items.length&&<tr><td colSpan={5} className="p-12 text-center"><div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 dark:bg-white/5"><Search size={19}/></div><p className="font-medium">No expenses found</p><p className="mt-1 text-xs text-slate-400">Try adjusting your filters or add an expense.</p></td></tr>}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-white/10"><span>{result.data?.total ?? 0} transaction{result.data?.total===1?"":"s"}</span><div className="flex items-center gap-2"><span>Page {page} of {Math.max(1,result.data?.total_pages ?? 1)}</span><Button variant="outline" size="icon-sm" aria-label="Previous page" disabled={page<=1} onClick={()=>setPage(page-1)}><ChevronLeft size={15}/></Button><Button variant="outline" size="icon-sm" aria-label="Next page" disabled={page >= (result.data?.total_pages ?? 0)} onClick={()=>setPage(page+1)}><ChevronRight size={15}/></Button></div></div></Card>}
    {open&&<ExpenseDialog categories={cats.data??[]} expense={editing} close={()=>setOpen(false)} saved={(alerts)=>{setOpen(false);void qc.invalidateQueries();toast.success(editing?"Expense updated":"Expense added");alerts.forEach(a=>toast[a.level==="exceeded"?"error":"warning"](`${a.category}: ${a.level === "exceeded" ? "budget exceeded" : "nearing budget"} (${a.percent}%)`))}}/>}
  </>;
}

function ExpenseDialog({ categories, expense, close, saved }: {categories:Category[];expense:Expense|null;close:()=>void;saved:(alerts:import("@/lib/api").Alert[])=>void}) {
  const [title,setTitle]=useState(expense?.title??"");const [amount,setAmount]=useState(expense?.amount??"");const [category,setCategory]=useState(String(expense?.category_id??categories[0]?.id??""));const [date,setDate]=useState(expense?.date??localDate());const [notes,setNotes]=useState(expense?.notes??"");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setError("");if(!title.trim()||title.length>100){setError("Enter a title between 1 and 100 characters.");return}if(!/^[0-9]+(\.[0-9]{1,2})?$/.test(amount)||Number(amount)<=0){setError("Enter an amount greater than zero with up to 2 decimal places.");return}if(!category||!date){setError("Choose a category and date.");return}if(new Date(`${date}T00:00:00`) > new Date(new Date().setHours(23,59,59,999)+86400000)){setError("Date cannot be more than one day in the future.");return}setBusy(true);try{const result=expense?await api.updateExpense(expense.id,{title:title.trim(),amount,category_id:Number(category),date,notes:notes||null}):await api.createExpense({title:title.trim(),amount,category_id:Number(category),date,notes:notes||null});saved(result.alerts)}catch(err){setError((err as Error).message)}finally{setBusy(false)}}
  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><form onSubmit={submit} className="w-full max-w-lg rounded-2xl border bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#171d19]"><div className="mb-6 flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-emerald-700 dark:text-emerald-400">{expense?"Update transaction":"New transaction"}</p><h2 className="mt-1 text-xl font-semibold">{expense?"Edit expense":"Add an expense"}</h2></div><button type="button" onClick={close} aria-label="Close dialog" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"><X size={18}/></button></div><div className="grid gap-4 sm:grid-cols-2"><Field label="What was it for?" className="sm:col-span-2"><Input autoFocus placeholder="e.g. Weekly groceries" value={title} maxLength={100} onChange={e=>setTitle(e.target.value)}/></Field><Field label="Amount"><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span><Input className="pl-8" inputMode="decimal" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)}/></div></Field><Field label="Category"><select value={category} onChange={e=>setCategory(e.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm dark:bg-[#151a16]">{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Date"><Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field><Field label="Notes (optional)"><Input placeholder="Add a little context" value={notes} maxLength={500} onChange={e=>setNotes(e.target.value)}/></Field></div>{error&&<p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}<div className="mt-6 flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button disabled={busy} className="min-w-28 bg-[#184e38] hover:bg-[#246746]">{busy&&<LoaderCircle className="animate-spin" size={15}/>} {expense?"Save changes":"Add expense"}</Button></div></form></div>;
}
function Field({label,children,className=""}:{label:string;children:ReactNode;className?:string}){return <label className={`block space-y-1.5 ${className}`}><span className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>{children}</label>}

function BudgetsPage() {
  const qc=useQueryClient();const cats=useQuery({queryKey:["categories"],queryFn:api.categories});const budgets=useQuery({queryKey:["budgets"],queryFn:api.budgets});const dash=useQuery({queryKey:["dashboard",currentMonth()],queryFn:()=>api.dashboard(currentMonth())});
  const values=useMemo<Record<string,string>>(()=>Object.fromEntries((budgets.data??[]).map(b=>[b.category_id,b.monthly_limit])),[budgets.data]);
  const [drafts,setDrafts]=useState<Record<string,string>>({});useEffect(()=>setDrafts(values),[values]);
  const [busy,setBusy]=useState<number|null>(null);
  async function save(category:Category){const value=drafts[category.id]?.trim();if(!value||!/^\d+(\.\d{1,2})?$/.test(value)||Number(value)<=0){toast.error("Enter a monthly limit greater than zero (up to 2 decimals).");return}setBusy(category.id);try{await api.saveBudget(category.id,value);await qc.invalidateQueries();toast.success(`${category.name} budget saved`)}catch(e){toast.error((e as Error).message)}finally{setBusy(null)}}
  async function remove(category:Category){setBusy(category.id);try{await api.deleteBudget(category.id);await qc.invalidateQueries();toast.success(`${category.name} budget removed`)}catch(e){toast.error((e as Error).message)}finally{setBusy(null)}}
  if(cats.isLoading||budgets.isLoading)return <Loading/>;if(cats.isError||budgets.isError)return <ErrorState message="Could not load budgets." retry={()=>{void cats.refetch();void budgets.refetch()}}/>;
  const categories=cats.data??[];const spend=Object.fromEntries((dash.data?.categories??[]).map(c=>[c.id,c]));const total=categories.reduce((s,c)=>s+Number(values[c.id]??0),0);
  return <><PageHeading eyebrow="Plan with intention" title="Your monthly budgets" description="Set gentle limits that help your money go further." action={<div className="rounded-xl bg-white px-4 py-2.5 text-xs text-slate-500 shadow-sm dark:bg-[#151a16]">Total planned <strong className="ml-2 text-slate-900 dark:text-white">{money(total)}</strong></div>}/><div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-5 py-4 dark:border-emerald-900/50 dark:bg-emerald-950/25"><p className="text-sm font-semibold text-emerald-950 dark:text-emerald-200">A little structure goes a long way.</p><p className="mt-1 text-xs text-emerald-900/70 dark:text-emerald-200/65">Your limits repeat monthly. We’ll give you a heads up as you get close.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{categories.map(category=>{const current=spend[category.id];const used=Number(current?.spent??0);const limit=Number(values[category.id]??0);const pct=limit?used/limit*100:0;const state=pct>=100?"exceeded":pct>=80?"warning":"ok";return <Card key={category.id} className="gap-0 rounded-2xl border-slate-200/80 py-0 dark:border-white/10"><CardContent className="p-5"><div className="flex items-start justify-between"><span className="flex size-10 items-center justify-center rounded-xl" style={{backgroundColor:`${category.color}18`,color:category.color}}><CategoryGlyph category={category} size={17}/></span>{limit>0&&<span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${state==="exceeded"?"bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300":state==="warning"?"bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300":"bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"}`}>{state==="exceeded"?"Over budget":state==="warning"?"Nearing limit":"On track"}</span>}</div><h3 className="mt-4 font-semibold">{category.name}</h3><div className="mt-1 flex items-baseline justify-between"><span className="text-xs text-slate-500">Spent <b className="text-slate-800 dark:text-slate-200">{money(used)}</b></span>{limit>0&&<span className="text-[10px] text-slate-400">{pct.toFixed(0)}% used</span>}</div>{limit>0&&<div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className={`h-full rounded-full ${state==="exceeded"?"bg-rose-500":state==="warning"?"bg-amber-500":"bg-emerald-600"}`} style={{width:`${Math.min(pct,100)}%`}}/></div>}<div className="mt-5 flex gap-2"><label className="relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">₹</span><Input aria-label={`${category.name} monthly limit`} className="pl-7" type="number" min="0.01" step="0.01" placeholder="Set monthly limit" value={drafts[category.id]??""} onChange={e=>setDrafts({...drafts,[category.id]:e.target.value})}/></label><Button size="sm" className="bg-[#184e38] hover:bg-[#246746]" disabled={busy===category.id} onClick={()=>void save(category)}>{busy===category.id?<LoaderCircle size={15} className="animate-spin"/>:<Check size={15}/>}Save</Button></div>{limit>0&&<button onClick={()=>void remove(category)} disabled={busy===category.id} className="mt-3 text-[11px] font-medium text-slate-400 hover:text-rose-600">Remove limit</button>}</CardContent></Card>})}</div></>;
}

export default function App() { return <QueryClientProvider client={client}><BrowserRouter><AuthGate/></BrowserRouter></QueryClientProvider>; }
