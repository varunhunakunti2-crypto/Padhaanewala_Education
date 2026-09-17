import random
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import MockTest, TestAnswer, TestAttempt, TestQuestion, User
from app.schemas.catalog import (
    AttemptDetailResponse,
    AttemptQuestionResponse,
    MockTestResponse,
    ResultQuestionResponse,
    SaveAnswerRequest,
    StartAttemptResponse,
    TestAttemptResponse,
    TestQuestionResponse,
    TestResultResponse,
)

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


def _find_mock_test(db: Session, ref: str) -> MockTest | None:
    cond = MockTest.id == int(ref) if ref.isdigit() else MockTest.slug == ref
    return db.scalar(select(MockTest).where(cond, MockTest.is_active))


def _active_questions(db: Session, mock_test_id: int) -> list[TestQuestion]:
    return db.scalars(
        select(TestQuestion)
        .where(
            TestQuestion.mock_test_id == mock_test_id,
            TestQuestion.is_active,
        )
        .order_by(TestQuestion.sort_order, TestQuestion.id)
    ).all()


def _shuffled_options(question: TestQuestion) -> list | None:
    if not question.options or not isinstance(question.options, list):
        return question.options
    options = list(question.options)
    random.Random(question.id).shuffle(options)
    return options


def _find_attempt(db: Session, attempt_id: int, user: User) -> TestAttempt:
    attempt = db.scalar(
        select(TestAttempt)
        .options(selectinload(TestAttempt.mock_test))
        .where(TestAttempt.id == attempt_id)
    )
    if attempt is None:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your attempt")
    return attempt


def _finalize_if_expired(db: Session, attempt: TestAttempt) -> bool:
    if attempt.status == "in_progress" and attempt.time_remaining_seconds == 0:
        _grade_attempt(db, attempt)
        return True
    return False


def _grade_attempt(db: Session, attempt: TestAttempt) -> None:
    questions = _active_questions(db, attempt.mock_test_id)
    answers = {a.question_id: a for a in attempt.answers}
    score = 0
    correct = 0
    incorrect = 0
    for q in questions:
        answer = answers.get(q.id)
        if answer is None or answer.selected_answer is None:
            continue
        if answer.is_correct is None:
            is_correct = _is_answer_correct(attempt, q, answer)
            if is_correct is not None:
                answer.marks_awarded = _marks_for(attempt, q, is_correct)
        if answer.is_correct:
            correct += 1
            score += answer.marks_awarded or 0
        else:
            incorrect += 1
            score += answer.marks_awarded or 0

    answered_ids = {
        a.question_id
        for a in answers.values()
        if a.selected_answer is not None
    }
    total_marks = sum(q.marks for q in questions)
    attempt.score = score
    attempt.total_marks = total_marks
    attempt.correct_count = correct
    attempt.incorrect_count = incorrect
    attempt.unanswered_count = len(questions) - len(
        answered_ids & {q.id for q in questions}
    )
    attempt.percentage = (
        round(score * 100 / total_marks, 2) if total_marks else 0
    )
    attempt.status = "submitted"
    attempt.submitted_at = datetime.now(timezone.utc)


def _is_answer_correct(
    attempt: TestAttempt,
    question: TestQuestion,
    answer: TestAnswer,
) -> bool | None:
    if question.question_type != "mcq" or not question.correct_answer:
        return None
    if answer.selected_answer is None:
        return None
    return answer.selected_answer.strip() == question.correct_answer.strip()


def _marks_for(attempt: TestAttempt, question: TestQuestion, is_correct: bool) -> int:
    if is_correct:
        return int(question.marks or 0)
    if attempt.mock_test.negative_marking:
        return -int(
            question.negative_marks
            if question.negative_marks is not None and question.negative_marks > 0
            else attempt.mock_test.negative_marks_value or 0
        )
    return 0


def _attempt_view(attempt: TestAttempt) -> TestAttemptResponse:
    return TestAttemptResponse.build(attempt)


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


