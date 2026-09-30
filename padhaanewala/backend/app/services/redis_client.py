"""The single async Redis client for the process.

There is exactly one connection pool per application instance, created lazily on
first use and closed by the FastAPI lifespan in `app/main.py`. Two things this
module exists to prevent:

* **A blocking client on the event loop.** The original rate limiter built a
  synchronous ``redis.Redis`` and called ``get``/``set``/``incr`` from inside
  ``async def dispatch``. Each of those is a network round trip executed on the
  event loop thread, so every write request to a throttled path stalled the
  whole worker for the duration of the Redis round trip. ``redis.asyncio`` is
  awaitable, so the loop keeps serving other requests while it waits.
* **A pool per call site.** A module-level lazy singleton means the pool is
  created once and reused; a fresh client per request exhausts file descriptors
  under load.
"""

from __future__ import annotations

import asyncio
import logging

import redis.asyncio as aioredis
from redis.exceptions import RedisError

from app.config import settings

logger = logging.getLogger("padhaanewala.redis")

_client: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    """Return the process-wide async client, creating it on first call.

    Not async itself: constructing a client performs no I/O, so this is safe to
    call from synchronous setup code as well as from request handlers.
    """
    global _client
    if _client is None:
        _client = aioredis.Redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            # `socket_timeout` covers connect and read. `socket_connect_timeout`
            # is separate in redis-py and defaults to the same value, but it is
            # set explicitly because an unreachable host otherwise falls back to
            # a long OS-level connect timeout and the fast-fail guarantee in
            # `REDIS_SOCKET_TIMEOUT_SECONDS` quietly stops holding.
            socket_timeout=settings.REDIS_SOCKET_TIMEOUT_SECONDS,
            socket_connect_timeout=settings.REDIS_SOCKET_TIMEOUT_SECONDS,
            # Health checks and probes must not queue behind a saturated pool.
            health_check_interval=30,
        )
    return _client


async def redis_is_reachable(timeout: float | None = None) -> bool:
    """Ping Redis, returning False instead of raising.

    Used by `GET /health`, which reports degraded rather than crashing, so the
    caller gets a verdict and never has to handle an exception. `timeout`
    defaults to `REDIS_HEALTH_TIMEOUT_SECONDS` and is enforced with
    `asyncio.wait_for` rather than by reconfiguring the shared client, so a slow
    probe cannot leave the connection pool in a different state for the next
    caller. The client's own socket timeout can still fire first if it is the
    smaller of the two; either path returns False, which is the only thing the
    caller needs.
    """
    limit = settings.REDIS_HEALTH_TIMEOUT_SECONDS if timeout is None else timeout
    try:
        await asyncio.wait_for(get_redis().ping(), timeout=limit)
    except (RedisError, OSError, TimeoutError) as exc:
        logger.warning("Redis health check failed: %s", type(exc).__name__)
        return False
    return True


async def close_redis() -> None:
    """Close the pool and drop the singleton so the next call reconnects.

    Called from the FastAPI lifespan. A no-op when no client was ever created,
    so a process that never touched Redis does not need one just to shut down.
    """
    global _client
    if _client is None:
        return
    try:
        await _client.aclose()
    except (RedisError, OSError) as exc:
        # Shutdown must not fail because the connection it is closing is already
        # broken; that is the normal state during a Redis outage.
        logger.warning("Error closing Redis client: %s", type(exc).__name__)
    finally:
        _client = None
