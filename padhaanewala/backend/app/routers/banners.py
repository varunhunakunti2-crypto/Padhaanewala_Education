from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import (
    can_view_inactive,
    get_optional_current_user,
    require_role,
)
from app.models import Banner, User
from app.roles import CONTENT_ROLES
from app.schemas.content import BannerCreate, BannerResponse, BannerUpdate
from app.utils import audit

router = APIRouter(prefix="/api/v1/banners", tags=["banners"])


def _to_response(banner: Banner) -> BannerResponse:
    return BannerResponse(
        id=banner.id,
        title=banner.title,
        image_url=banner.image_url,
        link_url=banner.link_url,
        position=banner.position,
        display_order=banner.display_order,
        is_active=banner.is_active,
        start_date=banner.start_date,
        end_date=banner.end_date,
        created_at=banner.created_at,
    )

def _is_visible(banner: Banner) -> bool:
    today = date.today()
    if banner.start_date and banner.start_date > today:
        return False
    if banner.end_date and banner.end_date < today:
        return False
    return True


def _visibility_predicate(today: date):
    """SQL equivalent of `_is_visible`, for use inside a `WHERE` clause.

    A NULL bound means "unbounded on that side", which is exactly what the
    Python version's falsy check expresses. Kept as a named helper so the two
    implementations can be compared by a test rather than by reading.
    """
    return and_(
        or_(Banner.start_date.is_(None), Banner.start_date <= today),
        or_(Banner.end_date.is_(None), Banner.end_date >= today),
    )

@router.get("", response_model=list[BannerResponse])
def list_banners(
    position: str | None = None,
    # `include_inactive` was an unguarded public query parameter here, so
    # `?include_inactive=true` returned draft, expired and not-yet-scheduled
    # banners to anonymous callers — even though the sibling `GET /{id}` handler
    # in this same file gates the identical flag. Both are gated now.
    include_inactive: bool = False,
    # No `limit` existed here. The date-window filter also used to run in Python
    # *after* the whole table was loaded, so it could not be combined with
    # `limit`/`offset` without silently changing which rows a page contained.
    # `_visibility_predicate` is the SQL form of `_is_visible`; the two must
    # agree, and the test suite asserts they do.
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    privileged = can_view_inactive(user)
    if include_inactive and not privileged:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="include_inactive requires admin permissions",
        )

    query = select(Banner)
    if position:
        query = query.where(Banner.position == position)
    if not include_inactive:
        query = query.where(
            Banner.is_active,
            _visibility_predicate(date.today()),
        )
    banners = db.scalars(
        query.order_by(Banner.position, Banner.display_order)
        .limit(limit)
        .offset(offset)
    ).all()
    return [_to_response(b) for b in banners]

@router.get("/{banner_id}", response_model=BannerResponse)
def get_banner(
    banner_id: int,
    # Reading by direct id used to bypass the is_active + date-window checks that
    # the list handler applies, so anonymous callers could read draft, expired
    # and not-yet-scheduled banners. Admins can still see them explicitly.
    include_inactive: bool = False,
    user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    banner = db.get(Banner, banner_id)
    if banner is None:
        raise HTTPException(status_code=404, detail="Banner not found")

    privileged = can_view_inactive(user)
    if not include_inactive and not privileged:
        if not banner.is_active or not _is_visible(banner):
            raise HTTPException(status_code=404, detail="Banner not found")
    elif include_inactive and not privileged:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="include_inactive requires admin permissions",
        )

    return _to_response(banner)

@router.post(
    "",
    response_model=BannerResponse,
    status_code=201,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def create_banner(
    payload: BannerCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*CONTENT_ROLES)),
):
    banner = Banner(**payload.model_dump())
    db.add(banner)
    # 4.4 — flushed so `banner.id` exists for the audit row below; the commit
    # that persists the banner also persists the trail entry, so the two can
    # never disagree about whether the create happened.
    db.flush()
    audit.record(
        db,
        request=request,
        action="create_banner",
        entity_type="banner",
        entity_id=banner.id,
        actor=user,
        new_value=payload.model_dump(),
    )
    db.commit()
    db.refresh(banner)
    return _to_response(banner)

@router.put(
    "/{banner_id}",
    response_model=BannerResponse,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def update_banner(
    banner_id: int,
    payload: BannerUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*CONTENT_ROLES)),
):
    banner = db.get(Banner, banner_id)
    if banner is None:
        raise HTTPException(status_code=404, detail="Banner not found")
    data = payload.model_dump(exclude_unset=True)
    # 4.4 — old values read before the `setattr` loop below, so the row
    # describes the edit and not its result; `exclude_unset` keeps fields the
    # admin form never sent out of the diff. Same shape as `update_blog`.
    audit.record(
        db,
        request=request,
        action="update_banner",
        entity_type="banner",
        entity_id=banner.id,
        actor=user,
        old_value={field: getattr(banner, field) for field in data},
        new_value=data,
    )
    for field, value in data.items():
        setattr(banner, field, value)
    db.commit()
    db.refresh(banner)
    return _to_response(banner)

@router.delete(
    "/{banner_id}",
    status_code=204,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def delete_banner(
    banner_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*CONTENT_ROLES)),
):
    banner = db.get(Banner, banner_id)
    if banner is None:
        raise HTTPException(status_code=404, detail="Banner not found")
    # 4.4 — enough to say which banner was pulled and where it sat, read while
    # the row still exists; after `db.delete` there is nothing left to ask.
    audit.record(
        db,
        request=request,
        action="delete_banner",
        entity_type="banner",
        entity_id=banner.id,
        actor=user,
        old_value={
            "title": banner.title,
            "position": banner.position,
            "display_order": banner.display_order,
            "is_active": banner.is_active,
        },
    )
    db.delete(banner)
    db.commit()