@router.get("/{mock_test_ref}/questions", response_model=list[TestQuestionResponse])
def get_mock_test_questions(mock_test_ref: str, db: Session = Depends(get_db)):
    mock_test = _find_mock_test(db, mock_test_ref)
    if mock_test is None:
        raise HTTPException(status_code=404, detail="Mock test not found")
    questions = _active_questions(db, mock_test.id)
    return [
        TestQuestionResponse(
            id=q.id,
            question_text=q.question_text,
            question_type=q.question_type,
            options=_shuffled_options(q) if mock_test.option_randomization else q.options,
            marks=q.marks,
            negative_marks=q.negative_marks,
            difficulty=q.difficulty,
            sort_order=q.sort_order,
        )
        for q in questions
    ]


@router.post("/{mock_test_ref}/start", response_model=StartAttemptResponse)
def start_mock_test(
    mock_test_ref: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    mock_test = _find_mock_test(db, mock_test_ref)
    if mock_test is None:
        raise HTTPException(status_code=404, detail="Mock test not found")

    used = db.scalar(
        select(func.count(TestAttempt.id)).where(
            TestAttempt.mock_test_id == mock_test.id,
            TestAttempt.user_id == user.id,
            TestAttempt.status.in_(["in_progress", "submitted"]),
        )
    )
    if mock_test.attempts_allowed > 0 and used >= mock_test.attempts_allowed:
        raise HTTPException(
            status_code=400,
            detail="Attempt limit reached for this mock test",
        )

    attempt = TestAttempt(
        mock_test_id=mock_test.id,
        user_id=user.id,
        status="in_progress",
        expires_at=datetime.now(timezone.utc)
        + timedelta(minutes=mock_test.duration_minutes),
    )
    db.add(attempt)
    db.flush()
    attempt.mock_test = mock_test

    questions = _active_questions(db, mock_test.id)
    if mock_test.question_randomization:
        randomized = list(questions)
        random.shuffle(randomized)
        questions = randomized

    db.commit()
    db.refresh(attempt)

    return StartAttemptResponse(
        attempt=_attempt_view(attempt),
        questions=[
            AttemptQuestionResponse(
                id=q.id,
                question_text=q.question_text,
                question_type=q.question_type,
                options=_shuffled_options(q) if mock_test.option_randomization else q.options,
                marks=q.marks,
                negative_marks=q.negative_marks,
                difficulty=q.difficulty,
                sort_order=q.sort_order,
            )
            for q in questions
        ],
    )


@router.get("/{mock_test_ref}/attempts", response_model=list[TestAttemptResponse])
def list_my_attempts(
    mock_test_ref: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    mock_test = _find_mock_test(db, mock_test_ref)
    if mock_test is None:
        raise HTTPException(status_code=404, detail="Mock test not found")

    attempts = db.scalars(
        select(TestAttempt)
        .options(selectinload(TestAttempt.mock_test))
        .where(
            TestAttempt.mock_test_id == mock_test.id,
            TestAttempt.user_id == user.id,
        )
        .order_by(TestAttempt.started_at.desc())
    ).all()
    for attempt in attempts:
        _finalize_if_expired(db, attempt)
    if attempts:
        db.commit()
    return [_attempt_view(a) for a in attempts]


@router.get("/attempts/{attempt_id}", response_model=AttemptDetailResponse)
def get_attempt(
    attempt_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    attempt = _find_attempt(db, attempt_id, user)
    _finalize_if_expired(db, attempt)
    db.commit()

    questions = _active_questions(db, attempt.mock_test_id)
    answers = {
        a.question_id: a
        for a in db.scalars(
            select(TestAnswer).where(TestAnswer.attempt_id == attempt.id)
        ).all()
    }
    return AttemptDetailResponse(
        attempt=_attempt_view(attempt),
        questions=[
            AttemptQuestionResponse(
                id=q.id,
                question_text=q.question_text,
                question_type=q.question_type,
                options=_shuffled_options(q)
                if attempt.mock_test.option_randomization
                else q.options,
                marks=q.marks,
                negative_marks=q.negative_marks,
                difficulty=q.difficulty,
                sort_order=q.sort_order,
                selected_answer=answers[q.id].selected_answer
                if q.id in answers
                else None,
            )
            for q in questions
        ],
    )


@router.put(
    "/attempts/{attempt_id}/answers/{question_id}",
    response_model=ResultQuestionResponse,
)
def save_answer(
    attempt_id: int,
    question_id: int,
    payload: SaveAnswerRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    attempt = _find_attempt(db, attempt_id, user)
    if attempt.status == "submitted":
        raise HTTPException(
            status_code=400, detail="Attempt already submitted"
        )
    _finalize_if_expired(db, attempt)
    if attempt.status == "submitted":
        raise HTTPException(status_code=400, detail="Attempt already submitted")

    question = db.scalar(
        select(TestQuestion).where(
            TestQuestion.id == question_id,
            TestQuestion.mock_test_id == attempt.mock_test_id,
            TestQuestion.is_active,
        )
    )
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")

    answer = db.scalar(
        select(TestAnswer).where(
            TestAnswer.attempt_id == attempt.id,
            TestAnswer.question_id == question.id,
        )
    )
    if answer is None:
        answer = TestAnswer(
            attempt_id=attempt.id,
            question_id=question.id,
        )
        db.add(answer)

    answer.selected_answer = payload.selected_answer
    answer.answered_at = (
        datetime.now(timezone.utc) if payload.selected_answer is not None else None
    )
    is_correct = _is_answer_correct(attempt, question, answer)
    answer.is_correct = is_correct
    answer.marks_awarded = (
        _marks_for(attempt, question, is_correct)
        if is_correct is not None
        else None
    )
    db.commit()
    db.refresh(answer)

    return ResultQuestionResponse(
        id=question.id,
        question_text=question.question_text,
        question_type=question.question_type,
        options=question.options,
        marks=question.marks,
        negative_marks=question.negative_marks,
        difficulty=question.difficulty,
        sort_order=question.sort_order,
        selected_answer=answer.selected_answer,
        is_correct=answer.is_correct,
        marks_awarded=answer.marks_awarded,
        correct_answer=question.correct_answer,
        explanation=question.explanation,
    )


@router.post(
    "/attempts/{attempt_id}/submit",
    response_model=TestResultResponse,
)
def submit_attempt(
    attempt_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    attempt = _find_attempt(db, attempt_id, user)
    if attempt.status == "in_progress":
        _grade_attempt(db, attempt)
        db.commit()
    return _build_result(attempt, db)


@router.get(
    "/attempts/{attempt_id}/result",
    response_model=TestResultResponse,
)
def get_attempt_result(
    attempt_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    attempt = _find_attempt(db, attempt_id, user)
    _finalize_if_expired(db, attempt)
    if attempt.status != "submitted":
        raise HTTPException(
            status_code=400, detail="Attempt not yet submitted"
        )
    db.commit()
    return _build_result(attempt, db)


def _build_result(attempt: TestAttempt, db: Session) -> TestResultResponse:
    questions = _active_questions(db, attempt.mock_test_id)
    answers = {
        a.question_id: a
        for a in db.scalars(
            select(TestAnswer).where(TestAnswer.attempt_id == attempt.id)
        ).all()
    }
    grade_by_question = {
        a.question_id: (a.is_correct, a.marks_awarded)
        for a in answers.values()
    }
    return TestResultResponse(
        attempt=_attempt_view(attempt),
        questions=[
            ResultQuestionResponse(
                id=q.id,
                question_text=q.question_text,
                question_type=q.question_type,
                options=q.options,
                marks=q.marks,
                negative_marks=q.negative_marks,
                difficulty=q.difficulty,
                sort_order=q.sort_order,
                selected_answer=answers[q.id].selected_answer
                if q.id in answers
                else None,
                is_correct=grade_by_question.get(q.id, (None, None))[0],
                marks_awarded=grade_by_question.get(q.id, (None, None))[1],
                correct_answer=q.correct_answer,
                explanation=q.explanation,
            )
            for q in questions
        ],
    )


@router.get("/{mock_test_ref}", response_model=MockTestResponse)
def get_mock_test(mock_test_ref: str, db: Session = Depends(get_db)):
    cond = (
        MockTest.id == int(mock_test_ref)
        if mock_test_ref.isdigit()
        else MockTest.slug == mock_test_ref
    )
    row = db.execute(
        select(MockTest, func.count(TestQuestion.id).label("question_count"))
        .outerjoin(TestQuestion, TestQuestion.mock_test_id == MockTest.id)
        .options(selectinload(MockTest.exam), selectinload(MockTest.course))
        .where(cond, MockTest.is_active)
        .group_by(MockTest.id)
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Mock test not found")
    return _to_response(row[0], row[1])