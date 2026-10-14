from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SiteSetting(Base):
    """The one row of platform-wide configuration the admin console edits.

    ## Why a typed singleton and not a key/value table

    A `settings(key, value)` table forces a value type per key, so every read is
    an unchecked cast and every write is unvalidated text. The console edits a
    fixed, small set of fields that each have a natural column, so they get one:
    the schema can validate a support address as an address, the columns are
    non-null, and a typo cannot invent a new, invisible key that no code reads.
    Extending it is a migration plus a column -- the right amount of friction
    for something the whole public site publishes.

    ## The singleton is pinned, not merely intended

    ``id`` defaults to 1 and the router reads and writes ``db.get(SiteSetting,
    1)`` exclusively, so a second row can only appear by bypassing the API. The
    migration seeds that row, which is what lets ``GET`` be a pure read: a
    handler that lazily created its default would turn a read into a write, and
    make an anonymous cache miss look identical to a mutation.

    Seeded with the values the public site already publishes (see
    ``frontend/lib/site.ts``), so the console shows what visitors see rather
    than a second, drifting opinion.
    """

    __tablename__ = "site_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)

    site_name: Mapped[str] = mapped_column(String(120), default="padhaanewala")
    support_email: Mapped[str] = mapped_column(
        String(254), default="hello@padhaanewala.in"
    )
    contact_phone: Mapped[str] = mapped_column(String(30), default="+91 98765 43210")
    counselling_hours: Mapped[str] = mapped_column(
        String(120), default="Mon\u2013Sat, 9 AM \u2013 8 PM IST"
    )
    default_timezone: Mapped[str] = mapped_column(String(64), default="Asia/Kolkata")
    number_formatting: Mapped[str] = mapped_column(String(20), default="indian")

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now, onupdate=datetime.now
    )
