---
name: expense-tracker-builder
description: Build, extend or debug the "Expense Tracker with Budget Alerts" full-stack project (React + Tailwind CSS + Shadcn/UI frontend, FastAPI + SQL backend, Git). Use this skill whenever the user mentions the expense tracker, budget alerts, expense CRUD, category totals, dashboard charts, FastAPI expense endpoints, Shadcn components for this app, or says "continue the project" or "next step", even if they do not name the skill. Always read PRD.md in the project root first.
---

# Expense Tracker Builder

Guides Claude to build the project in `PRD.md` one verified phase at a time. The goal is a fully working, well-designed app, not a skeleton.

## Ground rules

1. **Read `PRD.md` first.** It is the source of truth for scope, data model, API and acceptance criteria. Do not add features outside it without asking.
2. **Work in phases.** Finish and verify one phase before starting the next. After each phase, tell the user what was built, how to run/test it, and what comes next.
3. **Verify, don't assume.** Run the server, run tests, hit endpoints with curl, and load the UI. Report real results.
4. **Commit after every phase** using conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
5. **Keep it beginner-readable.** Short functions, clear names, comments that explain *why*.
6. **Money is `Decimal`**, never float. Month ranges use `>= start AND < next_start`.

## Phase 1: Setup and Git

```bash
mkdir expense-tracker && cd expense-tracker && git init
mkdir backend frontend
# Backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install fastapi "uvicorn[standard]" sqlalchemy pydantic pytest httpx
pip freeze > requirements.txt
# Frontend
cd ../frontend && npm create vite@latest . -- --template react-ts && npm install
npm install -D tailwindcss @tailwindcss/vite
npm install react-router-dom @tanstack/react-query react-hook-form zod @hookform/resolvers recharts date-fns lucide-react sonner
npx shadcn@latest init
npx shadcn@latest add button card input label select dialog alert-dialog table badge progress popover calendar form alert tabs skeleton dropdown-menu sheet tooltip sonner
```
Add `.gitignore` (`.venv/`, `node_modules/`, `*.db`, `.env`, `__pycache__/`, `dist/`). Commit: `chore: scaffold backend and frontend`.

**Verify:** `uvicorn app.main:app --reload` serves `/health`; `npm run dev` shows the Vite page.

## Phase 2: Database and models

- `database.py`: SQLAlchemy engine from `DATABASE_URL` (default `sqlite:///./expenses.db`), `SessionLocal`, `get_db` dependency.
- `models.py`: `Category`, `Expense`, `Budget` exactly as in the PRD (use `Numeric(12, 2)`, indexes on `expenses.date` and `expenses.category_id`).
- `seed.py`: insert the 10 categories with colors/icons; optional `--demo` flag adds ~40 realistic expenses across 3 months.
- Create tables on startup.

**Verify:** run the seed, open the DB (`sqlite3 expenses.db ".tables"`), confirm rows exist.

## Phase 3: Expense API

- `schemas.py` (Pydantic v2): `ExpenseCreate`, `ExpenseUpdate`, `ExpenseOut`, `Page[ExpenseOut]`. Validate `title` 1–100, `amount > 0` with 2 decimals, `date` not more than 1 day ahead, `category_id` exists.
- `routers/expenses.py`: `GET` (filters: `q` using `ILIKE` on title/notes, `category_id`, `date_from`, `date_to`, `page`, `page_size`), `POST`, `GET /{id}`, `PUT /{id}`, `DELETE /{id}` (204).
- Return 404 for missing rows and 422 for bad input. Enable CORS for `http://localhost:5173`.
- Prefix all routes with `/api/v1`.

**Verify:** pytest tests for create, update, delete, search, and each validation rule. Also test with curl.

## Phase 4: Budgets, dashboard and alerts

- `PUT /budgets/{category_id}` upserts, `DELETE` removes, `GET /budgets` lists.
- `GET /dashboard/summary?month=YYYY-MM` runs the GROUP BY / SUM query from the PRD and returns:
  `{ month, total_spent, total_budget, remaining, expense_count, categories: [{id, name, color, spent, budget, percent, status}], alerts: [...], recent: [...] }`
- `status`: `ok` (< 80%), `warning` (80–99%), `exceeded` (≥ 100%), `none` (no budget).
- `GET /dashboard/trend?months=6` returns monthly totals (use `strftime('%Y-%m', date)` in SQLite; `to_char` or `date_trunc` in PostgreSQL).
- `POST /expenses` and `PUT /expenses/{id}` also return an `alerts` array containing any category that crossed a threshold because of this change, so the UI can toast immediately.

**Verify:** tests for the PRD acceptance case (limit 100: spend 85 → `warning`, spend 105 → `exceeded`), month-boundary dates (the last day of a month and the first day of the next), and months with no data.

## Phase 5: Frontend shell

