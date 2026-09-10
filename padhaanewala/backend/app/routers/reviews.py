from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models import AuditLog, College, Course, Review, User
from app.schemas.content import (
    ReviewCreate,
    ReviewModerate,
    ReviewResponse,
    ReviewUpdate,
)

router = APIRouter(prefix="/api/v1/reviews", tags=["reviews"])

PUBLIC_MODES = {"approved"}


def _to_response(db: Session, review: Review) -> ReviewResponse:
    college = db.get(College, review.college_id)
    course = db.get(Course, review.course_id) if review.course_id else None
    student = db.get(User, review.student_id)
    return ReviewResponse(
        id=review.id,
        college_id=review.college_id,
        college_name=college.name if college else None,
        course_id=review.course_id,
        course_name=course.name if course else None,
        student_id=review.student_id,
        student_name=student.display_name if student else None,
        rating=review.rating,
        review_text=review.review_text,
        year_of_study=review.year_of_study,
        images=review.images,
        status=review.status,
        moderation_notes=review.moderation_notes,
        is_verified=review.is_verified,
        moderated_at=review.moderated_at,
        created_at=review.created_at,
    )


def _recalc_rating(db: Session, college_id: int) -> None:
    college = db.get(College, college_id)
    if college is None:
        return
    avg, count = db.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(
            Review.college_id == college_id, Review.status == "approved"
        )
    ).one()
    college.average_rating = float(avg) if avg is not None else 0
    college.total_reviews = count or 0


@router.get("/college/{college_ref}", response_model=list[ReviewResponse])
def list_reviews_for_college(
    college_ref: str,
    db: Session = Depends(get_db),
):
    college = db.scalar(
        select(College).where(
            College.id == int(college_ref)
            if college_ref.isdigit()
            else College.slug == college_ref
        )
    )
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")
    reviews = db.scalars(
        select(Review)
        .where(Review.college_id == college.id, Review.status == "approved")
        .order_by(Review.created_at.desc())
    ).all()
    return [_to_response(db, r) for r in reviews]


@router.get("/moderation", response_model=list[ReviewResponse])
def moderation_queue(
    status: str = Query("submitted", pattern="^(submitted|approved|rejected)$"),
    db: Session = Depends(get_db),
    _: User = Depends(require_role("admin", "super_admin", "content_manager")),
):
    reviews = db.scalars(
        select(Review)
        .where(Review.status == status)
        .order_by(Review.created_at.asc())
    ).all()
    return [_to_response(db, r) for r in reviews]


@router.get("/my", response_model=list[ReviewResponse])
def my_reviews(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    reviews = db.scalars(
        select(Review)
        .where(Review.student_id == user.id)
        .order_by(Review.created_at.desc())
    ).all()
    return [_to_response(db, r) for r in reviews]


@router.post("", response_model=ReviewResponse, status_code=201)
def submit_review(
    payload: ReviewCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    college = db.get(College, payload.college_id)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")
    existing = db.scalar(
        select(Review).where(
            Review.student_id == user.id, Review.college_id == payload.college_id
        )
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Review already submitted for this college")

    review = Review(
        college_id=payload.college_id,
        course_id=payload.course_id,
        student_id=user.id,
        rating=payload.rating,
        review_text=payload.review_text,
        year_of_study=payload.year_of_study,
        images=payload.images,
        status="submitted",
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return _to_response(db, review)


@router.put("/{review_id}", response_model=ReviewResponse)
def update_my_review(
    review_id: int,
    payload: ReviewUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    review = db.scalar(
        select(Review).where(Review.id == review_id, Review.student_id == user.id)
    )
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found")
    if review.status == "approved":
        raise HTTPException(status_code=409, detail="Approved reviews cannot be edited")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(review, field, value)
    review.status = "submitted"
    db.commit()
    db.refresh(review)
    return _to_response(db, review)


@router.post("/{review_id}/moderate", response_model=ReviewResponse)
def moderate_review(
    review_id: int,
    payload: ReviewModerate,
    db: Session = Depends(get_db),
    moderator: User = Depends(require_role("admin", "super_admin", "content_manager")),
):
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found")

    old_status = review.status
    review.status = payload.status
    review.moderation_notes = payload.moderation_notes
    review.moderated_by = moderator.id
    review.moderated_at = datetime.now(timezone.utc)
    if payload.status == "approved":
        review.is_verified = True

    db.add(
        AuditLog(
            user_id=moderator.id,
            action="moderate_review",
            entity_type="review",
            entity_id=review.id,
            old_value={"status": old_status},
            new_value={"status": payload.status},
        )
    )
    db.commit()
    _recalc_rating(db, review.college_id)
    db.refresh(review)
    return _to_response(db, review)


@router.delete("/{review_id}", status_code=204)
def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin", "super_admin")),
):
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found")
    college_id = review.college_id
    db.delete(review)
    db.commit()
    _recalc_rating(db, college_id)