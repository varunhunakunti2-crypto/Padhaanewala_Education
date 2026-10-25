from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import require_role
from app.models import AuditLog, StudentProfile, User
from app.schemas.content import AuditLogResponse

router = APIRouter(prefix="/api/v1/audit-logs", tags=["audit"])

from app.roles import AUDIT_ROLES


def _to_response(log: AuditLog) -> AuditLogResponse:
    # `log.user` is eager-loaded by the list query, and so is that user's
    # student profile. This used to be `db.get(User, log.user_id)` per row, so a
    # page of 200 entries cost 201 queries and the audit trail — the screen an
    # admin opens when something has gone wrong — was the slowest page in the
    # product.
    #
    # The second `selectinload` is not optional. `User.display_name` is a
    # property that reads `self.student_profile`, so eager-loading only the user
    # moves the N+1 one level down: 25 audit rows written by 25 different people
    # still issued 29 SELECTs, because each profile was lazy-loaded on access.
    user = log.user
    return AuditLogResponse(
        id=log.id,
        user_id=log.user_id,
        username=user.display_name if user else None,
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
    q: str | None = Query(None, max_length=255),
    action: str | None = None,
    entity_type: str | None = None,
    entity_id: int | None = None,
    user_id: int | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_role(*AUDIT_ROLES)),
):
    """Newest-first audit trail, filterable.

    `q` backs the admin console's search box. It matches the actor's name — the
    question that actually brings an admin to this screen ("what has this person
    been doing?") — plus the email that `display_name` falls back to, the action,
    the entity type and the source IP. The filter runs here rather than in the
    panel because a client-side search only ever sees the fifty rows that
    happened to load, and a login history is exactly the kind of list that
    outgrows one page.

    An actor's audit history is *not* the same thing as their login history: no
    auth route wrote an audit row before, so a student who only ever signed in
    appeared nowhere here. `POST /auth/login` and `POST /auth/login/otp/verify`
    now record a `login` row, which makes `?q=<name>&action=login` the login
    history this search exists for.
    """
    query = select(AuditLog)
    if q and q.strip():
        like = f"%{q.strip()}%"
        # LEFT JOINs, not inner: an audit row written before its account was
        # deleted keeps `user_id = NULL`, and those rows must remain searchable
        # by action, entity or IP instead of vanishing from a name query.
        query = (
            query.outerjoin(User, User.id == AuditLog.user_id)
            .outerjoin(StudentProfile, StudentProfile.user_id == User.id)
            .where(
                or_(
                    StudentProfile.name.ilike(like),
                    User.email.ilike(like),
                    AuditLog.action.ilike(like),
                    AuditLog.entity_type.ilike(like),
                    AuditLog.ip_address.ilike(like),
                )
            )
        )
    if action:
        query = query.where(AuditLog.action == action)
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    if entity_id is not None:
        query = query.where(AuditLog.entity_id == entity_id)
    if user_id is not None:
        query = query.where(AuditLog.user_id == user_id)
    logs = db.scalars(
        query.options(
            selectinload(AuditLog.user).selectinload(User.student_profile)
        )
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return [_to_response(log) for log in logs]