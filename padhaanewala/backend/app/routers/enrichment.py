from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import require_role
from app.models import (
    Admission,
    College,
    CollegeCourse,
    Course,
    Cutoff,
    Fee,
    NIRFRanking,
    OtherRanking,
    PlacementRecord,
    SeatMatrix,
)
from app.schemas.enrichment import (
    AdmissionCreate,
    AdmissionResponse,
    AdmissionUpdate,
    CutoffCreate,
    CutoffResponse,
    CutoffUpdate,
    FeeCreate,
    FeeResponse,
    FeeUpdate,
    NIRFRankingCreate,
    NIRFRankingResponse,
    NIRFRankingUpdate,
    OtherRankingCreate,
    OtherRankingResponse,
    OtherRankingUpdate,
    PlacementCreate,
    PlacementResponse,
    PlacementUpdate,
    RankingResponse,
    SeatMatrixCreate,
    SeatMatrixResponse,
    SeatMatrixUpdate,
)

router = APIRouter(prefix="/api/v1/colleges", tags=["college-enrichment"])
catalog_router = APIRouter(prefix="/api/v1", tags=["catalog-data"])

ADMIN_ROLES = ("admin", "super_admin", "content_manager")


def _find_college_by_ref(db: Session, ref: str) -> College | None:
    cond = College.id == int(ref) if ref.isdigit() else College.slug == ref
    return db.scalar(select(College).where(cond))


def _get_active_college(db: Session, ref: str) -> College:
    college = _find_college_by_ref(db, ref)
    if college is None or not college.is_active:
        raise HTTPException(status_code=404, detail="College not found")
    return college


def _match_none(col, value):
    return col.is_(None) if value is None else col == value


def _course_name(db: Session, course_id: int | None) -> str | None:
    if course_id is None:
        return None
    return db.scalar(select(Course.name).where(Course.id == course_id))


# ---------------------------------------------------------------- Cutoffs ----


def _to_cutoff(db: Session, cutoff: Cutoff) -> CutoffResponse:
    college_name = cutoff.college.name if cutoff.college else None
    return CutoffResponse(
        id=cutoff.id,
        college_id=cutoff.college_id,
        college_name=college_name,
        course_id=cutoff.course_id,
        course_name=_course_name(db, cutoff.course_id),
        branch=cutoff.branch,
        exam_name=cutoff.exam_name,
        year=cutoff.year,
        round=cutoff.round,
        quota=cutoff.quota,
        category=cutoff.category,
        opening_rank=cutoff.opening_rank,
        closing_rank=cutoff.closing_rank,
        opening_score=cutoff.opening_score,
        closing_score=cutoff.closing_score,
        source=cutoff.source,
        source_url=cutoff.source_url,
        verified_date=cutoff.verified_date,
    )


def _find_cutoff(db: Session, college: College, cutoff_id: int) -> Cutoff:
    cutoff = db.scalar(
        select(Cutoff)
        .options(selectinload(Cutoff.college))
        .where(Cutoff.id == cutoff_id, Cutoff.college_id == college.id)
    )
    if cutoff is None:
        raise HTTPException(status_code=404, detail="Cutoff not found")
    return cutoff


@router.get("/{college_ref}/cutoffs", response_model=list[CutoffResponse])
def list_cutoffs(
    college_ref: str,
    course_id: int | None = None,
    exam_name: str | None = None,
    year: int | None = None,
    db: Session = Depends(get_db),
):
    college = _get_active_college(db, college_ref)
    conditions = [Cutoff.college_id == college.id]
    if course_id is not None:
        conditions.append(Cutoff.course_id == course_id)
    if exam_name is not None:
        conditions.append(Cutoff.exam_name == exam_name)
    if year is not None:
        conditions.append(Cutoff.year == year)
    cutoffs = db.scalars(
        select(Cutoff)
        .options(selectinload(Cutoff.college))
        .where(*conditions)
        .order_by(Cutoff.year.desc(), Cutoff.exam_name, Cutoff.category)
    ).all()
    return [_to_cutoff(db, c) for c in cutoffs]


