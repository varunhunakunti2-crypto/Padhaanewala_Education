"""OTP and email-token lifecycle: issue, verify, expire, rate limit.

This module owns every rule that makes a one-time secret safe to hand to a
student over SMS or email. It is deliberately provider-agnostic — callers pair
it with `sms_service` / `email_service`, and neither of those imports this.

The rules, and why each exists:

* **The secret is never stored.** `OtpRecord.code_hash` holds a bcrypt digest.
  A 6-digit code has 10^6 possible values, which is a *tiny* search space;
  hashing is what stops a database read from being a finished attack.
* **Issuing supersedes.** A new code for an identifier invalidates any earlier
  unconsumed code, so an intercepted first SMS is not a lasting credential.
* **Sending is rate limited per identifier**, not per IP, because the abuse
  being stopped is SMS toll fraud against a known number.
* **Verification is attempt limited per issued code**, so 10^6 possibilities
  cannot be walked through by requesting one code and grinding it.
* **Expiry is enforced on read, not by a sweeper**, so correctness never depends
  on a background job having run.
"""

from __future__ import annotations

import hashlib
import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.config import settings
from app.models.otp_record import OtpRecord
from app.utils.security import pwd_context

logger = logging.getLogger(__name__)

# --- purposes ---------------------------------------------------------------
# Kept as plain strings to match the DB column; the Literal documents intent.
MOBILE_VERIFICATION = "mobile_verification"
LOGIN = "login"
EMAIL_VERIFICATION = "email_verification"
PASSWORD_RESET = "password_reset"

OtpPurpose = str

#: Purposes whose secret is a 6-digit number. The other two carry a random URL
#: token inside a link instead.
SMS_PURPOSES = frozenset({MOBILE_VERIFICATION, LOGIN})

#: bcrypt's input is capped at 72 bytes; well clear of a 6-digit code or a
#: 43-character `token_urlsafe(32)`.
_LINK_TOKEN_BYTES = 32


class OtpError(Exception):
    """Base class. `code` is the HTTP status the router should surface."""

    code = 400


class OtpRateLimited(OtpError):
    """Too many sends for this identifier inside the window."""

    code = 429


class OtpNotFound(OtpError):
    """No live code exists for this purpose+identifier.

    Note this is also what an *expired* code looks like from the caller's side
    unless the caller checks `OtpExpired` first, so the router must not map it to
    a message that distinguishes the two.
    """

    code = 400


class OtpExpired(OtpError):
    code = 400


class OtpLocked(OtpError):
    """Too many failed attempts against a single issued code."""

    code = 429


class OtpInvalid(OtpError):
    """The code did not match. The attempt has been counted."""

    code = 400


@dataclass(frozen=True)
class IssuedSecret:
    """A freshly minted secret and the record that will govern its use.

    `secret` is plaintext and exists only long enough to be handed to a delivery
    provider. It is never persisted and never returned from an endpoint.
    """

    record: OtpRecord
    secret: str
    expires_in_seconds: int


def _now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def normalize_mobile(mobile: str) -> str:
    """Reduce a mobile to the 10 national digits used as the identity key.

    The same number can arrive as `+91 98765 43210`, `919876543210` or
    `9876543210`. All three must share one rate-limit bucket, otherwise the
    limit is trivially bypassed by varying the format.
    """
    digits = "".join(ch for ch in mobile if ch.isdigit())
    if len(digits) == 12 and digits.startswith("91"):
        return digits[2:]
    return digits


def normalize_identifier(purpose: OtpPurpose, value: str) -> str:
    if purpose in SMS_PURPOSES:
        return normalize_mobile(value)
    return normalize_email(value)


def generate_otp(length: int | None = None) -> str:
    """A numeric OTP, drawn from `secrets` (CSPRNG), with no modulo bias.

    `secrets.randbelow(10**n)` would also be unbiased, but this form keeps a
    leading zero, which matters because the UI renders six separate boxes.
    """
    size = length or settings.SMS_OTP_LENGTH
    return "".join(secrets.choice("0123456789") for _ in range(size))


def generate_link_token() -> str:
    """A high-entropy token for an email verification / reset link."""
    return secrets.token_urlsafe(_LINK_TOKEN_BYTES)


def _hash(secret: str) -> str:
    return pwd_context.hash(secret)


def _secret_matches(record: OtpRecord, secret: str) -> bool:
    try:
        return pwd_context.verify(secret, record.code_hash)
    except ValueError:
        # A malformed digest (hand-edited row, or a hash from an older scheme)
        # must read as "no match", never as a 500 on the login path.
        return False


