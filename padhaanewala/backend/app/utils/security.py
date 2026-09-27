from datetime import datetime, timedelta, timezone
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


def create_refresh_token(subject: str | int, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(subject),
        "role": role,
        "type": "refresh",
        # `jti` is the token's unique id. Without it a refresh token is
        # indistinguishable from every other refresh token ever issued to that
        # user, so logout and rotation have nothing to act on. Phase 3 adds the
        # `refresh_tokens` table that consumes this; minting it now means tokens
        # issued between now and then are already revocable-in-principle.
        "jti": uuid4().hex,
        "iat": now,
        "exp": now + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(
        payload, settings.JWT_REFRESH_SECRET_KEY, algorithm=ALGORITHM
    )


def decode_token(token: str, secret: str | None = None) -> dict:
    key = secret if secret is not None else settings.JWT_SECRET_KEY
    return jwt.decode(token, key, algorithms=[ALGORITHM])

