"""Expenses router — CRUD + search + validation."""

import datetime as dt
import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User
from app.crud import (
    get_expenses,
    get_expense,
    create_expense,
    update_expense,
    delete_expense,
    get_category,
    check_alerts_for_expense,
    get_spending_for_category_in_month,
)
from app.schemas import (
    ExpenseCreate,
    ExpenseUpdate,
    ExpenseOut,
    ExpenseWithAlerts,
    PaginatedExpenses,
)

router = APIRouter(prefix="/api/v1/expenses", tags=["expenses"])


def _validate_category(db: Session, category_id: int) -> None:
    """Raise 422 if the category doesn't exist."""
    if not get_category(db, category_id):
        raise HTTPException(
            status_code=422,
            detail=f"Category with id {category_id} does not exist",
        )


@router.get("", response_model=PaginatedExpenses)
def list_expenses(
    q: str | None = Query(None, description="Search title/notes"),
    category_id: int | None = Query(None, description="Filter by category"),
    date_from: dt.date | None = Query(None, description="Start date (inclusive)"),
    date_to: dt.date | None = Query(None, description="End date (inclusive)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List expenses with optional search, filters, and pagination."""
    if date_from is not None and date_to is not None and date_from > date_to:
        raise HTTPException(status_code=422, detail="date_from must be on or before date_to")
    items, total = get_expenses(
        db,
        user.id,
        q=q,
        category_id=category_id,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
    return PaginatedExpenses(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 0,
    )


@router.post("", response_model=ExpenseWithAlerts, status_code=201)
def create_expense_endpoint(
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create a new expense. Returns the expense plus any budget alerts triggered."""
    _validate_category(db, data.category_id)
    previous_spent = get_spending_for_category_in_month(db, user.id, data.category_id, data.date.strftime("%Y-%m"))
    expense = create_expense(
        db,
        user_id=user.id,
        title=data.title,
        amount=data.amount,
        category_id=data.category_id,
        date=data.date,
        notes=data.notes,
    )
    alerts = check_alerts_for_expense(db, user.id, expense, previous_spent)
    return ExpenseWithAlerts(expense=ExpenseOut.model_validate(expense), alerts=alerts)


@router.get("/{expense_id}", response_model=ExpenseOut)
def get_expense_endpoint(
    expense_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get a single expense by id."""
    expense = get_expense(db, user.id, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense


@router.put("/{expense_id}", response_model=ExpenseWithAlerts)
def update_expense_endpoint(
    expense_id: int,
    data: ExpenseUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update an existing expense. Returns the expense plus any budget alerts triggered."""
    expense = get_expense(db, user.id, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    if data.category_id is not None:
        _validate_category(db, data.category_id)

    # Build kwargs with only provided fields
    update_data = data.model_dump(exclude_unset=True)
    nullable_fields = {"notes"}
    if any(value is None and field not in nullable_fields for field, value in update_data.items()):
        raise HTTPException(status_code=422, detail="Only notes may be cleared with null")
    target_category = update_data.get("category_id", expense.category_id)
    target_date = update_data.get("date", expense.date)
    previous_spent = get_spending_for_category_in_month(
        db, user.id, target_category, target_date.strftime("%Y-%m")
    )
    if target_category == expense.category_id and target_date.strftime("%Y-%m") == expense.date.strftime("%Y-%m"):
        previous_spent -= expense.amount
    expense = update_expense(db, expense, **update_data)
    alerts = check_alerts_for_expense(db, user.id, expense, previous_spent)
    return ExpenseWithAlerts(expense=ExpenseOut.model_validate(expense), alerts=alerts)


@router.delete("/{expense_id}", status_code=204)
def delete_expense_endpoint(
    expense_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete an expense."""
    expense = get_expense(db, user.id, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    delete_expense(db, expense)
    return None
