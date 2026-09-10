from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import University
from app.schemas.catalog import UniversityResponse

router = APIRouter(prefix="/api/v1/universities", tags=["universities"])


@router.get("", response_model=list[UniversityResponse])
def list_universities(db: Session = Depends(get_db)):
    return db.scalars(
        select(University).where(University.is_active).order_by(University.name)
    ).all()


@router.get("/{university_id}", response_model=UniversityResponse)
def get_university(university_id: int, db: Session = Depends(get_db)):
    university = db.get(University, university_id)
    if university is None or not university.is_active:
        raise HTTPException(status_code=404, detail="University not found")
    return university