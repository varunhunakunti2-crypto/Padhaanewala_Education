from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import MockTest, TestQuestion
from app.schemas.catalog import MockTestResponse

router = APIRouter(prefix="/api/v1/mock-tests", tags=["mock-tests"])


def _to_response(mock_test: MockTest, question_count: int) -> MockTestResponse:
    return MockTestResponse(
        id=mock_test.id,
        name=mock_test.name,
        slug=mock_test.slug,
        exam_id=mock_test.exam_id,
        exam_name=mock_test.exam.name if mock_test.exam else None,
        course_id=mock_test.course_id,
        course_name=mock_test.course.name if mock_test.course else None,
        subject=mock_test.subject,
        difficulty=mock_test.difficulty,
        question_type=mock_test.question_type,
        duration_minutes=mock_test.duration_minutes,
        total_marks=mock_test.total_marks,
        negative_marking=mock_test.negative_marking,
        negative_marks_value=mock_test.negative_marks_value,
        attempts_allowed=mock_test.attempts_allowed,
        question_randomization=mock_test.question_randomization,
        option_randomization=mock_test.option_randomization,
        instructions=mock_test.instructions,
        result_visibility=mock_test.result_visibility,
        test_type=mock_test.test_type,
        question_count=question_count,
        is_active=mock_test.is_active,
    )


@router.get("", response_model=list[MockTestResponse])
def list_mock_tests(
    exam_id: int | None = None,
    course_id: int | None = None,
    subject: str | None = None,
    difficulty: str | None = None,
    test_type: str | None = None,
    q: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = (
        select(MockTest, func.count(TestQuestion.id).label("question_count"))
        .outerjoin(TestQuestion, TestQuestion.mock_test_id == MockTest.id)
        .options(selectinload(MockTest.exam), selectinload(MockTest.course))
        .where(MockTest.is_active)
    )
    if exam_id:
        query = query.where(MockTest.exam_id == exam_id)
    if course_id:
        query = query.where(MockTest.course_id == course_id)
    if subject:
        query = query.where(MockTest.subject == subject)
    if difficulty:
        query = query.where(MockTest.difficulty == difficulty)
    if test_type:
        query = query.where(MockTest.test_type == test_type)
    if q:
        term = f"%{q.strip()}%"
        query = query.where(MockTest.name.ilike(term))

    rows = db.execute(
        query.group_by(MockTest.id).order_by(MockTest.name).limit(limit).offset(offset)
    ).all()
    return [_to_response(m, count) for m, count in rows]


@router.get("/{mock_test_id}", response_model=MockTestResponse)
def get_mock_test(mock_test_id: int, db: Session = Depends(get_db)):
    row = db.execute(
        select(MockTest, func.count(TestQuestion.id).label("question_count"))
        .outerjoin(TestQuestion, TestQuestion.mock_test_id == MockTest.id)
        .options(selectinload(MockTest.exam), selectinload(MockTest.course))
        .where(MockTest.id == mock_test_id, MockTest.is_active)
        .group_by(MockTest.id)
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Mock test not found")
    return _to_response(row[0], row[1])