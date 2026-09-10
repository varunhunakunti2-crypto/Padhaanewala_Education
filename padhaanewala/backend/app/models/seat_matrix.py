from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SeatMatrix(Base):
    __tablename__ = "seat_matrix"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    college_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("colleges.id", ondelete="CASCADE"), nullable=True, index=True
    )
    course_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("courses.id", ondelete="CASCADE"), nullable=True, index=True
    )
    branch: Mapped[str | None] = mapped_column(String(100), nullable=True)
    exam: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    total_seats: Mapped[int | None] = mapped_column(Integer, nullable=True)
    general_seats: Mapped[int | None] = mapped_column(Integer, nullable=True)
    obc_seats: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sc_seats: Mapped[int | None] = mapped_column(Integer, nullable=True)
    st_seats: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ews_seats: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pwd_seats: Mapped[int | None] = mapped_column(Integer, nullable=True)
    female_supernumerary: Mapped[int | None] = mapped_column(Integer, nullable=True)
    home_state_quota: Mapped[int | None] = mapped_column(Integer, nullable=True)
    all_india_quota: Mapped[int | None] = mapped_column(Integer, nullable=True)
    management_quota: Mapped[int | None] = mapped_column(Integer, nullable=True)
    year: Mapped[int] = mapped_column(Integer, index=True)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.now)

    college: Mapped["College | None"] = relationship()
    course: Mapped["Course | None"] = relationship()