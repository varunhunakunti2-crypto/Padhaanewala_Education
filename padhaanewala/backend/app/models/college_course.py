from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CollegeCourse(Base):
    __tablename__ = "college_courses"
    __table_args__ = (
        UniqueConstraint("college_id", "course_id", name="uq_college_course"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    college_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("colleges.id", ondelete="CASCADE"), index=True
    )
    course_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("courses.id", ondelete="CASCADE"), index=True
    )
    annual_fee: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    total_fee: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    intake_seats: Mapped[int | None] = mapped_column(Integer, nullable=True)
    admission_mode: Mapped[str | None] = mapped_column(String(50), nullable=True)
    entrance_exam: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now, onupdate=datetime.now
    )

    college: Mapped["College"] = relationship(back_populates="college_courses")
    course: Mapped["Course"] = relationship(back_populates="college_courses")