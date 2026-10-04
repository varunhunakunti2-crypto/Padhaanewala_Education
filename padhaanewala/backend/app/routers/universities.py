import re

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_role
from app.models import University, User
from app.schemas.catalog import (
    UniversityCreate,
    UniversityResponse,
    UniversityUpdate,
)
from app.roles import ADMIN_ROLES, CONTENT_ROLES
from app.utils import audit

router = APIRouter(prefix="/api/v1/universities", tags=["universities"])


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")


def _find_university(db: Session, ref: str) -> University | None:
    cond = University.id == int(ref) if ref.isdigit() else University.slug == ref
    return db.scalar(select(University).where(cond))


@router.get("", response_model=list[UniversityResponse])
def list_universities(
    # This endpoint had no `limit` at all, so it was the one list route Phase
    # 1.6's `Query(le=...)` sweep could not reach: `?limit=1000000` was silently
    # ignored and the whole table was returned. It is also walked by the
    # frontend's paged fetch, which assumes `limit`/`offset` are honoured —
    # without them that walk ignores `offset`, receives the same page forever and
    # only stops at the client's 5000-row ceiling.
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(University)
        .where(University.is_active)
        .order_by(University.name)
        .limit(limit)
        .offset(offset)
    ).all()


@router.get("/{university_ref}", response_model=UniversityResponse)
def get_university(university_ref: str, db: Session = Depends(get_db)):
    university = _find_university(db, university_ref)
    if university is None or not university.is_active:
        raise HTTPException(status_code=404, detail="University not found")
    return university


@router.post(
    "",
    response_model=UniversityResponse,
    status_code=201,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def create_university(
    payload: UniversityCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*CONTENT_ROLES)),
):
    slug = _slugify(payload.name)
    if db.scalar(select(University).where(University.slug == slug)):
        raise HTTPException(status_code=400, detail="University with this name exists")
    university = University(
        **payload.model_dump(exclude={"name"}), name=payload.name, slug=slug
    )
    db.add(university)
    # 4.4 — universities were mutated with no audit row, so the institution
    # behind every college link could be added or dropped untraceably. Flushed
    # first so `university.id` exists to stamp, and written after the slug
    # check so a refused create leaves no phantom entry.
    db.flush()
    audit.record(
        db,
        request=request,
        action="create_university",
        entity_type="university",
        entity_id=university.id,
        actor=user,
        new_value=payload.model_dump(),
    )
    db.commit()
    db.refresh(university)
    return university


@router.put(
    "/{university_ref}",
    response_model=UniversityResponse,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def update_university(
    university_ref: str,
    payload: UniversityUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*CONTENT_ROLES)),
):
    university = _find_university(db, university_ref)
    if university is None:
        raise HTTPException(status_code=404, detail="University not found")

    data = payload.model_dump(exclude_unset=True)
    # Captured before the setattr loop so the trail holds the values the edit
    # actually replaced, narrowed to the keys the caller sent — a full dump
    # would log untouched columns as changes and make the row unreadable.
    old_value = {field: getattr(university, field) for field in data}
    if "name" in data and data["name"] != university.name:
        slug = _slugify(data["name"])
        if db.scalar(
            select(University).where(
                University.slug == slug, University.id != university.id
            )
        ):
            raise HTTPException(
                status_code=400, detail="University with this name exists"
            )
        university.slug = slug
    for field, value in data.items():
        setattr(university, field, value)
    audit.record(
        db,
        request=request,
        action="update_university",
        entity_type="university",
        entity_id=university.id,
        actor=user,
        old_value=old_value,
        new_value=data,
    )
    db.commit()
    db.refresh(university)
    return university


@router.delete(
    "/{university_ref}",
    status_code=204,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def delete_university(
    university_ref: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*ADMIN_ROLES)),
):
    university = _find_university(db, university_ref)
    if university is None:
        raise HTTPException(status_code=404, detail="University not found")
    # Enough of the row to reconstruct what existed, read before the delete so
    # the values are not fetched from an expired instance afterwards.
    audit.record(
        db,
        request=request,
        action="delete_university",
        entity_type="university",
        entity_id=university.id,
        actor=user,
        old_value={
            "name": university.name,
            "slug": university.slug,
            "type": university.type,
            "is_active": university.is_active,
        },
    )
    db.delete(university)
    db.commit()