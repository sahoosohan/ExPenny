"""Budget management endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.crud import delete_budget, get_budgets, get_category, upsert_budget
from app.database import get_db
from app.models import User
from app.schemas import BudgetCreate, BudgetOut

router = APIRouter(prefix="/api/v1/budgets", tags=["budgets"])


@router.get("", response_model=list[BudgetOut])
def list_budgets(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return get_budgets(db, user.id)


@router.put("/{category_id}", response_model=BudgetOut)
def save_budget(
    category_id: int,
    data: BudgetCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not get_category(db, category_id):
        raise HTTPException(status_code=404, detail="Category not found")
    return upsert_budget(db, user.id, category_id, data.monthly_limit)


@router.delete("/{category_id}", status_code=204)
def remove_budget(
    category_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not delete_budget(db, user.id, category_id):
        raise HTTPException(status_code=404, detail="Budget not found")
    return None
