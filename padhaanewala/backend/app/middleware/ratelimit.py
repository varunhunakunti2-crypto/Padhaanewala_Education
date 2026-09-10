import time

import redis
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.config import settings

AUTH_RATE_LIMIT = 5
AUTH_RATE_WINDOW_SECONDS = 60

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
        if settings.RATE_LIMIT_ENABLED and request.url.path.startswith("/api/v1/auth"):
            try:
                r = get_redis()
                key = f"rl:{request.url.path}:{_client_key(request)}"
                current = r.get(key)
                if current is None:
                    r.set(key, 1, ex=AUTH_RATE_WINDOW_SECONDS)
                else:
                    current = int(current)
                    if current >= AUTH_RATE_LIMIT:
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
                pass
        return await call_next(request)