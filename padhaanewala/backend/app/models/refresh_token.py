from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RefreshToken(Base):
    """The revocation ledger for issued refresh tokens.

    `POST /auth/refresh` used to mint a fresh 30-day pair for any token that
    still verified, with no record of the token it replaced. `POST /auth/logout`
    echoed `{"success": true}` and invalidated nothing, so a walk-away-from-an-
    unlocked-browser attacker held a valid session indefinitely. This table is
    what gives both endpoints something to act on.

    **Why no hash of the token is stored here**, unlike `otp_records.code_hash`:
    that column is bcrypt because an OTP *is* its own authenticator — six digits,
    brute-forceable if the digest leaks. A refresh token is not. It is a JWT
    signed with `JWT_REFRESH_SECRET_KEY`, so possession of this table's contents
    (or of the whole database) yields an attacker nothing usable: a row's `jti`
    tells them a token identifier exists, not what the token says, and minting
    one still requires the signing key. Authentication is the signature; this
    table is only a *revocation* check performed after the signature has already
    been verified. Hashing it would add cost and defeat online inspection
    without closing any additional hole.
    """

    __tablename__ = "refresh_tokens"

    # Family-wide revocation on detected reuse must be a single indexed lookup,
    # not a scan of every live token on the account. `user_id` is carried in the
    # index so the query stays inside one account's rows.
    __table_args__ = (
        UniqueConstraint("jti", name="uq_refresh_tokens_jti"),
        Index("ix_refresh_tokens_family_user", "family", "user_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )

    #: The token's `jti` claim (32 hex chars, see `create_refresh_token`). Unique
    #: because it identifies exactly one issued token; a collision is not merely
    #: unlikely, it would let one token revoke another. Uniqueness is a named
    #: constraint rather than `unique=True` on the column so there is exactly one
    #: index on this column — `unique=True, index=True` renders as a *unique
    #: index* and the named constraint then becomes a redundant second one.
    jti: Mapped[str] = mapped_column(String(64), index=True)

    #: The rotation chain this token belongs to. A fresh family id is minted at
    #: login, register and OTP sign-in; refresh inherits the presented token's
    #: family. Presenting a token that has already been rotated away means the
    #: token was copied, so the whole family is revoked and the user must
    #: re-authenticate — that is the signal, and it is why this column exists.
    family: Mapped[str] = mapped_column(String(64), index=True)

    #: When this token was exchanged for its successor. Set exactly once. A
    #: non-null `used_at` on an otherwise valid token is reuse, not a mistake.
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    #: The `jti` that replaced this one, so a compromised lineage can be walked
    #: backwards in an investigation.
    rotated_to_jti: Mapped[str | None] = mapped_column(
        String(64), nullable=True
    )

    #: Mirrors the JWT `exp` claim. Duplicated deliberately: the claim needs the
    #: signing key to trust, this column does not, and a revocation sweep must
    #: not have to verify a signature to know what has already expired.
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    #: Set by logout, by family revocation on detected reuse, and by a password
    #: change. A token is valid only while this is null, its `used_at` is null
    #: and it is not past `expires_at`.
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    #: Best-effort abuse attribution, mirroring `otp_record.request_ip` and
    #: `client_ip.py` usage elsewhere. Null when the client IP is unavailable.
    request_ip: Mapped[str | None] = mapped_column(String(45), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now, nullable=False
    )
