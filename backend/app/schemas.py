"""Pydantic v2 schemas for request/response validation."""

import datetime as dt
from decimal import Decimal, InvalidOperation

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---------------------------------------------------------------------------
# Category
# ---------------------------------------------------------------------------

class GoogleCredential(BaseModel):
    credential: str = Field(..., min_length=20, max_length=8192)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    picture: str | None


class LoginResponse(BaseModel):
    user: UserOut

class CategoryOut(BaseModel):
    """Category response schema."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    color: str
    icon: str


# ---------------------------------------------------------------------------
# Expense
# ---------------------------------------------------------------------------

class ExpenseCreate(BaseModel):
    """Validate input when creating an expense."""

    title: str = Field(..., min_length=1, max_length=100)
    amount: Decimal = Field(..., gt=0)
    category_id: int
    date: dt.date
    notes: str | None = Field(None, max_length=500)

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be blank")
        return value

    @field_validator("amount")
    @classmethod
    def amount_max_two_decimals(cls, v: Decimal) -> Decimal:
        """Ensure amount has at most 2 decimal places."""
        try:
            quantized = v.quantize(Decimal("0.01"))
        except InvalidOperation:
            raise ValueError("Amount must have at most 2 decimal places")
        if quantized != v:
            raise ValueError("Amount must have at most 2 decimal places")
        return quantized

    @field_validator("date")
    @classmethod
    def date_not_too_far_in_future(cls, v: dt.date) -> dt.date:
        """Date cannot be more than 1 day in the future."""
        tomorrow = dt.date.today() + dt.timedelta(days=1)
        if v > tomorrow:
            raise ValueError("Date cannot be more than 1 day in the future")
        return v


class ExpenseUpdate(BaseModel):
    """Validate input when updating an expense. All fields optional."""

    title: str | None = Field(None, min_length=1, max_length=100)
    amount: Decimal | None = Field(None, gt=0)
    category_id: int | None = None
    date: dt.date | None = None
    notes: str | None = Field(None, max_length=500)

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be blank")
        return value

    @field_validator("amount")
    @classmethod
    def amount_max_two_decimals(cls, v: Decimal | None) -> Decimal | None:
        if v is None:
            return v
        try:
            quantized = v.quantize(Decimal("0.01"))
        except InvalidOperation:
            raise ValueError("Amount must have at most 2 decimal places")
        if quantized != v:
            raise ValueError("Amount must have at most 2 decimal places")
        return quantized

    @field_validator("date")
    @classmethod
    def date_not_too_far_in_future(cls, v: dt.date | None) -> dt.date | None:
        if v is None:
            return v
        tomorrow = dt.date.today() + dt.timedelta(days=1)
        if v > tomorrow:
            raise ValueError("Date cannot be more than 1 day in the future")
        return v


class ExpenseOut(BaseModel):
    """Expense response schema."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    amount: Decimal
    category_id: int
    category: CategoryOut
    date: dt.date
    notes: str | None
    created_at: dt.datetime
    updated_at: dt.datetime


class PaginatedExpenses(BaseModel):
    """Paginated list of expenses."""

    items: list[ExpenseOut]
    total: int
    page: int
    page_size: int
    total_pages: int


# ---------------------------------------------------------------------------
# Alert
# ---------------------------------------------------------------------------

class AlertOut(BaseModel):
    """Budget alert returned after creating/updating expenses or on the dashboard."""

    category_id: int
    category: str
    spent: Decimal
    limit: Decimal
    percent: float
    level: str  # "warning" or "exceeded"


# ---------------------------------------------------------------------------
# Expense responses with alerts
# ---------------------------------------------------------------------------

class ExpenseWithAlerts(BaseModel):
    """Expense response that includes budget alerts triggered by this save."""

    expense: ExpenseOut
    alerts: list[AlertOut] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Budget
# ---------------------------------------------------------------------------

class BudgetCreate(BaseModel):
    """Validate input when creating/updating a budget."""

    monthly_limit: Decimal = Field(..., gt=0)

    @field_validator("monthly_limit")
    @classmethod
    def limit_max_two_decimals(cls, v: Decimal) -> Decimal:
        try:
            quantized = v.quantize(Decimal("0.01"))
        except InvalidOperation:
            raise ValueError("Limit must have at most 2 decimal places")
        if quantized != v:
            raise ValueError("Limit must have at most 2 decimal places")
        return quantized


class BudgetOut(BaseModel):
    """Budget response schema."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    category_id: int
    category: CategoryOut
    monthly_limit: Decimal


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

class CategorySpending(BaseModel):
    """Per-category spending for a given month."""

    id: int
    name: str
    color: str
    icon: str
    spent: Decimal
    budget: Decimal | None
    percent: float | None
    status: str  # "ok", "warning", "exceeded", "none"


class DashboardSummary(BaseModel):
    """Complete dashboard data for a month."""

    month: str
    total_spent: Decimal
    total_budget: Decimal
    remaining: Decimal
    expense_count: int
    categories: list[CategorySpending]
    alerts: list[AlertOut]
    recent: list[ExpenseOut]


class MonthlyTotal(BaseModel):
    """Monthly total for the trend chart."""

    month: str
    total: Decimal


class TrendData(BaseModel):
    """Trend data for the last N months."""

    months: list[MonthlyTotal]
