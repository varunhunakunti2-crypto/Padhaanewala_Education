import time

import redis
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.config import settings

AUTH_RATE_LIMIT = 5
AUTH_RATE_WINDOW_SECONDS = 60

# `POST /api/v1/enquiries` is unauthenticated public lead capture. Without a limit
# an anonymous caller can flood the CRM at request speed, poisoning the lead table
# that counsellors actually work from. Limits are (max requests, window seconds).
PUBLIC_WRITE_LIMITS: dict[str, tuple[int, int]] = {
    "/api/v1/enquiries": (5, 3600),
    "/api/v1/predictor": (60, 60),
}


def _limit_for(path: str) -> tuple[str, int, int] | None:
    """Return (key namespace, max requests, window seconds) for a throttled path."""
    if path.startswith("/api/v1/auth"):
        return ("auth", AUTH_RATE_LIMIT, AUTH_RATE_WINDOW_SECONDS)
    for prefix, (max_requests, window) in PUBLIC_WRITE_LIMITS.items():
        if path == prefix or path.startswith(prefix + "/"):
            return (prefix, max_requests, window)
    return None

redis_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    global redis_client
    if redis_client is None:
        redis_client = redis.Redis.from_url(
            settings.REDIS_URL, decode_responses=True
        )
    return redis_client


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


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
        try:
            r = get_redis()
            key = f"rl:{namespace}:{request.url.path}:{_client_key(request)}"
            current = r.get(key)
            if current is None:
                r.set(key, 1, ex=window)
            else:
                current = int(current)
                if current >= max_requests:
                    retry = r.ttl(key)
                    return JSONResponse(
                        status_code=429,
                        content={
                            "success": False,
                            "error": {
                                "code": "RATE_LIMIT_EXCEEDED",
                                "message": "Too many requests, try again later",
                                "details": {"retry_after_seconds": max(retry, 1)},
                            },
                        },
                    )
                r.incr(key)
        except redis.RedisError:
            # Fail open: availability beats throttling.
            pass
        return await call_next(request)