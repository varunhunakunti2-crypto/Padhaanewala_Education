from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Cutoff(Base):
    __tablename__ = "cutoffs"
    __table_args__ = (
        # The legacy identity constraint. Kept for downgrade compatibility; it
        # cannot fire when any of its nullable columns is NULL (PostgreSQL
        # treats NULLs as distinct), which is exactly the duplicate case that
        # skews the predictor. The COALESCE index below is the real guard.
        UniqueConstraint(
            "college_id",
            "course_id",
            "branch",
            "exam_name",
            "year",
            "round",
            "quota",
            "category",
            name="uq_cutoff_identity",
        ),
        # Phase 4: functional unique index that collapses NULLs to unreachable
        # sentinels (ids start at 1; text columns are never the empty string),
        # so a duplicate cutoff row can no longer slip through on NULLs.
        Index(
            "uq_cutoff_identity_coalesce",
            text(
                "COALESCE(college_id, 0), COALESCE(course_id, 0), "
                "COALESCE(branch, ''), exam_name, year, "
                "COALESCE(\"round\", ''), COALESCE(quota, ''), category"
            ),
            unique=True,
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # SET NULL, not CASCADE. This row is a published historical fact (a real
    # cutoff from a real exam year) and it outlives any single college record:
    # correcting a college's name, or an admin deleting a duplicate entry, must
    # not delete a decade of rank history with it. Detaching keeps the fact and
    # marks it unattributed, which is recoverable; a cascade makes it
    # unrecoverable. Enquiry.college_id already works this way.
    college_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("colleges.id", ondelete="SET NULL"), nullable=True, index=True
    )
    course_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("courses.id", ondelete="SET NULL"), nullable=True, index=True
    )
    branch: Mapped[str | None] = mapped_column(String(100), nullable=True)
    exam_name: Mapped[str] = mapped_column(String(50), index=True)
    year: Mapped[int] = mapped_column(Integer, index=True)
    round: Mapped[str | None] = mapped_column(String(30), nullable=True)
    quota: Mapped[str | None] = mapped_column(String(30), nullable=True)
    category: Mapped[str] = mapped_column(String(30), index=True)
    opening_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    closing_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    opening_score: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    closing_score: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    verified_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.now)

    college: Mapped["College | None"] = relationship()
    course: Mapped["Course | None"] = relationship()