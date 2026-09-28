import random
import re
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models import MockTest, TestAnswer, TestAttempt, TestQuestion, User
from app.question_types import QuestionType
from app.schemas.catalog import (
    AdminQuestionResponse,
    AttemptDetailResponse,
    AttemptQuestionResponse,
    MockTestAdminDetailResponse,
    MockTestCreate,
    MockTestResponse,
    MockTestUpdate,
    ResultQuestionResponse,
    SaveAnswerRequest,
    StartAttemptResponse,
    SubmitAttemptRequest,
    TestAttemptResponse,
    TestQuestionResponse,
    TestResultResponse,
)

router = APIRouter(prefix="/api/v1/mock-tests", tags=["mock-tests"])

from app.roles import CONTENT_ROLES

def _slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.strip().lower()).strip("-")

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

def _find_mock_test_admin(db: Session, ref: str) -> MockTest | None:
    cond = MockTest.id == int(ref) if ref.isdigit() else MockTest.slug == ref
    return db.scalar(select(MockTest).where(cond))

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
    """Auto-submit an attempt whose deadline has passed. Returns True if it graded.

    Callers MUST commit before responding with an error, otherwise the
    finalisation is rolled back with the session and the attempt stays
    `in_progress` forever, which both defeats the deadline and burns one of the
    student's `attempts_allowed` without ever recording a result.
    """
    if attempt.status == "in_progress" and attempt.time_remaining_seconds == 0:
        _grade_attempt(db, attempt)
        # The deadline is the submission time, not whenever a request happened to
        # notice the clock had run out.
        attempt.submitted_at = attempt.expires_at
        return True
    return False

def _grade_attempt(db: Session, attempt: TestAttempt) -> None:
    db.flush()
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
            answer.is_correct = _is_answer_correct(attempt, q, answer)
        if answer.is_correct is None:
            # Not auto-gradable: subjective types (essay/descriptive), a `numeric`
            # question published without a numeric_answer, a blank numeric
            # submission, and MCQs published without an answer key. Previously these
            # fell through to the `else` branch, so every one of them was tallied as incorrect
            # (inflating incorrect_count) while still scoring 0 marks, and it was
            # excluded from unanswered_count because it had a selected_answer.
            # They are left for manual review instead: no marks, no verdict. They
            # still land in unanswered_count below, which keeps the partition
            # correct + incorrect + unanswered == len(questions).
            answer.marks_awarded = None
            continue
        answer.marks_awarded = _marks_for(attempt, q, answer.is_correct)
        if answer.is_correct:
            correct += 1
        else:
            incorrect += 1
        score += answer.marks_awarded or 0

    total_marks = sum(q.marks for q in questions)
    attempt.score = score
    attempt.total_marks = total_marks
    attempt.correct_count = correct
    attempt.incorrect_count = incorrect
    attempt.unanswered_count = len(questions) - correct - incorrect
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
    if answer.selected_answer is None:
        return None
    if question.question_type == QuestionType.NUMERIC:
        return _is_numeric_correct(question, answer.selected_answer)
    if question.question_type != QuestionType.MCQ or not question.correct_answer:
        return None
    return answer.selected_answer.strip() == question.correct_answer.strip()

def _is_numeric_correct(question: TestQuestion, selected: str) -> bool | None:
    """Grade a `numeric` submission against `numeric_answer` within `tolerance`.

    Both sides are parsed as `Decimal`, which is what makes "20.0" and "20" the
    same answer -- string comparison of `correct_answer` would call that wrong.
    Tolerance is an absolute margin, so a question keying 1.4142 with tolerance
    0.005 accepts 1.41 and 1.415 but not 1.40.

    None (ungradable, no verdict) rather than False in two cases, because
    `_grade_attempt` treats None as "left for manual review" and skips negative
    marking:
      - the question has no numeric key;
      - the submission is blank, which is an omission rather than a wrong number.
    Anything else that fails to parse is a genuine wrong answer and returns False.
    """
    if question.numeric_answer is None:
        return None
    raw = selected.strip().replace(",", "")
    if not raw:
        return None
    try:
        value = Decimal(raw)
    except (InvalidOperation, ArithmeticError):
        return False
    tolerance = (
        question.tolerance if question.tolerance is not None else Decimal(0)
    )
    return abs(value - question.numeric_answer) <= tolerance

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

