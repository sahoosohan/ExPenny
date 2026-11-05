"""Seed the database with categories and optional demo expenses."""

import argparse
import random
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.database import SessionLocal, engine
from app.models import Base, Budget, Category, Expense

# The 10 fixed categories from the PRD, each with a color and a Lucide icon name
CATEGORIES = [
    {"name": "Food", "color": "#ef4444", "icon": "utensils"},
    {"name": "Transport", "color": "#3b82f6", "icon": "car"},
    {"name": "Rent", "color": "#8b5cf6", "icon": "home"},
    {"name": "Utilities", "color": "#f59e0b", "icon": "zap"},
    {"name": "Shopping", "color": "#ec4899", "icon": "shopping-bag"},
    {"name": "Health", "color": "#10b981", "icon": "heart-pulse"},
    {"name": "Entertainment", "color": "#6366f1", "icon": "clapperboard"},
    {"name": "Education", "color": "#0ea5e9", "icon": "graduation-cap"},
    {"name": "Travel", "color": "#14b8a6", "icon": "plane"},
    {"name": "Other", "color": "#6b7280", "icon": "ellipsis"},
]

# Demo expenses: realistic entries spread across 3 months
DEMO_EXPENSES = [
    # Current month
    ("Grocery run", "Food", "35.50", 0, "Weekly groceries"),
    ("Uber ride", "Transport", "12.75", 1, None),
    ("Netflix subscription", "Entertainment", "15.99", 2, "Monthly plan"),
    ("Electricity bill", "Utilities", "89.00", 3, "November bill"),
    ("New headphones", "Shopping", "49.99", 4, None),
    ("Gym membership", "Health", "30.00", 5, "Monthly membership"),
    ("Online course", "Education", "29.99", 6, "Python advanced"),
    ("Restaurant dinner", "Food", "45.00", 7, "Birthday dinner"),
    ("Bus pass", "Transport", "50.00", 8, "Monthly pass"),
    ("Coffee shop", "Food", "8.50", 9, None),
    ("Doctor visit", "Health", "120.00", 10, "General checkup"),
    ("Movie tickets", "Entertainment", "24.00", 11, "2 tickets"),
    ("Phone bill", "Utilities", "45.00", 12, None),
    ("Books", "Education", "32.50", 13, "Programming books"),
    # Previous month
    ("Supermarket", "Food", "67.30", 35, "Bulk shopping"),
    ("Taxi fare", "Transport", "22.00", 36, "Airport"),
    ("Rent payment", "Rent", "1200.00", 31, "Monthly rent"),
    ("Water bill", "Utilities", "35.00", 37, None),
    ("Clothing", "Shopping", "85.50", 38, "Winter jacket"),
    ("Dentist", "Health", "150.00", 39, "Cleaning"),
    ("Concert", "Entertainment", "65.00", 40, None),
    ("Textbooks", "Education", "55.00", 41, "Semester books"),
    ("Lunch out", "Food", "18.75", 42, None),
    ("Gas refuel", "Transport", "42.00", 43, None),
    ("Internet bill", "Utilities", "60.00", 44, None),
    ("Snacks", "Food", "12.00", 45, None),
    ("Yoga class", "Health", "25.00", 46, None),
    # Two months ago
    ("Pizza delivery", "Food", "22.99", 62, None),
    ("Train ticket", "Transport", "35.00", 63, "Day trip"),
    ("Rent payment", "Rent", "1200.00", 61, "Monthly rent"),
    ("Gas bill", "Utilities", "55.00", 64, None),
    ("Shoes", "Shopping", "95.00", 65, "Running shoes"),
    ("Pharmacy", "Health", "18.50", 66, "Vitamins"),
    ("Streaming service", "Entertainment", "12.99", 67, None),
    ("Workshop fee", "Education", "40.00", 68, "Design workshop"),
    ("Weekend trip", "Travel", "250.00", 69, "Nearby city"),
    ("Coffee beans", "Food", "15.00", 70, "Specialty beans"),
    ("Parking fee", "Transport", "8.00", 71, None),
    ("Household items", "Shopping", "32.00", 72, "Cleaning supplies"),
    ("Misc expense", "Other", "20.00", 73, None),
]


def seed_categories(db: Session) -> dict[str, int]:
    """Insert the fixed categories if they don't already exist. Returns name→id map."""
    existing = db.query(Category).count()
    if existing > 0:
        print(f"Categories already seeded ({existing} rows). Skipping.")
        cats = db.query(Category).all()
        return {c.name: c.id for c in cats}

    name_to_id: dict[str, int] = {}
    for cat_data in CATEGORIES:
        cat = Category(**cat_data)
        db.add(cat)
        db.flush()
        name_to_id[cat.name] = cat.id
    db.commit()
    print(f"Seeded {len(CATEGORIES)} categories.")
    return name_to_id


def seed_demo_data(db: Session, name_to_id: dict[str, int]) -> None:
    """Insert demo expenses across the last 3 months."""
    existing = db.query(Expense).count()
    if existing > 0:
        print(f"Expenses already exist ({existing} rows). Skipping demo data.")
        return

    today = date.today()
    count = 0
    for title, category_name, amount_str, days_ago, notes in DEMO_EXPENSES:
        expense = Expense(
            title=title,
            amount=Decimal(amount_str),
            category_id=name_to_id[category_name],
            date=today - timedelta(days=days_ago),
            notes=notes,
        )
        db.add(expense)
        count += 1

    # Also add a few demo budgets
    demo_budgets = [
        ("Food", "200.00"),
        ("Transport", "150.00"),
        ("Entertainment", "100.00"),
        ("Utilities", "200.00"),
        ("Shopping", "150.00"),
        ("Health", "200.00"),
    ]
    for cat_name, limit_str in demo_budgets:
        budget = Budget(
            category_id=name_to_id[cat_name],
            monthly_limit=Decimal(limit_str),
        )
        db.add(budget)

    db.commit()
    print(f"Seeded {count} demo expenses and {len(demo_budgets)} demo budgets.")


def run_seed(demo: bool = False) -> None:
    """Create tables and seed data."""
    Base.metadata.create_all(bind=engine)
    print("Tables created (or already exist).")

    db = SessionLocal()
    try:
        name_to_id = seed_categories(db)
        if demo:
            seed_demo_data(db, name_to_id)
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed the ExPenny database.")
    parser.add_argument("--demo", action="store_true", help="Also insert demo expenses and budgets")
    args = parser.parse_args()
    run_seed(demo=args.demo)
