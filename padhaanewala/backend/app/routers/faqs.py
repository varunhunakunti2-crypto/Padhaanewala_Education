from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_role
from app.models import FAQ, User
from app.schemas.content import FAQCreate, FAQResponse, FAQUpdate
from app.utils import audit

router = APIRouter(prefix="/api/v1/faqs", tags=["faqs"])

from app.roles import CONTENT_ROLES

@router.get("", response_model=list[FAQResponse])
def list_faqs(
    entity_type: str | None = Query(None, max_length=50),
    entity_id: int | None = None,
    # No `limit` existed here, so the whole table was returned regardless of what
    # the caller asked for. See the same note in `universities.list_universities`.
    limit: int = Query(100, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = select(FAQ).where(FAQ.is_active)
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
def get_faq(faq_id: int, db: Session = Depends(get_db)):
    faq = db.get(FAQ, faq_id)
    if faq is None or not faq.is_active:
        raise HTTPException(status_code=404, detail="FAQ not found")
    return faq

@router.post(
    "",
    response_model=FAQResponse,
    status_code=201,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def create_faq(
    payload: FAQCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*CONTENT_ROLES)),
):
    faq = FAQ(**payload.model_dump())
    db.add(faq)
    # 4.4 — flushed so `faq.id` exists for the audit row; the commit below
    # lands the row and its trail entry together, as `create_college` does.
    db.flush()
    audit.record(
        db,
        request=request,
        action="create_faq",
        entity_type="faq",
        entity_id=faq.id,
        actor=user,
        new_value=payload.model_dump(),
    )
    db.commit()
    db.refresh(faq)
    return faq

@router.put(
    "/{faq_id}",
    response_model=FAQResponse,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def update_faq(
    faq_id: int,
    payload: FAQUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*CONTENT_ROLES)),
):
    faq = db.get(FAQ, faq_id)
    if faq is None:
        raise HTTPException(status_code=404, detail="FAQ not found")
    data = payload.model_dump(exclude_unset=True)
    # 4.4 — old values read before the `setattr` loop below, so the row
    # describes the edit and not its result; `exclude_unset` keeps the fields
    # the caller never sent out of the diff. Same shape as `update_blog`.
    audit.record(
        db,
        request=request,
        action="update_faq",
        entity_type="faq",
        entity_id=faq.id,
        actor=user,
        old_value={field: getattr(faq, field) for field in data},
        new_value=data,
    )
    for field, value in data.items():
        setattr(faq, field, value)
    db.commit()
    db.refresh(faq)
    return faq

@router.delete(
    "/{faq_id}",
    status_code=204,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def delete_faq(
    faq_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*CONTENT_ROLES)),
):
    faq = db.get(FAQ, faq_id)
    if faq is None:
        raise HTTPException(status_code=404, detail="FAQ not found")
    # 4.4 — the question itself plus what it was attached to, read while the
    # row still exists; after `db.delete` there is nothing left to ask.
    audit.record(
        db,
        request=request,
        action="delete_faq",
        entity_type="faq",
        entity_id=faq.id,
        actor=user,
        old_value={
            "question": faq.question,
            "entity_type": faq.entity_type,
            "entity_id": faq.entity_id,
        },
    )
    db.delete(faq)
    db.commit()