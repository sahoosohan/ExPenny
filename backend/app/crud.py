"""Database query functions (CRUD) for expenses, budgets, and dashboard."""

import datetime as dt
from decimal import Decimal

from sqlalchemy import func, case, or_
from sqlalchemy.orm import Session, joinedload

from app.models import Budget, Category, Expense


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------

def get_categories(db: Session) -> list[Category]:
    """Return all categories ordered by id."""
    return db.query(Category).order_by(Category.id).all()


def get_category(db: Session, category_id: int) -> Category | None:
    """Return a single category by id."""
    return db.query(Category).filter(Category.id == category_id).first()


# ---------------------------------------------------------------------------
# Expenses
# ---------------------------------------------------------------------------

def get_expenses(
    db: Session,
    user_id: int,
    *,
    q: str | None = None,
    category_id: int | None = None,
    date_from: dt.date | None = None,
    date_to: dt.date | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Expense], int]:
    """
    Query expenses with optional filters, pagination, and sorting.
    Returns (items, total_count).
    """
    query = db.query(Expense).options(joinedload(Expense.category)).filter(Expense.user_id == user_id)

    # Text search on title and notes (case-insensitive)
    if q:
        search = f"%{q}%"
        query = query.filter(
            or_(
                Expense.title.ilike(search),
                Expense.notes.ilike(search),
            )
        )

    # Category filter
    if category_id is not None:
        query = query.filter(Expense.category_id == category_id)

    # Date range using half-open interval: >= date_from AND < date_to + 1 day
    if date_from is not None:
        query = query.filter(Expense.date >= date_from)
    if date_to is not None:
        # Include the date_to day itself
        query = query.filter(Expense.date <= date_to)

    total = query.count()

    items = (
        query
        .order_by(Expense.date.desc(), Expense.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return items, total


def get_expense(db: Session, user_id: int, expense_id: int) -> Expense | None:
    """Return a single expense by id with its category eagerly loaded."""
    return (
        db.query(Expense)
        .options(joinedload(Expense.category))
        .filter(Expense.id == expense_id, Expense.user_id == user_id)
        .first()
    )


def create_expense(db: Session, **kwargs) -> Expense:
    """Create and return a new expense."""
    expense = Expense(**kwargs)
    db.add(expense)
    db.commit()
    db.refresh(expense)
    # Eagerly load the category relationship
    db.refresh(expense, attribute_names=["category"])
    return expense


def update_expense(db: Session, expense: Expense, **kwargs) -> Expense:
    """Update fields on an existing expense."""
    for key, value in kwargs.items():
        setattr(expense, key, value)
    expense.updated_at = dt.datetime.utcnow()
    db.commit()
    db.refresh(expense)
    db.refresh(expense, attribute_names=["category"])
    return expense


def delete_expense(db: Session, expense: Expense) -> None:
    """Delete an expense."""
    db.delete(expense)
    db.commit()


# ---------------------------------------------------------------------------
# Budgets
# ---------------------------------------------------------------------------

def get_budgets(db: Session, user_id: int) -> list[Budget]:
    """Return all budgets with their categories."""
    return (
        db.query(Budget)
        .options(joinedload(Budget.category))
        .filter(Budget.user_id == user_id)
        .order_by(Budget.category_id)
        .all()
    )


def get_budget_by_category(db: Session, user_id: int, category_id: int) -> Budget | None:
    """Return the budget for a specific category."""
    return (
        db.query(Budget)
        .options(joinedload(Budget.category))
        .filter(Budget.user_id == user_id, Budget.category_id == category_id)
        .first()
    )


def upsert_budget(db: Session, user_id: int, category_id: int, monthly_limit: Decimal) -> Budget:
    """Create or update a budget for a category."""
    budget = db.query(Budget).filter(Budget.user_id == user_id, Budget.category_id == category_id).first()
    if budget:
        budget.monthly_limit = monthly_limit
    else:
        budget = Budget(user_id=user_id, category_id=category_id, monthly_limit=monthly_limit)
        db.add(budget)
    db.commit()
    db.refresh(budget)
    db.refresh(budget, attribute_names=["category"])
    return budget


def delete_budget(db: Session, user_id: int, category_id: int) -> bool:
    """Delete a budget. Returns True if a budget was deleted."""
    budget = db.query(Budget).filter(Budget.user_id == user_id, Budget.category_id == category_id).first()
    if budget:
        db.delete(budget)
        db.commit()
        return True
    return False


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

def get_month_range(month_str: str) -> tuple[dt.date, dt.date]:
    """
    Parse 'YYYY-MM' and return (month_start, next_month_start) for half-open queries.
    """
    year, month = map(int, month_str.split("-"))
    month_start = dt.date(year, month, 1)
    if month == 12:
        next_month_start = dt.date(year + 1, 1, 1)
    else:
        next_month_start = dt.date(year, month + 1, 1)
    return month_start, next_month_start


def get_category_spending(db: Session, user_id: int, month_str: str) -> list[dict]:
    """
    Run the PRD aggregation query: per-category spent vs budget for a month.
    Uses >= month_start AND < next_month_start (half-open range).
    """
    month_start, next_month_start = get_month_range(month_str)

    results = (
        db.query(
            Category.id,
            Category.name,
            Category.color,
            Category.icon,
            func.coalesce(
                func.sum(
                    case(
                        (
                            (Expense.date >= month_start) & (Expense.date < next_month_start),
                            Expense.amount,
                        ),
                        else_=None,
                    )
                ),
                0,
            ).label("spent"),
            Budget.monthly_limit.label("budget"),
        )
        .outerjoin(Expense, (Expense.category_id == Category.id) & (Expense.user_id == user_id))
        .outerjoin(Budget, (Budget.category_id == Category.id) & (Budget.user_id == user_id))
        .group_by(Category.id, Category.name, Category.color, Category.icon, Budget.monthly_limit)
        .order_by(func.coalesce(
            func.sum(
                case(
                    (
                        (Expense.date >= month_start) & (Expense.date < next_month_start),
                        Expense.amount,
                    ),
                    else_=None,
                )
            ),
            0,
        ).desc())
        .all()
    )

    categories = []
    for row in results:
        spent = Decimal(str(row.spent)) if row.spent else Decimal("0")
        budget = Decimal(str(row.budget)) if row.budget else None

        if budget and budget > 0:
            percent = float(spent / budget * 100)
            if percent >= 100:
                status = "exceeded"
            elif percent >= 80:
                status = "warning"
            else:
                status = "ok"
        else:
            percent = None
            status = "none"

        categories.append({
            "id": row.id,
            "name": row.name,
            "color": row.color,
            "icon": row.icon,
            "spent": spent,
            "budget": budget,
            "percent": round(percent, 1) if percent is not None else None,
            "status": status,
        })

    return categories


def get_expense_count_for_month(db: Session, user_id: int, month_str: str) -> int:
    """Count expenses in a given month."""
    month_start, next_month_start = get_month_range(month_str)
    return (
        db.query(func.count(Expense.id))
        .filter(Expense.user_id == user_id, Expense.date >= month_start, Expense.date < next_month_start)
        .scalar()
    ) or 0


def get_recent_expenses(db: Session, user_id: int, month_str: str, limit: int = 5) -> list[Expense]:
    """Get the most recent expenses for a month."""
    month_start, next_month_start = get_month_range(month_str)
    return (
        db.query(Expense)
        .options(joinedload(Expense.category))
        .filter(Expense.user_id == user_id, Expense.date >= month_start, Expense.date < next_month_start)
        .order_by(Expense.date.desc(), Expense.id.desc())
        .limit(limit)
        .all()
    )


def get_spending_for_category_in_month(db: Session, user_id: int, category_id: int, month_str: str) -> Decimal:
    """Get the total spending for a category in a given month."""
    month_start, next_month_start = get_month_range(month_str)
    result = (
        db.query(func.coalesce(func.sum(Expense.amount), 0))
        .filter(
            Expense.category_id == category_id,
            Expense.user_id == user_id,
            Expense.date >= month_start,
            Expense.date < next_month_start,
        )
        .scalar()
    )
    return Decimal(str(result)) if result else Decimal("0")


def check_alerts_for_expense(
    db: Session, user_id: int, expense: Expense, previous_spent: Decimal = Decimal("0")
) -> list[dict]:
    """
    After saving an expense, return alerts for budget thresholds newly crossed.
    """
    month_str = expense.date.strftime("%Y-%m")
    budget = get_budget_by_category(db, user_id, expense.category_id)
    if not budget:
        return []

    spent = get_spending_for_category_in_month(db, user_id, expense.category_id, month_str)
    limit = budget.monthly_limit
    if limit <= 0:
        return []

    percent = float(spent / limit * 100)
    previous_percent = float(previous_spent / limit * 100)
    if percent >= 100 and previous_percent < 100:
        level = "exceeded"
    elif percent >= 80 and previous_percent < 80:
        level = "warning"
    else:
        return []

    return [{
        "category_id": expense.category_id,
        "category": budget.category.name,
        "spent": spent,
        "limit": limit,
        "percent": round(percent, 1),
        "level": level,
    }]


def get_monthly_trend(db: Session, user_id: int, months: int = 6) -> list[dict]:
    """
    Get total spending per month for the last N months.
    Uses strftime for SQLite compatibility.
    """
    today = dt.date.today()

    # Calculate the start date (first day of the month, N-1 months ago)
    start_month = today.month - months + 1
    start_year = today.year
    while start_month <= 0:
        start_month += 12
        start_year -= 1
    start_date = dt.date(start_year, start_month, 1)

    # End is the first day of next month
    if today.month == 12:
        end_date = dt.date(today.year + 1, 1, 1)
    else:
        end_date = dt.date(today.year, today.month + 1, 1)

    month_expression = (
        func.to_char(Expense.date, "YYYY-MM")
        if db.bind and db.bind.dialect.name == "postgresql"
        else func.strftime("%Y-%m", Expense.date)
    )
    results = (
        db.query(
            month_expression.label("month"),
            func.sum(Expense.amount).label("total"),
        )
        .filter(Expense.user_id == user_id, Expense.date >= start_date, Expense.date < end_date)
        .group_by(month_expression)
        .order_by(month_expression)
        .all()
    )

    # Build a complete list of months (including those with no data)
    result_map = {r.month: Decimal(str(r.total)) for r in results}
    trend = []
    current = start_date
    while current < end_date:
        month_key = current.strftime("%Y-%m")
        trend.append({
            "month": month_key,
            "total": result_map.get(month_key, Decimal("0")),
        })
        # Move to next month
        if current.month == 12:
            current = dt.date(current.year + 1, 1, 1)
        else:
            current = dt.date(current.year, current.month + 1, 1)

    return trend