def sends_in_window(db: Session, purpose: OtpPurpose, identifier: str) -> int:
    """How many codes were issued for this identifier inside the rate window."""
    since = _now() - timedelta(minutes=settings.SMS_OTP_RATE_WINDOW_MINUTES)
    return db.scalar(
        select(func.count())
        .select_from(OtpRecord)
        .where(
            OtpRecord.purpose == purpose,
            OtpRecord.identifier == identifier,
            OtpRecord.created_at >= since,
        )
    ) or 0


def is_rate_limited(db: Session, purpose: OtpPurpose, identifier: str) -> bool:
    return sends_in_window(db, purpose, identifier) >= settings.SMS_OTP_MAX_SENDS_PER_WINDOW


def _supersede_prior(db: Session, purpose: OtpPurpose, identifier: str) -> None:
    """Void earlier live codes for this identifier.

    Without this, a student who requests a resend would still have two valid
    codes, so intercepting either one is enough — which defeats the point of
    sending a second.
    """
    for record in db.scalars(
        select(OtpRecord).where(
            OtpRecord.purpose == purpose,
            OtpRecord.identifier == identifier,
            OtpRecord.is_used.is_(False),
        )
    ):
        record.is_used = True
        record.consumed_at = _now()


def _prune(db: Session, purpose: OtpPurpose, identifier: str) -> None:
    """Drop fully dead rows for this identifier.

    Opportunistic and deliberately narrow: only rows that are both used and long
    expired are removed, so the table does not grow without bound while never
    touching a row that could still be verified.
    """
    cutoff = _now() - timedelta(days=1)
    db.query(OtpRecord).filter(
        OtpRecord.purpose == purpose,
        OtpRecord.identifier == identifier,
        OtpRecord.is_used.is_(True),
        OtpRecord.expires_at < cutoff,
    ).delete(synchronize_session=False)


def _advisory_key(purpose: OtpPurpose, identifier: str) -> int:
    """A stable signed 64-bit lock key for one (purpose, identifier) pair.

    Must be identical in every worker process, so this uses blake2b rather than
    `hash()`: Python randomises string hashing per process by default
    (PYTHONHASHSEED), and a per-process key would hand every worker its own lock
    — silently restoring exactly the race this is here to close.
    """
    digest = hashlib.blake2b(
        f"{purpose}:{identifier}".encode("utf-8"), digest_size=8
    ).digest()
    key = int.from_bytes(digest, "big")
    # Postgres bigint is signed; fold the top half down so the value is
    # representable rather than overflowing on the way in.
    return key - (1 << 64) if key >= (1 << 63) else key


def _lock_identifier(db: Session, purpose: OtpPurpose, identifier: str) -> None:
    """Serialise concurrent `issue` calls for a single identifier.

    The send cap is a count-then-insert, which is only atomic if nothing else can
    run between the read and the write. Without this, four simultaneous requests
    for the same number all read `count == 2`, all pass the check, and all
    insert — so the cap of 3 is really a cap of however many requests happen to
    overlap. That is exactly the shape of a toll-fraud burst, which is the abuse
    the limit exists to stop.

    `pg_advisory_xact_lock` is held until the enclosing transaction ends, so the
    second request blocks here, then re-reads a count that already includes the
    first and is correctly rejected. It is transaction-scoped rather than
    session-scoped so it cannot leak if the session is reused.

    No-op on other dialects: the test suite runs SQLite, whose database-level
    write lock already serialises these writers, and there is no portable
    equivalent to advisory locks.
    """
    try:
        bind = db.get_bind()
    except Exception:  # pragma: no cover - only if called outside a context
        return
    if bind is None or bind.dialect.name != "postgresql":
        return
    db.execute(
        text("SELECT pg_advisory_xact_lock(:key)"), {"key": _advisory_key(purpose, identifier)}
    )


