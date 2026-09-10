from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Role, StudentProfile, User
from app.schemas.auth import LoginRequest, LogoutRequest, RefreshRequest, RegisterRequest
from app.schemas.common import StandardResponse, TokenResponse
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _build_token_response(user: User, tokens: dict) -> TokenResponse:
    return TokenResponse(
        access_token=tokens["access"],
        refresh_token=tokens["refresh"],
        token_type="bearer",
    )


def _issue_tokens(user: User) -> dict:
    role_names = ",".join(role.name for role in user.roles) or "student,user"
    return {
        "access": create_access_token(user.id, role_names),
        "refresh": create_refresh_token(user.id, role_names),
    }


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.scalar(
        select(User).where((User.email == payload.email) | (User.mobile == payload.mobile))
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email or mobile already registered",
        )

    user = User(
        email=payload.email,
        mobile=payload.mobile,
        password_hash=hash_password(payload.password),
        is_active=True,
        is_email_verified=False,
        is_mobile_verified=False,
    )
    db.add(user)
    db.flush()

    role = db.scalar(select(Role).where(Role.name == "student"))
    if role is not None:
        user.roles.append(role)

    profile = StudentProfile(user_id=user.id, name=payload.name)
    db.add(profile)
    db.commit()
    db.refresh(user)

    return _build_token_response(user, _issue_tokens(user))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    return _build_token_response(user, _issue_tokens(user))


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    try:
        claims = decode_token(payload.refresh_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    if claims.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user = db.get(User, int(claims.get("sub")))
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return _build_token_response(user, _issue_tokens(user))


@router.post("/logout", response_model=StandardResponse)
def logout(payload: LogoutRequest):
    return StandardResponse(
        success=True,
        message="Logged out successfully",
        data={"received_refresh_token": bool(payload.refresh_token)},
    )