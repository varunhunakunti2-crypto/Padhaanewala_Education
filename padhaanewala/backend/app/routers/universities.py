import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_role
from app.models import University
from app.schemas.catalog import (
    UniversityCreate,
    UniversityResponse,
    UniversityUpdate,
)

router = APIRouter(prefix="/api/v1/universities", tags=["universities"])


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")


def _find_university(db: Session, ref: str) -> University | None:
    cond = University.id == int(ref) if ref.isdigit() else University.slug == ref
    return db.scalar(select(University).where(cond))


@router.get("", response_model=list[UniversityResponse])
def list_universities(db: Session = Depends(get_db)):
    return db.scalars(
        select(University).where(University.is_active).order_by(University.name)
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
    dependencies=[Depends(require_role("admin", "super_admin", "content_manager"))],
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
    dependencies=[Depends(require_role("admin", "super_admin", "content_manager"))],
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
    dependencies=[Depends(require_role("admin", "super_admin"))],
)
def delete_university(university_ref: str, db: Session = Depends(get_db)):
    university = _find_university(db, university_ref)
    if university is None:
        raise HTTPException(status_code=404, detail="University not found")
    db.delete(university)
    db.commit()