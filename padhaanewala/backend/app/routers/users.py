from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models import StudentProfile, User
from app.schemas.auth import (
    ChangePasswordRequest,
    ProfileResponse,
    UpdateProfileRequest,
    UserResponse,
)
from app.schemas.common import StandardResponse
from app.utils.security import hash_password, verify_password

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return user


@router.get("/me/profile", response_model=ProfileResponse)
def get_my_profile(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.scalar(
        select(StudentProfile).where(StudentProfile.user_id == user.id)
    )
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found",
        )

    profile.email = user.email
    profile.mobile = user.mobile
    return profile


@router.put("/me", response_model=ProfileResponse)
def update_my_profile(
    payload: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.scalar(
        select(StudentProfile).where(StudentProfile.user_id == user.id)
    )
    if profile is None:
        profile = StudentProfile(user_id=user.id)
        db.add(profile)
        db.flush()

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(profile, field, value)

    if "name" in updates and updates["name"]:
        profile.name = updates["name"]

    db.commit()
    db.refresh(profile)
    profile.email = user.email
    profile.mobile = user.mobile
    return profile


@router.put("/me/password", response_model=StandardResponse)
def change_my_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    user.password_hash = hash_password(payload.new_password)
    db.commit()

    return StandardResponse(success=True, message="Password updated successfully")


@router.get("/admin-only", response_model=StandardResponse)
def admin_only(_: User = Depends(require_role("admin", "super_admin"))):
    return StandardResponse(success=True, message="Admin access granted")