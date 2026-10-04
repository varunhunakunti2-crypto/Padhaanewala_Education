from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_role
from app.models import Role, User
from app.roles import ADMIN_ROLES, outranks
from app.schemas.auth import AdminRoleResponse
from app.utils import audit

router = APIRouter(prefix="/api/v1/roles", tags=["roles"])


# Admin-only. This endpoint hands out the exact role *ids* that
# `PATCH /users/{id}` accepts, so exposing it to every authenticated user turns
# any student into an escalation candidate. Non-admins do not need it: the
# frontend reads their own roles from `GET /users/me/roles`, which is scoped to
# the caller.
@router.get("", response_model=list[AdminRoleResponse])
def list_roles(
    user: User = Depends(require_role(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    """Every role, each flagged with whether *this* caller may grant it.

    The console previously offered a single hardcoded "make admin" toggle and
    nothing else, so the thirteen other roles were unreachable from the UI even
    though the write path fully supported them. Replacing that with a plain
    checkbox list would just move the failure: the browser would happily offer
    `super_admin` to a plain admin and the write would come back 403. So the
    ordering is evaluated here, by the server, through the same `outranks()`
    that `PATCH /users/{id}` uses to enforce R4.8 — the UI renders what the
    policy allows instead of guessing at it.

    Note the `super_admin` row is withheld from *everyone*, including
    super_admins themselves: `outranks` is a strict `<`, so no role outranks
    `super_admin` and the ceiling blocks granting it. Promotion to the top role
    stays a deliberate script-level operation. Surfacing that here is the whole
    point — the console previously implied an admin could mint a super_admin.
    """
    caller_roles = audit.role_names(user)
    rows = db.scalars(select(Role).order_by(Role.id)).all()
    return [
        AdminRoleResponse(
            id=role.id,
            name=role.name,
            description=role.description,
            grantable=outranks(caller_roles, role.name),
        )
        for role in rows
    ]