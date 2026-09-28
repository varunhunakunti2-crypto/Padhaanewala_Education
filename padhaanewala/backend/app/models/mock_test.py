from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.question_types import ALL_QUESTION_TYPES

#: The widest answer a submission may carry, in characters. Postgres raises
#: `value too long for type character varying(255)` on overflow, which surfaces
#: as a 500 and fails the whole submission, so the bound is repeated on the
#: request schemas -- where it can be a 422 -- rather than left to the column.
SELECTED_ANSWER_MAX_LENGTH = 255

#: Shared by both tables. `test_questions` is the one that matters: it has no
#: create endpoint and no seed script, so rows arrive by hand or ad-hoc script
#: and this constraint is the only guard on the value. A typo would otherwise
#: land unnoticed and silently withhold marks at grading time.
_QUESTION_TYPE_CHECK = "question_type IN ({})".format(
    ", ".join(f"'{value}'" for value in ALL_QUESTION_TYPES)
)


class MockTest(Base):
    __tablename__ = "mock_tests"
    __table_args__ = (
        CheckConstraint(_QUESTION_TYPE_CHECK, name="ck_mock_tests_question_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    exam_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("exams.id", ondelete="SET NULL"), nullable=True, index=True
    )
    course_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("courses.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    subject: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    difficulty: Mapped[str] = mapped_column(String(20), default="medium", index=True)
    question_type: Mapped[str] = mapped_column(String(20), default="mcq")
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    total_marks: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0)
    negative_marking: Mapped[bool] = mapped_column(Boolean, default=False)
    negative_marks_value: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    attempts_allowed: Mapped[int] = mapped_column(Integer, default=1)
    question_randomization: Mapped[bool] = mapped_column(Boolean, default=False)
    option_randomization: Mapped[bool] = mapped_column(Boolean, default=False)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_visibility: Mapped[str] = mapped_column(String(20), default="immediate")
    test_type: Mapped[str] = mapped_column(String(20), default="standard", index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now, onupdate=datetime.now
    )

    exam: Mapped["Exam | None"] = relationship()
    course: Mapped["Course | None"] = relationship()
    questions: Mapped[list["TestQuestion"]] = relationship(
        back_populates="mock_test", cascade="all, delete-orphan"
    )
    attempts: Mapped[list["TestAttempt"]] = relationship(
        back_populates="mock_test", cascade="all, delete-orphan"
    )


class TestQuestion(Base):
    __test__ = False
    __tablename__ = "test_questions"
    __table_args__ = (
        CheckConstraint(_QUESTION_TYPE_CHECK, name="ck_test_questions_question_type"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    mock_test_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("mock_tests.id", ondelete="CASCADE"), index=True
    )
    question_text: Mapped[str] = mapped_column(Text)
    question_type: Mapped[str] = mapped_column(String(20), default="mcq")
    options: Mapped[list | None] = mapped_column(JSON, nullable=True)
    correct_answer: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Subject lives here, not only on MockTest, because a single paper routinely
    # mixes sections (JEE Main/NEET are Physics + Chemistry + Maths/Biology). A
    # per-test subject cannot express that; NULL means "same as the paper's".
    subject: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    topic: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    # The answer key for `question_type = "numeric"`. Kept separate from
    # correct_answer so an exact-match key and a numeric key cannot disagree, and
    # so tolerance-based comparison is never applied to an option letter.
    numeric_answer: Mapped[Decimal | None] = mapped_column(Numeric(12, 4), nullable=True)
    # Absolute margin: a submission is correct when |given - numeric_answer| <=
    # tolerance. 0 means exact, which also makes "20.0" and "20" compare equal
    # because both sides are parsed as Decimal rather than as raw strings.
    tolerance: Mapped[Decimal] = mapped_column(Numeric(8, 4), default=0)
    marks: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=1)
    negative_marks: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=0)
    difficulty: Mapped[str] = mapped_column(String(20), default="medium")
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now, onupdate=datetime.now
    )

    mock_test: Mapped["MockTest"] = relationship(back_populates="questions")
    answers: Mapped[list["TestAnswer"]] = relationship(
        back_populates="question", cascade="all, delete-orphan"
    )


class TestAttempt(Base):
    __tablename__ = "test_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    mock_test_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("mock_tests.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(
        String(20), default="in_progress", index=True
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    score: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    total_marks: Mapped[Decimal | None] = mapped_column(
        Numeric(8, 2), nullable=True
    )
    correct_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    incorrect_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Questions the student left blank. Deliberately narrower than "not correct":
    # a blank submission is an omission, so it must not pick up negative marking.
    unanswered_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Answers that exist but that the autograder cannot decide: `essay`, an MCQ
    # published without a key, a `numeric` published without a numeric_answer.
    # These were previously folded into `unanswered_count`, which reported a
    # written essay as a question the student never attempted. Kept as its own
    # tally so that
    #   correct + incorrect + unanswered + pending_review == len(questions)
    # holds with every bucket meaning what its name says.
    #
    # NULL, not 0, for attempts graded before this column existed: their
    # `unanswered_count` mixed the two meanings and cannot be split after the
    # fact, so backfilling either bucket would be a guess.
    pending_review_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    percentage: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now, onupdate=datetime.now
    )

    mock_test: Mapped["MockTest"] = relationship(back_populates="attempts")
    user: Mapped["User"] = relationship()
    answers: Mapped[list["TestAnswer"]] = relationship(
        back_populates="attempt", cascade="all, delete-orphan"
    )

    @property
    def time_remaining_seconds(self) -> int:
        now = datetime.now(timezone.utc)
        expires = self.expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        return max(0, int((expires - now).total_seconds()))


class TestAnswer(Base):
    __test__ = False
    __tablename__ = "test_answers"
    __table_args__ = (
        UniqueConstraint(
            "attempt_id", "question_id", name="uq_test_answers_attempt_question"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    attempt_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("test_attempts.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("test_questions.id", ondelete="CASCADE"), index=True
    )
    selected_answer: Mapped[str | None] = mapped_column(
        String(SELECTED_ANSWER_MAX_LENGTH), nullable=True
    )
    is_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    marks_awarded: Mapped[Decimal | None] = mapped_column(
        Numeric(6, 2), nullable=True
    )
    answered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now, onupdate=datetime.now
    )

    attempt: Mapped["TestAttempt"] = relationship(back_populates="answers")
    question: Mapped["TestQuestion"] = relationship(back_populates="answers")