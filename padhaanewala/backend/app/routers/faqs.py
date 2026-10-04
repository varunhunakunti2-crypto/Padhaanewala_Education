from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import (
    can_view_inactive,
    get_optional_current_user,
    require_role,
)
from app.models import FAQ, User
from app.schemas.content import FAQCreate, FAQResponse, FAQUpdate

router = APIRouter(prefix="/api/v1/faqs", tags=["faqs"])

from app.roles import CONTENT_ROLES

@router.get("", response_model=list[FAQResponse])
def list_faqs(
    entity_type: str | None = Query(None, max_length=50),
    entity_id: int | None = None,
    # `include_inactive` was an unguarded public query parameter here, so
    # `?include_inactive=true` would have returned unpublished answers to
    # anonymous callers. It is gated, matching `routers/banners.py`.
    include_inactive: bool = False,
    # No `limit` existed here, so the whole table was returned regardless of what
    # the caller asked for. See the same note in `universities.list_universities`.
    limit: int = Query(100, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    if include_inactive and not can_view_inactive(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="include_inactive requires admin permissions",
        )

    query = select(FAQ)
    if not include_inactive:
        query = query.where(FAQ.is_active)
    if entity_type:
        query = query.where(FAQ.entity_type == entity_type)
    if entity_id is not None:
        query = query.where(FAQ.entity_id == entity_id)
    return db.scalars(
        query.order_by(FAQ.entity_type, FAQ.entity_id, FAQ.display_order)
        .limit(limit)
        .offset(offset)
    ).all()

@router.get("/{faq_id}", response_model=FAQResponse)
def get_faq(
    faq_id: int,
    include_inactive: bool = False,
    user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """Read one FAQ.

    The `is_active` filter used to be unconditional, which made an unpublished
    FAQ unreachable through the API even for the admin who had just hidden it —
    the admin console's edit dialog loads the record through this endpoint, so a
    hidden FAQ could be seen in no list, opened in no dialog, and only ever
    re-created. `include_inactive` now lifts the filter for `CONTENT_ROLES`,
    matching `routers/banners.py::get_banner`.
    """
    faq = db.get(FAQ, faq_id)
    if faq is None:
        raise HTTPException(status_code=404, detail="FAQ not found")

    privileged = can_view_inactive(user)
    if include_inactive and not privileged:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="include_inactive requires admin permissions",
        )
    if not faq.is_active and not privileged:
        raise HTTPException(status_code=404, detail="FAQ not found")

    return faq

@router.post(
    "",
    response_model=FAQResponse,
    status_code=201,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def create_faq(payload: FAQCreate, db: Session = Depends(get_db)):
    faq = FAQ(**payload.model_dump())
    db.add(faq)
    db.commit()
    db.refresh(faq)
    return faq

@router.put(
    "/{faq_id}",
    response_model=FAQResponse,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def update_faq(
    faq_id: int, payload: FAQUpdate, db: Session = Depends(get_db)
):
    faq = db.get(FAQ, faq_id)
    if faq is None:
        raise HTTPException(status_code=404, detail="FAQ not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(faq, field, value)
    db.commit()
    db.refresh(faq)
    return faq

@router.delete(
    "/{faq_id}",
    status_code=204,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def delete_faq(faq_id: int, db: Session = Depends(get_db)):
    faq = db.get(FAQ, faq_id)
    if faq is None:
        raise HTTPException(status_code=404, detail="FAQ not found")
    db.delete(faq)
    db.commit()