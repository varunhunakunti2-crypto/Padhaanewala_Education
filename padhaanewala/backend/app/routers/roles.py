from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_role
from app.models import Role
from app.roles import ADMIN_ROLES
from app.schemas.auth import RoleResponse

router = APIRouter(prefix="/api/v1/roles", tags=["roles"])


# Admin-only. This endpoint hands out the exact role *ids* that
# `PATCH /users/{id}` accepts, so exposing it to every authenticated user turns
# any student into an escalation candidate. Non-admins do not need it: the
# frontend reads their own roles from `GET /users/me/roles`, which is scoped to
# the caller.
@router.get("", response_model=list[RoleResponse])
def list_roles(
    _=Depends(require_role(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
):
    return db.scalars(select(Role).order_by(Role.id)).all()
