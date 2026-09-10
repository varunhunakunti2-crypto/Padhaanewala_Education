from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class State(Base):
    __tablename__ = "states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    code: Mapped[str] = mapped_column(String(10), unique=True, index=True)
    is_union_territory: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now
    )

    districts: Mapped[list["District"]] = relationship(back_populates="state")
    colleges: Mapped[list["College"]] = relationship(back_populates="state")


class District(Base):
    __tablename__ = "districts"
    __table_args__ = (
        UniqueConstraint("state_id", "name", name="uq_district_state_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    code: Mapped[str] = mapped_column(String(10), index=True)
    state_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("states.id", ondelete="CASCADE"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now
    )

    state: Mapped["State"] = relationship(back_populates="districts")
    cities: Mapped[list["City"]] = relationship(back_populates="district")
    colleges: Mapped[list["College"]] = relationship(back_populates="district")


class City(Base):
    __tablename__ = "cities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    district_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("districts.id", ondelete="CASCADE"), index=True
    )
    is_metropolitan: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now
    )

    district: Mapped["District"] = relationship(back_populates="cities")