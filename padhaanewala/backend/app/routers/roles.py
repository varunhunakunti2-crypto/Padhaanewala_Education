from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Role, User
from app.schemas.auth import RoleResponse

router = APIRouter(prefix="/api/v1/roles", tags=["roles"])


@router.get("", response_model=list[RoleResponse])
def list_roles(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.scalars(select(Role).order_by(Role.id)).all()