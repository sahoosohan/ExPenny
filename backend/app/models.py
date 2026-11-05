"""SQLAlchemy ORM models matching the PRD data model."""

import datetime as dt
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Category(Base):
    """Fixed set of expense categories (seeded on startup)."""

    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    color: Mapped[str] = mapped_column(String(20), nullable=False)
    icon: Mapped[str] = mapped_column(String(50), nullable=False)

    # Relationships
    expenses: Mapped[list["Expense"]] = relationship(back_populates="category")
    budget: Mapped["Budget | None"] = relationship(back_populates="category")


class Expense(Base):
    """A single expense record."""

    __tablename__ = "expenses"
    __table_args__ = (
        CheckConstraint("length(title) >= 1 AND length(title) <= 100", name="ck_title_length"),
        CheckConstraint("amount > 0", name="ck_amount_positive"),
        Index("idx_expenses_date", "date"),
        Index("idx_expenses_category", "category_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    date: Mapped[dt.date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime, nullable=False, default=dt.datetime.utcnow
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime, nullable=False, default=dt.datetime.utcnow, onupdate=dt.datetime.utcnow
    )

    # Relationships
    category: Mapped["Category"] = relationship(back_populates="expenses")


class Budget(Base):
    """Monthly budget limit for a category (one limit per category, applies every month)."""

    __tablename__ = "budgets"
    __table_args__ = (
        CheckConstraint("monthly_limit > 0", name="ck_budget_positive"),
        UniqueConstraint("category_id", name="uq_budget_category"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), nullable=False)
    monthly_limit: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    # Relationships
    category: Mapped["Category"] = relationship(back_populates="budget")
