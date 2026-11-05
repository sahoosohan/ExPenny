"""ExPenny — FastAPI application entry point."""

from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

# Load the backend-local configuration before importing modules that read
# environment settings during import (for example GOOGLE_CLIENT_ID and CORS).
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import allowed_origins
from app.database import Base, engine, SessionLocal, upgrade_sqlite_user_schema
from app.seed import seed_categories
from app.routers import auth, budgets, categories, dashboard, expenses


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables and seed categories on startup."""
    Base.metadata.create_all(bind=engine)
    upgrade_sqlite_user_schema()
    db = SessionLocal()
    try:
        seed_categories(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="ExPenny API",
    description="Expense Tracker with Budget Alerts",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(categories.router)
app.include_router(auth.router)
app.include_router(expenses.router)
app.include_router(budgets.router)
app.include_router(dashboard.router)


@app.get("/api/v1/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok"}
