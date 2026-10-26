from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import case, func, select, update
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user, get_current_user_roles, require_role
from app.models import Notification, Role, User, user_roles
from app.roles import ADMIN_ROLES, SUPER_ADMIN_ROLES, RoleName
from app.schemas.content import (
    AdminNotificationResponse,
    NotificationBatchResult,
    NotificationBroadcastResult,
    NotificationCreate,
    NotificationResponse,
    NotificationSendSummary,
    NotificationUpdate,
)
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
        batch_id=notification.batch_id,
    )


def _is_super_admin(user: User) -> bool:
    return bool(set(SUPER_ADMIN_ROLES) & get_current_user_roles(user))


def _updated_fields(payload: NotificationUpdate) -> dict:
    """The columns the caller actually sent, or a 400.

    Without the emptiness check an `{}` body is a silent success: the write
    executes, no column changes, and the API answers 200 as if something had
    happened. The admin console then shows "updated" over an unchanged row.
    """
    fields = payload.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )
    return fields


@router.get("", response_model=list[AdminNotificationResponse])
def list_notifications(
    unread_only: bool = False,
    type: str | None = Query(None, max_length=50),
    user_id: int | None = None,
    batch_id: str | None = Query(None, max_length=36),
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

    Gated on `ADMIN_ROLES`: reading the log is not a destructive act, and an
    `admin` needs it to answer "did the announcement go out?". The mutations
    below are stricter — see `create_notification`.

    Students read their own through `/notifications/my`.
    """
    query = select(Notification).options(joinedload(Notification.user))
    if unread_only:
        query = query.where(Notification.is_read.is_(False))
    if type:
        query = query.where(Notification.type == type)
    if user_id is not None:
        query = query.where(Notification.user_id == user_id)
    if batch_id:
        query = query.where(Notification.batch_id == batch_id)
    notifications = db.scalars(
        query.order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return [_to_admin_response(n) for n in notifications]


@router.get("/sends", response_model=list[NotificationSendSummary])
def list_notification_sends(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_role(*ADMIN_ROLES)),
):
    """The admin log, one row per send rather than one per recipient.

    `GET /notifications` returns delivery rows. That is the right shape for an
    audit detail, and the wrong shape for a console: a broadcast writes one row
    per student, so a 500-student announcement appeared as 500 entries and the
    page size cut a single send in half. The panel's recipient count would then
    read "50" for a message 500 people received — a log that understates its own
    audience is worse than no count at all.

    So the grouping happens in SQL: one entry per `batch_id` with its recipient
    and read counts, plus one entry per legacy row (`batch_id IS NULL`) because
    those genuinely were individual sends.

    Ordered newest first, and sliced *after* merging so `offset` pages over
    sends rather than over recipient rows.
    """
    grouped = db.execute(
        select(
            Notification.batch_id,
            func.count(Notification.id).label("recipients"),
            func.sum(case((Notification.is_read.is_(True), 1), else_=0)).label(
                "read_count"
            ),
            func.min(Notification.id).label("notification_id"),
            func.max(Notification.created_at).label("created_at"),
        )
        .where(Notification.batch_id.is_not(None))
        .group_by(Notification.batch_id)
    ).all()

    representative_ids = [row.notification_id for row in grouped]
    representatives = (
        {
            n.id: n
            for n in db.scalars(
                select(Notification).where(Notification.id.in_(representative_ids))
            )
        }
        if representative_ids
        else {}
    )

    sends = [
        NotificationSendSummary(
            notification_id=row.notification_id,
            batch_id=row.batch_id,
            type=representatives[row.notification_id].type,
            title=representatives[row.notification_id].title,
            message=representatives[row.notification_id].message,
            channel=representatives[row.notification_id].channel,
            recipients=row.recipients,
            read_count=int(row.read_count or 0),
            created_at=row.created_at,
        )
        for row in grouped
    ]

    legacy = db.scalars(
        select(Notification).where(Notification.batch_id.is_(None))
    ).all()
    sends += [
        NotificationSendSummary(
            notification_id=n.id,
            batch_id=None,
            type=n.type,
            title=n.title,
            message=n.message,
            channel=n.channel,
            recipients=1,
            read_count=1 if n.is_read else 0,
            created_at=n.created_at,
        )
        for n in legacy
    ]

    sends.sort(key=lambda send: send.created_at, reverse=True)
    return sends[offset : offset + limit]


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
)
def create_notification(
    payload: NotificationCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*SUPER_ADMIN_ROLES)),
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

    ## Super admin only

    A broadcast is a mass write into accounts that are frequently minors: it
    cannot be recalled from a student's screen once read, and there is no
    per-tenant blast radius. `SUPER_ADMIN_ROLES` rather than `ADMIN_ROLES`
    matches the console, where the compose form and the row actions are shown
    only to a super admin.

    ## Every row of one send shares a `batch_id`

    The fan-out writes N rows. Without a shared id the admin log showed one
    announcement as N unrelated entries and there was no unit to edit or
    retract. The id is generated here and recorded on all of them, so
    `PUT/DELETE /notifications/batch/{batch_id}` can act on the send as a whole.

    A broadcast is never silent: the response reports the recipient count and an
    audit row records the actor, the audience and the source IP. `Phase 4.4` in
    `docs/Pending-phases.md` lists this write as unaudited.
    """
    fields = payload.model_dump(exclude={"user_id"})
    batch_id = uuid4().hex

    if payload.user_id is not None:
        recipient = db.get(User, payload.user_id)
        if recipient is None:
            raise HTTPException(status_code=404, detail="User not found")
        notification = Notification(user_id=recipient.id, batch_id=batch_id, **fields)
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
        created = [
            Notification(user_id=uid, batch_id=batch_id, **fields) for uid in recipient_ids
        ]
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
            "batch_id": batch_id,
        },
    )
    db.commit()
    for notification in created:
        db.refresh(notification)
    return NotificationBroadcastResult(
        created=len(created),
        recipients=[_to_admin_response(n) for n in created],
    )


