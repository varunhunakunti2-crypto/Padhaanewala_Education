import re

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import (
    can_view_inactive,
    get_current_user,
    get_optional_current_user,
    require_role,
)
from app.models import (
    Admission,
    College,
    CollegeCourse,
    Course,
    Cutoff,
    District,
    NIRFRanking,
    OtherRanking,
    PlacementRecord,
    Review,
    SavedCollege,
    SeatMatrix,
    User,
)
from app.roles import ADMIN_ROLES, CONTENT_ROLES, SUPER_ADMIN_ROLES
from app.schemas.catalog import (
    AdmissionWindowResponse,
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

# Only roles that can edit catalog rows may see unpublished ones. This used to be
# a local `_can_view_inactive` here and an open-coded copy of the same predicate
# in `banners.py` and `faqs.py`; it is now one shared helper in
# `dependencies.can_view_inactive`.


def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")


def _admission_windows(
    db: Session, colleges: list[College]
) -> dict[int, list[AdmissionWindowResponse]]:
    """Every published application window for these colleges, in one query.

    Read in a batch rather than per row: `admissions` hangs off
    `college_courses`, so asking each college for its own windows is the N+1
    that the list endpoints used to be free of only because they sent no
    windows at all. A page of 100 rows must stay one extra query, not 101.
    """
    ids = [c.id for c in colleges]
    if not ids:
        return {}
    rows = db.execute(
        select(
            CollegeCourse.college_id,
            Admission.application_start_date,
            Admission.application_end_date,
            Admission.entrance_exam,
        )
        .join(Admission, Admission.college_course_id == CollegeCourse.id)
        .where(CollegeCourse.college_id.in_(ids))
        .order_by(Admission.id)
    ).all()
    windows: dict[int, list[AdmissionWindowResponse]] = {}
    for college_id, start, end, exam in rows:
        windows.setdefault(college_id, []).append(
            AdmissionWindowResponse(
                application_start_date=start,
                application_end_date=end,
                entrance_exam=exam,
            )
        )
    return windows


def _course_names(db: Session, colleges: list[College]) -> dict[int, list[str]]:
    """Distinct course names per college, in one query.

    The list endpoint omits the full `courses` rows to stay cheap, but course
    *names* are search input: `mapCollegeListItem` built `courses: []`, so the
    degree half of every college haystack was permanently empty. That is why
    `/colleges?q=B.Tech` — the link on every course card, and one of the
    `POPULAR_SEARCHES` pills — returned nothing.

    Names only, deduplicated: the frontend needs them to match against, and the
    fee/duration/specialisation that would justify the join are not on this
    projection. One query for the page, same as `_admission_windows`, because a
    page of 100 rows must not turn into 100 queries.
    """
    ids = [c.id for c in colleges]
    if not ids:
        return {}
    rows = db.execute(
        select(CollegeCourse.college_id, Course.name)
        .join(Course, Course.id == CollegeCourse.course_id)
        .where(CollegeCourse.college_id.in_(ids), CollegeCourse.is_active)
        .order_by(Course.name)
    ).all()
    names: dict[int, list[str]] = {}
    for college_id, name in rows:
        bucket = names.setdefault(college_id, [])
        # Ordered by name, so duplicates are adjacent; `!=` on the last element
        # is enough and avoids a set per college.
        if not bucket or bucket[-1] != name:
            bucket.append(name)
    return names


def _to_list_item(
    college: College,
    admissions: list[AdmissionWindowResponse] | None = None,
    course_names: list[str] | None = None,
) -> CollegeListItemResponse:
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
        admissions=admissions or [],
        course_names=course_names or [],
    )