def _save_answer(
    db: Session,
    attempt: TestAttempt,
    question: TestQuestion,
    selected_answer: str | None,
) -> TestAnswer:
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

    answer.selected_answer = selected_answer
    answer.answered_at = (
        datetime.now(timezone.utc) if selected_answer is not None else None
    )
    is_correct = _is_answer_correct(attempt, question, answer)
    answer.is_correct = is_correct
    answer.marks_awarded = (
        _marks_for(attempt, question, is_correct)
        if is_correct is not None
        else None
    )
    return answer

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
    limit: int = Query(50, ge=1, le=100),
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

@router.post(
    "",
    response_model=MockTestResponse,
    status_code=201,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def create_mock_test(payload: MockTestCreate, db: Session = Depends(get_db)):
    slug = _slugify(payload.name)
    if db.scalar(select(MockTest).where(MockTest.slug == slug)):
        raise HTTPException(status_code=400, detail="Mock test with this name exists")
    mock_test = MockTest(
        **payload.model_dump(exclude={"name"}), name=payload.name, slug=slug
    )
    db.add(mock_test)
    db.commit()
    db.refresh(mock_test)
    return _to_response(mock_test, 0)

@router.put(
    "/{mock_test_ref}",
    response_model=MockTestResponse,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def update_mock_test(
    mock_test_ref: str, payload: MockTestUpdate, db: Session = Depends(get_db)
):
    mock_test = _find_mock_test_admin(db, mock_test_ref)
    if mock_test is None:
        raise HTTPException(status_code=404, detail="Mock test not found")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] != mock_test.name:
        slug = _slugify(data["name"])
        if db.scalar(
            select(MockTest).where(
                MockTest.slug == slug, MockTest.id != mock_test.id
            )
        ):
            raise HTTPException(
                status_code=400, detail="Mock test with this name exists"
            )
        mock_test.slug = slug
    for field, value in data.items():
        setattr(mock_test, field, value)
    db.commit()
    db.refresh(mock_test)

    question_count = db.scalar(
        select(func.count(TestQuestion.id)).where(
            TestQuestion.mock_test_id == mock_test.id
        )
    )
    return _to_response(mock_test, question_count or 0)

@router.delete(
    "/{mock_test_ref}",
    status_code=204,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def delete_mock_test(mock_test_ref: str, db: Session = Depends(get_db)):
    mock_test = _find_mock_test_admin(db, mock_test_ref)
    if mock_test is None:
        raise HTTPException(status_code=404, detail="Mock test not found")
    mock_test.is_active = False
    db.commit()

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
            subject=q.subject,
            topic=q.topic,
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

    existing = db.scalars(
        select(TestAttempt)
        .where(
            TestAttempt.mock_test_id == mock_test.id,
            TestAttempt.user_id == user.id,
            TestAttempt.status == "in_progress",
        )
        .order_by(TestAttempt.started_at.desc())
    ).all()
    if existing:
        expired = False
        for attempt in existing:
            if attempt.time_remaining_seconds == 0:
                _finalize_if_expired(db, attempt)
                expired = True
        if expired:
            db.commit()

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
                subject=q.subject,
                topic=q.topic,
            )
            for q in questions
        ],
    )