@router.put("/batch/{batch_id}", response_model=NotificationBatchResult)
def update_notification_batch(
    batch_id: str,
    payload: NotificationUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*SUPER_ADMIN_ROLES)),
):
    """Edit every row written by one send.

    This is what makes the log actionable: correcting the wording of an
    announcement, or marking a mistyped one as read, used to mean one request
    per recipient — and the console had no way to send even one.
    """
    fields = _updated_fields(payload)
    existing = db.scalar(
        select(func.count(Notification.id)).where(Notification.batch_id == batch_id)
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Broadcast not found")

    db.execute(
        update(Notification).where(Notification.batch_id == batch_id).values(**fields)
    )
    audit.record(
        db,
        request=request,
        action="notification.batch_update",
        entity_type="notification",
        actor=actor,
        old_value={"batch_id": batch_id, "affected": existing},
        new_value={**fields, "batch_id": batch_id},
    )
    db.commit()
    return NotificationBatchResult(batch_id=batch_id, affected=existing)


@router.delete("/batch/{batch_id}", response_model=NotificationBatchResult)
def delete_notification_batch(
    batch_id: str,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*SUPER_ADMIN_ROLES)),
):
    """Retract one send from every recipient's inbox.

    Answers 200 with the affected count rather than 204: a client that asked to
    delete a 500-row broadcast needs to know whether it removed 500 rows or
    zero, and a bodiless response cannot say.
    """
    existing = db.scalar(
        select(func.count(Notification.id)).where(Notification.batch_id == batch_id)
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Broadcast not found")

    db.execute(
        Notification.__table__.delete().where(Notification.batch_id == batch_id)
    )
    audit.record(
        db,
        request=request,
        action="notification.batch_delete",
        entity_type="notification",
        actor=actor,
        old_value={"batch_id": batch_id, "affected": existing},
    )
    db.commit()
    return NotificationBatchResult(batch_id=batch_id, affected=existing)


@router.put("/{notification_id}", response_model=AdminNotificationResponse)
def update_notification(
    notification_id: int,
    payload: NotificationUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(*SUPER_ADMIN_ROLES)),
):
    """Edit one delivered notification.

    Rows written before `batch_id` existed belong to no send, so this is the
    only way to change their wording; the batch route above covers everything
    written since.
    """
    fields = _updated_fields(payload)
    notification = db.get(Notification, notification_id)
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")

    before = {
        "type": notification.type,
        "title": notification.title,
        "message": notification.message,
        "channel": notification.channel,
        "is_read": notification.is_read,
    }
    for key, value in fields.items():
        setattr(notification, key, value)

    audit.record(
        db,
        request=request,
        action="notification.update",
        entity_type="notification",
        entity_id=notification.id,
        actor=actor,
        old_value=before,
        new_value=fields,
    )
    db.commit()
    db.refresh(notification)
    return _to_admin_response(notification)


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
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a notification.

    A student may delete their own; a super admin may delete any, which is what
    the admin log's Delete button calls. Both paths are audited: a delete is a
    user-visible disappearance with no remaining record to appeal against.
    Read the row before deleting it — afterwards the instance is expired and the
    values are gone.
    """
    notification = db.get(Notification, notification_id)
    if notification is None:
        raise HTTPException(status_code=404, detail="Notification not found")

    own = notification.user_id == user.id
    if not own and not _is_super_admin(user):
        raise HTTPException(status_code=404, detail="Notification not found")

    audit.record(
        db,
        request=request,
        action="delete_notification" if own else "notification.admin_delete",
        entity_type="notification",
        entity_id=notification.id,
        actor=user,
        old_value={
            "type": notification.type,
            "title": notification.title,
            "message": notification.message,
            "user_id": notification.user_id,
            "batch_id": notification.batch_id,
            "is_read": notification.is_read,
            "scope": "own" if own else "other_user",
        },
    )
    db.delete(notification)
    db.commit()
