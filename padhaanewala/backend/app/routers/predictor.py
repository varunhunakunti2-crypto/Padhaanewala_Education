from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import College, CollegeCourse, Cutoff, Course, SeatMatrix
from app.schemas.catalog import CollegeListItemResponse

router = APIRouter(prefix="/api/v1/predictor", tags=["predictor"])

VALID_EXAMS = ["neet-ug", "jee-main", "cuet-ug", "kcet"]
VALID_CATEGORIES = ["General", "OBC", "EWS", "SC", "ST"]
VALID_OWNERSHIP = ["any", "government", "private"]
BUCKET_ORDER = ["highly-suitable", "possible", "reach", "not-eligible"]

CATEGORY_CARRY_MAP = {
    "neet-ug": {"General": 45000, "OBC": 85000, "EWS": 65000, "SC": 160000, "ST": 210000},
    "jee-main": {"General": 60000, "OBC": 100000, "EWS": 80000, "SC": 190000, "ST": 250000},
    "cuet-ug": {"General": 50000, "OBC": 90000, "EWS": 70000, "SC": 170000, "ST": 220000},
    "kcet": {"General": 25000, "OBC": 45000, "EWS": 35000, "SC": 70000, "ST": 90000},
}


class PredictorRequest(BaseModel):
    exam: str = Field(min_length=1, max_length=50)
    category: str = Field(min_length=1, max_length=30)
    rank: int = Field(gt=0)
    course_id: int | None = None
    ownership: str = "any"
    state_id: int | None = None
    budget: float | None = None
    hostel_required: bool = False


class PredictorCollegeResult(BaseModel):
    college: CollegeListItemResponse
    bucket: str
    confidence: int
    closing_rank: int | None
    reasons: list[str]
    seats_available: int | None = None
    annual_fee: float | None = None

    model_config = {"from_attributes": True}


class PredictorResponse(BaseModel):
    exam: str
    category: str
    rank: int
    total_results: int
    results: list[PredictorCollegeResult]
    data_note: str = ""


@router.get("/exams")
def list_predictor_exams():
    return [
        {"slug": "neet-ug", "name": "NEET UG", "max_score": 720},
        {"slug": "jee-main", "name": "JEE Main", "max_score": 300},
        {"slug": "cuet-ug", "name": "CUET UG", "max_score": 800},
        {"slug": "kcet", "name": "KCET (Karnataka)", "max_score": 180},
    ]


