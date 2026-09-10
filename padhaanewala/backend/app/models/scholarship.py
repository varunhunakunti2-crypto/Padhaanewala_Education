from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Scholarship(Base):
    __tablename__ = "scholarships"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    provider: Mapped[str] = mapped_column(String(255), index=True)
    ownership: Mapped[str] = mapped_column(String(20), default="government")
    eligibility: Mapped[str | None] = mapped_column(Text, nullable=True)
    state_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("states.id", ondelete="SET NULL"), nullable=True, index=True
    )
    course: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    income_criteria: Mapped[str | None] = mapped_column(String(255), nullable=True)
    amount: Mapped[str | None] = mapped_column(String(255), nullable=True)
    application_deadline: Mapped[date | None] = mapped_column(
        Date, nullable=True, index=True
    )
    documents_required: Mapped[list | None] = mapped_column(JSON, nullable=True)
    application_procedure: Mapped[str | None] = mapped_column(Text, nullable=True)
    official_website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    verification_status: Mapped[str] = mapped_column(String(20), default="unverified")
    last_verified_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    next_verification_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now, onupdate=datetime.now
    )

    state: Mapped["State | None"] = relationship()