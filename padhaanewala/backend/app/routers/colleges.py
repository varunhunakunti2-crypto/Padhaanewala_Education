import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import require_role
from app.models import College, CollegeCourse, Course
from app.schemas.catalog import (
    CollegeCourseResponse,
    CollegeCreate,
    CollegeDetailResponse,
    CollegeListItemResponse,
    CollegeUpdate,
    CourseResponse,
    SearchResult,
)

router = APIRouter(prefix="/api/v1/colleges", tags=["colleges"])


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")


def _to_list_item(college: College) -> CollegeListItemResponse:
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


@router.get("", response_model=list[CollegeListItemResponse])
def list_colleges(
    state_id: int | None = None,
    course_id: int | None = None,
    featured: bool | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = (
        select(College)
        .options(selectinload(College.state), selectinload(College.university))
        .where(College.is_active)
    )
    if state_id:
        query = query.where(College.state_id == state_id)
    if featured:
        query = query.where(College.is_featured)
    if course_id:
        query = (
            query.join(CollegeCourse, CollegeCourse.college_id == College.id)
            .where(CollegeCourse.course_id == course_id, CollegeCourse.is_active)
            .distinct()
        )

    colleges = (
        db.scalars(query.order_by(College.name).limit(limit).offset(offset)).all()
    )
    return [_to_list_item(c) for c in colleges]


@router.get("/search", response_model=SearchResult)
def search(
    q: str,
    state_id: int | None = None,
    db: Session = Depends(get_db),
):
    term = f"%{q.strip()}%"

    college_query = (
        select(College)
        .options(selectinload(College.state), selectinload(College.university))
        .where(
            College.is_active,
            or_(
                College.name.ilike(term),
                College.city.ilike(term),
                College.college_type.ilike(term),
            ),
        )
    )
    if state_id:
        college_query = college_query.where(College.state_id == state_id)

    colleges = db.scalars(college_query.limit(20)).all()

    course_query = select(Course).where(Course.is_active, Course.name.ilike(term))
    courses = db.scalars(course_query.limit(10)).all()

    return SearchResult(
        colleges=[_to_list_item(c) for c in colleges],
        courses=[
            CourseResponse.model_validate(c, from_attributes=True) for c in courses
        ],
    )


@router.get("/{college_ref}/courses", response_model=list[CollegeCourseResponse])
def get_college_courses(college_ref: str, db: Session = Depends(get_db)):
    college = db.scalar(
        select(College).where(
            College.is_active,
            (
                College.id == int(college_ref)
                if college_ref.isdigit()
                else College.slug == college_ref
            ),
        )
    )
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")

    college_courses = db.scalars(
        select(CollegeCourse)
        .options(selectinload(CollegeCourse.course))
        .where(CollegeCourse.college_id == college.id, CollegeCourse.is_active)
    ).all()
    return [
        CollegeCourseResponse(
            id=cc.id,
            course_id=cc.course_id,
            course_name=cc.course.name if cc.course else None,
            annual_fee=cc.annual_fee,
            total_fee=cc.total_fee,
            intake_seats=cc.intake_seats,
            admission_mode=cc.admission_mode,
            entrance_exam=cc.entrance_exam,
        )
        for cc in college_courses
    ]


@router.get("/{college_ref}", response_model=CollegeDetailResponse)
def get_college(college_ref: str, db: Session = Depends(get_db)):
    college = db.scalar(
        select(College)
        .options(
            selectinload(College.state),
            selectinload(College.university),
            selectinload(College.college_courses).selectinload(CollegeCourse.course),
        )
        .where(
            College.is_active,
            (College.id == int(college_ref) if college_ref.isdigit() else College.slug == college_ref),
        )
    )
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")

    base = _to_list_item(college)
    courses = []
    for cc in college.college_courses:
        if cc.is_active:
            courses.append(
                {
                    "id": cc.id,
                    "course_id": cc.course_id,
                    "course_name": cc.course.name if cc.course else None,
                    "annual_fee": cc.annual_fee,
                    "total_fee": cc.total_fee,
                    "intake_seats": cc.intake_seats,
                    "admission_mode": cc.admission_mode,
                    "entrance_exam": cc.entrance_exam,
                }
            )

    return CollegeDetailResponse(
        **base.model_dump(),
        official_name=college.official_name,
        address=college.address,
        pincode=college.pincode,
        lat=college.lat,
        lng=college.lng,
        website=college.website,
        email=college.email,
        phone=college.phone,
        established_year=college.established_year,
        accreditation_naac=college.accreditation_naac,
        accreditation_nba=college.accreditation_nba,
        overview=college.overview,
        facilities=college.facilities,
        state_id=college.state_id,
        district_id=college.district_id,
        university_id=college.university_id,
        courses=courses,
    )


@router.post(
    "",
    response_model=CollegeDetailResponse,
    status_code=201,
    dependencies=[Depends(require_role("admin", "super_admin"))],
)
def create_college(payload: CollegeCreate, db: Session = Depends(get_db)):
    slug = _slugify(payload.name)
    if db.scalar(select(College).where(College.slug == slug)):
        raise HTTPException(status_code=400, detail="College with this name exists")

    next_id = (
        db.scalar(select(func.max(College.id))) or 0
    ) + 1
    college = College(
        college_id=f"COLLEGE{next_id:06d}",
        name=payload.name,
        official_name=payload.official_name,
        slug=slug,
        college_type=payload.college_type,
        ownership=payload.ownership,
        university_id=payload.university_id,
        state_id=payload.state_id,
        district_id=payload.district_id,
        city=payload.city,
        address=payload.address,
        pincode=payload.pincode,
        lat=payload.lat,
        lng=payload.lng,
        website=payload.website,
        email=payload.email,
        phone=payload.phone,
        established_year=payload.established_year,
        accreditation_naac=payload.accreditation_naac,
        overview=payload.overview,
        facilities=payload.facilities,
        has_hostel=payload.has_hostel,
        verification_status="unverified",
    )
    db.add(college)
    db.flush()

    for cc in payload.courses:
        db.add(
            CollegeCourse(
                college_id=college.id,
                course_id=cc.course_id,
                annual_fee=cc.annual_fee,
                total_fee=cc.total_fee,
                intake_seats=cc.intake_seats,
                admission_mode=cc.admission_mode,
                entrance_exam=cc.entrance_exam,
            )
        )

    db.commit()
    db.refresh(college)
    return _get_detail(college, db)


@router.put(
    "/{college_ref}",
    response_model=CollegeDetailResponse,
    dependencies=[Depends(require_role("admin", "super_admin"))],
)
def update_college(
    college_ref: str, payload: CollegeUpdate, db: Session = Depends(get_db)
):
    college = _find_college(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] != college.name:
        slug = _slugify(data["name"])
        if db.scalar(select(College).where(College.slug == slug, College.id != college.id)):
            raise HTTPException(status_code=400, detail="College with this name exists")
        college.slug = slug
    for field, value in data.items():
        setattr(college, field, value)
    db.commit()
    db.refresh(college)
    return _get_detail(college, db)


@router.delete(
    "/{college_ref}",
    status_code=204,
    dependencies=[Depends(require_role("super_admin"))],
)
def delete_college(college_ref: str, db: Session = Depends(get_db)):
    college = _find_college(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")
    db.delete(college)
    db.commit()


def _find_college(db: Session, ref: str) -> College | None:
    cond = (
        College.id == int(ref) if ref.isdigit() else College.slug == ref
    )
    return db.scalar(select(College).where(cond))


def _get_detail(college: College, db: Session) -> CollegeDetailResponse:
    base = _to_list_item(college)
    cc_rows = db.scalars(
        select(CollegeCourse)
        .options(selectinload(CollegeCourse.course))
        .where(CollegeCourse.college_id == college.id, CollegeCourse.is_active)
    ).all()
    return CollegeDetailResponse(
        **base.model_dump(),
        official_name=college.official_name,
        address=college.address,
        pincode=college.pincode,
        lat=college.lat,
        lng=college.lng,
        website=college.website,
        email=college.email,
        phone=college.phone,
        established_year=college.established_year,
        accreditation_naac=college.accreditation_naac,
        accreditation_nba=college.accreditation_nba,
        overview=college.overview,
        facilities=college.facilities,
        state_id=college.state_id,
        district_id=college.district_id,
        university_id=college.university_id,
        courses=[
            CollegeCourseResponse(
                id=cc.id,
                course_id=cc.course_id,
                course_name=cc.course.name if cc.course else None,
                annual_fee=cc.annual_fee,
                total_fee=cc.total_fee,
                intake_seats=cc.intake_seats,
                admission_mode=cc.admission_mode,
                entrance_exam=cc.entrance_exam,
            )
            for cc in cc_rows
        ],
    )