from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import (
    get_current_user,
    require_processing_consent,
    require_role,
)
from app.models import College, Review, User
from app.roles import ADMIN_ROLES, CONTENT_ROLES
from app.schemas.content import (
    ReviewCreate,
    ReviewModerate,
    ReviewResponse,
    ReviewUpdate,
)
from app.utils import audit

router = APIRouter(prefix="/api/v1/reviews", tags=["reviews"])

PUBLIC_MODES = {"approved"}


#: The relationships every review response reads. A list page for N reviews used
#: to cost 3N+1 queries (a `db.get` each for the college, the course and the
#: student) and none of the three list endpoints was even paged, so N was the
#: whole table. Eager-loading them makes the count independent of the page size.
#: `student` carries a second `selectinload`: `User.display_name` is a property
#: that reads `self.student_profile`, so loading only the student would just
#: move the N+1 one level down — the same trap the audit router documents.
_REVIEW_EAGER = (
    selectinload(Review.college),
    selectinload(Review.course),
    selectinload(Review.student).selectinload(User.student_profile),
)


def _load_one(db: Session, review_id: int) -> Review:
    """Re-read one review with the same eager loads the list queries use.

    The write paths refresh the row after committing; doing that through
    `_REVIEW_EAGER` keeps `_to_response` free of lazy loads on every path, so a
    single-row response costs the same query count as a row in a list.
    """
    return db.scalar(
        select(Review).where(Review.id == review_id).options(*_REVIEW_EAGER)
    )


def _to_response(review: Review) -> ReviewResponse:
    # Reads the eager-loaded relationships rather than `db.get(...)` per row. See
    # `_REVIEW_EAGER`; a detached call still works because the attributes are
    # already populated.
    college = review.college
    course = review.course
    student = review.student
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
    """Write the denormalised rating columns with one statement.

    This used to `db.get(College, college_id)` and set two scalar fields on the
    hydrated object. That loads every column of the row — including its JSON
    blobs — to write two numbers, and it is on the moderation path, which is the
    one an admin drives in bulk. A targeted UPDATE touches only the two columns
    and does not hydrate an ORM instance at all.

    A college row that does not exist is not an error here: this runs after a
    review was moderated or deleted, and `Review.college_id` is `ON DELETE
    CASCADE`, so the only way to reach a missing parent is a race with a
    concurrent college delete. In that case there is nothing to denormalise.
    """
    avg, count = db.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(
            Review.college_id == college_id, Review.status == "approved"
        )
    ).one()
    db.execute(
        update(College)
        .where(College.id == college_id)
        .values(
            average_rating=float(avg) if avg is not None else 0,
            total_reviews=count or 0,
        )
    )


@router.get("/college/{college_ref}", response_model=list[ReviewResponse])
def list_reviews_for_college(
    college_ref: str,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
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
        .options(*_REVIEW_EAGER)
        .order_by(Review.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return [_to_response(r) for r in reviews]


@router.get("/moderation", response_model=list[ReviewResponse])
def moderation_queue(
    status: str = Query("submitted", pattern="^(submitted|approved|rejected)$"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(require_role(*CONTENT_ROLES)),
):
    reviews = db.scalars(
        select(Review)
        .where(Review.status == status)
        .options(*_REVIEW_EAGER)
        .order_by(Review.created_at.asc())
        .limit(limit)
        .offset(offset)
    ).all()
    return [_to_response(r) for r in reviews]


@router.get("/my", response_model=list[ReviewResponse])
def my_reviews(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    reviews = db.scalars(
        select(Review)
        .where(Review.student_id == user.id)
        .options(*_REVIEW_EAGER)
        .order_by(Review.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return [_to_response(r) for r in reviews]


@router.post("", response_model=ReviewResponse, status_code=201)
def submit_review(
    payload: ReviewCreate,
    db: Session = Depends(get_db),
    #: Phase 9.1 — a published review names a course of study and a year, which is
    #: personal data about a person who may be a minor, and it is published to
    #: every visitor. Gated for the same reason as the rest of the write surface.
    user: User = Depends(require_processing_consent),
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
    review = _load_one(db, review.id)
    return _to_response(review)


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
    review = _load_one(db, review_id)
    return _to_response(review)


@router.post("/{review_id}/moderate", response_model=ReviewResponse)
def moderate_review(
    review_id: int,
    payload: ReviewModerate,
    request: Request,
    db: Session = Depends(get_db),
    moderator: User = Depends(require_role(*CONTENT_ROLES)),
):
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found")
    

    old_status = review.status
    review.status = payload.status
    review.moderation_notes = payload.moderation_notes
    review.moderated_by = moderator.id
    review.moderated_at = datetime.now(UTC)
    if payload.status == "approved":
        review.is_verified = True

    audit.record(
        db,
        request=request,
        action="moderate_review",
        entity_type="review",
        entity_id=review.id,
        actor=moderator,
        old_value={"status": old_status},
        new_value={"status": payload.status, "moderation_notes": payload.moderation_notes},
    )
    db.commit()
    _recalc_rating(db, review.college_id)
    db.commit()
    review = _load_one(db, review_id)
    return _to_response(review)


@router.delete("/{review_id}", status_code=204)
def delete_review(
    review_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*ADMIN_ROLES)),
):
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found")
    college_id = review.college_id
    # 4.4/4.5 — moderation was audited but the harder action was not: an admin
    # destroying a review left no row saying who did it or what the review said.
    # Captured before the delete so the text is on the trail after it is gone.
    audit.record(
        db,
        request=request,
        action="delete_review",
        entity_type="review",
        entity_id=review.id,
        actor=user,
        old_value={
            "college_id": review.college_id,
            "student_id": review.student_id,
            "rating": review.rating,
            "status": review.status,
            "review_text": review.review_text,
        },
    )
    db.delete(review)
    db.commit()
    _recalc_rating(db, college_id)
    db.commit()