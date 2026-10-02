"""The one place that answers "may we process this user's personal data?".

Section 9 of the DPDP Act, 2023 splits users into two groups that are treated
differently, and getting the split wrong is the expensive direction to be wrong
in — s.9(3) carries up to ₹200 crore:

* **Adults** (or a minor who has been declared 18+) may consent for themselves.
* **Minors** may only have their data processed on **verifiable** parental
  consent, and the guardian must be able to withdraw it.

This module holds that decision so it cannot be re-implemented per endpoint. The
alternative — each write path checking `user.is_minor` and then remembering to
also check the consent row — is the shape of bug that passes review, because each
individual check looks correct.

Two rules that are easy to get wrong and are therefore stated as code rather
than left to the caller:

1. **An unanswered age question is not consent.** `age_band is None` blocks
   personal-data writes for everyone. Reading "we don't know" as "adult" is how a
   gate becomes decorative.

2. **Consent has to be live, not merely present.** A verified row that has passed
   `expires_at`, or that has been withdrawn, blocks processing. A parent who
   agreed two years ago has not agreed to what the product collects now.

Staff accounts are exempt. A counsellor acting on a student's behalf under a
published legitimate purpose is acting as the Data Fiduciary, not as a data
principal, and gating staff on their own parental consent would lock the
grievance and deletion workflows that Phase 9 exists to make possible.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.guardian_consent import UNVERIFIED_STATUSES, GuardianConsent
from app.models.user import User

#: Age bands a user may declare. Anything else is rejected at the schema layer.
AGE_BAND_UNDER_18 = "under_18"
AGE_BAND_18_PLUS = "18_plus"
AGE_BANDS = frozenset({AGE_BAND_UNDER_18, AGE_BAND_18_PLUS})

#: Verbatim text a guardian agrees to. Versioned separately from the copy so
#: that a later rewrite of the wording does not retroactively change what an
#: earlier consent was given against.
GUARDIAN_CONSENT_VERSION = "v1"

GUARDIAN_CONSENT_TEXT = (
    "I am the parent or legal guardian of the user of this account. I consent to "
    "Padhaanewala processing that user's personal data — including their name, "
    "email address, mobile number, course and location preferences, and their "
    "activity on the site — for the purpose of providing college discovery, "
    "entrance-exam preparation and admission-support services. I understand I may "
    "withdraw this consent at any time, and that withdrawing it stops processing "
    "and requires deletion of the personal data held."
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime) -> datetime:
    """Coerce a naive datetime to UTC.

    `DateTime(timezone=True)` returns an aware value from PostgreSQL, but a naive
    one if the row was written through a driver that drops the offset. Comparing
    the two raises `TypeError`, and this comparison decides whether a child may
    be processed — so it must not be the thing that 500s.
    """
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def apply_age_band(user: User, age_band: str) -> None:
    """Set the declared band and derive `is_minor` from it.

    `is_minor` is written here and nowhere else. Two places deriving it would be
    two places able to disagree, and the disagreement would be invisible.
    """
    user.age_band = age_band
    user.is_minor = age_band == AGE_BAND_UNDER_18


def latest_consent(db: Session, user_id: int) -> GuardianConsent | None:
    """The most recently created consent row for this user, if any."""
    return db.scalars(
        select(GuardianConsent)
        .where(GuardianConsent.user_id == user_id)
        .order_by(GuardianConsent.id.desc())
        .limit(1)
    ).first()


def is_consent_live(consent: GuardianConsent | None, *, now: datetime | None = None) -> bool:
    """True only while a verified consent is inside its own validity window."""
    if consent is None or consent.status in UNVERIFIED_STATUSES:
        return False
    if consent.status != "verified":
        return False
    if consent.verified_at is None:
        # Defensive. A `verified` row with no timestamp could not have been
        # produced by the request path, but treating it as live would mean an
        # unverifiable consent grants processing.
        return False
    moment = now or _now()
    return _as_utc(consent.expires_at) > moment


@dataclass(frozen=True)
class ProcessingDecision:
    """Why processing is or is not permitted, in words a 403 can carry."""

    allowed: bool
    #: Machine-readable reason, e.g. `parental_consent_required`.
    code: str
    #: What the caller should tell the user, and what the UI keys off.
    message: str

    @property
    def reason_code(self) -> str:
        return self.code


ALLOWED = ProcessingDecision(
    allowed=True,
    code="ok",
    message="Personal data processing is permitted.",
)


def decide_processing(db: Session, user: User, *, now: datetime | None = None) -> ProcessingDecision:
    """The single authority on whether this user's personal data may be processed."""
    moment = now or _now()

    # Staff are not data principals of the platform's own records; see module doc.
    if user.roles and any(role.name != "student" for role in user.roles):
        return ALLOWED

    if user.age_band is None:
        return ProcessingDecision(
            allowed=False,
            code="age_verification_required",
            message=(
                "Confirm your age before we process your personal data. "
                "This is required by the Digital Personal Data Protection Act, 2023."
            ),
        )

    if not user.is_minor:
        return ALLOWED

    consent = latest_consent(db, user.id)
    if is_consent_live(consent, now=moment):
        return ALLOWED

    if consent is not None and consent.status == "expired":
        return ProcessingDecision(
            allowed=False,
            code="parental_consent_expired",
            message=(
                "Your guardian's consent has expired and needs to be given again "
                "before we can keep processing your personal data."
            ),
        )
    if consent is not None and consent.status == "withdrawn":
        return ProcessingDecision(
            allowed=False,
            code="parental_consent_withdrawn",
            message=(
                "Your guardian withdrew consent. We have stopped processing your "
                "personal data."
            ),
        )
    if consent is not None and consent.status == "pending":
        return ProcessingDecision(
            allowed=False,
            code="parental_consent_pending",
            message=(
                "We have sent a verification code to your parent or guardian. "
                "Your account becomes usable once they confirm it."
            ),
        )
    return ProcessingDecision(
        allowed=False,
        code="parental_consent_required",
        message=(
            "Because you told us you are under 18, a parent or guardian has to "
            "give verifiable consent before we can process your personal data."
        ),
    )


def gate_snapshot(db: Session, user: User, *, now: datetime | None = None) -> dict:
    """Everything the client needs to render the right gate, in one payload.

    Returned as a plain dict rather than a Pydantic model because it is assembled
    from three sources (the user row, the consent table and the derived decision)
    and is consumed directly by `ProcessingDecision`-free frontend code.
    """
    moment = now or _now()
    consent = latest_consent(db, user.id)
    decision = decide_processing(db, user, now=moment)

    return {
        "age_band": user.age_band,
        "is_minor": bool(user.is_minor),
        "age_answered": user.age_band is not None,
        "processing_allowed": decision.allowed,
        "blocked_reason": None if decision.allowed else decision.code,
        "blocked_message": None if decision.allowed else decision.message,
        "parental_consent": (
            None
            if consent is None
            else {
                "id": consent.id,
                "status": consent.status,
                "verification_channel": consent.verification_channel,
                "requested_at": consent.requested_at,
                "verified_at": consent.verified_at,
                "withdrawn_at": consent.withdrawn_at,
                "expires_at": consent.expires_at,
                "consent_version": consent.consent_version,
            }
        ),
    }
