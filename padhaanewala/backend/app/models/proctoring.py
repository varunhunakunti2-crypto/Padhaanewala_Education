"""Proctoring data: sessions and their recorded events (Phases 23-28, 49).

`app/models/proctoring.py` was originally written ahead of its migration and
drifted from it: it declared a `client` JSON column and a `payload` column that
no table has, while omitting the `status`, `severity`, `reason`,
`remaining_seconds` and `detail` columns the migration created. The tables in
the database match the migration, so this module is corrected here to mirror
the schema exactly -- a SQLAlchemy model that disagrees with its own DDL is a
landmine, because ``db.add()`` then emits an INSERT naming columns that do not
exist and every write fails at runtime rather than at import.

The check-constraint vocabularies are spelled out as literals rather than
imported from here elsewhere, because migrations freeze history; the live
constants below exist for the application and tests, and are kept in sync with
the migration by hand.
"""

from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# --------------------------------------------------------------------------- #
# Vocabulary
# --------------------------------------------------------------------------- #

#: Proctoring session lifecycle states (``ck_proctoring_sessions_status``).
SESSION_STATUS_ACTIVE = "active"
SESSION_STATUS_ENDED = "ended"
SESSION_STATUSES = (SESSION_STATUS_ACTIVE, SESSION_STATUS_ENDED)

# Event types (``ck_proctoring_events_event_type``). The two face events are the
# ones the client-side detector raises; the rest are focus/permission signals.
EVENT_FACE_NOT_DETECTED = "FACE_NOT_DETECTED"
EVENT_MULTIPLE_FACES = "MULTIPLE_FACES"
EVENT_TAB_SWITCH = "TAB_SWITCH"
EVENT_WINDOW_BLUR = "WINDOW_BLUR"
EVENT_FULLSCREEN_EXIT = "FULLSCREEN_EXIT"
EVENT_SCREEN_SHARE_STOPPED = "SCREEN_SHARE_STOPPED"
EVENT_SCREEN_SHARE_SURFACE_CHANGED = "SCREEN_SHARE_SURFACE_CHANGED"
EVENT_COPY_BLOCKED = "COPY_BLOCKED"
EVENT_PASTE_BLOCKED = "PASTE_BLOCKED"
EVENT_CONTEXT_MENU_BLOCKED = "CONTEXT_MENU_BLOCKED"
EVENT_PERMISSION_REVOKED = "PERMISSION_REVOKED"
EVENT_AUTO_SUBMIT = "AUTO_SUBMIT"
EVENT_CAMERA_DISCONNECTED = "CAMERA_DISCONNECTED"
EVENT_MIC_DISCONNECTED = "MIC_DISCONNECTED"
EVENT_SCREEN_SHARE_DISCONNECTED = "SCREEN_SHARE_DISCONNECTED"
EVENT_FULL_ATTENTION_LOST = "FULL_ATTENTION_LOST"
EVENT_FULL_ATTENTION_REGAINED = "FULL_ATTENTION_REGAINED"
EVENT_NO_STUDENT = "NO_STUDENT"
EVENT_MULTIPLE_STUDENTS = "MULTIPLE_STUDENTS"
EVENT_ANSWER_SAVED = "ANSWER_SAVED"
EVENT_EXAM_STARTED = "EXAM_STARTED"
EVENT_EXAM_ENDED = "EXAM_ENDED"
EVENT_EXAM_SUBMITTED = "EXAM_SUBMITTED"
EVENT_SCREEN_RECORDING_STOPPED = "SCREEN_RECORDING_STOPPED"
EVENT_SECONDARY_DISPLAY_DETECTED = "SECONDARY_DISPLAY_DETECTED"

#: Every event type the schema accepts. Kept in the same order as the migration
#: so a diff between the two is a one-to-one comparison.
EVENT_TYPES = (
    EVENT_FACE_NOT_DETECTED,
    EVENT_MULTIPLE_FACES,
    EVENT_TAB_SWITCH,
    EVENT_WINDOW_BLUR,
    EVENT_FULLSCREEN_EXIT,
    EVENT_SCREEN_SHARE_STOPPED,
    EVENT_SCREEN_SHARE_SURFACE_CHANGED,
    EVENT_COPY_BLOCKED,
    EVENT_PASTE_BLOCKED,
    EVENT_CONTEXT_MENU_BLOCKED,
    EVENT_PERMISSION_REVOKED,
    EVENT_AUTO_SUBMIT,
    EVENT_CAMERA_DISCONNECTED,
    EVENT_MIC_DISCONNECTED,
    EVENT_SCREEN_SHARE_DISCONNECTED,
    EVENT_FULL_ATTENTION_LOST,
    EVENT_FULL_ATTENTION_REGAINED,
    EVENT_NO_STUDENT,
    EVENT_MULTIPLE_STUDENTS,
    EVENT_ANSWER_SAVED,
    EVENT_EXAM_STARTED,
    EVENT_EXAM_ENDED,
    EVENT_EXAM_SUBMITTED,
    EVENT_SCREEN_RECORDING_STOPPED,
    EVENT_SECONDARY_DISPLAY_DETECTED,
)

#: Severity ladder (``ck_proctoring_events_severity``).
SEVERITY_LOW = "low"
SEVERITY_MEDIUM = "medium"
SEVERITY_HIGH = "high"
SEVERITY_CRITICAL = "critical"
SEVERITIES = (SEVERITY_LOW, SEVERITY_MEDIUM, SEVERITY_HIGH, SEVERITY_CRITICAL)


def _quoted(values: tuple[str, ...]) -> str:
    """Render a tuple of literals for a ``CheckConstraint`` string."""
    return ", ".join(repr(v) for v in values)


_STATUS_CHECK = f"status IN {_quoted(SESSION_STATUSES)}"
_EVENT_TYPE_CHECK = f"event_type IN {_quoted(EVENT_TYPES)}"
_SEVERITY_CHECK = f"severity IN {_quoted(SEVERITIES)}"


# --------------------------------------------------------------------------- #
# ORM models
# --------------------------------------------------------------------------- #


class ProctoringSession(Base):
    """One exam session under proctoring, 1:1 with a ``TestAttempt``."""

    __tablename__ = "proctoring_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    attempt_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("test_attempts.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    mock_test_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("mock_tests.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=SESSION_STATUS_ACTIVE
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    events = relationship(
        "ProctoringEvent",
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ProctoringEvent.occurred_at",
    )

    __table_args__ = (CheckConstraint(_STATUS_CHECK, name="ck_proctoring_sessions_status"),)


class ProctoringEvent(Base):
    """One proctoring event attached to a session."""

    __tablename__ = "proctoring_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("proctoring_sessions.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default=SEVERITY_MEDIUM)
    reason: Mapped[str | None] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    remaining_seconds: Mapped[int | None] = mapped_column(Integer)
    detail: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    session = relationship("ProctoringSession", back_populates="events")

    __table_args__ = (
        CheckConstraint(_EVENT_TYPE_CHECK, name="ck_proctoring_events_event_type"),
        CheckConstraint(_SEVERITY_CHECK, name="ck_proctoring_events_severity"),
    )
