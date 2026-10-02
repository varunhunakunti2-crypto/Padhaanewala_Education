"""Verifiable parental consent for users known to be under 18.

Section 9(2) of the DPDP Act, 2023 requires that where processing a child's
personal data is permitted because a parent or guardian has consented, that
consent must be *verifiable*. A checkbox the child ticks, or a self-declared
guardian name typed into a form, satisfies nothing: both are assertions by the
very party whose age is in question.

So this table records a verification that actually happened. A row only reaches
`verified` after a one-time code was delivered to the guardian's own contact
channel and read back — the mechanism is `otp_records` with
`purpose = "guardian_consent"`, which already hashes the secret, caps sends per
identifier, caps verification attempts and expires the code.

`status` is a lifecycle rather than a boolean, because the interesting states are
the ones between "asked" and "yes":

    pending  → a code was sent to the guardian and is awaiting read-back
    verified → the code was read back; processing is permitted
    denied   → the guardian declined, or the code could not be delivered
    withdrawn → consent was later revoked (a separate `withdrawn_at`, never an
                overwrite — revocation history is itself the compliance record)
    expired  → verified, then past `expires_at` without re-confirmation

Rows are never deleted. Withdrawing consent stops processing immediately; it does
not erase the fact that consent was once given, which is what an auditor asks for.
"""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

#: Statuses that mean "the guardian has not currently authorised processing".
UNVERIFIED_STATUSES = frozenset({"pending", "denied", "expired", "withdrawn"})


class GuardianConsent(Base):
    __tablename__ = "guardian_consents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    guardian_name: Mapped[str] = mapped_column(String(255))
    guardian_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    guardian_mobile: Mapped[str | None] = mapped_column(String(20), nullable=True)

    #: Which channel carried the code: "sms" or "email". Kept as a separate
    #: column from the contact fields because exactly one of those two is the
    #: verified identity, and which one is part of the audit answer.
    verification_channel: Mapped[str] = mapped_column(String(20))
    #: The normalised address or number the code was actually sent to. Stored so
    #: the record can be reconciled against `otp_records.identifier` without
    #: re-deriving the normalisation rules.
    verification_target: Mapped[str] = mapped_column(String(255), index=True)

    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    consent_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    #: Verbatim copy the guardian agreed to. A consent record whose text drifts
    #: from what was actually shown is not evidence of anything.
    consent_text: Mapped[str] = mapped_column(Text)

    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    withdrawn_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    #: Verified consent lapses rather than running forever. A parent who agreed
    #: two years ago has not agreed to whatever the product collects now.
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    request_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        # Every status read in the request path is "the live row for this user,
        # newest first". Without this that is a scan of every consent the account
        # has ever had.
        Index(
            "ix_guardian_consents_user_status",
            "user_id",
            "status",
        ),
    )

    user: Mapped["User"] = relationship(back_populates="guardian_consents")
