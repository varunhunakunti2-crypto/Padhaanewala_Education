import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_role
from app.models import CollegeCourse, Course
from app.schemas.catalog import CourseCreate, CourseResponse, CourseUpdate

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
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = select(Course).where(Course.is_active)
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
    dependencies=[Depends(require_role("admin", "super_admin", "content_manager"))],
)
def create_course(payload: CourseCreate, db: Session = Depends(get_db)):
    slug = _slugify(payload.name)
    if db.scalar(select(Course).where(Course.slug == slug)):
        raise HTTPException(status_code=400, detail="Course with this name exists")
    course = Course(**payload.model_dump(exclude={"name"}), name=payload.name, slug=slug)
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


@router.put(
    "/{course_ref}",
    response_model=CourseDetailResponse,
    dependencies=[Depends(require_role("admin", "super_admin", "content_manager"))],
)
def update_course(
    course_ref: str, payload: CourseUpdate, db: Session = Depends(get_db)
):
    course = _find_course(db, course_ref)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] != course.name:
        slug = _slugify(data["name"])
        if db.scalar(select(Course).where(Course.slug == slug, Course.id != course.id)):
            raise HTTPException(status_code=400, detail="Course with this name exists")
        course.slug = slug
    for field, value in data.items():
        setattr(course, field, value)
    db.commit()
    db.refresh(course)
    return course


@router.delete(
    "/{course_ref}",
    status_code=204,
    dependencies=[Depends(require_role("admin", "super_admin"))],
)
def delete_course(course_ref: str, db: Session = Depends(get_db)):
    course = _find_course(db, course_ref)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    db.delete(course)
    db.commit()