@router.post("/{mock_test_ref}/submit", response_model=TestResultResponse)
def submit_mock_test(
    mock_test_ref: str,
    payload: SubmitAttemptRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    mock_test = _find_mock_test(db, mock_test_ref)
    if mock_test is None:
        raise HTTPException(status_code=404, detail="Mock test not found")

    attempt = db.scalar(
        select(TestAttempt)
        .options(selectinload(TestAttempt.mock_test))
        .where(
            TestAttempt.mock_test_id == mock_test.id,
            TestAttempt.user_id == user.id,
        )
        .order_by(TestAttempt.started_at.desc())
        .limit(1)
    )

    if attempt is None:
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

    if attempt.status == "submitted":
        raise HTTPException(status_code=400, detail="Attempt already submitted")
    if _finalize_if_expired(db, attempt):
        # The deadline passed, so these answers are late and are discarded. The
        # auto-grading is committed first (raising here used to roll it back) and
        # the graded result is returned so the client still gets its outcome.
        db.commit()
        return _build_result(attempt, db)

    questions = {q.id: q for q in _active_questions(db, mock_test.id)}
    for submission in payload.answers:
        question = questions.get(submission.question_id)
        if question is None:
            raise HTTPException(
                status_code=404,
                detail=f"Question {submission.question_id} not found in this mock test",
            )
        _save_answer(db, attempt, question, submission.selected_answer)

    _grade_attempt(db, attempt)
    db.commit()
    return _build_result(attempt, db)

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

@router.get("/{mock_test_ref}/attempts/{attempt_id}", response_model=AttemptDetailResponse)
def get_attempt(
    mock_test_ref: str,
    attempt_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    mock_test = _find_mock_test(db, mock_test_ref)
    if mock_test is None:
        raise HTTPException(status_code=404, detail="Mock test not found")
    attempt = _find_attempt(db, attempt_id, user)
    if attempt.mock_test_id != mock_test.id:
        raise HTTPException(status_code=404, detail="Attempt not found for this mock test")
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
                subject=q.subject,
                topic=q.topic,
            )
            for q in questions
        ],
    )

@router.put(
    "/{mock_test_ref}/attempts/{attempt_id}/answers/{question_id}",
    response_model=AttemptQuestionResponse,
)
def save_answer(
    mock_test_ref: str,
    attempt_id: int,
    question_id: int,
    payload: SaveAnswerRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    mock_test = _find_mock_test(db, mock_test_ref)
    if mock_test is None:
        raise HTTPException(status_code=404, detail="Mock test not found")
    attempt = _find_attempt(db, attempt_id, user)
    if attempt.mock_test_id != mock_test.id:
        raise HTTPException(status_code=404, detail="Attempt not found for this mock test")
    if attempt.status == "submitted":
        raise HTTPException(
            status_code=400, detail="Attempt already submitted"
        )
    if _finalize_if_expired(db, attempt):
        # The answer is late, so it is rejected, but the finalisation is committed
        # first â€” raising without committing rolled it back and left the attempt
        # `in_progress` past its deadline.
        db.commit()
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

    answer = _save_answer(db, attempt, question, payload.selected_answer)
    db.commit()
    db.refresh(answer)

    return AttemptQuestionResponse(
        id=question.id,
        question_text=question.question_text,
        question_type=question.question_type,
        options=_shuffled_options(question)
        if attempt.mock_test.option_randomization
        else question.options,
        marks=question.marks,
        negative_marks=question.negative_marks,
        difficulty=question.difficulty,
        sort_order=question.sort_order,
        selected_answer=answer.selected_answer,
        subject=question.subject,
        topic=question.topic,
    )

@router.post(
    "/{mock_test_ref}/attempts/{attempt_id}/submit",
    response_model=TestResultResponse,
)
def submit_attempt(
    mock_test_ref: str,
    attempt_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    mock_test = _find_mock_test(db, mock_test_ref)
    if mock_test is None:
        raise HTTPException(status_code=404, detail="Mock test not found")
    attempt = _find_attempt(db, attempt_id, user)
    if attempt.mock_test_id != mock_test.id:
        raise HTTPException(status_code=404, detail="Attempt not found for this mock test")
    # This endpoint carried no expiry check, so an attempt whose clock had run out
    # could still be submitted and graded as if it were on time. Finalise on the
    # deadline instead; re-submitting an already-graded attempt stays idempotent.
    _finalize_if_expired(db, attempt)
    if attempt.status == "in_progress":
        _grade_attempt(db, attempt)
    db.commit()
    return _build_result(attempt, db)

@router.get(
    "/{mock_test_ref}/attempts/{attempt_id}/result",
    response_model=TestResultResponse,
)
def get_attempt_result(
    mock_test_ref: str,
    attempt_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    mock_test = _find_mock_test(db, mock_test_ref)
    if mock_test is None:
        raise HTTPException(status_code=404, detail="Mock test not found")
    attempt = _find_attempt(db, attempt_id, user)
    if attempt.mock_test_id != mock_test.id:
        raise HTTPException(status_code=404, detail="Attempt not found for this mock test")
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
    show_key = attempt.mock_test is not None and attempt.mock_test.result_visibility == "immediate"
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
                subject=q.subject,
                topic=q.topic,
                is_correct=grade_by_question.get(q.id, (None, None))[0],
                marks_awarded=grade_by_question.get(q.id, (None, None))[1],
                correct_answer=q.correct_answer if show_key else None,
                numeric_answer=q.numeric_answer if show_key else None,
                explanation=q.explanation if show_key else None,
            )
            for q in questions
        ],
    )

