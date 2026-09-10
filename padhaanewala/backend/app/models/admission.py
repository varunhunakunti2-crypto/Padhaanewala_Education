from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Admission(Base):
    __tablename__ = "admissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    college_course_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("college_courses.id", ondelete="CASCADE"), index=True
    )
    admission_information: Mapped[str | None] = mapped_column(Text, nullable=True)
    eligibility_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    entrance_exam: Mapped[str | None] = mapped_column(String(100), nullable=True)
    application_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    application_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now, onupdate=datetime.now
    )