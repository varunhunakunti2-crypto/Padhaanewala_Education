from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Exam(Base):
    __tablename__ = "exams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    conducting_authority: Mapped[str] = mapped_column(String(255), index=True)
    exam_type: Mapped[str] = mapped_column(String(50), default="national", index=True)
    eligibility: Mapped[str | None] = mapped_column(Text, nullable=True)
    application_start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    application_deadline: Mapped[date | None] = mapped_column(
        Date, nullable=True, index=True
    )
    exam_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    admit_card_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    result_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    official_website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    official_notification: Mapped[str | None] = mapped_column(String(255), nullable=True)
    syllabus: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    faqs: Mapped[list | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now, onupdate=datetime.now
    )