@router.get(
    "/admin/all",
    response_model=list[MockTestResponse],
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def admin_list_mock_tests(
    exam_id: int | None = None,
    course_id: int | None = None,
    subject: str | None = None,
    difficulty: str | None = None,
    test_type: str | None = None,
    is_active: bool | None = None,
    q: str | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = (
        select(MockTest, func.count(TestQuestion.id).label("question_count"))
        .outerjoin(TestQuestion, TestQuestion.mock_test_id == MockTest.id)
        .options(selectinload(MockTest.exam), selectinload(MockTest.course))
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
    if is_active is not None:
        query = query.where(MockTest.is_active == is_active)
    if q:
        term = f"%{q.strip()}%"
        query = query.where(MockTest.name.ilike(term))

    rows = db.execute(
        query.group_by(MockTest.id).order_by(MockTest.name).limit(limit).offset(offset)
    ).all()
    return [_to_response(m, count) for m, count in rows]

@router.get(
    "/admin/all/{mock_test_ref}",
    response_model=MockTestAdminDetailResponse,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def admin_get_mock_test(mock_test_ref: str, db: Session = Depends(get_db)):
    mock_test = _find_mock_test_admin(db, mock_test_ref)
    if mock_test is None:
        raise HTTPException(status_code=404, detail="Mock test not found")

    questions = db.scalars(
        select(TestQuestion)
        .where(TestQuestion.mock_test_id == mock_test.id)
        .order_by(TestQuestion.sort_order, TestQuestion.id)
    ).all()

    attempt_count = db.scalar(
        select(func.count(TestAttempt.id)).where(
            TestAttempt.mock_test_id == mock_test.id
        )
    )

    return MockTestAdminDetailResponse(
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
        question_count=len(questions),
        is_active=mock_test.is_active,
        attempt_count=attempt_count,
        questions=[
            AdminQuestionResponse(
                id=q.id,
                question_text=q.question_text,
                question_type=q.question_type,
                options=q.options,
                correct_answer=q.correct_answer,
                marks=q.marks,
                negative_marks=q.negative_marks,
                difficulty=q.difficulty,
                explanation=q.explanation,
                sort_order=q.sort_order,
                is_active=q.is_active,
                subject=q.subject,
                topic=q.topic,
                numeric_answer=q.numeric_answer,
                tolerance=q.tolerance,
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
