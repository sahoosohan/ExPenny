# PRD: Expense Tracker with Budget Alerts

**Version:** 1.0  **Status:** Ready to build
**Stack:** React.js (Vite), Tailwind CSS, Shadcn/UI, FastAPI (Python), SQL (SQLite → PostgreSQL ready), Git

---

## 1. Overview

A full-stack web app to record daily expenses, search and manage them, see monthly spending per category on a dashboard, and get a visible warning when spending crosses a monthly budget set for a category.

**Goal:** a polished, fully working portfolio project that demonstrates full-stack skills: REST API design, input validation, SQL aggregation (GROUP BY, SUM), and a clean component-based UI.

## 2. Target User

An individual who wants a simple, fast way to log expenses and stay within monthly category budgets. Single user, no login in v1.

## 3. Scope

### In scope (v1)
1. Expense CRUD: add, edit, delete, view
2. Search and filter: by text (title/notes), category, date range
3. Dashboard: monthly totals per category (SQL `GROUP BY` + `SUM`), month selector, charts
4. Budgets: set a monthly limit per category
5. Budget alerts: in-app warnings when spending is near or over the limit
6. Input validation on the API and the form
7. Responsive layout, light/dark mode

### Out of scope (v1)
Authentication, multi-user, recurring expenses, multi-currency, receipt upload, bank sync, mobile app.

## 4. Functional Requirements

### 4.1 Expenses
| ID | Requirement |
|----|-------------|
| E1 | User can add an expense: title, amount, category, date, optional notes |
| E2 | User can edit any field of an existing expense |
| E3 | User can delete an expense after a confirmation dialog |
| E4 | List is sorted by date (newest first) and paginated (20 per page) |
| E5 | Search by title/notes (debounced, 300 ms), filter by category and date range |
| E6 | Amount must be > 0, max 2 decimals; date cannot be more than 1 day in the future; title 1–100 chars |

### 4.2 Categories
Fixed, seeded list: Food, Transport, Rent, Utilities, Shopping, Health, Entertainment, Education, Travel, Other. Each has a color and icon used across the UI.

### 4.3 Dashboard
| ID | Requirement |
|----|-------------|
| D1 | Month selector (defaults to the current month) |
| D2 | Summary cards: total spent, total budget, remaining, number of expenses |
| D3 | Per-category table/bar chart: spent vs budget (from SQL GROUP BY / SUM) |
| D4 | Donut chart of category share |
| D5 | 6-month trend line/bar chart of total spending |
| D6 | Recent expenses list (last 5) |

### 4.4 Budgets
| ID | Requirement |
|----|-------------|
| B1 | User can set, update or remove a monthly limit per category |
| B2 | A budget applies to every month until changed (v1 simplification: one limit per category) |
| B3 | Progress bar per category: green < 80%, amber 80–99%, red ≥ 100% |
| B4 | **Warning state (80–99%):** amber badge "Nearing limit" |
| B5 | **Exceeded state (≥ 100%):** red alert banner on the dashboard and a toast when a newly saved expense pushes a category over the limit |
| B6 | Alert shows category, spent, limit and amount over |

## 5. Non-Functional Requirements

- **Performance:** API responses under 200 ms for typical data; list queries use indexes on `date` and `category_id`
- **Validation:** all input validated by Pydantic on the server and by Zod on the client
- **Accessibility:** keyboard navigable, labelled form fields, WCAG AA contrast, alerts not dependent on color alone (icon + text)
- **Responsive:** works from 360 px mobile to desktop
- **Reliability:** consistent error format, no unhandled 500s, loading and empty states everywhere
- **Code quality:** typed (TypeScript + Python type hints), linted, committed in small conventional commits

## 6. Data Model (SQL)

```sql
CREATE TABLE categories (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  icon  TEXT NOT NULL
);

CREATE TABLE expenses (
  id          INTEGER PRIMARY KEY,
  title       TEXT    NOT NULL CHECK (length(title) BETWEEN 1 AND 100),
  amount      NUMERIC NOT NULL CHECK (amount > 0),
  category_id INTEGER NOT NULL REFERENCES categories(id),
  date        DATE    NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_expenses_date     ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category_id);

CREATE TABLE budgets (
  id            INTEGER PRIMARY KEY,
  category_id   INTEGER NOT NULL UNIQUE REFERENCES categories(id),
  monthly_limit NUMERIC NOT NULL CHECK (monthly_limit > 0)
);
```

### Key aggregation query (dashboard)
```sql
SELECT c.id, c.name, c.color,
       COALESCE(SUM(e.amount), 0) AS spent,
       b.monthly_limit            AS budget
FROM categories c
LEFT JOIN expenses e
       ON e.category_id = c.id
      AND e.date >= :month_start AND e.date < :next_month_start
LEFT JOIN budgets b ON b.category_id = c.id
GROUP BY c.id, c.name, c.color, b.monthly_limit
ORDER BY spent DESC;
```

