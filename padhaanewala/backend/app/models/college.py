from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class College(Base):
    __tablename__ = "colleges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    college_id: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    official_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    college_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ownership: Mapped[str | None] = mapped_column(String(50), nullable=True)
    university_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("universities.id", ondelete="SET NULL"), nullable=True
    )
    state_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("states.id", ondelete="SET NULL"), nullable=True
    )
    district_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("districts.id", ondelete="SET NULL"), nullable=True
    )
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    pincode: Mapped[str | None] = mapped_column(String(10), nullable=True)
    lat: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    lng: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    established_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    accreditation_naac: Mapped[str | None] = mapped_column(String(20), nullable=True)
    accreditation_nba: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    overview: Mapped[str | None] = mapped_column(Text, nullable=True)
    facilities: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    has_hostel: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    hostel_facilities: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    total_reviews: Mapped[int] = mapped_column(Integer, default=0)
    average_rating: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=0)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    verification_status: Mapped[str] = mapped_column(
        String(20), default="unverified"
    )
    last_verified_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now, onupdate=datetime.now
    )

    university: Mapped["University | None"] = relationship(back_populates="colleges")
    state: Mapped["State | None"] = relationship(back_populates="colleges")
    district: Mapped["District | None"] = relationship(back_populates="colleges")
    college_courses: Mapped[list["CollegeCourse"]] = relationship(
        back_populates="college"
    )