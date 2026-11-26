"""Password hashing and JWT minting.

## Why PyJWT and not python-jose (Phase 7.2)

`pip-audit` gates this repository, and it failed on day one: **ecdsa 0.19.2,
PYSEC-2026-1325, no fixed version published.** That is not a hypothetical risk
in this codebase — it is an *unreachable* one, and the distinction is the whole
reason to fix it rather than suppress it.

`ecdsa` was not chosen. It arrived as a hard `install_requires` of
`python-jose==3.5.0`, which pulls it unconditionally, and it exists in
python-jose solely to implement **ES256/ES384**. This project signs with HMAC
only: `ALGORITHM` below is `settings.JWT_ALGORITHM`, and the production guard in
`config.py` *refuses to boot* on anything outside `("HS256", "HS384", "HS512")`.
So the vulnerable code path cannot be reached by any configuration this
application will accept.

That is still not good enough. "Unreachable because a validation guard says so"
is a weaker guarantee than "not installed": the guarantee is one edit to a
whitelist away from silently becoming load-bearing, and `ecdsa` 0.19.2 has no
published fix, so there is no upgrade to migrate to. Removing `python-jose`
removes the package rather than documenting the absence.

The migration is one import here, plus one exception rename in
`app/dependencies.py`: `jose.exceptions.JWTError` is `jwt.exceptions.
InvalidTokenError` in PyJWT, and `ExpiredSignatureError` keeps its name in both.
The HMAC-only call surface here is otherwise API-identical —
`jwt.encode(payload, key, algorithm=...)` and
`jwt.decode(token, key, algorithms=[...])`. The 336-test suite, 23 of which
exercise every path through this module, is the evidence that the swap changed
nothing observable.

`pyasn1` and `rsa` were python-jose's other unconditional requirements and are
gone for the same reason; neither is imported anywhere in the project.
"""

import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
from passlib.context import CryptContext

from app.config import settings

# `BCRYPT_ROUNDS` used to be declared in Settings and never passed here, so
# passlib silently used its own default of 12 and raising the setting did
# nothing. It is now wired, and the production guard in config.py refuses a
# value below 12 so the cost factor cannot be lowered by accident.
pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=settings.BCRYPT_ROUNDS,
)

#: Exposed at module level because the RBAC suite signs forged tokens with it to
#: prove a forged `role` claim grants nothing. Derived from Settings rather than
#: hardcoded: when this was the literal "HS256" it silently shadowed
#: settings.JWT_ALGORITHM, so changing the configured algorithm had no effect.
ALGORITHM = settings.JWT_ALGORITHM


_KEY_BYTES = 32


def generate_signing_key() -> str:
    """Return one fresh 256-bit key for a signing slot.

    Call this separately for every slot — each call is an independent CSPRNG
    draw, so the access and refresh keys cannot end up related. The return value
    is *not* printed or logged here: callers must place it directly in a secret
    manager. Used by rotation tooling and tests, never by the running app.
    """
    return secrets.token_hex(_KEY_BYTES)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str | int, role: str) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(subject),
        "role": role,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=ALGORITHM)


@dataclass(frozen=True)
class SignedRefreshToken:
    """A signed refresh token plus the two claims the ledger needs.

    `token` is what travels over the wire (the JWT string); `jti` and
    `expires_at` are duplicated into `refresh_tokens` so a revocation sweep
    never has to verify a signature to know what expired or which token to
    find. Returning a bare string forced callers to re-decode it just to learn
    its own identifier, which is how the ledger ended up never being fed.
    """

    token: str
    jti: str
    expires_at: datetime


def new_token_family() -> str:
    """A fresh rotation-chain identifier, minted at every *authentication*.

    Refresh inherits its presenter's family, which is exactly what makes a
    replayed token revocable as a unit: one chain, one device, one leak.
    """
    return uuid4().hex


def create_refresh_token(subject: str | int, role: str) -> SignedRefreshToken:
    now = datetime.now(UTC)
    jti = uuid4().hex
    expires_at = now + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(subject),
        "role": role,
        "type": "refresh",
        # `jti` is the token's unique id, consumed by the `refresh_tokens`
        # ledger: rotation and logout act on exactly one issued token, and reuse
        # detection needs the identifier to decide which family to revoke.
        "jti": jti,
        "iat": now,
        "exp": expires_at,
    }
    token = jwt.encode(
        payload, settings.JWT_REFRESH_SECRET_KEY, algorithm=ALGORITHM
    )
    return SignedRefreshToken(token=token, jti=jti, expires_at=expires_at)


def decode_token(token: str, secret: str | None = None) -> dict:
    """Decode with one explicit key (or the current access key).

    Retained for tests and tooling that deliberately exercise a single key.
    Request handling should use ``decode_access_token`` / ``decode_refresh_token``
    so a token issued just before a rotation keeps working during the grace
    window.
    """
    key = secret if secret is not None else settings.JWT_SECRET_KEY
    return jwt.decode(token, key, algorithms=[ALGORITHM])


def _decode_with_keys(token: str, keys: tuple[str, ...], token_type: str) -> dict:
    """Verify ``token`` under each candidate key, current first.

    An expired token is reported immediately: expiry is a property of the
    claims, not of which key happened to sign it, and continuing to the retired
    key would produce a misleading "invalid signature" error. Every other
    failure falls through to the next candidate; if none verifies, the last
    error is raised so callers still see a normal PyJWT exception.
    """
    last_error: jwt.exceptions.InvalidTokenError | None = None
    for key in keys:
        if not key:
            continue
        try:
            return jwt.decode(token, key, algorithms=[ALGORITHM])
        except jwt.ExpiredSignatureError:
            raise
        except jwt.exceptions.InvalidTokenError as exc:
            last_error = exc
    if last_error is not None:
        raise last_error
    raise jwt.exceptions.InvalidTokenError(f"no {token_type} key is configured")


def decode_access_token(token: str) -> dict:
    """Verify an access token under current (and, during rotation, retired) keys."""
    return _decode_with_keys(token, settings.jwt_access_keys, "access")


def decode_refresh_token(token: str) -> dict:
    """Verify a refresh token under current (and, during rotation, retired) keys."""
    return _decode_with_keys(token, settings.jwt_refresh_keys, "refresh")

