from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Cutoff(Base):
    __tablename__ = "cutoffs"
    __table_args__ = (
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
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    college_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("colleges.id", ondelete="CASCADE"), nullable=True, index=True
    )
    course_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=True, index=True
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