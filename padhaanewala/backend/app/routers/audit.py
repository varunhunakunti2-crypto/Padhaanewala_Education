from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_role
from app.models import AuditLog, User
from app.schemas.content import AuditLogResponse

router = APIRouter(prefix="/api/v1/audit-logs", tags=["audit"])

AUDIT_ROLES = ("super_admin", "admin")


def _to_response(db: Session, log: AuditLog) -> AuditLogResponse:
    username = None
    if log.user_id:
        user = db.get(User, log.user_id)
        username = user.display_name if user else None
    return AuditLogResponse(
        id=log.id,
        user_id=log.user_id,
        username=username,
        action=log.action,
        entity_type=log.entity_type,
        entity_id=log.entity_id,
        old_value=log.old_value,
        new_value=log.new_value,
        ip_address=log.ip_address,
        created_at=log.created_at,
    )


@router.get("", response_model=list[AuditLogResponse])
def list_audit_logs(
    action: str | None = None,
    entity_type: str | None = None,
    entity_id: int | None = None,
    user_id: int | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(*AUDIT_ROLES)),
):
    query = select(AuditLog)
    if action:
        query = query.where(AuditLog.action == action)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if entity_id is not None:
        query = query.where(AuditLog.entity_id == entity_id)
    if user_id is not None:
        query = query.where(AuditLog.user_id == user_id)
    logs = db.scalars(
        query.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
    ).all()
    return [_to_response(db, log) for log in logs]