@router.post("", response_model=PredictorResponse)
def predict_colleges(
    payload: PredictorRequest,
    db: Session = Depends(get_db),
):
    if payload.exam not in VALID_EXAMS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid exam '{payload.exam}'. Must be one of: {', '.join(VALID_EXAMS)}",
        )
    if payload.category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category '{payload.category}'. Must be one of: {', '.join(VALID_CATEGORIES)}",
        )
    if payload.ownership not in VALID_OWNERSHIP:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid ownership '{payload.ownership}'. Must be one of: {', '.join(VALID_OWNERSHIP)}",
        )

    cutoff_query = (
        select(Cutoff)
        .options(selectinload(Cutoff.college), selectinload(Cutoff.course))
        .where(
            Cutoff.exam_name == payload.exam,
            Cutoff.category == payload.category,
        )
    )
    if payload.course_id:
        cutoff_query = cutoff_query.where(Cutoff.course_id == payload.course_id)

    cutoffs = db.scalars(cutoff_query).all()

    if not cutoffs:
        return PredictorResponse(
            exam=payload.exam,
            category=payload.category,
            rank=payload.rank,
            total_results=0,
            results=[],
            data_note="No cutoff data found for this exam/category combination. Data may not be seeded yet.",
        )

    college_cutoffs: dict[int, list[Cutoff]] = {}
    for co in cutoffs:
        if co.college_id is None:
            continue
        college_cutoffs.setdefault(co.college_id, []).append(co)

    candidate_college_ids = list(college_cutoffs.keys())
    college_query = (
        select(College)
        .options(selectinload(College.state), selectinload(College.university))
        .where(College.is_active, College.id.in_(candidate_college_ids))
    )
    if payload.ownership != "any":
        college_query = college_query.where(
            College.ownership.ilike(payload.ownership)
        )
    if payload.state_id:
        college_query = college_query.where(College.state_id == payload.state_id)

    colleges = db.scalars(college_query).all()
    college_map = {c.id: c for c in colleges}

    seat_query = select(SeatMatrix).where(
        SeatMatrix.exam == payload.exam,
    )
    if payload.course_id:
        seat_query = seat_query.where(SeatMatrix.course_id == payload.course_id)
    if payload.state_id:
        seat_query = seat_query.where(SeatMatrix.college_id.in_(list(college_map.keys())))
    seat_matrices = db.scalars(seat_query).all()
    seat_map: dict[int, int] = {}
    for sm in seat_matrices:
        if sm.college_id is None:
            continue
        cat_seats = getattr(sm, f"{payload.category.lower()}_seats", None)
        if cat_seats and cat_seats > 0:
            seat_map[sm.college_id] = cat_seats

    fee_map: dict[int, float] = {}
    if candidate_college_ids:
        cc_rows = db.scalars(
            select(CollegeCourse).where(
                CollegeCourse.college_id.in_(list(college_map.keys())),
                CollegeCourse.is_active,
            )
        ).all()
        for cc in cc_rows:
            if cc.annual_fee:
                current = fee_map.get(cc.college_id, 0)
                fee_map[cc.college_id] = max(current, float(cc.annual_fee))

    results = []
    for cid, cos in college_cutoffs.items():
        if cid not in college_map:
            continue
        college = college_map[cid]

        valid_cutoffs = [
            co for co in cos if co.closing_rank is not None and co.closing_rank > 0
        ]
        if not valid_cutoffs:
            continue

        closing_ranks = [co.closing_rank for co in valid_cutoffs]
        avg_closing = round(sum(closing_ranks) / len(closing_ranks))

        reasons: list[str] = []
        ratio = payload.rank / avg_closing if avg_closing > 0 else 999

        if ratio <= 0.8:
            bucket = "highly-suitable"
            confidence = 90
            reasons.append("Rank sits comfortably below the expected closing rank.")
        elif ratio <= 1.05:
            bucket = "possible"
            confidence = 72
            reasons.append("Rank is close to the expected closing rank — likely in later rounds.")
        elif ratio <= 1.45:
            bucket = "reach"
            confidence = 50
            reasons.append("Rank is beyond the expected range — may convert only if cutoffs drop.")
        else:
            bucket = "not-eligible"
            confidence = 26
            reasons.append("Rank is well beyond the expected cutoff for this college.")

        annual_fee = fee_map.get(cid)
        if annual_fee and payload.budget and annual_fee > payload.budget:
            if bucket == "highly-suitable":
                bucket = "possible"
            elif bucket == "possible":
                bucket = "reach"
            reasons.append(
                f"Annual fees (₹{annual_fee:,.0f}) are above your ₹{payload.budget:,.0f} budget."
            )

        if payload.hostel_required and not college.has_hostel:
            reasons.append("No hostel facility available at this college.")

        state_name = college.state.name if college.state else "Unknown"
        reasons.append(f"Located in {college.city or 'Unknown'}, {state_name}.")
        reasons.append(
            f"Average closing rank for {payload.exam.replace('-', ' ').upper()} "
            f"({payload.category}): #{avg_closing:,}"
        )

        confidence += round((hash(str(cid)) % 11 - 5) * 1.5)
        confidence = max(4, min(97, confidence))

        college_item = CollegeListItemResponse(
            id=college.id,
            college_id=college.college_id,
            name=college.name,
            slug=college.slug,
            college_type=college.college_type,
            ownership=college.ownership,
            city=college.city,
            state=state_name,
            university_name=college.university.name if college.university else None,
            has_hostel=college.has_hostel,
            total_reviews=college.total_reviews,
            average_rating=college.average_rating,
            is_featured=college.is_featured,
        )

        results.append(
            PredictorCollegeResult(
                college=college_item,
                bucket=bucket,
                confidence=confidence,
                closing_rank=avg_closing,
                reasons=reasons,
                seats_available=seat_map.get(cid),
                annual_fee=annual_fee,
            )
        )

    results.sort(
        key=lambda r: (
            BUCKET_ORDER.index(r.bucket) if r.bucket in BUCKET_ORDER else 99,
            -r.confidence,
        )
    )

    has_cutoff_data = len(results) > 0
    note = (
        "Results based on historical cutoff data."
        if has_cutoff_data
        else "No cutoff data found. Results are estimates and may not be accurate."
    )

    return PredictorResponse(
        exam=payload.exam,
        category=payload.category,
        rank=payload.rank,
        total_results=len(results),
        results=results,
        data_note=note,
    )
