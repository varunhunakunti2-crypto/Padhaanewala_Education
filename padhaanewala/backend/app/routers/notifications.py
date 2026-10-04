from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models import Notification, Role, User, user_roles
from app.schemas.content import (
    AdminNotificationResponse,
    NotificationBroadcastResult,
    NotificationCreate,
    NotificationResponse,
)
from app.roles import ADMIN_ROLES, RoleName
from app.utils import audit

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


def _to_response(notification: Notification) -> NotificationResponse:
    return NotificationResponse(
        id=notification.id,
        user_id=notification.user_id,
        type=notification.type,
        title=notification.title,
        message=notification.message,
        data=notification.data,
        is_read=notification.is_read,
        channel=notification.channel,
        created_at=notification.created_at,
    )


def _to_admin_response(notification: Notification) -> AdminNotificationResponse:
    user = notification.user
    return AdminNotificationResponse(
        **_to_response(notification).model_dump(),
        username=user.display_name if user is not None else None,
    )


@router.get("", response_model=list[AdminNotificationResponse])
def list_notifications(
    unread_only: bool = False,
    type: str | None = Query(None, max_length=50),
    user_id: int | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_role(*ADMIN_ROLES)),
):
    """Admin-only delivery log.

    This route did not exist. `frontend/lib/api.ts::adminApi.notifications()`
    called `GET /api/v1/notifications` and got a 405, so the admin console's
    Notifications panel always rendered its error banner — and then, because it
    had nothing real to show, fell back to this browser's own `localStorage`
    inbox and finally to a hardcoded row reading "No notifications sent yet".
    A broadcast log with no read endpoint cannot distinguish "nothing has been
    sent" from "this screen cannot see what has been sent", which is the one
    distinction an admin needs from it.

    Gated on `ADMIN_ROLES`, matching `POST ""` below. Students read their own
    through `/notifications/my`.
    """
    query = select(Notification).options(joinedload(Notification.user))
    if unread_only:
        query = query.where(Notification.is_read.is_(False))
    if type:
        query = query.where(Notification.type == type)
    if user_id is not None:
        query = query.where(Notification.user_id == user_id)
    notifications = db.scalars(
        query.order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return [_to_admin_response(n) for n in notifications]


@router.get("/my", response_model=list[NotificationResponse])
def my_notifications(
    unread_only: bool = False,
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        query = query.where(Notification.is_read.is_(False))
    notifications = db.scalars(
        query.order_by(Notification.created_at.desc()).limit(limit)
    ).all()
    return [_to_response(n) for n in notifications]


@router.get("/my/unread-count", response_model=int)
def unread_count(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return db.scalar(
        select(func.count(Notification.id)).where(
            Notification.user_id == user.id, Notification.is_read.is_(False)
        )
    )


@router.post(
    "",
    response_model=NotificationBroadcastResult,
    status_code=201,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def create_notification(
    payload: NotificationCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(get_current_user),
):
    """Send to one account, or broadcast to every active student.

    ``user_id`` was a required field, and the admin console's compose form does
    not send one — it is labelled "Send broadcast". So the button this endpoint
    backs returned 422 on every press, and the panel reported a send failure for
    a broadcast that never happened.

    Two shapes are supported rather than one:

    * ``user_id`` given — one row, exactly as before. This is what the
      per-user callers and `test_notification_flow` use.
    * ``user_id`` omitted — one row per active account holding the `student`
      role. `notifications.user_id` is `NOT NULL` with a foreign key, so a
      recipient-less row cannot be stored; fanning out is the only way the
      schema can represent "everyone".

    A broadcast is a mass write to accounts that are frequently minors, so it is
    never silent: the response reports the recipient count and an audit row
    records the actor, the audience and the source IP. `Phase 4.4` in
    `docs/Pending-phases.md` lists this write as unaudited.
    """
    fields = payload.model_dump(exclude={"user_id"})

    if payload.user_id is not None:
        recipient = db.get(User, payload.user_id)
        if recipient is None:
            raise HTTPException(status_code=404, detail="User not found")
        notification = Notification(user_id=recipient.id, **fields)
        db.add(notification)
        created = [notification]
        audience = f"user:{recipient.id}"
    else:
        student_role = db.scalar(select(Role).where(Role.name == RoleName.STUDENT.value))
        if student_role is None:
            # Fail closed rather than fan out to every account including the
            # admins. A missing `student` role is a seeding failure (R2.4 treats
            # the same condition as fatal at registration), and silently
            # mailing every operator because of it is the wrong direction.
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Cannot broadcast: the 'student' role does not exist",
            )
        recipient_ids = db.scalars(
            select(user_roles.c.user_id)
            .join(User, User.id == user_roles.c.user_id)
            .where(user_roles.c.role_id == student_role.id, User.is_active.is_(True))
            .order_by(user_roles.c.user_id)
        ).all()
        if not recipient_ids:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot broadcast: no active student accounts",
            )
        created = [Notification(user_id=uid, **fields) for uid in recipient_ids]
        db.add_all(created)
        audience = f"all_active_students:{len(created)}"

    audit.record(
        db,
        request=request,
        action="notification.broadcast" if payload.user_id is None else "notification.send",
        entity_type="notification",
        actor=actor,
        new_value={
            "type": payload.type,
            "title": payload.title,
            "channel": payload.channel,
            "audience": audience,
        },
    )
    db.commit()
    for notification in created:
        db.refresh(notification)
    return NotificationBroadcastResult(
        created=len(created),
        recipients=[_to_admin_response(n) for n in created],
    )


@router.put("/{notification_id}/read", response_model=NotificationResponse)
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    notification = db.scalar(
        select(Notification).where(
            Notification.id == notification_id, Notification.user_id == user.id
        )
    )
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return _to_response(notification)


@router.put("/my/read-all", response_model=int)
def mark_all_read(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = db.execute(
        Notification.__table__.update()
        .where(Notification.user_id == user.id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    db.commit()
    return result.rowcount or 0


@router.delete("/{notification_id}", status_code=204)
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    notification = db.scalar(
        select(Notification).where(
            Notification.id == notification_id, Notification.user_id == user.id
        )
    )
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.delete(notification)
    db.commit()