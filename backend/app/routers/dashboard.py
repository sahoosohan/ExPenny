"""Monthly dashboard and spending trend endpoints."""

import datetime as dt
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.crud import (
    get_category_spending,
    get_expense_count_for_month,
    get_month_range,
    get_monthly_trend,
    get_recent_expenses,
)
from app.database import get_db
from app.models import User
from app.schemas import DashboardSummary, TrendData

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(
    month: str = Query(default_factory=lambda: dt.date.today().strftime("%Y-%m"), pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    get_month_range(month)
    categories = get_category_spending(db, user.id, month)
    spent = sum((item["spent"] for item in categories), Decimal("0"))
    budget = sum((item["budget"] for item in categories if item["budget"] is not None), Decimal("0"))
    alerts = [
        {
            "category_id": item["id"],
            "category": item["name"],
            "spent": item["spent"],
            "limit": item["budget"],
            "percent": item["percent"],
            "level": item["status"],
        }
        for item in categories
        if item["status"] in ("warning", "exceeded")
    ]
    return {
        "month": month,
        "total_spent": spent,
        "total_budget": budget,
        "remaining": budget - spent,
        "expense_count": get_expense_count_for_month(db, user.id, month),
        "categories": categories,
        "alerts": alerts,
        "recent": get_recent_expenses(db, user.id, month),
    }


@router.get("/trend", response_model=TrendData)
def dashboard_trend(
    months: int = Query(6, ge=1, le=24),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return {"months": get_monthly_trend(db, user.id, months)}
