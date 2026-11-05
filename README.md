# ExPenny

ExPenny is a personal expense tracker for logging purchases, reviewing monthly spending, and keeping category budgets in view. People sign in with Google; every user's expenses and budgets are isolated in the database. It uses a React and TypeScript frontend with a FastAPI and SQLite backend.

## Features

- Add, edit, delete, search, filter, and paginate expenses
- Dashboard with month selection, category totals, budget alerts, recent activity, and a six-month spending trend
- Reusable monthly budgets per category, with progress and warning states
- Server and form validation for amounts, dates, categories, and titles
- Responsive layout with a persistent light and dark theme
- Google sign-in and account creation with private, user-scoped data
- Revocable, HTTP-only browser sessions

## Run locally

Requirements: Python 3.10+ and Node.js 20.19+ (or 22.12+ for Vite 8).

From the project root, start both the API and frontend with one command:

```sh
./run.sh
```

The script creates the Python virtual environment and installs project dependencies when needed. On first run, it also creates `backend/.env` and `frontend/.env.local` from their examples; set the same Google Web client ID in both files, then run `./run.sh` again. Press `Ctrl+C` to stop both servers.

Before signing in, create a Google OAuth 2.0 **Web application** client in Google Cloud Console. Add `http://localhost:5173` (and `http://127.0.0.1:5173` if you use that address) as an authorized JavaScript origin.

1. Start the API:

   ```sh
   cd backend
   python -m venv .venv
   # Linux/macOS: source .venv/bin/activate
   # Windows PowerShell: .venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   cp .env.example .env
   # Set GOOGLE_CLIENT_ID in .env to your Google Web client ID.
   uvicorn app.main:app --reload --env-file .env
   ```

   The API creates its tables and seeds the fixed categories on startup. Optional sample records can be added with `python -m app.seed --demo` from `backend/`.

2. In another terminal, start the frontend:

   ```sh
   cd frontend
   npm install
   cp .env.example .env.local
   # Set VITE_GOOGLE_CLIENT_ID in .env.local to the same Google Web client ID.
   npm run dev
   ```

   Open the Vite URL shown in the terminal (normally <http://localhost:5173>). The dev server proxies `/api` requests to `http://localhost:8000`.

   In Google Cloud Console, configure the OAuth web client with both `http://localhost:5173` and `http://127.0.0.1:5173` under **Authorized JavaScript origins**. The frontend and backend client ID values must match. Google rejects sign-in with an origin error if the current Vite origin is missing.

The API schema is available at <http://localhost:8000/docs>. The default SQLite database is `backend/expenses.db`. Existing pre-login expense and budget rows are assigned to the first Google account that signs in. Set `DATABASE_URL` to use another SQLAlchemy database URL; for PostgreSQL, install a matching PostgreSQL driver and run the schema migration for that database.

## API overview

All routes are under `/api/v1`:

| Area | Routes |
| --- | --- |
| Authentication | `POST /auth/google`, `GET /auth/me`, `POST /auth/logout` |
| Categories | `GET /categories` |
| Expenses | `GET, POST /expenses`, `GET, PUT, DELETE /expenses/{id}` |
| Budgets | `GET /budgets`, `PUT, DELETE /budgets/{category_id}` |
| Dashboard | `GET /dashboard/summary?month=YYYY-MM`, `GET /dashboard/trend?months=6` |
| Health | `GET /health` |

Google's Identity Services button returns a signed ID token to the API. The API verifies it against `GOOGLE_CLIENT_ID`, identifies accounts by Google's stable subject ID, and issues a revocable HTTP-only session cookie. Expense list parameters include `q`, `category_id`, `date_from`, `date_to`, `page`, and `page_size`. Create and update responses include the saved expense and any newly crossed budget alerts.

## Project structure

- `backend/app/models.py` — SQLAlchemy data models
- `backend/app/crud.py` — expense, budget, and aggregation queries
- `backend/app/routers/` — FastAPI endpoints
- `frontend/src/App.tsx` — routed application screens and interactions
- `frontend/src/lib/api.ts` — typed API client and response types

## Future ideas

Authentication, recurring expenses, per-month budgets, CSV import/export, multiple currencies, receipt uploads, and bank sync are out of scope for v1.
