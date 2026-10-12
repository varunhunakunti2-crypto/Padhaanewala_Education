from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

#: The timezones the console offers. A closed set rather than free text because
#: the value formats every timestamp the site renders; a typo'd zone is not an
#: error anywhere downstream, it is a silently wrong time.
Timezone = Literal["Asia/Kolkata", "UTC"]

#: ``indian`` renders ₹1,23,456 / 1.2 lakh; ``international`` renders
#: $123,456 / 1.2M. Stored as a stable key and labelled in the UI, so the label
#: can be reworded without a data migration.
NumberFormatting = Literal["indian", "international"]


class SiteSettingsResponse(BaseModel):
    """The stored values.

    ``default_timezone`` and ``number_formatting`` are typed as ``str`` rather
    than the ``Literal`` aliases on purpose: the columns are plain ``String``, so
    a row written before a future constraint change must still *read* instead of
    raising on the way out of the database.
    """

    model_config = ConfigDict(from_attributes=True)

    site_name: str
    support_email: str
    contact_phone: str
    counselling_hours: str
    default_timezone: str
    number_formatting: str
    updated_at: datetime


class SiteSettingsUpdate(BaseModel):
    """A partial update: only the fields the console actually changed.

    Every field is optional so the panel can send a one-field diff, and the
    router applies ``exclude_unset=True`` -- an absent field is left alone rather
    than blanked by omission.

    ``extra="forbid"`` so a stale client that posts ``id`` or ``updated_at`` is
    told so (422) instead of having them quietly ignored.
    """

    model_config = ConfigDict(extra="forbid")

    site_name: str | None = Field(None, min_length=1, max_length=120)
    support_email: EmailStr | None = None
    contact_phone: str | None = Field(None, min_length=5, max_length=30)
    counselling_hours: str | None = Field(None, min_length=1, max_length=120)
    default_timezone: Timezone | None = None
    number_formatting: NumberFormatting | None = None

    @field_validator("site_name", "contact_phone", "counselling_hours")
    @classmethod
    def _reject_blank(cls, value: str | None) -> str | None:
        # ``min_length=1`` counts whitespace, so ``"   "`` would pass it and
        # store a value that renders as nothing. Strip first, then refuse empty.
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped
