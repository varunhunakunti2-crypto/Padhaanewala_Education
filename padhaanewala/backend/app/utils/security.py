from datetime import datetime, timedelta, timezone
from dataclasses import dataclass
from uuid import uuid4

from jose import jwt
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


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: str | int, role: str) -> str:
    now = datetime.now(timezone.utc)
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
    now = datetime.now(timezone.utc)
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
    key = secret if secret is not None else settings.JWT_SECRET_KEY
    return jwt.decode(token, key, algorithms=[ALGORITHM])

