"""Authentication endpoints: Google sign-in/sign-up and session management."""

import datetime as dt
import os
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.auth import (
    SESSION_COOKIE,
    SESSION_TTL_SECONDS,
    _set_session_cookie,
    _token_digest,
    get_current_user,
    require_same_origin,
)
from app.database import get_db
from app.models import Budget, Expense, LoginSession, User
from app.schemas import GoogleCredential, LoginResponse, UserOut

router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])


@router.post("/google", response_model=LoginResponse)
def google_sign_in(
    data: GoogleCredential,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Verify Google's signed ID token, create/find the account, and set a session cookie."""
    require_same_origin(request)
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured on the server")

    try:
        from google.auth.transport.requests import Request as GoogleRequest
        from google.oauth2 import id_token

        identity = id_token.verify_oauth2_token(data.credential, GoogleRequest(), client_id)
    except ImportError:
        raise HTTPException(status_code=503, detail="Install backend requirements to enable Google sign-in") from None
    except ValueError:
        raise HTTPException(status_code=401, detail="Google credential could not be verified") from None
    except Exception:
        raise HTTPException(status_code=503, detail="Google identity verification is temporarily unavailable") from None

    google_sub = identity.get("sub")
    email_claim = identity.get("email")
    email = email_claim.strip().lower() if isinstance(email_claim, str) else ""
    if not google_sub or not email or identity.get("email_verified") is not True:
        raise HTTPException(status_code=401, detail="Google account must have a verified email")

    user = db.query(User).filter(User.google_sub == google_sub).first()
    if user is None:
        conflicting_user = db.query(User).filter(User.email == email).first()
        if conflicting_user:
            raise HTTPException(status_code=409, detail="This email is already linked to a different sign-in")
        user = User(
            google_sub=google_sub,
            email=email,
            name=identity.get("name") or email.partition("@")[0],
            picture=identity.get("picture"),
        )
        db.add(user)
        db.flush()
    else:
        conflicting_user = db.query(User).filter(User.email == email, User.id != user.id).first()
        if conflicting_user:
            raise HTTPException(status_code=409, detail="This email is already linked to a different sign-in")
        user.email = email
        user.name = identity.get("name") or user.name
        user.picture = identity.get("picture")

    # Keep pre-auth v1 data (or explicitly seeded demo rows) with the first account only.
    if db.query(User.id).count() == 1:
        db.query(Expense).filter(Expense.user_id.is_(None)).update({Expense.user_id: user.id})
        db.query(Budget).filter(Budget.user_id.is_(None)).update({Budget.user_id: user.id})

    now = dt.datetime.utcnow()
    db.query(LoginSession).filter(LoginSession.expires_at <= now).delete(synchronize_session=False)
    token = secrets.token_urlsafe(48)
    db.add(LoginSession(
        user_id=user.id,
        token_hash=_token_digest(token),
        expires_at=now + dt.timedelta(seconds=SESSION_TTL_SECONDS),
    ))
    db.commit()
    db.refresh(user)
    _set_session_cookie(response, token)
    return LoginResponse(user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def current_account(user: User = Depends(get_current_user)):
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    require_same_origin(request)
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        db.query(LoginSession).filter(LoginSession.token_hash == _token_digest(token)).delete()
        db.commit()
    response.delete_cookie(
        key=SESSION_COOKIE,
        path="/",
        secure=os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true",
        httponly=True,
        samesite="lax",
    )
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
