from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import College, SavedCollege, StudentProfile, User
from app.schemas.catalog import CollegeListItemResponse

router = APIRouter(prefix="/api/v1/saved-colleges", tags=["saved-colleges"])


class SavedCollegeResponse(BaseModel):
    id: int
    college_id: int
    saved_at: datetime
    college: CollegeListItemResponse

    model_config = {"from_attributes": True}


def _get_student_profile(user: User, db: Session) -> StudentProfile:
    profile = db.scalar(
        select(StudentProfile).where(StudentProfile.user_id == user.id)
    )
    if profile is None:
        raise HTTPException(
            status_code=400,
            detail="Student profile not found. Please complete your profile first.",
        )
    return profile


def _to_college_item(college: College) -> CollegeListItemResponse:
    return CollegeListItemResponse(
        id=college.id,
        college_id=college.college_id,
        name=college.name,
        slug=college.slug,
        college_type=college.college_type,
        ownership=college.ownership,
        city=college.city,
        state=college.state.name if college.state else None,
        university_name=college.university.name if college.university else None,
        has_hostel=college.has_hostel,
        total_reviews=college.total_reviews,
        average_rating=college.average_rating,
        is_featured=college.is_featured,
    )


@router.get("", response_model=list[SavedCollegeResponse])
def list_saved_colleges(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = _get_student_profile(user, db)
    rows = db.scalars(
        select(SavedCollege)
        .options(
            selectinload(SavedCollege.college)
            .selectinload(College.state),
            selectinload(SavedCollege.college)
            .selectinload(College.university),
        )
        .where(SavedCollege.student_id == profile.id)
        .order_by(SavedCollege.created_at.desc())
    ).all()
    return [
        SavedCollegeResponse(
            id=sc.id,
            college_id=sc.college_id,
            saved_at=sc.created_at,
            college=_to_college_item(sc.college),
        )
        for sc in rows
    ]


@router.post("", response_model=SavedCollegeResponse, status_code=201)
def save_college(
    college_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = _get_student_profile(user, db)

    college = db.get(College, college_id)
    if college is None or not college.is_active:
        raise HTTPException(status_code=404, detail="College not found")

    existing = db.scalar(
        select(SavedCollege).where(
            SavedCollege.student_id == profile.id,
            SavedCollege.college_id == college_id,
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="College already saved")

    sc = SavedCollege(student_id=profile.id, college_id=college_id)
    db.add(sc)
    db.commit()
    db.refresh(sc)

    db.refresh(college)
    return SavedCollegeResponse(
        id=sc.id,
        college_id=sc.college_id,
        saved_at=sc.created_at,
        college=_to_college_item(college),
    )


@router.delete("/{college_id}", status_code=204)
def unsave_college(
    college_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = _get_student_profile(user, db)

    sc = db.scalar(
        select(SavedCollege).where(
            SavedCollege.student_id == profile.id,
            SavedCollege.college_id == college_id,
        )
    )
    if sc is None:
        raise HTTPException(status_code=404, detail="Saved college not found")

    db.delete(sc)
    db.commit()
