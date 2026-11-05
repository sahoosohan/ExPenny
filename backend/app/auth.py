"""Google identity verification and cookie-backed application sessions."""

import hashlib
import os
import secrets
import datetime as dt

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import LoginSession, User

SESSION_COOKIE = "expenny_session"
SESSION_TTL_SECONDS = int(os.getenv("SESSION_TTL_SECONDS", str(60 * 60 * 24 * 14)))


def allowed_origins() -> list[str]:
    configured = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return [origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip()]


def require_same_origin(request: Request) -> None:
    origin = (request.headers.get("origin") or "").rstrip("/")
    if origin not in allowed_origins():
        raise HTTPException(status_code=403, detail="Request origin is not allowed")


def _token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        require_same_origin(request)
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Sign in is required")
    session = (
        db.query(LoginSession)
        .filter(
            LoginSession.token_hash == _token_digest(token),
            LoginSession.expires_at > dt.datetime.utcnow(),
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=401, detail="Session expired; sign in again")
    user = db.query(User).filter(User.id == session.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Account not found")
    return user


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        secure=os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true",
        samesite="lax",
        path="/",
    )