def issue(
    db: Session,
    *,
    purpose: OtpPurpose,
    identifier: str,
    user_id: int | None = None,
    request_ip: str | None = None,
    ttl_seconds: int | None = None,
) -> IssuedSecret:
    """Mint, hash and record a new secret for `identifier`.

    Raises `OtpRateLimited` if the per-identifier send limit is already hit. The
    count and the insert are made atomic by `_lock_identifier`, so concurrent
    requests for the same identifier cannot collectively exceed the cap; callers
    should catch `OtpRateLimited` and surface 429.
    """
    identifier = normalize_identifier(purpose, identifier)

    if purpose in SMS_PURPOSES:
        _lock_identifier(db, purpose, identifier)
        if is_rate_limited(db, purpose, identifier):
            raise OtpRateLimited(
                f"Too many codes requested. Try again in "
                f"{settings.SMS_OTP_RATE_WINDOW_MINUTES} minutes."
            )

    secret = generate_otp() if purpose in SMS_PURPOSES else generate_link_token()
    ttl = ttl_seconds or (
        settings.SMS_OTP_TTL_SECONDS
        if purpose in SMS_PURPOSES
        else settings.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES * 60
    )

    _supersede_prior(db, purpose, identifier)
    _prune(db, purpose, identifier)

    record = OtpRecord(
        user_id=user_id,
        purpose=purpose,
        identifier=identifier,
        code_hash=_hash(secret),
        attempts=0,
        is_used=False,
        expires_at=_now() + timedelta(seconds=ttl),
        request_ip=request_ip,
        # Set explicitly rather than left to the column default, which is naive
        # local time; the rate-limit window is computed in UTC and a skewed
        # `created_at` would silently widen or narrow it.
        created_at=_now(),
    )
    db.add(record)
    # A link arrives carrying nothing but the token, and a bcrypt digest cannot
    # be located by equality — so the row id has to be known before the link is
    # built. `flush` assigns it without committing; only the id is public (the
    # token itself is still required, and the id alone verifies nothing).
    db.flush()

    if purpose not in SMS_PURPOSES:
        secret = f"{record.id}.{secret}"

    db.commit()
    db.refresh(record)


    logger.info(
        "Issued %s code for %s (user_id=%s), expires in %ss",
        purpose,
        identifier,
        user_id,
        ttl,
    )
    return IssuedSecret(record=record, secret=secret, expires_in_seconds=ttl)


def _latest_live(db: Session, purpose: OtpPurpose, identifier: str) -> OtpRecord | None:
    return db.scalars(
        select(OtpRecord)
        .where(
            OtpRecord.purpose == purpose,
            OtpRecord.identifier == identifier,
            OtpRecord.is_used.is_(False),
        )
        .order_by(OtpRecord.created_at.desc(), OtpRecord.id.desc())
        .limit(1)
    ).first()


def _check_and_consume(db: Session, record: OtpRecord, secret: str) -> OtpRecord:
    """Shared tail of every verification path: expiry, lockout, match, consume.

    Separated from lookup because a link token is located by row id while an SMS
    OTP is located by (purpose, identifier) — the rules applied to the candidate
    row must be identical either way, or a token would be valid by one route and
    rejected by the other.
    """
    now = _now()

    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        # Defensive: a timestamptz column read through a driver that drops the
        # offset would otherwise raise TypeError on the comparison.
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= now:
        record.is_used = True
        record.consumed_at = now
        db.commit()
        raise OtpExpired("That code has expired. Request a new one.")

    if record.attempts >= settings.SMS_OTP_MAX_VERIFY_ATTEMPTS:
        record.is_used = True
        record.consumed_at = now
        db.commit()
        raise OtpLocked("Too many incorrect attempts. Request a new code.")

    if not _secret_matches(record, secret.strip()):
        record.attempts += 1
        db.commit()
        # Once the last permitted attempt is spent, burn the code so the same
        # record cannot be probed again.
        if record.attempts >= settings.SMS_OTP_MAX_VERIFY_ATTEMPTS:
            record.is_used = True
            record.consumed_at = now
            db.commit()
        raise OtpInvalid("That code is not correct.")

    record.is_used = True
    record.consumed_at = now
    db.commit()
    db.refresh(record)
    return record


def verify(
    db: Session, *, purpose: OtpPurpose, identifier: str, secret: str
) -> OtpRecord:
    """Check a submitted SMS OTP and consume it on success.

    Raises the `Otp*` subclasses above. Every failure mode is distinct so the
    router can log precisely, but the router is responsible for collapsing
    them into one opaque message on any endpoint where the distinction would let
    an attacker probe for registered accounts.
    """
    identifier = normalize_identifier(purpose, identifier)
    record = _latest_live(db, purpose, identifier)
    if record is None:
        raise OtpNotFound("No active code. Request a new one.")
    return _check_and_consume(db, record, secret)


def verify_link_token(db: Session, *, purpose: OtpPurpose, token: str) -> OtpRecord:
    """Check a `<record_id>.<secret>` email link token and consume it.

    The id narrows the search to one row; the bcrypt check still has to pass, so
    a guessed id is worthless.
    """
    raw_id, separator, secret = token.strip().partition(".")
    if not separator or not secret:
        raise OtpNotFound("That link is not valid. Request a new one.")

    try:
        record_id = int(raw_id)
    except ValueError:
        raise OtpNotFound("That link is not valid. Request a new one.")

    record = db.get(OtpRecord, record_id)
    if (
        record is None
        or record.purpose != purpose
        or record.is_used
    ):
        raise OtpNotFound("That link is not valid. Request a new one.")

    return _check_and_consume(db, record, secret)

