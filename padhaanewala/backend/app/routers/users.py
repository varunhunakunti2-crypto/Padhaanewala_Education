from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models import Role, StudentProfile, User
from app.schemas.auth import (
    AdminUpdateUserRequest,
    ChangePasswordRequest,
    ProfileResponse,
    UpdateProfileRequest,
    UserAdminResponse,
    UserResponse,
    UserRolesResponse,
)
from app.schemas.common import StandardResponse
from app.utils.security import hash_password, verify_password

router = APIRouter(prefix="/api/v1/users", tags=["users"])


def _to_admin_view(user: User) -> UserAdminResponse:
    return UserAdminResponse(
        id=user.id,
        email=user.email,
        mobile=user.mobile,
        is_active=user.is_active,
        is_email_verified=user.is_email_verified,
        is_mobile_verified=user.is_mobile_verified,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
        roles=sorted(role.name for role in user.roles),
    )


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
    updates = payload.model_dump(exclude_unset=True)
    if profile is None:
        profile = StudentProfile(user_id=user.id, name=updates.get("name") or user.display_name)
        db.add(profile)
        db.flush()

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


@router.get("/me/roles", response_model=UserRolesResponse)
def get_my_roles(user: User = Depends(get_current_user)):
    return UserRolesResponse(roles=sorted(role.name for role in user.roles))


@router.get("", response_model=list[UserAdminResponse])
def list_users_admin(
    search: str | None = Query(None, max_length=255),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_role("admin", "super_admin")),
    db: Session = Depends(get_db),
):
    query = select(User).order_by(User.id)
    if search:
        like = f"%{search}%"
        query = query.where(
            (User.email.ilike(like)) | (User.mobile.ilike(like))
        )
    users = db.scalars(query.limit(limit).offset(offset)).all()
    return [_to_admin_view(u) for u in users]


@router.get("/{user_id}", response_model=UserAdminResponse)
def get_user_detail_admin(
    user_id: int,
    user: User = Depends(require_role("admin", "super_admin")),
    db: Session = Depends(get_db),
):
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return _to_admin_view(target)


@router.patch("/{user_id}", response_model=UserAdminResponse)
def update_user_admin(
    user_id: int,
    payload: AdminUpdateUserRequest,
    user: User = Depends(require_role("admin", "super_admin")),
    db: Session = Depends(get_db),
):
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    if user_id == user.id and payload.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account",
        )
    if payload.is_active is not None:
        target.is_active = payload.is_active
    if payload.role_ids is not None:
        roles = db.scalars(
            select(Role).where(Role.id.in_(payload.role_ids))
        ).all()
        target.roles = list(roles)
    db.commit()
    db.refresh(target)
    return _to_admin_view(target)