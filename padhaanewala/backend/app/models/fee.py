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
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Fee(Base):
    __tablename__ = "fees"
    __table_args__ = (
        UniqueConstraint(
            "college_course_id", "academic_year", name="uq_fee_college_course_year"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    college_course_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("college_courses.id", ondelete="CASCADE"), index=True
    )
    tuition_fee: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    hostel_fee: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    examination_fee: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    other_charges: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    total_approximate: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    fee_period: Mapped[str | None] = mapped_column(String(50), nullable=True)
    academic_year: Mapped[str] = mapped_column(String(20), index=True)
    is_approximate: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now
    )