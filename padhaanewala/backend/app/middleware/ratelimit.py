import logging

from redis.exceptions import RedisError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.config import settings
from app.services.redis_client import get_redis
from app.utils.client_ip import client_ip

logger = logging.getLogger("padhaanewala.ratelimit")

AUTH_RATE_LIMIT = 5
AUTH_RATE_WINDOW_SECONDS = 60

# `POST /api/v1/enquiries` is unauthenticated public lead capture. Without a limit
# an anonymous caller can flood the CRM at request speed, poisoning the lead table
# that counsellors actually work from. Limits are (max requests, window seconds).
PUBLIC_WRITE_LIMITS: dict[str, tuple[int, int]] = {
    "/api/v1/enquiries": (5, 3600),
    "/api/v1/predictor": (60, 60),
}

#: Namespace whose limiter fails *closed*. Brute-forcing credentials is the one
#: workload where "Redis is unreachable, so I will not throttle" is the wrong
#: answer: the outage is the moment an attacker wants, and a fail-open login path
#: turns a degraded dependency into unlimited password guesses.
FAIL_CLOSED_NAMESPACES = frozenset({"auth"})

#: Atomic increment-and-expire, as one round trip.
#:
#: The previous implementation did `GET` then `INCR` in Python. Those are two
#: separate round trips, so N requests arriving in the same window all read the
#: same pre-increment value, all pass the `current >= max_requests` test, and all
#: increment. The limit was therefore "how many requests did *this particular*
#: request observe", which is not a limit at all — a parallel script got N times
#: the intended allowance.
#:
#: The script makes read-modify-write atomic on the server:
#:   1. `INCR` returns the post-increment count, so no client can miss an update.
#:   2. `EXPIRE` is set only when the count is exactly 1, i.e. only on creation,
#:      so the window starts at the first request and is never extended by
#:      traffic (which would let a steady trickle keep a bucket alive forever).
#:   3. `TTL` is read back for the `Retry-After` hint, avoiding a fourth call.
#: Returns a two-element array: {count, ttl}. Evaluated with `EVAL` on the
#: client directly; the script body is inline rather than registered because
#: `register_script` would need the client at import time, before the lifespan
#: has had a chance to create it.
_RATE_LIMIT_SCRIPT = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return {count, redis.call('TTL', KEYS[1])}
"""


def _limit_for(path: str) -> tuple[str, int, int] | None:
    """Return (key namespace, max requests, window seconds) for a throttled path."""
    if path.startswith("/api/v1/auth"):
        return ("auth", AUTH_RATE_LIMIT, AUTH_RATE_WINDOW_SECONDS)
    for prefix, (max_requests, window) in PUBLIC_WRITE_LIMITS.items():
        if path == prefix or path.startswith(prefix + "/"):
            return (prefix, max_requests, window)
    return None


def _client_key(request: Request) -> str:
    # `client_ip` only honours X-Forwarded-For when TRUSTED_PROXY_HOPS declares
    # the real proxy topology, so a caller cannot mint a fresh rate-limit
    # bucket per request by forging the header.
    return client_ip(request) or "unknown"


def _throttled(namespace: str, max_requests: int, retry_after: int) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "error": {
                "code": "RATE_LIMIT_EXCEEDED",
                "message": "Too many requests, try again later",
                "details": {"retry_after_seconds": max(retry_after, 1)},
            },
        },
    )


def _dependency_unavailable() -> JSONResponse:
    """503 for a throttled route that cannot be throttled.

    Distinct from 429 on purpose. 429 tells the caller "you are being throttled,
    wait", which invites an immediate retry and, on a real outage, turns one
    Redis blip into a retry storm. 503 with `Retry-After` tells a well-behaved
    client to back off and makes the dependency's absence visible in metrics.
    """
    return JSONResponse(
        status_code=503,
        headers={"Retry-After": "1"},
        content={
            "success": False,
            "error": {
                "code": "SERVICE_UNAVAILABLE",
                "message": "Request throttling is temporarily unavailable, retry shortly",
            },
        },
    )


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)

        # Only throttle writes. Throttling GETs would break the ISR-heavy
        # public catalog pages, which legitimately fan out many parallel reads.
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return await call_next(request)

        limit = _limit_for(request.url.path)
        if limit is None:
            return await call_next(request)

        namespace, max_requests, window = limit
        key = f"rl:{namespace}:{request.url.path}:{_client_key(request)}"
        try:
            count, retry = await get_redis().eval(
                _RATE_LIMIT_SCRIPT, 1, key, str(window)
            )
        except (RedisError, OSError, TimeoutError) as exc:
            # The counter is the only thing standing between an attacker and
            # unlimited login attempts, so "cannot count" must not mean
            # "unlimited" on the auth path. Everything else fails open: losing
            # a spam throttle on lead capture is a far better trade than
            # refusing every enquiry because Redis restarted.
            fail_closed = (
                namespace in FAIL_CLOSED_NAMESPACES or not settings.RATE_LIMIT_FAIL_OPEN
            )
            logger.error(
                "Rate limiter unavailable for namespace %r (%s); failing %s",
                namespace,
                type(exc).__name__,
                "closed" if fail_closed else "open",
            )
            if fail_closed:
                return _dependency_unavailable()
            return await call_next(request)

        if int(count) > max_requests:
            return _throttled(namespace, max_requests, int(retry))
        return await call_next(request)
