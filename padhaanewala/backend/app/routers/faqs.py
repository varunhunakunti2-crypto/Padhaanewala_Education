from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_role
from app.models import FAQ
from app.schemas.content import FAQCreate, FAQResponse, FAQUpdate

router = APIRouter(prefix="/api/v1/faqs", tags=["faqs"])

CONTENT_ROLES = ("admin", "super_admin", "content_manager")


@router.get("", response_model=list[FAQResponse])
def list_faqs(
    entity_type: str | None = Query(None, max_length=50),
    entity_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = select(FAQ).where(FAQ.is_active)
    if entity_type:
        query = query.where(FAQ.entity_type == entity_type)
    if entity_id is not None:
        query = query.where(FAQ.entity_id == entity_id)
    return db.scalars(
        query.order_by(FAQ.entity_type, FAQ.entity_id, FAQ.display_order)
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