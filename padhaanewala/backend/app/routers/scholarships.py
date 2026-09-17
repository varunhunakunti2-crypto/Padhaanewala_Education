import re
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import require_role
from app.models import Scholarship
from app.schemas.catalog import (
    ScholarshipCreate,
    ScholarshipResponse,
    ScholarshipUpdate,
)

router = APIRouter(prefix="/api/v1/scholarships", tags=["scholarships"])


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")


def _to_response(scholarship: Scholarship) -> ScholarshipResponse:
    return ScholarshipResponse(
        id=scholarship.id,
        name=scholarship.name,
        slug=scholarship.slug,
        provider=scholarship.provider,
        ownership=scholarship.ownership,
        eligibility=scholarship.eligibility,
        state_id=scholarship.state_id,
        state_name=scholarship.state.name if scholarship.state else None,
        course=scholarship.course,
        category=scholarship.category,
        income_criteria=scholarship.income_criteria,
        amount=scholarship.amount,
        application_deadline=scholarship.application_deadline,
        documents_required=scholarship.documents_required,
        application_procedure=scholarship.application_procedure,
        official_website=scholarship.official_website,
        verification_status=scholarship.verification_status,
        last_verified_date=scholarship.last_verified_date,
        next_verification_date=scholarship.next_verification_date,
        is_active=scholarship.is_active,
    )


@router.get("", response_model=list[ScholarshipResponse])
def list_scholarships(
    q: str | None = None,
    state_id: int | None = None,
    category: str | None = None,
    ownership: str | None = None,
    upcoming: bool = False,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = (
        select(Scholarship)
        .options(selectinload(Scholarship.state))
        .where(Scholarship.is_active)
    )
    if q:
        term = f"%{q.strip()}%"
        query = query.where(
            or_(Scholarship.name.ilike(term), Scholarship.provider.ilike(term))
        )
    if state_id:
        query = query.where(Scholarship.state_id == state_id)
    if category:
        query = query.where(Scholarship.category == category)
    if ownership:
        query = query.where(Scholarship.ownership == ownership)
    if upcoming:
        query = query.where(Scholarship.application_deadline >= date.today())

    scholarships = (
        db.scalars(query.order_by(Scholarship.name).limit(limit).offset(offset)).all()
    )
    return [_to_response(s) for s in scholarships]


@router.get("/{scholarship_ref}", response_model=ScholarshipResponse)
def get_scholarship(scholarship_ref: str, db: Session = Depends(get_db)):
    scholarship = db.scalar(
        select(Scholarship)
        .options(selectinload(Scholarship.state))
        .where(
            Scholarship.is_active,
            (
                Scholarship.id == int(scholarship_ref)
                if scholarship_ref.isdigit()
                else Scholarship.slug == scholarship_ref
            ),
        )
    )
    if scholarship is None:
        raise HTTPException(status_code=404, detail="Scholarship not found")
    return _to_response(scholarship)


def _find_scholarship(db: Session, ref: str) -> Scholarship | None:
    cond = (
        Scholarship.id == int(ref)
        if ref.isdigit()
        else Scholarship.slug == ref
    )
    return db.scalar(select(Scholarship).where(cond))


@router.post(
    "",
    response_model=ScholarshipResponse,
    status_code=201,
    dependencies=[Depends(require_role("admin", "super_admin", "content_manager"))],
)
def create_scholarship(payload: ScholarshipCreate, db: Session = Depends(get_db)):
    slug = _slugify(payload.name)
    if db.scalar(select(Scholarship).where(Scholarship.slug == slug)):
        raise HTTPException(status_code=400, detail="Scholarship with this name exists")
    scholarship = Scholarship(
        **payload.model_dump(exclude={"name"}), name=payload.name, slug=slug
    )
    db.add(scholarship)
    db.commit()
    db.refresh(scholarship)
    return _to_response(scholarship)


@router.put(
    "/{scholarship_ref}",
    response_model=ScholarshipResponse,
    dependencies=[Depends(require_role("admin", "super_admin", "content_manager"))],
)
def update_scholarship(
    scholarship_ref: str, payload: ScholarshipUpdate, db: Session = Depends(get_db)
):
    scholarship = _find_scholarship(db, scholarship_ref)
    if scholarship is None:
        raise HTTPException(status_code=404, detail="Scholarship not found")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] != scholarship.name:
        slug = _slugify(data["name"])
        if db.scalar(
            select(Scholarship).where(
                Scholarship.slug == slug, Scholarship.id != scholarship.id
            )
        ):
            raise HTTPException(
                status_code=400, detail="Scholarship with this name exists"
            )
        scholarship.slug = slug
    for field, value in data.items():
        setattr(scholarship, field, value)
    db.commit()
    db.refresh(scholarship)
    return _to_response(scholarship)


@router.delete(
    "/{scholarship_ref}",
    status_code=204,
    dependencies=[Depends(require_role("admin", "super_admin"))],
)
def delete_scholarship(scholarship_ref: str, db: Session = Depends(get_db)):
    scholarship = _find_scholarship(db, scholarship_ref)
    if scholarship is None:
        raise HTTPException(status_code=404, detail="Scholarship not found")
    db.delete(scholarship)
    db.commit()