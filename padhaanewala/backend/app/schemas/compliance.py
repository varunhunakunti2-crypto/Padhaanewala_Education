"""Request and response shapes for the DPDP compliance surface.

Every model here is `extra="forbid"`. That is not defensive boilerplate: this
router exists to be the authoritative record of what a data principal agreed to,
and a schema that silently drops an unrecognised field would let a caller believe
they had recorded something the server threw away.
"""

from datetime import datetime
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

AgeBand = Literal["under_18", "18_plus"]

RequestType = Literal[
    "access", "correction", "erasure", "withdrawal", "grievance", "nomination"
]
RequestStatus = Literal[
    "received", "acknowledged", "in_progress", "completed", "rejected"
]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


# --------------------------------------------------------------- age gate


class AgeDeclareRequest(StrictModel):
    age_band: AgeBand


class AgeDeclareResponse(StrictModel):
    age_band: AgeBand | None
    is_minor: bool
    processing_allowed: bool
    blocked_reason: str | None = None
    blocked_message: str | None = None


# --------------------------------------------------------- parental consent


class GuardianConsentRequest(StrictModel):
    """Ask a guardian to confirm. The minor may submit this themselves.

    A name and a **mobile** number are required. Email alone is refused until
    there is an email OTP delivery path: `otp_service` can mint link tokens, but
    the guardian-consent router only knows how to send a code by SMS, so an
    email-only request would sit pending forever while looking like verifiable
    consent. An email address may still be recorded alongside the mobile.
    """

    guardian_name: str = Field(..., min_length=2, max_length=255)
    guardian_mobile: str | None = Field(default=None, min_length=10, max_length=15)
    guardian_email: EmailStr | None = None

    @field_validator("guardian_mobile")
    @classmethod
    def check_mobile(cls, value: str | None) -> str | None:
        if value is None:
            return None
        digits = "".join(ch for ch in value if ch.isdigit())
        if len(digits) == 12 and digits.startswith("91"):
            digits = digits[2:]
        if len(digits) != 10 or not digits.startswith(("6", "7", "8", "9")):
            raise ValueError("Guardian mobile must be a valid 10-digit Indian number")
        return digits

    @model_validator(mode="after")
    def require_a_verifiable_channel(self) -> "GuardianConsentRequest":
        if not self.guardian_mobile:
            raise ValueError(
                "A guardian mobile number is required: parental consent is "
                "verified by SMS, and an email-only request cannot be verified"
            )
        return self


class GuardianConsentVerifyBody(StrictModel):
    """The code read back from the guardian's handset."""

    code: str = Field(..., min_length=4, max_length=12)


class GuardianConsentResponse(StrictModel):
    id: int
    status: Literal["pending", "verified", "denied", "expired", "withdrawn"]
    verification_channel: str
    requested_at: datetime
    verified_at: datetime | None
    withdrawn_at: datetime | None
    expires_at: datetime
    consent_version: str | None


# ------------------------------------------------------ data-principal rights


class DataRequestCreate(StrictModel):
    request_type: RequestType
    subject: str | None = Field(default=None, max_length=255)
    details: str = Field(..., min_length=1, max_length=5000)


class DataRequestUpdate(StrictModel):
    status: RequestStatus
    resolution: str | None = Field(default=None, max_length=5000)


class DataRequestResponse(StrictModel):
    id: int
    request_type: RequestType
    status: RequestStatus
    subject: str | None
    details: str
    received_at: datetime
    acknowledged_at: datetime | None
    due_at: datetime
    completed_at: datetime | None
    resolution: str | None
    #: Days until the statutory deadline. Negative means overdue — surfaced as a
    #: number so the staff queue can sort on it and so a test can assert it
    #: without re-deriving the arithmetic.
    days_remaining: int
    overdue: bool

    model_config = ConfigDict(from_attributes=True)


# ------------------------------------------------------------- the gate state


class ComplianceStatusResponse(StrictModel):
    """The whole gate in one payload.

    The frontend needs all of it before it can decide what to render, and making
    it ask three questions to find out whether it should show a modal is how a
    gate ends up flashing the wrong state on first paint.
    """

    age_band: AgeBand | None
    is_minor: bool
    age_answered: bool
    processing_allowed: bool
    blocked_reason: str | None
    blocked_message: str | None
    parental_consent: GuardianConsentResponse | None
    sla_days: int
