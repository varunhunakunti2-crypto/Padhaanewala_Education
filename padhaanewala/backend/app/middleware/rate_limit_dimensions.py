"""P3 multi-dimensional rate limiting helpers.

Responsibilities:
- verified server-side identity extraction (JWT, best-effort) for middleware
- safe identifier extraction/normalization/hashing for auth/OTP/reset flows
- multi-counter Redis key construction and atomic evaluation helpers

This module does not own policy selection; it composes with the centralized P2
policy engine and existing Redis/middleware behavior.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

from starlette.requests import Request

from app.config import settings
from app.services import otp_service
from app.utils.client_ip import client_ip
from app.utils.security import decode_token

logger = logging.getLogger("padhaanewala.ratelimit")

# Multi-key atomic check-and-increment:
# KEYS[1..N] = counter keys, ARGV[1..N] = windows, ARGV[N+1..2N] = limits
# Returns: {allowed(1/0), index(1-based) of first exceeded key or 0, retry_ttl}
_RATE_LIMIT_MULTI_SCRIPT = """
for i = 1, #KEYS do
  local count = tonumber(redis.call('GET', KEYS[i]) or '0')
  local limit = tonumber(ARGV[#KEYS + i])
  if count >= limit then
    local ttl = redis.call('TTL', KEYS[i])
    if ttl < 0 then ttl = tonumber(ARGV[i]) end
    return {0, i, ttl}
  end
end
for i = 1, #KEYS do
  local count = redis.call('INCR', KEYS[i])
  if count == 1 then
    redis.call('EXPIRE', KEYS[i], ARGV[i])
  end
end
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then ttl = tonumber(ARGV[1]) end
return {1, 0, ttl}
"""


@dataclass(frozen=True)
class RateLimitCheck:
    key: str
    limit: int
    window_seconds: int
    dimension: str
    fail_closed: bool | None = None


@dataclass(frozen=True)
class MultiCheckResult:
    allowed: bool
    failed: RateLimitCheck | None
    retry_after: int


def get_trusted_client_ip(request: Request) -> str:
    return client_ip(request) or "unknown"


def _verified_access_payload(request: Request) -> dict[str, Any] | None:
    """Decode and verify a bearer access token, or return ``None``.

    Middleware runs before endpoint auth dependencies, so this is a best-effort
    server-side identity read: signature/algorithm/type are verified exactly as
    in ``dependencies.get_current_user``, with no DB lookup. Nothing supplied by
    the client (headers other than the bearer token, body fields, query string)
    can influence the result.
    """
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth:
        return None
    scheme, _, token = auth.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    token = token.strip()
    try:
        payload = decode_token(token)
    except Exception:
        return None
    if not isinstance(payload, dict) or payload.get("type") != "access":
        return None
    return payload


def extract_verified_user_id(request: Request) -> str | None:
    """Best-effort server-side access-token identity for middleware.

    Middleware runs before endpoint auth dependencies. We verify the JWT using the
    same secret/algorithm/type expectations as `dependencies.get_current_user`
    but do not perform DB lookup here. Invalid/missing tokens yield None.
    """
    payload = _verified_access_payload(request)
    if payload is None:
        return None
    sub = payload.get("sub")
    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        return None
    if user_id <= 0:
        return None
    # Cache for downstream consumers/debugging without trusting client state.
    try:
        request.state.rate_limit_user_id = user_id
    except Exception:
        pass
    return str(user_id)


def extract_verified_user_roles(request: Request) -> frozenset[str]:
    """Verified access-token role claims, used only to select a P8 limit tier.

    The claim is a comma-separated list of role names in tokens issued by the
    auth service, so it is split rather than compared as one string. This never
    grants authorization: the endpoint's own ``require_role`` guard still runs
    against the database. A forged or invalid token yields an empty set and the
    caller keeps the stricter public limit.
    """
    payload = _verified_access_payload(request)
    if payload is None:
        return frozenset()
    role = payload.get("role")
    if not isinstance(role, str):
        return frozenset()
    return frozenset(
        part.strip().lower() for part in role.split(",") if part.strip()
    )


_MISSING = object()


async def get_cached_json_body(request: Request, max_bytes: int = 16_384) -> dict[str, Any] | None:
    """Read and cache request JSON body safely for middleware inspection.

    BaseHTTPMiddleware consumes the receive stream; to avoid breaking downstream
    handlers, replay the consumed body via a new receive callable.
    """
    cached = getattr(request.state, "_rl_cached_json", _MISSING)
    if cached is not _MISSING:
        return cached  # type: ignore[return-value]

    if request.method.upper() not in {"POST", "PUT", "PATCH", "DELETE"}:
        request.state._rl_cached_json = None
        return None
    content_type = (request.headers.get("content-type") or "").split(";")[0].strip().lower()
    if content_type != "application/json":
        request.state._rl_cached_json = None
        return None

    body = b""
    try:
        # If already consumed/cached by Starlette internals, use it.
        body = await request.body()
    except Exception:
        body = b""
    if not body or len(body) > max_bytes:
        request.state._rl_cached_json = None
        return None

    # Replay body for downstream consumers.
    async def receive() -> dict[str, Any]:
        return {"type": "http.request", "body": body, "more_body": False}

    try:
        request._receive = receive  # type: ignore[attr-defined]
    except Exception:
        pass
    try:
        parsed = json.loads(body.decode("utf-8"))
    except Exception:
        request.state._rl_cached_json = None
        return None
    request.state._rl_cached_json = parsed if isinstance(parsed, dict) else None
    return request.state._rl_cached_json


def _hash_identifier(kind: str, value: str) -> str:
    # Namespaced hash: avoids raw PII in Redis keys/logs while keeping stable buckets.
    material = f"{kind}:{value}".encode("utf-8")
    return hashlib.sha256(material).hexdigest()[:32]


#: Slugs produced by ``routers/blogs._slugify``: lowercase alphanumerics joined
#: by single hyphens. Anything else is not an article reference the router can
#: resolve, so it is deliberately collapsed into one bounded bucket instead of
#: becoming attacker-chosen Redis key material.
_BLOG_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_BLOG_REF_MAX_LENGTH = 128
_BLOG_REF_MAX_ID = 2**63 - 1


def normalized_blog_article_key(request: Request) -> str:
    """Bounded, hashed article dimension for a blog view request.

    Only the ``blog_ref`` path segment is read; query parameters are ignored, so
    ``?utm_source=`` cannot mint a separate bucket. A numeric ref is reduced to
    its integer value (``007`` and ``7`` share a bucket) and a slug must match
    the router's own slug shape. Every other value maps to ``invalid``, which
    bounds cardinality for a caller cycling random refs.
    """
    path = request.url.path
    ref = ""
    if path.endswith("/view"):
        ref = path[: -len("/view")].rsplit("/", 1)[-1]

    if ref.isdigit():
        try:
            article_id = int(ref)
        except ValueError:
            article_id = 0
        normalized = f"id:{article_id}" if 0 < article_id <= _BLOG_REF_MAX_ID else "invalid"
    elif len(ref) <= _BLOG_REF_MAX_LENGTH and _BLOG_SLUG_RE.match(ref):
        normalized = f"slug:{ref}"
    else:
        normalized = "invalid"
    return _hash_identifier("blog_article", normalized)


def extract_identifier_hashes(request: Request, body: dict[str, Any] | None) -> dict[str, str]:
    """Extract normalized+hashed identifiers for protected write flows.

    Only specific known endpoints/fields are read to avoid accidental sensitive
    data capture and to keep behavior explicit.
    """
    if not body:
        return {}
    path = request.url.path
    hashes: dict[str, str] = {}

    # Login by email+password
    if path == "/api/v1/auth/login":
        email = body.get("email")
        if isinstance(email, str) and email.strip():
            hashes["email"] = _hash_identifier("email", otp_service.normalize_email(email))
        return hashes

    # Registration may include both; limit to available fields.
    if path == "/api/v1/auth/register":
        email = body.get("email")
        mobile = body.get("mobile")
        if isinstance(email, str) and email.strip():
            hashes["email"] = _hash_identifier("email", otp_service.normalize_email(email))
        if isinstance(mobile, str) and mobile.strip():
            hashes["phone"] = _hash_identifier("phone", otp_service.normalize_mobile(mobile))
        return hashes

    # OTP send/verify (login) and password reset flows: mobile or email as applicable.
    if path in {"/api/v1/auth/login/otp/send", "/api/v1/auth/login/otp/verify"}:
        mobile = body.get("mobile")
        if isinstance(mobile, str) and mobile.strip():
            hashes["phone"] = _hash_identifier("phone", otp_service.normalize_mobile(mobile))
        return hashes

    if path in {"/api/v1/auth/forgot-password", "/api/v1/auth/verify-email/resend"}:
        email = body.get("email")
        if isinstance(email, str) and email.strip():
            hashes["email"] = _hash_identifier("email", otp_service.normalize_email(email))
        return hashes

    # P8 public intake: the form's phone and optional email share one bucket
    # across formatting/IP variants, so "98450 12345" and "+91 9845012345" (and
    # "Student@Example.com" / "student@example.com") cannot bypass the limit.
    # The enquiry schema caps both fields, and only the hash reaches Redis.
    if path == "/api/v1/enquiries":
        mobile = body.get("mobile")
        if isinstance(mobile, str):
            normalized_phone = otp_service.normalize_mobile(mobile)
            if normalized_phone:
                hashes["phone"] = _hash_identifier("phone", normalized_phone)
        email = body.get("email")
        if isinstance(email, str):
            normalized_email = otp_service.normalize_email(email)
            if normalized_email:
                hashes["email"] = _hash_identifier("email", normalized_email)
        return hashes

    # Reset-password token is not an account identifier for enumeration-safe limiting; skip.
    return hashes


def utc_day_bucket(now: datetime | None = None) -> str:
    now = now or datetime.now(UTC)
    return now.strftime("%Y%m%d")


def seconds_until_utc_midnight(now: datetime | None = None) -> int:
    """Seconds until the next UTC calendar day begins, minimum 1.

    Used to clamp a daily counter's TTL to the day boundary. The key already
    contains ``utc_day_bucket()``, so a key can never be reused across days;
    clamping only makes ``RateLimit-Reset``/``Retry-After`` accurate instead of
    reporting a rolling 24 hours from whenever the first request arrived.
    """
    now = now or datetime.now(UTC)
    if now.tzinfo is None:
        now = now.replace(tzinfo=UTC)
    tomorrow = (now + timedelta(days=1)).date()
    midnight = datetime(tomorrow.year, tomorrow.month, tomorrow.day, tzinfo=UTC)
    return max(1, int((midnight - now).total_seconds()))
