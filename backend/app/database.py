"""Database engine, session factory, and dependency."""

import os

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./expenses.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, echo=False)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Declarative base for all models."""
    pass


def upgrade_sqlite_user_schema() -> None:
    """Add per-user ownership to an existing SQLite database without dropping data."""
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "expenses" not in tables or "budgets" not in tables:
        return
    expense_columns = {column["name"] for column in inspector.get_columns("expenses")}
    budget_columns = {column["name"] for column in inspector.get_columns("budgets")}

    with engine.begin() as connection:
        if "user_id" not in expense_columns:
            connection.execute(text("ALTER TABLE expenses ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE"))
        if "user_id" not in budget_columns:
            # Rebuild to replace the old global category uniqueness with per-user uniqueness.
            connection.execute(text(
                "CREATE TABLE budgets_user_migration ("
                "id INTEGER PRIMARY KEY, category_id INTEGER NOT NULL REFERENCES categories(id), "
                "user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, "
                "monthly_limit NUMERIC(12, 2) NOT NULL CHECK (monthly_limit > 0))"
            ))
            connection.execute(text(
                "INSERT INTO budgets_user_migration (id, category_id, monthly_limit) "
                "SELECT id, category_id, monthly_limit FROM budgets"
            ))
            connection.execute(text("DROP TABLE budgets"))
            connection.execute(text("ALTER TABLE budgets_user_migration RENAME TO budgets"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses (user_id, date)"))
        connection.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_budgets_user_category "
            "ON budgets (user_id, category_id)"
        ))


def get_db():
    """FastAPI dependency that yields a DB session and closes it after the request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
