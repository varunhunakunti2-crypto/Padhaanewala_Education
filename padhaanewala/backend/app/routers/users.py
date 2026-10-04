from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models import Counsellor, Role, StudentProfile, User
from app.roles import ADMIN_ROLES, RoleName, exceeds_ceiling, exceeds_removal_ceiling
from app.schemas.auth import (
    AdminUpdateUserRequest,
    ChangePasswordRequest,
    ProfileResponse,
    UpdateProfileRequest,
    UserAdminListResponse,
    UserAdminResponse,
    UserResponse,
    UserRolesResponse,
)
from app.schemas.common import StandardResponse
from app.services import session_service
from app.utils import audit
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
        display_name=user.display_name,
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
        if value is None and field == "name":
            continue
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
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    user.password_hash = hash_password(payload.new_password)
    # R3.6 — a credential change ends every session on the account. The person
    # who resets chooses a new password because they believe somebody else has
    # access, and that somebody is holding a refresh token. Revoking it all here
    # is the difference between "reset" and "reset to a broken expectation".
    session_service.revoke_all_sessions(db, user.id, reason="password_change")
    # R5.3 — credential changes are privileged operations. The hash itself is
    # never logged, only the fact that it changed.
    audit.record(
        db,
        request=request,
        action="change_password",
        entity_type="user",
        entity_id=user.id,
        actor=user,
        old_value={"password_changed": False},
        new_value={"password_changed": True},
    )
    db.commit()

    return StandardResponse(success=True, message="Password updated successfully")


@router.get("/admin-only", response_model=StandardResponse)
def admin_only(_: User = Depends(require_role(*ADMIN_ROLES))):
    return StandardResponse(success=True, message="Admin access granted")


@router.get("/me/roles", response_model=UserRolesResponse)
def get_my_roles(user: User = Depends(get_current_user)):
    return UserRolesResponse(roles=sorted(role.name for role in user.roles))


