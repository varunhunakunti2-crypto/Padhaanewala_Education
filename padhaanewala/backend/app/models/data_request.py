"""Data-principal requests and the clock that governs them.

Section 8(5)-(6) of the DPDP Act, 2023 and the DPDP Rules, 2025 give a data
principal the right to ask for access to, correction of, erasure of, and
withdrawal of consent for their personal data, and oblige the Data Fiduciary to
answer *within 90 days*. That deadline is not a target — exceeding it is the
failure being penalised — so it is a stored, indexed column rather than something
a human remembers to check.

`due_at` is computed once, at intake, from `received_at`. Deriving it on read
instead would make the deadline move every time a request is touched, and a
deadline that moves when you look at it is not a deadline.

Status is a workflow, not a boolean, because an unanswered request and a refused
one are different obligations: `completed` and `rejected` both end the clock,
`received` / `acknowledged` / `in_progress` do not.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

#: DPDP Rules, 2025 — a data-principal request must be answered within 90 days.
#: Named here rather than read from settings because it is a statutory constant:
#: making it configurable would invite somebody to configure it wrong.
DATA_REQUEST_SLA_DAYS = 90

#: Statutory response types. `nomination` (DPDP s.12) is included because the Act
#: gives a data principal the right to nominate another person to exercise these
#: rights on their behalf, and a request channel that cannot record a nomination
#: cannot answer one.
REQUEST_TYPES = frozenset(
    {
        "access",
        "correction",
        "erasure",
        "withdrawal",
        "grievance",
        "nomination",
    }
)

#: Statuses that close the request. Anything else leaves the 90-day clock running.
TERMINAL_STATUSES = frozenset({"completed", "rejected"})

OPEN_STATUSES = frozenset({"received", "acknowledged", "in_progress"})


def sla_due_at(received_at: datetime) -> datetime:
    """The statutory deadline for a request received at `received_at`."""
    return received_at + timedelta(days=DATA_REQUEST_SLA_DAYS)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class DataRequest(Base):
    __tablename__ = "data_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    request_type: Mapped[str] = mapped_column(String(30), index=True)
    status: Mapped[str] = mapped_column(String(20), default="received", index=True)
    #: Short restatement of the request, in the data principal's own framing.
    subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    details: Mapped[str] = mapped_column(Text)

    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_now, index=True
    )
    acknowledged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    resolution: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: The staff member who closed it. SET NULL rather than CASCADE because an
    #: audit row that disappears when its actor is deleted is not an audit row.
    handled_by_user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    __table_args__ = (
        # The queue view is "my open requests, oldest first" — which is exactly
        # the order that surfaces the ones closest to breaching.
        Index("ix_data_requests_user_status", "user_id", "status"),
        Index("ix_data_requests_status_due", "status", "due_at"),
    )

    user: Mapped["User"] = relationship(
        back_populates="data_requests", foreign_keys=[user_id]
    )
    #: The staff member who closed it. A separate relationship rather than a
    #: second name on `user`, because both columns point at `users.id` and
    #: SQLAlchemy cannot pick between them without being told which is which.
    handled_by: Mapped["User | None"] = relationship(foreign_keys=[handled_by_user_id])
