from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PlacementRecord(Base):
    __tablename__ = "placement_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    college_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("colleges.id", ondelete="CASCADE"), nullable=True, index=True
    )
    course_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=True
    )
    branch: Mapped[str | None] = mapped_column(String(100), nullable=True)
    academic_year: Mapped[str] = mapped_column(String(20), index=True)
    total_graduating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_placed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    placement_percentage: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    students_higher_studies: Mapped[int | None] = mapped_column(Integer, nullable=True)
    median_salary_lpa: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    average_salary_lpa: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    highest_salary_lpa: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    lowest_salary_lpa: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    total_recruiters: Mapped[int | None] = mapped_column(Integer, nullable=True)
    top_recruiters: Mapped[list | None] = mapped_column(JSON, nullable=True)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    verified_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now, onupdate=datetime.now
    )

    college: Mapped["College | None"] = relationship()
    course: Mapped["Course | None"] = relationship()