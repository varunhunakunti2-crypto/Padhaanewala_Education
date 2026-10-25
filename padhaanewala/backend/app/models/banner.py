from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Banner(Base):
    """A promotional card the admin console places at a named position.

    ``position`` is a free string so a new slot on the public site needs no
    migration; the two in use today are ``home_top`` (the classic homepage
    strip) and ``hero_card`` (the floating cards beside the hero search).
    ``hero_card`` rows carry ``subtitle`` — the small CTA line under the
    title ("Find opportunities") — which the strip layout never renders,
    hence nullable rather than a second table.

    The three ``hero_card`` rows the public hero shipped with were seeded by
    migration ``a3f8d21c9b47``, so the console shows what visitors see
    instead of an empty panel over a hardcoded page.
    """

    __tablename__ = "banners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    #: CTA line under the title, rendered only by the ``hero_card`` layout.
    subtitle: Mapped[str | None] = mapped_column(String(120), nullable=True)
    image_url: Mapped[str] = mapped_column(String(500))
    link_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    position: Mapped[str] = mapped_column(String(50), default="home_top")
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now, onupdate=datetime.now
    )