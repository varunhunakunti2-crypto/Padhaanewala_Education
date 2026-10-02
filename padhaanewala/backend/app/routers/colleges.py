import re

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user, get_optional_current_user, require_role
from app.models import (
    College,
    CollegeCourse,
    Course,
    Cutoff,
    District,
    NIRFRanking,
    OtherRanking,
    PlacementRecord,
    SeatMatrix,
    User,
)
from app.roles import ADMIN_ROLES, CONTENT_ROLES, SUPER_ADMIN_ROLES
from app.schemas.catalog import (
    CollegeCourseResponse,
    CollegeCreate,
    CollegeDetailResponse,
    CollegeListItemResponse,
    CollegeUpdate,
    CourseResponse,
    SearchResult,
)
from app.utils import audit

router = APIRouter(prefix="/api/v1/colleges", tags=["colleges"])


def _can_view_inactive(user: User | None) -> bool:
    """Only roles that can edit catalog rows may see unpublished ones."""
    if user is None:
        return False
    return bool(set(CONTENT_ROLES) & {role.name for role in user.roles})


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
    limit: int = Query(50, ge=1, le=100),
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
def get_college_courses(
    college_ref: str,
    course_id: int | None = None,
    q: str | None = None,
    # `include_inactive` used to be a plain public query param, so
    # `?include_inactive=true` exposed draft fees/intake to anonymous callers.
    # It is now only honoured for callers who could edit the row anyway.
    include_inactive: bool = False,
    user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    if include_inactive and not _can_view_inactive(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="include_inactive requires admin permissions",
        )

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

    conditions = [CollegeCourse.college_id == college.id]
    if not include_inactive:
        conditions.append(CollegeCourse.is_active.is_(True))
    if course_id is not None:
        conditions.append(CollegeCourse.course_id == course_id)

    query = (
        select(CollegeCourse)
        .options(selectinload(CollegeCourse.course))
        .where(*conditions)
    )
    if q is not None:
        term = f"%{q.strip()}%"
        query = (
            query.join(Course, Course.id == CollegeCourse.course_id)
            .where(Course.name.ilike(term))
            .distinct()
        )

    college_courses = db.scalars(query.order_by(CollegeCourse.id)).all()
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
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def create_college(
    payload: CollegeCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
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
        accreditation_nba=payload.accreditation_nba,
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

    # 4.4/4.5 — `delete_college` was audited and this was not, which is the
    # worst asymmetry available: the trail recorded who destroyed a record but
    # not who created or edited it, so "who added this college" was
    # unanswerable. The admin CRUD screen is what makes this reachable at all.
    #
    # Written after `flush` so `college.id` exists, and after the courses so the
    # row describes what was actually created. The whole payload is logged
    # rather than a hand-picked subset — an audit column that silently omits a
    # field is how BUG-11 happened, where `accreditation_nba` was saved by
    # nobody and reported by everybody.
    audit.record(
        db,
        request=request,
        action="create_college",
        entity_type="college",
        entity_id=college.id,
        actor=user,
        new_value=payload.model_dump(),
    )
    db.commit()
    db.refresh(college)
    return _get_detail(college, db)


@router.put(
    "/{college_ref}",
    response_model=CollegeDetailResponse,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def update_college(
    college_ref: str,
    payload: CollegeUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    college = _find_college(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")

    data = payload.model_dump(exclude_unset=True)

    # 4.4/4.5 — captured before the `setattr` loop, and narrowed to the keys the
    # caller actually sent. `exclude_unset` is what makes this correct: the
    # admin form prefills from the record, so a full dump would record every
    # untouched column as a change and make the trail unreadable. Only the
    # fields that differ are logged, so a reviewer sees the edit, not the form.
    before = {field: getattr(college, field) for field in data if hasattr(college, field)}
    changed = {
        field: {"from": before[field], "to": value}
        for field, value in data.items()
        if field in before and before[field] != value
    }

    if "name" in data and data["name"] != college.name:
        slug = _slugify(data["name"])
        if db.scalar(select(College).where(College.slug == slug, College.id != college.id)):
            raise HTTPException(status_code=400, detail="College with this name exists")
        college.slug = slug
    for field, value in data.items():
        setattr(college, field, value)
    if (
        "state_id" in data
        and data["state_id"] is not None
        and college.district_id is not None
        and "district_id" not in data
    ):
        district = db.get(District, college.district_id)
        if district is None or district.state_id != college.state_id:
            college.district_id = None

    # Written after the duplicate-name check above, so a refused update leaves no
    # row describing a change that never happened — the same shape as
    # `test_rejected_blog_update_does_not_leave_a_phantom_audit_row`.
    #
    # A no-op PUT (the form re-saved unchanged values) logs nothing. That is
    # deliberate: a trail padded with empty diffs trains a reviewer to skip it.
    if changed:
        audit.record(
            db,
            request=request,
            action="update_college",
            entity_type="college",
            entity_id=college.id,
            actor=user,
            old_value={field: pair["from"] for field, pair in changed.items()},
            new_value={field: pair["to"] for field, pair in changed.items()},
        )
    db.commit()
    db.refresh(college)
    return _get_detail(college, db)


@router.delete(
    "/{college_ref}",
    status_code=204,
)
def delete_college(
    college_ref: str,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*SUPER_ADMIN_ROLES)),
):
    college = _find_college(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")

    # 4.4/4.5 — the most destructive endpoint in the app. Record who did it,
    # from where, and exactly how many dependent rows the cascade is about to
    # destroy — after the commit that number is unrecoverable.
    cascading = {
        "cutoffs": _count_for(db, Cutoff, college.id),
        "placements": _count_for(db, PlacementRecord, college.id),
        "nirf_rankings": _count_for(db, NIRFRanking, college.id),
        "other_rankings": _count_for(db, OtherRanking, college.id),
        "seat_matrix": _count_for(db, SeatMatrix, college.id),
        "college_courses": _count_for(db, CollegeCourse, college.id),
    }
    audit.record(
        db,
        request=request,
        action="delete_college",
        entity_type="college",
        entity_id=college.id,
        actor=user,
        old_value={
            "slug": college.slug,
            "name": college.name,
            "cascading_rows": cascading,
        },
    )
    db.delete(college)
    db.commit()


def _count_for(db: Session, model, college_id: int) -> int:
    """How many rows of `model` reference this college and would cascade away."""
    return (
        db.scalar(
            select(func.count())
            .select_from(model)
            .where(model.college_id == college_id)
        )
        or 0
    )


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