@router.get("", response_model=list[CollegeListItemResponse])
def list_colleges(
    state_id: int | None = None,
    course_id: int | None = None,
    featured: bool | None = None,
    # The console lists colleges straight from this public route, and this route
    # filtered `College.is_active` unconditionally. So the moment an admin
    # deactivated a college it disappeared from the panel with no route back --
    # `is_active` is writable on update, which made deactivation a one-way door.
    # The flag is gated by `can_view_inactive`, so it cannot be used to read draft
    # colleges anonymously.
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

    query = select(College).options(
        selectinload(College.state), selectinload(College.university)
    )
    if not include_inactive:
        query = query.where(College.is_active)
    if state_id:
        query = query.where(College.state_id == state_id)
    if featured:
        query = query.where(College.is_featured)
    if course_id:
        query = query.join(CollegeCourse, CollegeCourse.college_id == College.id).distinct()
        # The join row has its own `is_active`. Leaving it filtered while the
        # college's own flag is lifted would show an admin a college that appears
        # to offer no courses whenever the *link* was deactivated rather than the
        # college -- so both lift together.
        if not include_inactive:
            query = query.where(CollegeCourse.is_active)
        query = query.where(CollegeCourse.course_id == course_id)

    colleges = (
        db.scalars(query.order_by(College.name).limit(limit).offset(offset)).all()
    )
    windows = _admission_windows(db, colleges)
    names = _course_names(db, colleges)
    return [_to_list_item(c, windows.get(c.id), names.get(c.id, [])) for c in colleges]



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
    windows = _admission_windows(db, colleges)

    course_query = select(Course).where(Course.is_active, Course.name.ilike(term))
    courses = db.scalars(course_query.limit(10)).all()

    return SearchResult(
        colleges=[
            _to_list_item(c, windows.get(c.id))
            for c in colleges
        ],
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
    if include_inactive and not can_view_inactive(user):
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
            # `college_courses` is deliberately absent: `_get_detail` queries the
            # active links itself, and eager-loading them here would mean
            # fetching every link twice.
        )
        .where(
            College.is_active,
            (College.id == int(college_ref) if college_ref.isdigit() else College.slug == college_ref),
        )
    )
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")

    return _get_detail(college, db)


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

    _refuse_if_detaching_would_collide(db, college)

    # The most destructive endpoint in the app. Record who did it and from
    # where, plus exactly what the delete does to dependent rows — because the
    # two outcomes are no longer the same and conflating them hides the
    # difference from whoever reads this log at 3am.
    #
    # `detached` rows survive with a NULL college_id (ON DELETE SET NULL, see
    # migration b4e8f2a71d09); they are recoverable by re-linking. `destroyed`
    # rows are genuinely gone, and that number is unrecoverable after the
    # commit. Only NOT NULL config children still cascade.
    detached = {
        "cutoffs": _count_for(db, Cutoff, college.id),
        "placements": _count_for(db, PlacementRecord, college.id),
        "nirf_rankings": _count_for(db, NIRFRanking, college.id),
        "other_rankings": _count_for(db, OtherRanking, college.id),
        "seat_matrix": _count_for(db, SeatMatrix, college.id),
    }
    destroyed = {
        "college_courses": _count_for(db, CollegeCourse, college.id),
        "reviews": _count_for(db, Review, college.id),
        "saved_colleges": _count_for(db, SavedCollege, college.id),
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
            "detached_rows": detached,
            "destroyed_rows": destroyed,
        },
    )
    db.delete(college)
    db.commit()


def _refuse_if_detaching_would_collide(db: Session, college: College) -> None:
    """Refuse a delete that would detach a cutoff onto an existing orphan.

    `uq_cutoff_identity_coalesce` collapses a NULL college_id to the sentinel
    0, so two cutoffs that were distinguished only by their college become
    indistinguishable once both are detached. If an unattributed cutoff with the
    same identity already exists, PostgreSQL raises UniqueViolation inside the
    delete and the request 500s — correct in direction (nothing is lost) but
    opaque to whoever clicked the button.

    Refusing up front with a 409 turns that into an actionable answer. The
    alternative of letting it through is not on the table: catching the error
    and retrying would mean inventing one of the two rows, which is a data
    decision this endpoint has no business making silently.
    """
    orphans = (
        select(
            func.coalesce(Cutoff.course_id, 0),
            func.coalesce(Cutoff.branch, ""),
            Cutoff.exam_name,
            Cutoff.year,
            func.coalesce(Cutoff.round, ""),
            func.coalesce(Cutoff.quota, ""),
            Cutoff.category,
        )
        .where(Cutoff.college_id.is_(None))
        .intersect(
            select(
                func.coalesce(Cutoff.course_id, 0),
                func.coalesce(Cutoff.branch, ""),
                Cutoff.exam_name,
                Cutoff.year,
                func.coalesce(Cutoff.round, ""),
                func.coalesce(Cutoff.quota, ""),
                Cutoff.category,
            ).where(Cutoff.college_id == college.id)
        )
    )
    if db.execute(orphans.limit(1)).first() is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                "Cannot delete this college: detaching its cutoffs would collide "
                "with cutoff rows that are already unattributed, because they "
                "are identical apart from the college. Resolve those duplicate "
                "cutoffs first."
            ),
        )


def _count_for(db: Session, model, college_id: int) -> int:
    """How many rows of `model` reference this college.

    Whether those rows are destroyed or merely detached depends on the FK's
    ON DELETE rule, so the caller decides which bucket to file the number in.
    """
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
    """The only place a `CollegeDetailResponse` is built.

    Four endpoints return one: GET, POST, PUT and (historically) a private
    helper. They used to be built in two places, and the two drifted: the read
    path assembled `courses` as unvalidated dicts while the write path used
    `CollegeCourseResponse`. Nothing tied the field lists together, so adding a
    field to the schema updated the write path and left the public GET returning
    the old shape — an admin shown "Saved" against a field the page never
    displays.

    Callers must therefore not build this response themselves. Note that this
    issues its own `CollegeCourse` query rather than reading the relationship,
    so callers should not also eager-load it.
    """
    base = _to_list_item(
        college, _admission_windows(db, [college]).get(college.id)
    )
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
