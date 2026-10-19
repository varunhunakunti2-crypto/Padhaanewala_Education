"""Request/response schemas for the proctoring surface (Phases 49-53)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.proctoring import (
    EVENT_TYPES,
    SEVERITIES,
    SESSION_STATUSES,
)


class ProctoringSessionCreate(BaseModel):
    """Open a proctoring session for an attempt the caller owns."""

    attempt_id: int


class ProctoringEventIn(BaseModel):
    """One event as the client reports it.

    `occurred_at` is the client's wall-clock moment, not the server's receipt
    time: a violation that was queued during a network drop must be recorded
    when it happened, not when the flush succeeded.
    """

    event_type: str = Field(max_length=50)
    occurred_at: datetime
    severity: str = Field(default="medium", max_length=20)
    reason: str | None = Field(default=None, max_length=1000)
    remaining_seconds: int | None = None
    detail: dict | None = None


class ProctoringEventBatch(BaseModel):
    """A batch of events appended to one session."""

    events: list[ProctoringEventIn] = Field(min_length=1, max_length=200)


class ProctoringSessionEnd(BaseModel):
    """Close a proctoring session."""

    reason: str | None = Field(default=None, max_length=200)


class ProctoringEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_type: str
    severity: str
    reason: str | None
    occurred_at: datetime
    remaining_seconds: int | None
    detail: dict | None


class ProctoringSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    attempt_id: int
    user_id: int
    mock_test_id: int
    status: str
    started_at: datetime
    ended_at: datetime | None
    ended_reason: str | None


class ProctoringSessionDetail(ProctoringSessionResponse):
    """A session plus its events, for the student's own review and for staff."""

    events: list[ProctoringEventResponse] = []


class ProctoringSessionListResponse(BaseModel):
    """One page of proctoring sessions for the admin/proctor dashboard."""

    items: list[ProctoringSessionResponse]
    total: int


__all__ = [
    "EVENT_TYPES",
    "SEVERITIES",
    "SESSION_STATUSES",
    "ProctoringEventBatch",
    "ProctoringEventIn",
    "ProctoringEventResponse",
    "ProctoringSessionCreate",
    "ProctoringSessionDetail",
    "ProctoringSessionEnd",
    "ProctoringSessionListResponse",
    "ProctoringSessionResponse",
]
