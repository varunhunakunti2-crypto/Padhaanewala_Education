import re

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import (
    can_view_inactive,
    get_optional_current_user,
    require_role,
)
from app.models import University, User
from app.schemas.catalog import (
    UniversityCreate,
    UniversityResponse,
    UniversityUpdate,
)
from app.roles import ADMIN_ROLES, CONTENT_ROLES

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
    # See `colleges.list_colleges` for why this exists: the console reads this
    # public route to populate its university dropdown, and the unconditional
    # `is_active` filter meant a deactivated university could not be re-selected
    # or un-deactivated from there.
    include_inactive: bool = False,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    if include_inactive and not can_view_inactive(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="include_inactive requires admin permissions",
        )

    query = select(University)
    if not include_inactive:
        query = query.where(University.is_active)
    return (
        db.scalars(
            query.order_by(University.name).limit(limit).offset(offset)
        ).all()
    )


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
def create_university(payload: UniversityCreate, db: Session = Depends(get_db)):
    slug = _slugify(payload.name)
    if db.scalar(select(University).where(University.slug == slug)):
        raise HTTPException(status_code=400, detail="University with this name exists")
    university = University(
        **payload.model_dump(exclude={"name"}), name=payload.name, slug=slug
    )
    db.add(university)
    db.commit()
    db.refresh(university)
    return university


@router.put(
    "/{university_ref}",
    response_model=UniversityResponse,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def update_university(
    university_ref: str, payload: UniversityUpdate, db: Session = Depends(get_db)
):
    university = _find_university(db, university_ref)
    if university is None:
        raise HTTPException(status_code=404, detail="University not found")

    data = payload.model_dump(exclude_unset=True)
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
    db.commit()
    db.refresh(university)
    return university


@router.delete(
    "/{university_ref}",
    status_code=204,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def delete_university(university_ref: str, db: Session = Depends(get_db)):
    university = _find_university(db, university_ref)
    if university is None:
        raise HTTPException(status_code=404, detail="University not found")
    db.delete(university)
    db.commit()