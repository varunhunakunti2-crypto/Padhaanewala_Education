from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class OtpRecord(Base):
    """A single issued OTP or email verification/reset token.

    One table serves all four flows rather than four near-identical tables. The
    `purpose` column is what separates them, and every lookup in
    `app.services.otp_service` filters on `(purpose, identifier)`.

    The secret itself is never stored. `code_hash` holds a bcrypt digest, so a
    database leak does not hand an attacker a working OTP: guessing the
    remaining 10^6 possibilities of a 6-digit code is not feasible against
    bcrypt's work factor, and the row is marked consumed on first success so the
    same token cannot be replayed within its lifetime even if the digest leaked
    another way.
    """

    __tablename__ = "otp_records"

    # The rate limit is "N sends per window per identifier", and the verification
    # path always reads the newest unconsumed row for an identifier. Both are
    # served by this composite index; the unique name keeps the migration's
    # `op.create_index` call in step with the model.
    __table_args__ = (
        Index("ix_otp_records_purpose_identifier", "purpose", "identifier"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    #: Nullable because a passwordless login OTP is requested *before* we know
    #: which account it belongs to. Identity is established at verify time by
    #: matching `identifier` to a user.
    user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )

    #: One of `mobile_verification`, `login`, `email_verification`,
    #: `password_reset`.
    purpose: Mapped[str] = mapped_column(String(30), index=True)

    #: The destination the secret went to: a normalised mobile for SMS flows, a
    #: normalised email for link flows. Kept denormalised (rather than only a
    #: user_id) precisely so that the pre-authentication login flow can be
    #: rate-limited against a number that has no account yet.
    identifier: Mapped[str] = mapped_column(String(255), index=True)

    #: bcrypt digest of the OTP / link token. Never the plaintext.
    code_hash: Mapped[str] = mapped_column(String(255))

    #: Failed verification attempts. The caller refuses to check the code once
    #: this reaches `SMS_OTP_MAX_VERIFY_ATTEMPTS`, which bounds a 6-digit brute
    #: force to 5 guesses per issued OTP.
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    is_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    consumed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    #: Best-effort abuse attribution, mirroring `client_ip.py` usage elsewhere.
    request_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now, nullable=False
    )
