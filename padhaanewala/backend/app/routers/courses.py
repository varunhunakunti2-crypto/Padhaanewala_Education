import re

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import (
    can_view_inactive,
    get_optional_current_user,
    require_role,
)
from app.models import CollegeCourse, Course, User
from app.schemas.catalog import CourseCreate, CourseResponse, CourseUpdate
from app.roles import ADMIN_ROLES, CONTENT_ROLES
from app.utils import audit

router = APIRouter(prefix="/api/v1/courses", tags=["courses"])


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")


class CourseDetailResponse(CourseResponse):
    overview: str | None
    eligibility: str | None
    career_information: str | None
    college_count: int = 0


@router.get("", response_model=list[CourseResponse])
def list_courses(
    q: str | None = None,
    category: str | None = None,
    degree: str | None = None,
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

    query = select(Course)
    if not include_inactive:
        query = query.where(Course.is_active)
    if q:
        term = f"%{q.strip()}%"
        query = query.where(
            or_(Course.name.ilike(term), Course.degree.ilike(term))
        )
    if category:
        query = query.where(Course.category.ilike(f"%{category}%"))
    if degree:
        query = query.where(Course.degree.ilike(f"%{degree}%"))

    courses = db.scalars(query.order_by(Course.name).limit(limit).offset(offset)).all()
    return courses


@router.get("/categories", response_model=list[str])
def list_course_categories(db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Course.category)
        .where(Course.is_active, Course.category.isnot(None))
        .distinct()
        .order_by(Course.category)
    ).all()
    return rows


@router.get("/{course_ref}", response_model=CourseDetailResponse)
def get_course(course_ref: str, db: Session = Depends(get_db)):
    cond = (
        Course.id == int(course_ref)
        if course_ref.isdigit()
        else Course.slug == course_ref
    )
    course = db.scalar(select(Course).where(Course.is_active, cond))
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")

    college_count = db.scalar(
        select(func.count(CollegeCourse.id)).where(
            CollegeCourse.course_id == course.id,
            CollegeCourse.is_active,
        )
    ) or 0

    return CourseDetailResponse(
        id=course.id,
        name=course.name,
        slug=course.slug,
        degree=course.degree,
        duration=course.duration,
        category=course.category,
        overview=course.overview,
        eligibility=course.eligibility,
        career_information=course.career_information,
        college_count=college_count,
    )


def _find_course(db: Session, ref: str) -> Course | None:
    cond = Course.id == int(ref) if ref.isdigit() else Course.slug == ref
    return db.scalar(select(Course).where(cond))


@router.post(
    "",
    response_model=CourseDetailResponse,
    status_code=201,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def create_course(
    payload: CourseCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*CONTENT_ROLES)),
):
    slug = _slugify(payload.name)
    if db.scalar(select(Course).where(Course.slug == slug)):
        raise HTTPException(status_code=400, detail="Course with this name exists")
    course = Course(**payload.model_dump(exclude={"name"}), name=payload.name, slug=slug)
    db.add(course)
    # 4.4 — course create/update/delete carried no audit trail at all, so the
    # catalog could be rewritten with no record of who did it. Flushed first so
    # `course.id` exists to stamp on the row, and written after the slug check
    # so a refused create leaves no phantom entry.
    db.flush()
    audit.record(
        db,
        request=request,
        action="create_course",
        entity_type="course",
        entity_id=course.id,
        actor=user,
        new_value=payload.model_dump(),
    )
    db.commit()
    db.refresh(course)
    return course


@router.put(
    "/{course_ref}",
    response_model=CourseDetailResponse,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def update_course(
    course_ref: str,
    payload: CourseUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*CONTENT_ROLES)),
):
    course = _find_course(db, course_ref)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")

    data = payload.model_dump(exclude_unset=True)
    # Captured before the setattr loop so the trail holds the values the edit
    # actually replaced, narrowed to the keys the caller sent — a full dump
    # would log untouched columns as changes and make the row unreadable.
    old_value = {field: getattr(course, field) for field in data}
    if "name" in data and data["name"] != course.name:
        slug = _slugify(data["name"])
        if db.scalar(select(Course).where(Course.slug == slug, Course.id != course.id)):
            raise HTTPException(status_code=400, detail="Course with this name exists")
        course.slug = slug
    for field, value in data.items():
        setattr(course, field, value)
    audit.record(
        db,
        request=request,
        action="update_course",
        entity_type="course",
        entity_id=course.id,
        actor=user,
        old_value=old_value,
        new_value=data,
    )
    db.commit()
    db.refresh(course)
    return course


@router.delete(
    "/{course_ref}",
    status_code=204,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def delete_course(
    course_ref: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*ADMIN_ROLES)),
):
    course = _find_course(db, course_ref)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    # Enough of the row to reconstruct what existed, read before the delete so
    # the values are not fetched from an expired instance afterwards.
    audit.record(
        db,
        request=request,
        action="delete_course",
        entity_type="course",
        entity_id=course.id,
        actor=user,
        old_value={
            "name": course.name,
            "slug": course.slug,
            "degree": course.degree,
            "is_active": course.is_active,
        },
    )
    db.delete(course)
    db.commit()