@router.post(
    "/{college_ref}/cutoffs",
    response_model=CutoffResponse,
    status_code=201,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def create_cutoff(
    college_ref: str, payload: CutoffCreate, db: Session = Depends(get_db)
):
    college = _find_college_by_ref(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")

    duplicate = db.scalar(
        select(Cutoff).where(
            Cutoff.college_id == college.id,
            _match_none(Cutoff.course_id, payload.course_id),
            _match_none(Cutoff.branch, payload.branch),
            Cutoff.exam_name == payload.exam_name,
            Cutoff.year == payload.year,
            _match_none(Cutoff.round, payload.round),
            _match_none(Cutoff.quota, payload.quota),
            Cutoff.category == payload.category,
        )
    )
    if duplicate is not None:
        raise HTTPException(status_code=400, detail="Cutoff already exists")

    cutoff = Cutoff(**payload.model_dump(), college_id=college.id)
    db.add(cutoff)
    db.commit()
    db.refresh(cutoff)
    return _to_cutoff(db, cutoff)


@router.put(
    "/{college_ref}/cutoffs/{cutoff_id}",
    response_model=CutoffResponse,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def update_cutoff(
    college_ref: str,
    cutoff_id: int,
    payload: CutoffUpdate,
    db: Session = Depends(get_db),
):
    college = _find_college_by_ref(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")
    cutoff = _find_cutoff(db, college, cutoff_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(cutoff, field, value)
    db.commit()
    db.refresh(cutoff)
    return _to_cutoff(db, cutoff)


@router.delete(
    "/{college_ref}/cutoffs/{cutoff_id}",
    status_code=204,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def delete_cutoff(
    college_ref: str, cutoff_id: int, db: Session = Depends(get_db)
):
    college = _find_college_by_ref(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")
    cutoff = _find_cutoff(db, college, cutoff_id)
    db.delete(cutoff)
    db.commit()


# -------------------------------------------------------------------- Fees ----


def _to_fee(db: Session, fee: Fee) -> FeeResponse:
    course_name = db.execute(
        select(Course.name)
        .join(CollegeCourse, CollegeCourse.course_id == Course.id)
        .where(CollegeCourse.id == fee.college_course_id)
    ).scalar_one_or_none()
    return FeeResponse(
        id=fee.id,
        college_course_id=fee.college_course_id,
        course_name=course_name,
        tuition_fee=fee.tuition_fee,
        hostel_fee=fee.hostel_fee,
        examination_fee=fee.examination_fee,
        other_charges=fee.other_charges,
        total_approximate=fee.total_approximate,
        fee_period=fee.fee_period,
        academic_year=fee.academic_year,
        is_approximate=fee.is_approximate,
    )


def _college_course_ids(db: Session, college: College) -> list[int]:
    return list(
        db.scalars(
            select(CollegeCourse.id).where(CollegeCourse.college_id == college.id)
        ).all()
    )


def _verify_college_course(db: Session, college: College, college_course_id: int) -> None:
    cc = db.scalar(
        select(CollegeCourse).where(
            CollegeCourse.id == college_course_id,
            CollegeCourse.college_id == college.id,
        )
    )
    if cc is None:
        raise HTTPException(
            status_code=400,
            detail="college_course_id does not belong to this college",
        )


def _find_fee(db: Session, college: College, fee_id: int) -> Fee:
    fee = db.scalar(
        select(Fee).where(
            Fee.id == fee_id,
            Fee.college_course_id.in_(_college_course_ids(db, college)),
        )
    )
    if fee is None:
        raise HTTPException(status_code=404, detail="Fee not found")
    return fee


@router.get("/{college_ref}/fees", response_model=list[FeeResponse])
def list_fees(
    college_ref: str,
    academic_year: str | None = None,
    db: Session = Depends(get_db),
):
    college = _get_active_college(db, college_ref)
    ids = _college_course_ids(db, college)
    if not ids:
        return []
    conditions = [Fee.college_course_id.in_(ids)]
    if academic_year is not None:
        conditions.append(Fee.academic_year == academic_year)
    fees = db.scalars(
        select(Fee).where(*conditions).order_by(Fee.academic_year.desc())
    ).all()
    return [_to_fee(db, f) for f in fees]


@router.post(
    "/{college_ref}/fees",
    response_model=FeeResponse,
    status_code=201,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def create_fee(
    college_ref: str, payload: FeeCreate, db: Session = Depends(get_db)
):
    college = _find_college_by_ref(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")
    _verify_college_course(db, college, payload.college_course_id)

    duplicate = db.scalar(
        select(Fee).where(
            Fee.college_course_id == payload.college_course_id,
            Fee.academic_year == payload.academic_year,
        )
    )
    if duplicate is not None:
        raise HTTPException(
            status_code=400,
            detail="Fee already exists for this course and academic year",
        )

    fee = Fee(**payload.model_dump())
    db.add(fee)
    db.commit()
    db.refresh(fee)
    return _to_fee(db, fee)


@router.put(
    "/{college_ref}/fees/{fee_id}",
    response_model=FeeResponse,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def update_fee(
    college_ref: str,
    fee_id: int,
    payload: FeeUpdate,
    db: Session = Depends(get_db),
):
    college = _find_college_by_ref(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")
    fee = _find_fee(db, college, fee_id)
    data = payload.model_dump(exclude_unset=True)
    if "college_course_id" in data:
        _verify_college_course(db, college, data["college_course_id"])
    for field, value in data.items():
        setattr(fee, field, value)
    db.commit()
    db.refresh(fee)
    return _to_fee(db, fee)


@router.delete(
    "/{college_ref}/fees/{fee_id}",
    status_code=204,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def delete_fee(college_ref: str, fee_id: int, db: Session = Depends(get_db)):
    college = _find_college_by_ref(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")
    fee = _find_fee(db, college, fee_id)
    db.delete(fee)
    db.commit()


# ------------------------------------------------------------- Placements ----


def _to_placement(db: Session, placement: PlacementRecord) -> PlacementResponse:
    return PlacementResponse(
        id=placement.id,
        college_id=placement.college_id,
        college_name=placement.college.name if placement.college else None,
        course_id=placement.course_id,
        course_name=_course_name(db, placement.course_id),
        branch=placement.branch,
        academic_year=placement.academic_year,
        total_graduating=placement.total_graduating,
        total_placed=placement.total_placed,
        placement_percentage=placement.placement_percentage,
        students_higher_studies=placement.students_higher_studies,
        median_salary_lpa=placement.median_salary_lpa,
        average_salary_lpa=placement.average_salary_lpa,
        highest_salary_lpa=placement.highest_salary_lpa,
        lowest_salary_lpa=placement.lowest_salary_lpa,
        total_recruiters=placement.total_recruiters,
        top_recruiters=placement.top_recruiters,
        source=placement.source,
        source_url=placement.source_url,
        verified_date=placement.verified_date,
    )


def _find_placement(db: Session, college: College, placement_id: int) -> PlacementRecord:
    placement = db.scalar(
        select(PlacementRecord)
        .options(selectinload(PlacementRecord.college))
        .where(
            PlacementRecord.id == placement_id,
            PlacementRecord.college_id == college.id,
        )
    )
    if placement is None:
        raise HTTPException(status_code=404, detail="Placement record not found")
    return placement


@router.get("/{college_ref}/placements", response_model=list[PlacementResponse])
def list_placements(
    college_ref: str,
    course_id: int | None = None,
    academic_year: str | None = None,
    db: Session = Depends(get_db),
):
    college = _get_active_college(db, college_ref)
    conditions = [PlacementRecord.college_id == college.id]
    if course_id is not None:
        conditions.append(PlacementRecord.course_id == course_id)
    if academic_year is not None:
        conditions.append(PlacementRecord.academic_year == academic_year)
    placements = db.scalars(
        select(PlacementRecord)
        .options(selectinload(PlacementRecord.college))
        .where(*conditions)
        .order_by(PlacementRecord.academic_year.desc())
    ).all()
    return [_to_placement(db, p) for p in placements]


@router.post(
    "/{college_ref}/placements",
    response_model=PlacementResponse,
    status_code=201,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def create_placement(
    college_ref: str, payload: PlacementCreate, db: Session = Depends(get_db)
):
    college = _find_college_by_ref(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")
    placement = PlacementRecord(**payload.model_dump(), college_id=college.id)
    db.add(placement)
    db.commit()
    db.refresh(placement)
    return _to_placement(db, placement)


@router.put(
    "/{college_ref}/placements/{placement_id}",
    response_model=PlacementResponse,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def update_placement(
    college_ref: str,
    placement_id: int,
    payload: PlacementUpdate,
    db: Session = Depends(get_db),
):
    college = _find_college_by_ref(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")
    placement = _find_placement(db, college, placement_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(placement, field, value)
    db.commit()
    db.refresh(placement)
    return _to_placement(db, placement)


@router.delete(
    "/{college_ref}/placements/{placement_id}",
    status_code=204,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def delete_placement(
    college_ref: str, placement_id: int, db: Session = Depends(get_db)
):
    college = _find_college_by_ref(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")
    placement = _find_placement(db, college, placement_id)
    db.delete(placement)
    db.commit()


# --------------------------------------------------------------- Rankings ----


def _to_ranking(
    ranking_type: str,
    college: College | None,
    item,
) -> RankingResponse:
    return RankingResponse(
        id=item.id,
        ranking_type=ranking_type,
        college_id=college.id if college else item.college_id,
        college_name=college.name if college else None,
        ranking_body=getattr(item, "ranking_body", None),
        category=item.category,
        year=item.year,
        rank=item.rank,
        score=getattr(item, "score", None),
        rank_change=getattr(item, "rank_change", None),
        state_rank=getattr(item, "state_rank", None),
    )


def _to_nirf(db: Session, ranking: NIRFRanking) -> NIRFRankingResponse:
    return NIRFRankingResponse(
        id=ranking.id,
        college_id=ranking.college_id,
        college_name=ranking.college.name if ranking.college else None,
        category=ranking.category,
        year=ranking.year,
        rank=ranking.rank,
        score=ranking.score,
        rank_change=ranking.rank_change,
        state_rank=ranking.state_rank,
    )


def _to_other(db: Session, ranking: OtherRanking) -> OtherRankingResponse:
    return OtherRankingResponse(
        id=ranking.id,
        college_id=ranking.college_id,
        college_name=ranking.college.name if ranking.college else None,
        ranking_body=ranking.ranking_body,
        category=ranking.category,
        year=ranking.year,
        rank=ranking.rank,
    )


def _find_nirf(db: Session, college: College, rank_id: int) -> NIRFRanking:
    ranking = db.scalar(
        select(NIRFRanking)
        .options(selectinload(NIRFRanking.college))
        .where(NIRFRanking.id == rank_id, NIRFRanking.college_id == college.id)
    )
    if ranking is None:
        raise HTTPException(status_code=404, detail="NIRF ranking not found")
    return ranking


def _find_other(db: Session, college: College, rank_id: int) -> OtherRanking:
    ranking = db.scalar(
        select(OtherRanking)
        .options(selectinload(OtherRanking.college))
        .where(OtherRanking.id == rank_id, OtherRanking.college_id == college.id)
    )
    if ranking is None:
        raise HTTPException(status_code=404, detail="Ranking not found")
    return ranking


@router.get("/{college_ref}/rankings", response_model=list[RankingResponse])
def list_rankings(
    college_ref: str,
    ranking_type: str | None = Query(
        default=None, pattern="^(nirf|other)$", description="nirf or other"
    ),
    category: str | None = None,
    year: int | None = None,
    db: Session = Depends(get_db),
):
    college = _get_active_college(db, college_ref)
    rows = []
    if ranking_type in (None, "nirf"):
        conditions = [NIRFRanking.college_id == college.id]
        if category is not None:
            conditions.append(NIRFRanking.category == category)
        if year is not None:
            conditions.append(NIRFRanking.year == year)
        nirf = db.scalars(
            select(NIRFRanking)
            .where(*conditions)
            .order_by(NIRFRanking.year.desc())
        ).all()
        rows += [_to_ranking("nirf", college, r) for r in nirf]
    if ranking_type in (None, "other"):
        conditions = [OtherRanking.college_id == college.id]
        if category is not None:
            conditions.append(OtherRanking.category == category)
        if year is not None:
            conditions.append(OtherRanking.year == year)
        other = db.scalars(
            select(OtherRanking)
            .where(*conditions)
            .order_by(OtherRanking.year.desc())
        ).all()
        rows += [_to_ranking("other", college, r) for r in other]
    return rows


@router.post(
    "/{college_ref}/rankings/nirf",
    response_model=NIRFRankingResponse,
    status_code=201,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def create_nirf_ranking(
    college_ref: str, payload: NIRFRankingCreate, db: Session = Depends(get_db)
):
    college = _find_college_by_ref(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")
    duplicate = db.scalar(
        select(NIRFRanking).where(
            NIRFRanking.college_id == college.id,
            NIRFRanking.category == payload.category,
            NIRFRanking.year == payload.year,
        )
    )
    if duplicate is not None:
        raise HTTPException(
            status_code=400,
            detail="NIRF ranking already exists for this category and year",
        )
    ranking = NIRFRanking(**payload.model_dump(), college_id=college.id)
    db.add(ranking)
    db.commit()
    db.refresh(ranking)
    return _to_nirf(db, ranking)


@router.put(
    "/{college_ref}/rankings/nirf/{rank_id}",
    response_model=NIRFRankingResponse,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def update_nirf_ranking(
    college_ref: str,
    rank_id: int,
    payload: NIRFRankingUpdate,
    db: Session = Depends(get_db),
):
    college = _find_college_by_ref(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")
    ranking = _find_nirf(db, college, rank_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(ranking, field, value)
    db.commit()
    db.refresh(ranking)
    return _to_nirf(db, ranking)


@router.delete(
    "/{college_ref}/rankings/nirf/{rank_id}",
    status_code=204,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def delete_nirf_ranking(
    college_ref: str, rank_id: int, db: Session = Depends(get_db)
):
    college = _find_college_by_ref(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")
    ranking = _find_nirf(db, college, rank_id)
    db.delete(ranking)
    db.commit()


@router.post(
    "/{college_ref}/rankings/other",
    response_model=OtherRankingResponse,
    status_code=201,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def create_other_ranking(
    college_ref: str, payload: OtherRankingCreate, db: Session = Depends(get_db)
):
    college = _find_college_by_ref(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")
    ranking = OtherRanking(**payload.model_dump(), college_id=college.id)
    db.add(ranking)
    db.commit()
    db.refresh(ranking)
    return _to_other(db, ranking)


@router.put(
    "/{college_ref}/rankings/other/{rank_id}",
    response_model=OtherRankingResponse,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def update_other_ranking(
    college_ref: str,
    rank_id: int,
    payload: OtherRankingUpdate,
    db: Session = Depends(get_db),
):
    college = _find_college_by_ref(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")
    ranking = _find_other(db, college, rank_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(ranking, field, value)
    db.commit()
    db.refresh(ranking)
    return _to_other(db, ranking)


@router.delete(
    "/{college_ref}/rankings/other/{rank_id}",
    status_code=204,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def delete_other_ranking(
    college_ref: str, rank_id: int, db: Session = Depends(get_db)
):
    college = _find_college_by_ref(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")
    ranking = _find_other(db, college, rank_id)
    db.delete(ranking)
    db.commit()


# ------------------------------------------------------------ Seat matrix ----


def _to_seat_matrix(db: Session, seat: SeatMatrix) -> SeatMatrixResponse:
    return SeatMatrixResponse(
        id=seat.id,
        college_id=seat.college_id,
        college_name=seat.college.name if seat.college else None,
        course_id=seat.course_id,
        course_name=_course_name(db, seat.course_id),
        branch=seat.branch,
        exam=seat.exam,
        total_seats=seat.total_seats,
        general_seats=seat.general_seats,
        obc_seats=seat.obc_seats,
        sc_seats=seat.sc_seats,
        st_seats=seat.st_seats,
        ews_seats=seat.ews_seats,
        pwd_seats=seat.pwd_seats,
        female_supernumerary=seat.female_supernumerary,
        home_state_quota=seat.home_state_quota,
        all_india_quota=seat.all_india_quota,
        management_quota=seat.management_quota,
        year=seat.year,
        source=seat.source,
    )


def _find_seat_matrix(db: Session, college: College, seat_id: int) -> SeatMatrix:
    seat = db.scalar(
        select(SeatMatrix)
        .options(selectinload(SeatMatrix.college))
        .where(SeatMatrix.id == seat_id, SeatMatrix.college_id == college.id)
    )
    if seat is None:
        raise HTTPException(status_code=404, detail="Seat matrix not found")
    return seat


@router.get("/{college_ref}/seat-matrix", response_model=list[SeatMatrixResponse])
def list_seat_matrix(
    college_ref: str,
    course_id: int | None = None,
    exam: str | None = None,
    year: int | None = None,
    db: Session = Depends(get_db),
):
    college = _get_active_college(db, college_ref)
    conditions = [SeatMatrix.college_id == college.id]
    if course_id is not None:
        conditions.append(SeatMatrix.course_id == course_id)
    if exam is not None:
        conditions.append(SeatMatrix.exam == exam)
    if year is not None:
        conditions.append(SeatMatrix.year == year)
    seats = db.scalars(
        select(SeatMatrix)
        .options(selectinload(SeatMatrix.college))
        .where(*conditions)
        .order_by(SeatMatrix.year.desc())
    ).all()
    return [_to_seat_matrix(db, s) for s in seats]


@router.post(
    "/{college_ref}/seat-matrix",
    response_model=SeatMatrixResponse,
    status_code=201,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def create_seat_matrix(
    college_ref: str, payload: SeatMatrixCreate, db: Session = Depends(get_db)
):
    college = _find_college_by_ref(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")
    seat = SeatMatrix(**payload.model_dump(), college_id=college.id)
    db.add(seat)
    db.commit()
    db.refresh(seat)
    return _to_seat_matrix(db, seat)


@router.put(
    "/{college_ref}/seat-matrix/{seat_id}",
    response_model=SeatMatrixResponse,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def update_seat_matrix(
    college_ref: str,
    seat_id: int,
    payload: SeatMatrixUpdate,
    db: Session = Depends(get_db),
):
    college = _find_college_by_ref(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")
    seat = _find_seat_matrix(db, college, seat_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(seat, field, value)
    db.commit()
    db.refresh(seat)
    return _to_seat_matrix(db, seat)


@router.delete(
    "/{college_ref}/seat-matrix/{seat_id}",
    status_code=204,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def delete_seat_matrix(
    college_ref: str, seat_id: int, db: Session = Depends(get_db)
):
    college = _find_college_by_ref(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")
    seat = _find_seat_matrix(db, college, seat_id)
    db.delete(seat)
    db.commit()


# ------------------------------------------------------------ Admissions ----


def _course_name_via_college_course(
    db: Session, college_course_id: int | None
) -> str | None:
    if college_course_id is None:
        return None
    return db.execute(
        select(Course.name)
        .join(CollegeCourse, CollegeCourse.course_id == Course.id)
        .where(CollegeCourse.id == college_course_id)
    ).scalar_one_or_none()


def _to_admission(db: Session, admission: Admission) -> AdmissionResponse:
    return AdmissionResponse(
        id=admission.id,
        college_course_id=admission.college_course_id,
        course_name=_course_name_via_college_course(
            db, admission.college_course_id
        ),
        admission_information=admission.admission_information,
        eligibility_details=admission.eligibility_details,
        entrance_exam=admission.entrance_exam,
        application_start_date=admission.application_start_date,
        application_end_date=admission.application_end_date,
    )


def _find_admission(
    db: Session, college: College, admission_id: int
) -> Admission:
    admission = db.scalar(
        select(Admission).where(
            Admission.id == admission_id,
            Admission.college_course_id.in_(_college_course_ids(db, college)),
        )
    )
    if admission is None:
        raise HTTPException(status_code=404, detail="Admission info not found")
    return admission


@router.get("/{college_ref}/admissions", response_model=list[AdmissionResponse])
def list_admissions(
    college_ref: str,
    college_course_id: int | None = None,
    db: Session = Depends(get_db),
):
    college = _get_active_college(db, college_ref)
    ids = _college_course_ids(db, college)
    if not ids:
        return []
    conditions = [Admission.college_course_id.in_(ids)]
    if college_course_id is not None:
        conditions.append(Admission.college_course_id == college_course_id)
    admissions = db.scalars(
        select(Admission).where(*conditions).order_by(Admission.id)
    ).all()
    return [_to_admission(db, a) for a in admissions]


@router.post(
    "/{college_ref}/admissions",
    response_model=AdmissionResponse,
    status_code=201,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def create_admission(
    college_ref: str, payload: AdmissionCreate, db: Session = Depends(get_db)
):
    college = _find_college_by_ref(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")
    _verify_college_course(db, college, payload.college_course_id)
    admission = Admission(**payload.model_dump())
    db.add(admission)
    db.commit()
    db.refresh(admission)
    return _to_admission(db, admission)


@router.put(
    "/{college_ref}/admissions/{admission_id}",
    response_model=AdmissionResponse,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def update_admission(
    college_ref: str,
    admission_id: int,
    payload: AdmissionUpdate,
    db: Session = Depends(get_db),
):
    college = _find_college_by_ref(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")
    admission = _find_admission(db, college, admission_id)
    data = payload.model_dump(exclude_unset=True)
    if "college_course_id" in data:
        _verify_college_course(db, college, data["college_course_id"])
    for field, value in data.items():
        setattr(admission, field, value)
    db.commit()
    db.refresh(admission)
    return _to_admission(db, admission)


@router.delete(
    "/{college_ref}/admissions/{admission_id}",
    status_code=204,
    dependencies=[Depends(require_role(*ADMIN_ROLES))],
)
def delete_admission(
    college_ref: str, admission_id: int, db: Session = Depends(get_db)
):
    college = _find_college_by_ref(db, college_ref)
    if college is None:
        raise HTTPException(status_code=404, detail="College not found")
    admission = _find_admission(db, college, admission_id)
    db.delete(admission)
    db.commit()


# --------------------------------------------------- Global collection reads ----
# Public read-only endpoints so the predictor and frontend can query enrichment
# data by course/year without a college path prefix.


def _paginated(
    query, db: Session, limit: int | None, offset: int | None
) -> list:
    q = query.order_by(None)
    if limit is not None:
        q = q.limit(limit)
    if offset is not None:
        q = q.offset(offset)
    return db.scalars(q).all()


def _join_active_college_courses(db: Session):
    return (
        select(CollegeCourse.id)
        .join(College, College.id == CollegeCourse.college_id)
        .where(College.is_active.is_(True))
    )


@catalog_router.get("/cutoffs", response_model=list[CutoffResponse])
def catalog_cutoffs(
    college_id: int | None = None,
    course_id: int | None = None,
    exam_name: str | None = None,
    year: int | None = None,
    category: str | None = None,
    limit: int | None = Query(default=None, ge=1, le=500),
    offset: int | None = Query(default=None, ge=0),
    db: Session = Depends(get_db),
):
    conditions = []
    if college_id is not None:
        conditions.append(Cutoff.college_id == college_id)
    if course_id is not None:
        conditions.append(Cutoff.course_id == course_id)
    if exam_name is not None:
        conditions.append(Cutoff.exam_name == exam_name)
    if year is not None:
        conditions.append(Cutoff.year == year)
    if category is not None:
        conditions.append(Cutoff.category == category)
    cutoffs = _paginated(
        select(Cutoff)
        .options(selectinload(Cutoff.college))
        .where(*conditions)
        .order_by(Cutoff.year.desc(), Cutoff.exam_name, Cutoff.category),
        db,
        limit,
        offset,
    )
    return [_to_cutoff(db, c) for c in cutoffs]


@catalog_router.get("/fees", response_model=list[FeeResponse])
def catalog_fees(
    college_id: int | None = None,
    course_id: int | None = None,
    academic_year: str | None = None,
    limit: int | None = Query(default=None, ge=1, le=500),
    offset: int | None = Query(default=None, ge=0),
    db: Session = Depends(get_db),
):
    conditions = []
    if course_id is not None or college_id is not None:
        cc = _join_active_college_courses(db)
        if course_id is not None:
            cc = cc.where(CollegeCourse.course_id == course_id)
        if college_id is not None:
            cc = cc.where(CollegeCourse.college_id == college_id)
        ids = db.scalars(cc).all()
        if not ids:
            return []
        conditions.append(Fee.college_course_id.in_(ids))
    if academic_year is not None:
        conditions.append(Fee.academic_year == academic_year)
    fees = _paginated(
        select(Fee).where(*conditions).order_by(Fee.academic_year.desc()),
        db,
        limit,
        offset,
    )
    return [_to_fee(db, f) for f in fees]


@catalog_router.get("/placements", response_model=list[PlacementResponse])
def catalog_placements(
    college_id: int | None = None,
    course_id: int | None = None,
    academic_year: str | None = None,
    limit: int | None = Query(default=None, ge=1, le=500),
    offset: int | None = Query(default=None, ge=0),
    db: Session = Depends(get_db),
):
    conditions = []
    if college_id is not None:
        conditions.append(PlacementRecord.college_id == college_id)
    if course_id is not None:
        conditions.append(PlacementRecord.course_id == course_id)
    if academic_year is not None:
        conditions.append(PlacementRecord.academic_year == academic_year)
    placements = _paginated(
        select(PlacementRecord)
        .options(selectinload(PlacementRecord.college))
        .where(*conditions)
        .order_by(PlacementRecord.academic_year.desc()),
        db,
        limit,
        offset,
    )
    return [_to_placement(db, p) for p in placements]


@catalog_router.get("/rankings", response_model=list[RankingResponse])
def catalog_rankings(
    college_id: int | None = None,
    ranking_type: str | None = Query(
        default=None, pattern="^(nirf|other)$", description="nirf or other"
    ),
    category: str | None = None,
    year: int | None = None,
    limit: int | None = Query(default=None, ge=1, le=500),
    offset: int | None = Query(default=None, ge=0),
    db: Session = Depends(get_db),
):
    rows = []
    if ranking_type in (None, "nirf"):
        conditions = []
        if college_id is not None:
            conditions.append(NIRFRanking.college_id == college_id)
        if category is not None:
            conditions.append(NIRFRanking.category == category)
        if year is not None:
            conditions.append(NIRFRanking.year == year)
        nirf = _paginated(
            select(NIRFRanking)
            .options(selectinload(NIRFRanking.college))
            .where(*conditions)
            .order_by(NIRFRanking.year.desc()),
            db,
            limit,
            offset,
        )
        for r in nirf:
            college = r.college
            rows.append(_to_ranking("nirf", college, r))
    if ranking_type in (None, "other"):
        conditions = []
        if college_id is not None:
            conditions.append(OtherRanking.college_id == college_id)
        if category is not None:
            conditions.append(OtherRanking.category == category)
        if year is not None:
            conditions.append(OtherRanking.year == year)
        other = _paginated(
            select(OtherRanking)
            .options(selectinload(OtherRanking.college))
            .where(*conditions)
            .order_by(OtherRanking.year.desc()),
            db,
            limit,
            offset,
        )
        for r in other:
            college = r.college
            rows.append(_to_ranking("other", college, r))
    return rows


@catalog_router.get("/seat-matrix", response_model=list[SeatMatrixResponse])
def catalog_seat_matrix(
    college_id: int | None = None,
    course_id: int | None = None,
    exam: str | None = None,
    year: int | None = None,
    limit: int | None = Query(default=None, ge=1, le=500),
    offset: int | None = Query(default=None, ge=0),
    db: Session = Depends(get_db),
):
    conditions = []
    if college_id is not None:
        conditions.append(SeatMatrix.college_id == college_id)
    if course_id is not None:
        conditions.append(SeatMatrix.course_id == course_id)
    if exam is not None:
        conditions.append(SeatMatrix.exam == exam)
    if year is not None:
        conditions.append(SeatMatrix.year == year)
    seats = _paginated(
        select(SeatMatrix)
        .options(selectinload(SeatMatrix.college))
        .where(*conditions)
        .order_by(SeatMatrix.year.desc()),
        db,
        limit,
        offset,
    )
    return [_to_seat_matrix(db, s) for s in seats]


@catalog_router.get("/admissions", response_model=list[AdmissionResponse])
def catalog_admissions(
    college_id: int | None = None,
    course_id: int | None = None,
    limit: int | None = Query(default=None, ge=1, le=500),
    offset: int | None = Query(default=None, ge=0),
    db: Session = Depends(get_db),
):
    conditions = []
    if course_id is not None or college_id is not None:
        cc = _join_active_college_courses(db)
        if course_id is not None:
            cc = cc.where(CollegeCourse.course_id == course_id)
        if college_id is not None:
            cc = cc.where(CollegeCourse.college_id == college_id)
        ids = db.scalars(cc).all()
        if not ids:
            return []
        conditions.append(Admission.college_course_id.in_(ids))
    admissions = _paginated(
        select(Admission).where(*conditions).order_by(Admission.id),
        db,
        limit,
        offset,
    )
    return [_to_admission(db, a) for a in admissions]