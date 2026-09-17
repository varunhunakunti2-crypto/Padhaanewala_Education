from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
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


class MockTest(Base):
    __tablename__ = "mock_tests"

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

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    mock_test_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("mock_tests.id", ondelete="CASCADE"), index=True
    )
    question_text: Mapped[str] = mapped_column(Text)
    question_type: Mapped[str] = mapped_column(String(20), default="mcq")
    options: Mapped[list | None] = mapped_column(JSON, nullable=True)
    correct_answer: Mapped[str | None] = mapped_column(String(255), nullable=True)
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
    unanswered_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
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
        String(255), nullable=True
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