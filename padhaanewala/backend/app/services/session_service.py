"""The refresh-token ledger: issuance, rotation bookkeeping and revocation.

Kept out of `app/routers/auth.py` because two routers need it — `auth` rotates
and logs out, `users` must end every session when a password changes — and
importing a router from a router is how a dependency cycle starts.

Mirrors `otp_service`: owns the table, never talks to a provider, and returns
plain values so callers decide what a failure means for HTTP.
"""

import logging
from datetime import datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.models import RefreshToken
from app.utils.security import create_access_token, create_refresh_token, new_token_family

logger = logging.getLogger(__name__)


class RefreshReuseDetected(Exception):
    """A refresh token was presented after it had already been rotated.

    Raised rather than returned because the correct handling is not a variant of
    the normal path: the entire rotation family must be revoked before the 401
    is raised, and a caller that forgets to do that would reintroduce exactly the
    bug this class exists to make impossible to write.
    """


def issue(db: Session, user, role_names: str, request=None, family: str | None = None) -> dict:
    """Sign a refresh token and record it in the ledger. Returns the token pair.

    The ledger row is written in the caller's session but not committed here, so
    the row and the tokens it represents become visible together. A token
    without a row behind it is an unrevocable token, which is the defect this
    module removes.
    """
    family = family or new_token_family()
    refresh = create_refresh_token(user.id, role_names)
    db.add(
        RefreshToken(
            user_id=user.id,
            jti=refresh.jti,
            family=family,
            expires_at=refresh.expires_at,
            request_ip=_request_ip(request),
        )
    )
    enforce_active_token_ceiling(db, user.id, current_family=family)
    return {"refresh": refresh, "access": create_access_token(user.id, role_names)}


def rotate(db: Session, record: RefreshToken, user, role_names: str, request=None) -> dict:
    """Consume `record` and issue its successor in the same family.

    Raises `RefreshReuseDetected` if `record` has already been consumed. That is
    the whole point of the design: presenting a rotated-away token means the
    token was copied, and the response is to kill the chain and force a fresh
    authentication rather than to serve the caller a new pair.
    """
    if record.used_at is not None:
        raise RefreshReuseDetected(record.family)

    tokens = issue(db, user, role_names, request=request, family=record.family)
    record.used_at = datetime.now(timezone.utc)
    record.rotated_to_jti = tokens["refresh"].jti
    return tokens


def revoke_family(db: Session, user_id: int, family: str, reason: str) -> int:
    """Revoke every still-live token in one rotation chain. Returns the count."""
    result = db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.user_id == user_id,
            RefreshToken.family == family,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(timezone.utc))
    )
    count = result.rowcount or 0
    # WARNING, not INFO: this fires for logout as well as for detected theft, but
    # the `reason` argument is what separates the two and an operator should see
    # every one of them.
    logger.warning(
        "revoked refresh token family for user_id=%s (%s): %d token(s)",
        user_id,
        reason,
        count,
    )
    return count


def revoke_all_sessions(db: Session, user_id: int, reason: str) -> int:
    """Revoke every live refresh token on the account, across all families.

    Used when the credential itself changes. A password reset that leaves old
    sessions alive is only half a reset: the person who prompted it is usually
    doing so *because* they believe somebody else has access, and that somebody
    is holding exactly the token this revokes.
    """
    result = db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(timezone.utc))
    )
    count = result.rowcount or 0
    logger.warning(
        "revoked all sessions for user_id=%s (%s): %d token(s)", user_id, reason, count
    )
    return count


def enforce_active_token_ceiling(db: Session, user_id: int, current_family: str) -> None:
    """Bound the number of concurrently signed-in *sessions* per account.

    The unit is the family, not the token row, and that distinction is the whole
    design. Rotation writes one row per refresh by design, so a single device
    refreshing every 25 minutes produces ~1,700 rows over its 30-day life — that
    is normal and must never be penalised. What actually needs bounding is how
    many *devices* hold a live session at once, because that is what an attacker
    accumulating stolen logins looks like, and it is what an unbounded account
    would otherwise let grow forever.

    When the ceiling is crossed the oldest *other* families are revoked. The
    current family is never a candidate: signing in on a new device must not
    sign you out of the one you are using. Revoking rather than deleting is
    deliberate — a row deleted without being revoked is a live token with no
    ledger entry, which is the one state this table exists to make unreachable.
    """
    ceiling = settings.MAX_ACTIVE_REFRESH_TOKENS
    # `autoflush=False` is set on the sessionmaker, so the row just added by
    # `issue()` is still pending and would be invisible to this query. Flush
    # first or the count is short by one on every single call.
    db.flush()

    # Oldest live row per family, so "oldest family" means the session that has
    # been signed in longest rather than whichever rotated most recently.
    rows = db.execute(
        select(RefreshToken.family, func.min(RefreshToken.id))
        .where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
        .group_by(RefreshToken.family)
        .order_by(func.min(RefreshToken.id).asc())
    ).all()

    others = [row[0] for row in rows if row[0] != current_family]
    surplus = len(others) - (ceiling - 1)
    if surplus <= 0:
        return

    doomed = others[:surplus]
    now = datetime.now(timezone.utc)
    for family in doomed:
        db.execute(
            update(RefreshToken)
            .where(
                RefreshToken.user_id == user_id,
                RefreshToken.family == family,
                RefreshToken.revoked_at.is_(None),
            )
            .values(revoked_at=now)
        )
    logger.info(
        "refresh token ceiling reached for user_id=%s: revoked %d oldest session(s)",
        user_id,
        len(doomed),
    )


def find_by_jti(db: Session, jti: str | None) -> RefreshToken | None:
    if not jti:
        return None
    return db.scalar(select(RefreshToken).where(RefreshToken.jti == jti))


def is_live(record: RefreshToken, now: datetime | None = None) -> bool:
    """True when this record may still be exchanged.

    Three independent disqualifiers, and all three must hold: not consumed by a
    rotation, not revoked, not past its own expiry.
    """
    now = now or datetime.now(timezone.utc)
    return (
        record.used_at is None
        and record.revoked_at is None
        and record.expires_at > now
    )


def _request_ip(request) -> str | None:
    if request is None:
        return None
    from app.utils.client_ip import client_ip

    return client_ip(request)
