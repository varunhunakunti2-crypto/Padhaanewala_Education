from datetime import date, datetime

from sqlalchemy import (
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


class Enquiry(Base):
    __tablename__ = "enquiries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("student_profiles.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255))
    mobile: Mapped[str] = mapped_column(String(20), index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    course_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("courses.id", ondelete="SET NULL"), nullable=True
    )
    college_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("colleges.id", ondelete="SET NULL"), nullable=True, index=True
    )
    state_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("states.id", ondelete="SET NULL"), nullable=True
    )
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    qualification: Mapped[str | None] = mapped_column(String(100), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    utm_source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    utm_medium: Mapped[str | None] = mapped_column(String(100), nullable=True)
    utm_campaign: Mapped[str | None] = mapped_column(String(100), nullable=True)
    utm_content: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    device_type: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # --- Phase 9.1 ---------------------------------------------------------
    #
    # This endpoint needs no account, so it is the widest collector of minors'
    # personal data on the whole site: a name, a mobile number, an optional email,
    # a course, a location and a free-text message, submitted by whoever wants a
    # callback. The account-side age gate does not reach it, so the age has to be
    # declared here too.
    #
    # `is_minor` is derived from `age_band` and indexed so the CRM can answer
    # "which leads are children" without scanning every row — a counsellor
    # calling a lead who is 15 has to know that before the call, not after.
    age_band: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    is_minor: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    #: A parent or guardian's phone or email for a minor's enquiry. Required by
    #: the schema when `age_band` is `under_18`: the call has to be placed to an
    #: adult, and the record has to show whose authority the call was made under.
    guardian_contact: Mapped[str | None] = mapped_column(String(255), nullable=True)

    status: Mapped[str] = mapped_column(String(30), default="new", index=True)
    assigned_counsellor_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("counsellors.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    follow_up_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now, onupdate=datetime.now
    )

    college: Mapped["College | None"] = relationship()
    course: Mapped["Course | None"] = relationship()
    state: Mapped["State | None"] = relationship()
    counsellor: Mapped["Counsellor | None"] = relationship()
    student_profile: Mapped["StudentProfile | None"] = relationship()
    lead_notes: Mapped[list["LeadNote"]] = relationship(back_populates="enquiry")
    status_history: Mapped[list["LeadStatusHistory"]] = relationship(back_populates="enquiry")


class LeadNote(Base):
    __tablename__ = "lead_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    enquiry_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("enquiries.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    note: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.now)

    enquiry: Mapped["Enquiry"] = relationship(back_populates="lead_notes")


class LeadStatusHistory(Base):
    __tablename__ = "lead_status_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    enquiry_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("enquiries.id", ondelete="CASCADE"), index=True
    )
    old_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    new_status: Mapped[str] = mapped_column(String(30))
    changed_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.now)

    enquiry: Mapped["Enquiry"] = relationship(back_populates="status_history")