- Tailwind v4 via the Vite plugin; Shadcn theme tokens in `index.css`; Inter font.
- `lib/api.ts`: a typed `fetch` wrapper reading `VITE_API_URL`, throwing a typed error on non-2xx.
- `lib/schemas.ts`: Zod schemas mirroring the backend rules.
- `hooks/`: TanStack Query hooks (`useExpenses`, `useCreateExpense`, `useDashboard`, `useBudgets`, ...). Mutations invalidate `expenses`, `dashboard` and `budgets` queries.
- Layout: sidebar on desktop, `Sheet` menu on mobile, header with month context and a dark-mode toggle. Routes: `/`, `/expenses`, `/budgets`. Mount `<Toaster />` once.

**Verify:** navigation works, dark mode toggles and persists, the layout holds at 360 px and 1440 px.

## Phase 6: Expenses UI

- `ExpenseTable`: columns Date, Title, Category (colored badge + icon), Amount (right-aligned, currency formatted), Actions menu.
- `ExpenseFormDialog`: used for both add and edit; React Hook Form + Zod; Shadcn `Select` for category, `Popover` + `Calendar` for date; inline error messages; disabled submit while saving.
- `DeleteConfirm` using `AlertDialog`.
- Filters bar: debounced search input (300 ms), category select, date-range picker, "Clear filters".
- Pagination controls, skeleton loading, empty state, error state with retry.
- On save, show a success toast; if the response contains `alerts`, show a warning/destructive toast naming the category.

**Verify:** add, edit, delete, search and filter, then confirm the dashboard numbers change.

## Phase 7: Dashboard UI

- Month picker (prev/next arrows + label) that drives `useDashboard(month)`.
- 4 summary `Card`s (Total spent, Total budget, Remaining, Expenses count).
- **Alert banner:** Shadcn `Alert` (destructive variant for `exceeded`, amber for `warning`) with an icon, listing category, spent, limit and amount over. It must be visible without scrolling.
- Charts with Recharts: spent-vs-budget horizontal bars, category donut with a center total, 6-month trend. Use the category colors, add tooltips and accessible labels.
- Recent expenses list with a "View all" link.

**Verify:** totals equal the sum of the expense list for that month. Alerts appear and disappear correctly.

## Phase 8: Budgets UI

- One card per category: icon, name, current spent, limit input, `Progress` bar colored by status (green / amber / red), status badge text ("On track", "Nearing limit", "Over budget").
- Inline edit with Save, Remove-limit button, validation (> 0), toast on save.

**Verify:** change a limit and confirm the dashboard and alerts update without a page refresh.

## Phase 9: Polish and tests

- Backend: `pytest` green, covering validation, CRUD, search, aggregation, alerts.
- Frontend: add a few component tests with Vitest + Testing Library (form validation, alert rendering) if time allows.
- Accessibility: labels on all inputs, focus rings visible, dialogs trap focus, status never conveyed by color alone.
- Run `npm run lint`, `npm run build`, and fix warnings. Check the browser console for errors.
- Consistent spacing, hover/focus states, and smooth but subtle transitions.

## Phase 10: Docs and ship

- `README.md`: overview, screenshots, features, stack, setup in under 5 minutes, API docs link (`/docs`), project structure, future ideas.
- Optional deploy: backend on Render/Railway (switch `DATABASE_URL` to PostgreSQL), frontend on Vercel/Netlify with `VITE_API_URL`.
- Tag `v1.0.0`.

## Design standards

- **Look:** clean, spacious, neutral palette with one accent; rounded-xl cards, 1 px borders, light shadows; consistent 8 px spacing.
- **Typography:** Inter; clear hierarchy (page title 24–30 px, card title 14–16 px, numbers tabular and bold).
- **Status colors:** emerald (ok), amber (warning), red (exceeded), always with an icon and text.
- **Feedback:** every action gets loading, success and error feedback. Never leave a blank screen.
- **Responsive:** mobile first; tables become stacked cards or scroll horizontally on small screens.

## Definition of done (per phase)

- [ ] It runs without errors
- [ ] It was tested (automated or by hand) and the results were reported
- [ ] Code is formatted and linted
- [ ] It is committed with a clear message
- [ ] The user was told what's next

## Common pitfalls

| Problem | Fix |
|---------|-----|
| CORS blocked in the browser | Add the Vite origin to `allow_origins` in `CORSMiddleware` |
| Dashboard total off by a day | Use half-open ranges `>= start AND < next_start` |
| Amount shows `12.5` not `12.50` | Format with `Intl.NumberFormat` on the client |
| Stale UI after a mutation | Invalidate the relevant TanStack Query keys |
| Date shifts by a timezone | Send and store dates as `YYYY-MM-DD` strings, not timestamps |
| Shadcn component missing | `npx shadcn@latest add <name>` |
