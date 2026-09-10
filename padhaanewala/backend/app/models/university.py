from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class University(Base):
    __tablename__ = "universities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    state_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("states.id", ondelete="SET NULL"), nullable=True
    )
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    type: Mapped[str] = mapped_column(String(50), default="university")
    is_deemed: Mapped[bool] = mapped_column(Boolean, default=False)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now
    )

    colleges: Mapped[list["College"]] = relationship(back_populates="university")