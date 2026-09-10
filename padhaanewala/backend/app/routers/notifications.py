from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models import Notification, User
from app.schemas.content import NotificationCreate, NotificationResponse

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
    response_model=NotificationResponse,
    status_code=201,
    dependencies=[Depends(require_role("admin", "super_admin"))],
)
def create_notification(
    payload: NotificationCreate, db: Session = Depends(get_db)
):
    notification = Notification(**payload.model_dump())
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return _to_response(notification)


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