## 7. API Specification (FastAPI)

Base path: `/api/v1`. JSON only. Errors: `{ "detail": "message" }` (422 for validation).

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/categories` | List categories |
| GET | `/expenses` | List with `q`, `category_id`, `date_from`, `date_to`, `page`, `page_size` |
| POST | `/expenses` | Create (returns expense + `alerts` array if a budget is crossed) |
| GET | `/expenses/{id}` | Get one |
| PUT | `/expenses/{id}` | Update |
| DELETE | `/expenses/{id}` | Delete (204) |
| GET | `/budgets` | List budgets |
| PUT | `/budgets/{category_id}` | Create or update a limit |
| DELETE | `/budgets/{category_id}` | Remove a limit |
| GET | `/dashboard/summary?month=YYYY-MM` | Totals, per-category spent vs budget, alerts |
| GET | `/dashboard/trend?months=6` | Monthly totals for trend chart |
| GET | `/health` | Health check |

**Alert object:** `{ category_id, category, spent, limit, percent, level: "warning" | "exceeded" }`

## 8. UI / UX Design

### Design language
- Shadcn/UI components on Tailwind, neutral base with one accent (indigo/emerald)
- Font: Inter; 8 px spacing grid; rounded-xl cards with subtle borders and soft shadows
- Status colors: green (safe), amber (warning), red (exceeded), always paired with an icon
- Dark mode via Tailwind `class` strategy with a toggle

### Pages
1. **Dashboard** (`/`): month selector, 4 summary cards, alert banner (if any), category spent-vs-budget chart, donut chart, trend chart, recent expenses
2. **Expenses** (`/expenses`): search bar, category and date filters, data table with edit/delete actions, pagination, "Add expense" button opening a dialog
3. **Budgets** (`/budgets`): card per category with progress bar, inline limit editing

### Shadcn components
`button, card, input, label, select, dialog, alert-dialog, table, badge, progress, popover, calendar, form, sonner (toasts), alert, tabs, skeleton, dropdown-menu, sheet (mobile nav), tooltip`

### States to design for every screen
Loading (skeletons), empty (illustration + call to action), error (retry), success (toast).

## 9. Tech Architecture

```
expense-tracker/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, CORS, routers
│   │   ├── database.py        # engine, session
│   │   ├── models.py          # SQLAlchemy models
│   │   ├── schemas.py         # Pydantic models
│   │   ├── crud.py            # DB queries
│   │   ├── seed.py            # categories + demo data
│   │   └── routers/ (expenses.py, budgets.py, dashboard.py, categories.py)
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/ (ui/, expenses/, dashboard/, budgets/, layout/)
│   │   ├── pages/
│   │   ├── lib/ (api.ts, utils.ts, schemas.ts)
│   │   ├── hooks/ (TanStack Query hooks)
│   │   └── App.tsx
│   └── package.json
├── README.md
└── .gitignore
```

**Libraries:** SQLAlchemy 2.x, Pydantic v2, Uvicorn, pytest, httpx | React 18, Vite, TypeScript, React Router, TanStack Query, React Hook Form, Zod, Recharts, date-fns, lucide-react

## 10. Milestones

| # | Milestone | Done when |
|---|-----------|-----------|
| M1 | Setup and repo | Both apps run locally, Git initialised |
| M2 | Database and models | Tables and seed data created |
| M3 | Expense API | CRUD + search + validation tested |
| M4 | Budget and dashboard API | Aggregations and alerts correct |
| M5 | Frontend shell | Layout, routing, theme, API client |
| M6 | Expense UI | Add/edit/delete/search working end to end |
| M7 | Dashboard UI | Cards, charts, alerts working |
| M8 | Budgets UI | Set limits, progress and warnings working |
| M9 | Polish and tests | Responsive, a11y pass, tests green |
| M10 | Docs and ship | README with screenshots, deployed |

## 11. Acceptance Criteria

- [ ] Add, edit, delete and search expenses all work with no console or server errors
- [ ] Invalid input is rejected with clear messages on both client and server
- [ ] Dashboard totals exactly match the sum of expenses for the selected month
- [ ] Setting a budget of 100 and adding expenses totalling 85 shows a warning; totalling 105 shows an exceeded alert
- [ ] Alerts update immediately after add, edit, delete or budget change
- [ ] Works on mobile width and in dark mode
- [ ] Backend tests pass; README lets a new developer run the app in under 5 minutes

## 12. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Float rounding on money | Store as `Numeric`/`Decimal`, never float |
| Month boundary bugs | Use `>= month_start AND < next_month_start`, not `BETWEEN` |
| CORS errors in dev | Allow the Vite origin explicitly in FastAPI |
| Scope creep | Keep v1 scope fixed; log ideas in a "Future" section |

## 13. Future Ideas (v2)

Auth, recurring expenses, per-month budgets, CSV export/import, multi-currency, email alerts, PWA.