@router.get("", response_model=UserAdminListResponse)
def list_users_admin(
    search: str | None = Query(None, max_length=255),
    role: str | None = Query(None, max_length=50),
    is_active: bool | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_role(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    """Paged, filterable user listing for the admin console.

    Filtering lives here rather than in the console because the console can only
    ever see one page. A client-side "Inactive" chip over the first 50 users is a
    filter on the page, not on the account base — it hides an unknown number of
    deactivated accounts and reports counts that are wrong by whatever the page
    size happens to be. `total` counts the filtered set so the UI can state
    "1–50 of 312" instead of implying 50 is all of them.
    """
    # LEFT JOIN, not INNER: most accounts have no student profile yet (an admin
    # promoting a freshly registered user is the common case), and an inner join
    # would silently drop exactly the accounts an admin most wants to find.
    query = select(User).outerjoin(StudentProfile, StudentProfile.user_id == User.id)

    if search:
        like = f"%{search.strip()}%"
        if search.strip():
            query = query.where(
                (User.email.ilike(like))
                | (User.mobile.ilike(like))
                | (StudentProfile.name.ilike(like))
            )

    if role:
        # An unknown role name must not silently return "everyone". Match it as a
        # literal, so `role=nonsense` yields an empty page the admin can see is
        # wrong, rather than an unfiltered dump that looks like a valid answer.
        query = query.join(User.roles).where(Role.name == role.strip())

    if is_active is not None:
        query = query.where(User.is_active.is_(is_active))

    query = query.order_by(User.id)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    users = db.scalars(query.limit(limit).offset(offset)).all()
    return UserAdminListResponse(
        items=[_to_admin_view(u) for u in users],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{user_id}", response_model=UserAdminResponse)
def get_user_detail_admin(
    user_id: int,
    user: User = Depends(require_role(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return _to_admin_view(target)


def _count_active_super_admins(db: Session, exclude_user_id: int | None = None) -> int:
    """How many usable ``super_admin`` accounts exist, optionally ignoring one."""
    query = (
        select(func.count())
        .select_from(User)
        .join(User.roles)
        .where(Role.name == RoleName.SUPER_ADMIN.value, User.is_active.is_(True))
    )
    if exclude_user_id is not None:
        query = query.where(User.id != exclude_user_id)
    return db.scalar(query) or 0


#: Starting lead ceiling for a newly provisioned counsellor. Mirrors
#: `Counsellor.max_leads`' column default, restated here so the number the admin
#: console implies is visible in one place rather than only in the model.
COUNSELLOR_DEFAULT_MAX_LEADS = 100


def _sync_counsellor_profile(db: Session, user: User) -> None:
    """Reconcile a user's ``counsellors`` row with their role and account state.

    The role and the profile row were two halves of one fact with nothing
    connecting them. ``POST/PATCH /users`` set the role and never touched
    ``counsellors``, and no other code path inserts that row either -- only the
    test helpers in ``tests/test_phase9.py`` do, by hand. The consequences were
    silent and total: ``GET /counsellors`` was always empty, the admin console's
    assign dropdown had nothing to offer, ``PATCH /leads/{id}/assign`` always
    409'd, and the round-robin balancer in ``services/lead_handoff`` had an empty
    pool to choose from. Nothing errored, so it read as "no counsellors hired yet"
    rather than as a missing link in the chain.

    Called after *both* the role branch and the ``is_active`` branch, because
    ``PATCH /leads/{id}/assign`` gates on ``Counsellor.is_active`` alone and never
    looks at the linked user. Reconciling on role change only would therefore let
    an admin deactivate a counsellor's *account* while leaving the profile row
    active -- still listed on the roster, still assignable, and the leads would
    land with somebody who can no longer sign in. So the row is active only while
    the account is active **and** the role is held.

    Removing the role deactivates the row rather than deleting it, because
    ``enquiries.counsellor_id`` references it and a hard delete would take the
    assignment history with it.

    ``Counsellor.is_active`` previously had no writer at all, so it was stuck at
    its column default and there was no deliberate deactivation to preserve. It is
    now derived: any direct write to the column is overwritten the next time this
    runs. That is the trade for making the column mean something -- the alternative
    is a second source of truth that can contradict the first.

    Only ``RoleName.COUNSELLOR`` counts. ``counsellor_manager`` is in
    ``DEAD_ROLES`` -- it grants no capability anywhere, so provisioning a profile
    for it would put someone on the lead roster who cannot see a single lead.
    """
    holds_role = RoleName.COUNSELLOR.value in audit.role_names(user)
    should_be_active = holds_role and bool(user.is_active)

    profile = db.scalar(select(Counsellor).where(Counsellor.user_id == user.id))

    if not holds_role:
        if profile is not None and profile.is_active:
            profile.is_active = False
        return

    if profile is None:
        db.add(
            Counsellor(
                user_id=user.id,
                # `display_name` is `student_profiles.name`, falling back to the
                # email. `users` has no name column of its own, so this is the
                # only name available without asking the admin for one.
                name=user.display_name,
                max_leads=COUNSELLOR_DEFAULT_MAX_LEADS,
                is_active=should_be_active,
            )
        )
    elif profile.is_active != should_be_active:
        profile.is_active = should_be_active


@router.patch("/{user_id}", response_model=UserAdminResponse)
def update_user_admin(
    user_id: int,
    payload: AdminUpdateUserRequest,
    request: Request,
    user: User = Depends(require_role(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    caller_roles = audit.role_names(user)
    old_roles = audit.role_names(target)
    old_is_active = target.is_active

    # R4.9 — a super_admin account may only be modified by another super_admin.
    # The privilege ceiling already stopped an `admin` from *demoting* one, but
    # `is_active` (and adding lower roles) had no such guard, so an `admin`
    # could still deactivate a super_admin or alter its extra roles. All
    # mutation — not just role changes — is closed. Reading stays open so
    # admins can still audit who holds the top role.
    if (
        RoleName.SUPER_ADMIN.value in old_roles
        and RoleName.SUPER_ADMIN.value not in caller_roles
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only a super_admin can modify a super_admin account",
        )

    if user_id == user.id and payload.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account",
        )

    if payload.role_ids is not None:
        requested = list(dict.fromkeys(payload.role_ids))

        # R7.4 — nobody edits their own roles through this endpoint, not even a
        # super_admin. Self-service role changes need a separate, audited flow.
        if user_id == user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot change your own roles",
            )

        # R5.2 — every id must resolve. Silently dropping an unknown id would strip
        # every role off the target on a typo, which reads as success.
        roles = db.scalars(select(Role).where(Role.id.in_(requested))).all()
        found = {role.id for role in roles}
        missing = [rid for rid in requested if rid not in found]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Unknown role ids: {sorted(missing)}",
            )

        # R4.8 — privilege ceiling, applied to the *delta*. A caller may never
        # newly grant a role that outranks their own highest role. Restating a role
        # the target already holds is not an escalation, so it is excluded;
        # otherwise an `admin` could not even re-send a peer's existing `admin`
        # role, which is an operationally absurd dead end.
        new_role_names = {role.name for role in roles}
        newly_added = new_role_names - set(old_roles)
        blocked = exceeds_ceiling(set(caller_roles), newly_added)
        if blocked:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You cannot grant roles above your own privilege level: "
                    f"{sorted(blocked)}"
                ),
            )

        # R4.8 (removal) — the ceiling must apply to *taking away* roles too, not
        # just handing them out. Without this an `admin` could demote a peer
        # `super_admin` (or strip every role from any account) by PATCHing
        # `role_ids` with a set that omits them. The last-super_admin guard below
        # only fires when the target was the *final* super_admin, so a
        # multi-super_admin deployment was fully exposed.
        removed = set(old_roles) - new_role_names
        blocked_removal = exceeds_removal_ceiling(set(caller_roles), removed)
        if blocked_removal:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You cannot remove roles above your own privilege level: "
                    f"{sorted(blocked_removal)}"
                ),
            )

        # Refuse to strip the last usable super_admin — roles can only be created
        # by scripts/seed_roles.py, so losing the final one is unrecoverable.
        if (
            RoleName.SUPER_ADMIN.value in removed
            and _count_active_super_admins(db, exclude_user_id=user_id) == 0
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last active super_admin",
            )

        # A user with zero roles is a broken account — the same class of problem as
        # R2.4's roleless registration. Refuse to strand anyone, but allow a
        # deliberate demotion to a lower non-empty set.
        if not new_role_names:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "A user must keep at least one role. Grant the intended role "
                    "explicitly instead of clearing the set."
                ),
            )

        target.roles = list(roles)

    if payload.is_active is not None:
        # Same lockout guard for the deactivation path.
        if (
            payload.is_active is False
            and RoleName.SUPER_ADMIN.value in old_roles
            and _count_active_super_admins(db, exclude_user_id=user_id) == 0
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate the last active super_admin",
            )
        target.is_active = payload.is_active

    # A role is the authorization half of a counsellor; the `counsellors` row is
    # the workload half, and the leads CRM only ever reads the row. Reconciled
    # after both branches, never inside either, because deactivating the account
    # has to take the profile off the roster too.
    _sync_counsellor_profile(db, target)

    db.flush()
    # R5.3 — every privilege change is logged. This is the trail that makes an
    # escalation attempt attributable.
    if audit.role_names(target) != old_roles:
        audit.record(
            db,
            request=request,
            action="update_user_roles",
            entity_type="user",
            entity_id=target.id,
            actor=user,
            old_value={"roles": old_roles},
            new_value={"roles": audit.role_names(target)},
        )
    if target.is_active != old_is_active:
        audit.record(
            db,
            request=request,
            action="deactivate_user" if not target.is_active else "activate_user",
            entity_type="user",
            entity_id=target.id,
            actor=user,
            old_value={"is_active": old_is_active},
            new_value={"is_active": target.is_active},
        )

    db.commit()
    db.refresh(target)
    return _to_admin_view(target)