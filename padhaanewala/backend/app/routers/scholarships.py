import re
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import (
    can_view_inactive,
    get_optional_current_user,
    require_role,
)
from app.models import Scholarship, User
from app.schemas.catalog import (
    ScholarshipCreate,
    ScholarshipResponse,
    ScholarshipUpdate,
)
from app.roles import ADMIN_ROLES, CONTENT_ROLES
from app.utils import audit

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
    # See `list_colleges` for why this exists: the console reads this public route,
    # and an unconditional `is_active` filter made deactivation a one-way door.
    include_inactive: bool = False,
    limit: int = Query(50, ge=1, le=100),
    offset: int = 0,
    user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    if include_inactive and not can_view_inactive(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="include_inactive requires admin permissions",
        )

    query = select(Scholarship).options(selectinload(Scholarship.state))
    if not include_inactive:
        query = query.where(Scholarship.is_active)
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
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def create_scholarship(
    payload: ScholarshipCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*CONTENT_ROLES)),
):
    slug = _slugify(payload.name)
    if db.scalar(select(Scholarship).where(Scholarship.slug == slug)):
        raise HTTPException(status_code=400, detail="Scholarship with this name exists")
    scholarship = Scholarship(
        **payload.model_dump(exclude={"name"}), name=payload.name, slug=slug
    )
    db.add(scholarship)
    # 4.4 — scholarships were mutated with no audit row, so money and deadline
    # changes could be made with nothing in the trail to say who made them.
    # Flushed first so `scholarship.id` exists to stamp, and written after the
    # slug check so a refused create leaves no phantom entry.
    db.flush()
    audit.record(
        db,
        request=request,
        action="create_scholarship",
        entity_type="scholarship",
        entity_id=scholarship.id,
        actor=user,
        new_value=payload.model_dump(),
    )
    db.commit()
    db.refresh(scholarship)
    return _to_response(scholarship)


@router.put(
    "/{scholarship_ref}",
    response_model=ScholarshipResponse,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def update_scholarship(
    scholarship_ref: str,
    payload: ScholarshipUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*CONTENT_ROLES)),
):
    scholarship = _find_scholarship(db, scholarship_ref)
    if scholarship is None:
        raise HTTPException(status_code=404, detail="Scholarship not found")

    data = payload.model_dump(exclude_unset=True)
    # Captured before the setattr loop so the trail holds the values the edit
    # actually replaced, narrowed to the keys the caller sent — a full dump
    # would log untouched columns as changes and make the row unreadable.
    old_value = {field: getattr(scholarship, field) for field in data}
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
    audit.record(
        db,
        request=request,
        action="update_scholarship",
        entity_type="scholarship",
        entity_id=scholarship.id,
        actor=user,
        old_value=old_value,
        new_value=data,
    )
    db.commit()
    db.refresh(scholarship)
    return _to_response(scholarship)


@router.delete(
    "/{scholarship_ref}",
    status_code=204,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def delete_scholarship(
    scholarship_ref: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*ADMIN_ROLES)),
):
    scholarship = _find_scholarship(db, scholarship_ref)
    if scholarship is None:
        raise HTTPException(status_code=404, detail="Scholarship not found")
    # Enough of the row to reconstruct what existed, read before the delete so
    # the values are not fetched from an expired instance afterwards.
    audit.record(
        db,
        request=request,
        action="delete_scholarship",
        entity_type="scholarship",
        entity_id=scholarship.id,
        actor=user,
        old_value={
            "name": scholarship.name,
            "slug": scholarship.slug,
            "provider": scholarship.provider,
            "amount": scholarship.amount,
            "application_deadline": scholarship.application_deadline,
            "is_active": scholarship.is_active,
        },
    )
    db.delete(scholarship)
    db.commit()
