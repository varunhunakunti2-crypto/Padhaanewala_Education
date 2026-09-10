from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SavedCollege(Base):
    __tablename__ = "saved_colleges"
    __table_args__ = (
        UniqueConstraint("student_id", "college_id", name="uq_saved_college_student"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("student_profiles.id", ondelete="CASCADE"), index=True
    )
    college_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("colleges.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.now)

    college: Mapped["College"] = relationship()
    student_profile: Mapped["StudentProfile"] = relationship()