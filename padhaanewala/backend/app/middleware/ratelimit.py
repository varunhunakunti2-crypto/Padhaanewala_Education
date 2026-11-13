import logging
import time
from dataclasses import replace

from redis.exceptions import RedisError
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.config import settings
from app.middleware.rate_limit_dimensions import (
    _RATE_LIMIT_MULTI_SCRIPT,
    RateLimitCheck,
    extract_identifier_hashes,
    extract_verified_user_id,
    extract_verified_user_roles,
    get_cached_json_body,
    get_trusted_client_ip,
    normalized_blog_article_key,
    seconds_until_utc_midnight,
    utc_day_bucket,
)
from app.middleware.rate_limit_observability import (
    emit_decision,
    emit_dependency_failure,
    emit_quota_exhausted,
)
from app.middleware.rate_limit_policy import ResolvedRateLimit, resolve_rate_limit
from app.services.redis_client import close_redis, get_redis
from app.utils.client_ip import client_ip

logger = logging.getLogger("padhaanewala.ratelimit")

# Credential endpoints are the brute-force surface, so they stay tight. The
# remaining auth endpoints (OTP send, verification resend, password reset
# start) are part of a multi-step flow a legitimate user can hit several times
# in a minute (BUG-03), and a five-per-minute cap on them reliably locks people
# out of their own account while doing nothing to stop password guessing.
AUTH_TIGHT_LIMIT = 5
AUTH_TIGHT_WINDOW_SECONDS = 60
AUTH_GENEROUS_LIMIT = 20
AUTH_GENEROUS_WINDOW_SECONDS = 60

AUTH_TIGHT_PATHS = frozenset(
    {
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/refresh",
        "/api/v1/auth/login/otp/verify",
    }
)

# `POST /api/v1/enquiries` is unauthenticated public lead capture. Without a limit
# an anonymous caller can flood the CRM at request speed, poisoning the lead table
# that counsellors actually work from. Limits are (max requests, window seconds).
PUBLIC_WRITE_LIMITS: dict[str, tuple[int, int]] = {
    "/api/v1/enquiries": (5, 3600),
    "/api/v1/predictor": (60, 60),
    # 4.8 — six COUNT(*) per request, unauthenticated. Preserved for
    # compatibility; GET is not throttled by middleware in P2.
    "/api/v1/stats/catalog": (60, 60),
    # The student assistant. The Next.js proxy already throttles per browser IP
    # at 12/min; this is a coarse ceiling for a caller reaching FastAPI
    # directly. It is intentionally looser because the proxy's server IP is the
    # only client address this layer can see in the normal path, so a tight
    # limit here would throttle every student together.
    "/api/v1/ai/chat": (60, 60),
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
    """Compatibility shim for legacy callers/tests.

    Returns (namespace, max requests, window seconds) for historically
    protected write paths. Policy resolution for live requests is centralized
    in ``app.middleware.rate_limit_policy``.
    """
    if path.startswith("/api/v1/auth"):
        if path in AUTH_TIGHT_PATHS:
            return ("auth", AUTH_TIGHT_LIMIT, AUTH_TIGHT_WINDOW_SECONDS)
        return ("auth", AUTH_GENEROUS_LIMIT, AUTH_GENEROUS_WINDOW_SECONDS)
    for prefix, (max_requests, window) in PUBLIC_WRITE_LIMITS.items():
        if path == prefix or path.startswith(prefix + "/"):
            return (prefix, max_requests, window)
    return None


def _resolve_limit(request: Request) -> ResolvedRateLimit | None:
    """Resolve centralized policy for a request (P2/P3)."""
    try:
        resolved: ResolvedRateLimit | None = resolve_rate_limit(request, settings)
    except Exception:
        resolved = None
    if resolved is not None:
        # P8: a route shared by public and staff callers can carry a
        # role-selected limit tier. The role comes from the signed access token
        # only; the endpoint's own authorization guard is unchanged.
        if resolved.role_limits:
            roles = extract_verified_user_roles(request)
            if roles:
                for role_limit in resolved.role_limits:
                    if roles & role_limit.roles:
                        resolved = replace(
                            resolved,
                            namespace=role_limit.namespace,
                            limit=role_limit.limit,
                            window_seconds=role_limit.window_seconds,
                        )
                        break
        # Ensure concrete path is available for P3 identity/identifier routing.
        if not resolved.path:
            resolved = replace(resolved, path=request.url.path)
        return resolved

    # Backward-compatible fallback if policy resolution is unavailable.
    legacy = _limit_for(request.url.path)
    if legacy is None:
        return None
    namespace, max_requests, window = legacy
    if request.method.upper() in {"GET", "HEAD", "OPTIONS"}:
        return None
    return ResolvedRateLimit(
        namespace=namespace,
        limit=max_requests,
        window_seconds=window,
        bucket_path=request.url.path,
        category="legacy",
        fail_closed=None,
        dimensions=(),
        path=request.url.path,
    )


def _client_key(request: Request) -> str:
    # `client_ip` only honours X-Forwarded-For when TRUSTED_PROXY_HOPS declares
    # the real proxy topology, so a caller cannot mint a fresh rate-limit
    # bucket per request by forging the header.
    return client_ip(request) or "unknown"


def _positive_seconds(ttl: int) -> int:
    """Whole seconds until reset, never zero or negative.

    Redis ``TTL`` already returns whole seconds, but it can be ``0`` for a key
    with less than a second left and ``-1``/``-2`` when no expiry exists or the
    key vanished. Emitting those verbatim would tell a client to retry
    immediately, so clamp to one second.
    """
    try:
        return max(int(ttl), 1)
    except (TypeError, ValueError):
        return 1


def _rate_limit_headers(*, limit: int, remaining: int, reset: int) -> dict[str, str]:
    """Standard numeric rate-limit headers for one enforced counter.

    Deliberately contains no key, user ID, or address: only the numbers a
    client needs to pace itself.
    """
    try:
        limit_value = max(int(limit), 0)
    except (TypeError, ValueError):
        limit_value = 0
    try:
        remaining_value = max(int(remaining), 0)
    except (TypeError, ValueError):
        remaining_value = 0
    return {
        "RateLimit-Limit": str(limit_value),
        "RateLimit-Remaining": str(remaining_value),
        "RateLimit-Reset": str(_positive_seconds(reset)),
    }


def _throttled(
    namespace: str,
    max_requests: int,
    retry_after: int,
    *,
    limit: int | None = None,
    remaining: int = 0,
    reset: int | None = None,
) -> JSONResponse:
    retry_seconds = _positive_seconds(retry_after)
    reset_seconds = _positive_seconds(reset if reset is not None else retry_seconds)
    headers = _rate_limit_headers(
        limit=limit if limit is not None else max_requests,
        remaining=remaining,
        reset=reset_seconds,
    )
    headers["Retry-After"] = str(retry_seconds)
    return JSONResponse(
        status_code=429,
        headers=headers,
        content={
            "success": False,
            "error": {
                "code": "RATE_LIMIT_EXCEEDED",
                "message": "Too many requests, try again later",
                "details": {"retry_after_seconds": retry_seconds},
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


def _elapsed_ms(started: float) -> float:
    return max((time.perf_counter() - started) * 1000.0, 0.0)


async def _increment_counter(
    key: str,
    window: int,
    *,
    namespace: str = "",
    category: str = "",
    route_template: str | None = None,
) -> list[int]:
    """Run the atomic limiter script, retrying once against a fresh pool.

    A Redis restart leaves the pool holding sockets the server has already
    closed. `health_check_interval` only re-checks a connection that has been
    idle for 30 seconds, so the first request after a restart can be handed a
    socket the peer is in the middle of closing and raise `ConnectionError` or
    `TimeoutError`. On the auth namespace that surfaces as a 503 on a login that
    would have succeeded a moment later, which reads as "login is broken" rather
    than "Redis just came back". A dead pooled socket is therefore not treated as
    evidence that Redis is down: the counter is attempted a second time after
    dropping the pool, and only if *that* also fails is the open/closed decision
    taken.

    The retry re-runs `INCR`, so a read that timed out after the server had
    already counted the request is counted twice. That can only ever shorten a
    bucket by one, which is the safe direction for a limiter.

    P10 emits a structured retry event (class name only, never the message,
    which can contain the Redis URL) so a flapping pool is visible without
    waiting for the second attempt to fail.
    """
    started = time.perf_counter()
    try:
        return await get_redis().eval(_RATE_LIMIT_SCRIPT, 1, key, str(window))
    except (RedisError, OSError, TimeoutError) as exc:
        emit_dependency_failure(
            event="ratelimit.redis_retry",
            namespace=namespace,
            category=category,
            dimension="route_ip",
            route_template=route_template,
            fail_mode="unknown",
            error_type=type(exc).__name__,
            redis_latency_ms=_elapsed_ms(started),
        )
        # Drop the singleton so the retry cannot be handed the same dead socket;
        # the next `get_redis()` call reconnects.
        await close_redis()
        return await get_redis().eval(_RATE_LIMIT_SCRIPT, 1, key, str(window))


async def _check_multi_counters(
    checks: list[RateLimitCheck],
    *,
    namespace: str = "",
    category: str = "",
    route_template: str | None = None,
) -> tuple[bool, RateLimitCheck | None, int]:
    """Atomically evaluate multiple counters (check-all then increment-all)."""
    keys = [c.key for c in checks]
    windows = [str(c.window_seconds) for c in checks]
    limits = [str(c.limit) for c in checks]
    args = windows + limits
    started = time.perf_counter()
    try:
        result = await get_redis().eval(_RATE_LIMIT_MULTI_SCRIPT, len(keys), *keys, *args)
    except (RedisError, OSError, TimeoutError) as exc:
        emit_dependency_failure(
            event="ratelimit.redis_retry",
            namespace=namespace,
            category=category,
            dimension="route_ip",
            route_template=route_template,
            fail_mode="unknown",
            error_type=type(exc).__name__,
            redis_latency_ms=_elapsed_ms(started),
        )
        await close_redis()
        result = await get_redis().eval(_RATE_LIMIT_MULTI_SCRIPT, len(keys), *keys, *args)
    allowed = int(result[0]) == 1
    failed_index = int(result[1])
    retry_after = max(int(result[2]), 1) if len(result) > 2 else 1
    failed = checks[failed_index - 1] if not allowed and 0 < failed_index <= len(checks) else None
    return allowed, failed, retry_after


async def _counter_value(
    key: str,
    *,
    namespace: str = "",
    category: str = "",
    dimension: str = "route_ip",
    route_template: str | None = None,
) -> int | None:
    """Read a counter's current value for successful-response headers.

    Only called after an allowed multi-counter EVAL, whose verdict is already
    authoritative. This read is informational: if it fails or the key has just
    expired, the caller omits the headers rather than fabricating a remaining
    count. It deliberately does not retry or drop the Redis pool, because a
    failure here must not turn a successful request into an error. P10 logs it
    as an ``open`` dependency failure so a persistent read problem is visible.
    """
    started = time.perf_counter()
    try:
        value = await get_redis().get(key)
    except (RedisError, OSError, TimeoutError) as exc:
        emit_dependency_failure(
            event="ratelimit.counter_read_failure",
            namespace=namespace,
            category=category,
            dimension=dimension,
            route_template=route_template,
            fail_mode="open",
            error_type=type(exc).__name__,
            redis_latency_ms=_elapsed_ms(started),
        )
        return None
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _p3_identity_applies(resolved: ResolvedRateLimit) -> bool:
    if not getattr(settings, "RATE_LIMIT_P3_ENABLED", True):
        return False
    path = resolved.path or ""
    if any(path == p or path.startswith(p.rstrip("/") + "/") for p in getattr(settings, "RATE_LIMIT_P3_APPLY_IDENTITY_FOR_PREFIXES", [])):
        return True
    return resolved.category in set(getattr(settings, "RATE_LIMIT_P3_APPLY_IDENTITY_FOR_CATEGORIES", []))


def _build_p3_checks(
    request: Request,
    resolved: ResolvedRateLimit,
    user_id: str | None,
    identifier_hashes: dict[str, str],
) -> list[RateLimitCheck]:
    checks: list[RateLimitCheck] = []
    if not getattr(settings, "RATE_LIMIT_P3_ENABLED", True):
        return checks

    path = resolved.path or request.url.path
    ip = get_trusted_client_ip(request)
    bucket = resolved.bucket_path

    # Category/IP and user-based dimensions (additive) where configured/applicable.
    cat_limits = (getattr(settings, "RATE_LIMIT_P3_CATEGORY_IDENTITY_LIMITS", {}) or {}).get(resolved.category, {})
    if _p3_identity_applies(resolved):
        ip_limit = cat_limits.get("ip_limit")
        ip_window = cat_limits.get("ip_window") or 60
        if isinstance(ip_limit, int) and ip_limit > 0 and isinstance(ip_window, int) and ip_window > 0:
            checks.append(RateLimitCheck(
                key=f"rl:dim:ip:{resolved.category}:{bucket}:{ip}",
                limit=ip_limit,
                window_seconds=ip_window,
                dimension="ip",
                fail_closed=resolved.fail_closed,
            ))
        user_limit = cat_limits.get("user_limit")
        user_window = cat_limits.get("user_window") or 60
        if user_id and isinstance(user_limit, int) and user_limit > 0 and isinstance(user_window, int) and user_window > 0:
            checks.append(RateLimitCheck(
                key=f"rl:dim:user:{resolved.category}:{bucket}:{user_id}",
                limit=user_limit,
                window_seconds=user_window,
                dimension="user",
                fail_closed=resolved.fail_closed,
            ))
        # Extra per-identity windows for this category (P6 import: 5/10min).
        extras = (
            getattr(settings, "RATE_LIMIT_P3_CATEGORY_EXTRA_LIMITS", {}) or {}
        ).get(resolved.category, []) or []
        for extra in extras:
            if not isinstance(extra, dict):
                continue
            dimension = str(extra.get("dimension", "")).lower()
            limit = extra.get("limit")
            window = extra.get("window_seconds")
            if dimension not in {"ip", "user"}:
                continue
            if not isinstance(limit, int) or limit <= 0:
                continue
            if not isinstance(window, int) or window <= 0:
                continue
            subject = ip if dimension == "ip" else user_id
            if not subject:
                continue
            checks.append(RateLimitCheck(
                key=f"rl:dim:extra:{dimension}:{resolved.category}:{bucket}:{subject}",
                limit=limit,
                window_seconds=window,
                dimension=dimension,
                fail_closed=resolved.fail_closed,
            ))

    # Daily usage identity dimension (configurable/applicable).
    daily_cfgs = getattr(settings, "RATE_LIMIT_P3_DAILY_LIMITS", {}) or {}
    day = utc_day_bucket()
    daily_ttl = seconds_until_utc_midnight()

    def add_daily(dimension: str, subject: str) -> None:
        dcfg = daily_cfgs.get(f"{resolved.category}:{dimension}") or daily_cfgs.get(
            f"{resolved.namespace}:{dimension}"
        )
        if not isinstance(dcfg, dict):
            return
        dlimit = int(dcfg.get("limit", 0))
        dwin = int(dcfg.get("window_seconds", 86400))
        if dlimit <= 0 or dwin <= 0:
            return
        checks.append(RateLimitCheck(
            key=f"rl:dim:daily:{dimension}:{resolved.category}:{subject}:{day}",
            limit=dlimit,
            # Never outlive the UTC day the key is bucketed to. The day suffix
            # already prevents cross-day reuse; the clamp keeps the reset hint
            # accurate instead of reporting a rolling 24 hours.
            window_seconds=min(dwin, daily_ttl),
            dimension="daily",
            fail_closed=resolved.fail_closed,
        ))

    if user_id:
        add_daily("user", user_id)
    else:
        # Anonymous callers are protected by IP. An authenticated caller's user
        # quota is already shared across every IP, so a campus/NAT address cap
        # is not applied on top of it.
        add_daily("ip", ip)

    # Identifier + IP protections for auth/login/register/OTP/password reset.
    if "identifier" in (resolved.dimensions or ()):
        ilimits = getattr(settings, "RATE_LIMIT_P3_IDENTIFIER_LIMITS", {}) or {}
        def add_ident(cfg_key: str, key_suffix: str, dimension: str = "identifier"):
            cfg = ilimits.get(cfg_key)
            if not isinstance(cfg, dict):
                return
            limit = int(cfg.get("limit", 0))
            window = int(cfg.get("window_seconds", 0))
            if limit > 0 and window > 0:
                checks.append(RateLimitCheck(
                    key=f"rl:dim:ident:{cfg_key}:{key_suffix}",
                    limit=limit, window_seconds=window, dimension=dimension, fail_closed=True,
                ))

        if path == "/api/v1/auth/login":
            if "email" in identifier_hashes:
                add_ident("auth:login:email", identifier_hashes["email"])
            add_ident("auth:login:ip", ip)
        elif path == "/api/v1/auth/register":
            if "email" in identifier_hashes:
                add_ident("auth:register:email", identifier_hashes["email"])
            if "phone" in identifier_hashes:
                add_ident("auth:register:phone", identifier_hashes["phone"])
            add_ident("auth:register:ip", ip)
        elif path == "/api/v1/auth/login/otp/send":
            if "phone" in identifier_hashes:
                add_ident("auth:otp_send:phone", identifier_hashes["phone"])
            add_ident("auth:otp_send:ip", ip)
        elif path == "/api/v1/auth/login/otp/verify":
            if "phone" in identifier_hashes:
                add_ident("auth:otp_verify:phone", identifier_hashes["phone"])
            add_ident("auth:otp_verify:ip", ip)
        elif path == "/api/v1/auth/forgot-password":
            if "email" in identifier_hashes:
                add_ident("auth:password_reset:email", identifier_hashes["email"])
            add_ident("auth:password_reset:ip", ip)
        elif path == "/api/v1/auth/verify-email/resend":
            if "email" in identifier_hashes:
                add_ident("auth:otp_send:email", identifier_hashes["email"])
            add_ident("auth:otp_send:ip", ip)
        elif (
            path == "/api/v1/enquiries"
            and resolved.namespace == "p8:public_enquiry"
        ):
            # P8 public intake identifiers. A normalized phone/email shares one
            # bucket across formats and IPs; the value is already hashed, so no
            # PII reaches Redis or the logs. Staff lead creation from the admin
            # console shares the route but selects `p8:lead_create`, and is
            # intentionally not identifier-limited: one counsellor may
            # legitimately re-file the same student.
            p8_identifiers = (
                getattr(settings, "RATE_LIMIT_P8_IDENTIFIER_LIMITS", {}) or {}
            )
            for kind in ("phone", "email"):
                digest = identifier_hashes.get(kind)
                cfg = p8_identifiers.get(f"enquiry:{kind}")
                if not digest or not isinstance(cfg, dict):
                    continue
                try:
                    ident_limit = int(cfg.get("limit", 0))
                    ident_window = int(cfg.get("window_seconds", 0))
                except (TypeError, ValueError):
                    continue
                if ident_limit > 0 and ident_window > 0:
                    checks.append(RateLimitCheck(
                        key=f"rl:dim:p8:ident:enquiry:{kind}:{digest}",
                        limit=ident_limit,
                        window_seconds=ident_window,
                        dimension="identifier",
                        fail_closed=True,
                    ))

    # De-duplicate identical keys (defensive)
    uniq: dict[str, RateLimitCheck] = {}
    for c in checks:
        uniq[c.key] = c
    return list(uniq.values())


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not settings.RATE_LIMIT_ENABLED:
            return await call_next(request)

        resolved = _resolve_limit(request)
        if resolved is None:
            return await call_next(request)

        # P9: a fixed request-body field can select a stricter tier (role_ids on
        # the user PATCH -> role/permission-change ceiling). The body is parsed
        # here, before the bucket/limit are computed, so the stricter namespace
        # is the one enforced; `get_cached_json_body` replays it for the
        # endpoint, so request parsing downstream is unchanged.
        #
        # If the body cannot be inspected (too large, non-JSON content type, or
        # malformed), apply the strictest tier rather than the base one. Padding
        # a role-change payload past the inspection limit must not buy the
        # looser ordinary-mutation ceiling; an uninspectable request is charged
        # the sensitive limit and, if it really had no role change, that is only
        # the safer direction.
        body: dict | None = None
        if resolved.body_tiers or "identifier" in (resolved.dimensions or ()):
            body = await get_cached_json_body(request)
        if resolved.body_tiers:
            selected_tier = None
            if isinstance(body, dict):
                for tier in resolved.body_tiers:
                    if tier.field in body:
                        selected_tier = tier
                        break
            else:
                selected_tier = min(resolved.body_tiers, key=lambda t: t.limit)
            if selected_tier is not None:
                resolved = replace(
                    resolved,
                    namespace=selected_tier.namespace,
                    category=selected_tier.category,
                    limit=selected_tier.limit,
                    window_seconds=selected_tier.window_seconds,
                    fail_closed=selected_tier.fail_closed,
                )

        namespace = resolved.namespace
        max_requests = resolved.limit
        window = resolved.window_seconds
        bucket_path = resolved.bucket_path
        fail_closed_override = resolved.fail_closed

        # P3 identity/identifier extraction (server-side only).
        user_id = extract_verified_user_id(request)

        # Preserve existing trusted client IP extraction. P4 user-keyed read
        # policies (dashboard analytics) use the verified JWT subject; anonymous
        # callers fall back to the IP bucket so they are still limited.
        ip = _client_key(request)
        if resolved.key_dimension == "user" and user_id:
            route_key = f"rl:{namespace}:{bucket_path}:u:{user_id}"
        elif resolved.key_dimension == "article":
            # Blog views: validated article identity + trusted IP. The ref is
            # normalized/hashed, so a random path segment cannot mint an
            # unbounded set of keys, and query strings are ignored entirely.
            article = normalized_blog_article_key(request)
            route_key = f"rl:{namespace}:{bucket_path}:a:{article}:{ip}"
        else:
            route_key = f"rl:{namespace}:{bucket_path}:{ip}"

        body = body if (resolved.body_tiers or "identifier" in (resolved.dimensions or ())) else None
        identifier_hashes = extract_identifier_hashes(request, body) if isinstance(body, dict) else {}

        checks: list[RateLimitCheck] = [
            RateLimitCheck(
                key=route_key,
                limit=max_requests,
                window_seconds=window,
                dimension="route_ip",
                fail_closed=fail_closed_override,
            )
        ]
        checks.extend(_build_p3_checks(request, resolved, user_id, identifier_hashes))

        # Determine fail-open/closed for this request.
        effective_fail_closed = False
        for c in checks:
            if c.fail_closed is None:
                c_closed = c.key.startswith("rl:auth:") or namespace in FAIL_CLOSED_NAMESPACES or not settings.RATE_LIMIT_FAIL_OPEN
            else:
                c_closed = bool(c.fail_closed)
            effective_fail_closed = effective_fail_closed or c_closed

        success_headers: dict[str, str] | None = None
        rejection_limit = max_requests
        rejection_reset = 1
        rejection_dimension = "route_ip"
        rejected: RateLimitCheck | None = None
        route_template = resolved.route_template
        redis_started = time.perf_counter()

        try:
            if len(checks) == 1:
                count, retry = await _increment_counter(
                    route_key,
                    window,
                    namespace=namespace,
                    category=resolved.category,
                    route_template=route_template,
                )
                allowed = int(count) <= max_requests
                retry_after = int(retry)
                if allowed:
                    success_headers = _rate_limit_headers(
                        limit=max_requests,
                        remaining=max_requests - int(count),
                        reset=retry_after,
                    )
                else:
                    rejection_limit = max_requests
                    rejection_reset = retry_after
            else:
                allowed, failed, retry_after = await _check_multi_counters(
                    checks,
                    namespace=namespace,
                    category=resolved.category,
                    route_template=route_template,
                )
                rejected = failed
                if allowed:
                    # The multi script returns only the primary counter's TTL.
                    # Read its count for informational headers; if that read is
                    # unavailable, omit the headers rather than invent a value.
                    primary = checks[0]
                    primary_count = await _counter_value(
                        primary.key,
                        namespace=namespace,
                        category=resolved.category,
                        dimension=primary.dimension,
                        route_template=route_template,
                    )
                    if primary_count is not None:
                        success_headers = _rate_limit_headers(
                            limit=primary.limit,
                            remaining=primary.limit - primary_count,
                            reset=retry_after,
                        )
                else:
                    # Describe the counter that actually caused rejection, not
                    # an unrelated dimension with a looser limit.
                    rejection_limit = failed.limit if failed is not None else max_requests
                    rejection_reset = retry_after
                    rejection_dimension = (
                        failed.dimension if failed is not None else "route_ip"
                    )
        except (RedisError, OSError, TimeoutError) as exc:
            latency_ms = _elapsed_ms(redis_started)
            fail_mode = "closed" if effective_fail_closed else "open"
            # Reuse existing behavior/decision logic on Redis outage.
            logger.error(
                "Rate limiter unavailable for namespace %r (%s); failing %s",
                namespace,
                type(exc).__name__,
                fail_mode,
            )
            emit_dependency_failure(
                event="ratelimit.redis_error",
                namespace=namespace,
                category=resolved.category,
                dimension=rejection_dimension,
                route_template=route_template,
                fail_mode=fail_mode,
                error_type=type(exc).__name__,
                redis_latency_ms=latency_ms,
            )
            if effective_fail_closed:
                return _dependency_unavailable()
            return await call_next(request)

        redis_latency_ms = _elapsed_ms(redis_started)
        if not allowed:
            # Report the window of the counter that actually rejected the
            # request. On the multi-counter path that can be an identity or
            # daily counter whose window differs from the route window.
            rejection_window = (
                rejected.window_seconds if rejected is not None else window
            )
            emit_decision(
                outcome="throttled",
                namespace=namespace,
                category=resolved.category,
                dimension=rejection_dimension,
                route_template=route_template,
                http_status=429,
                redis_latency_ms=redis_latency_ms,
                limit=rejection_limit,
                window_seconds=rejection_window,
            )
            # Daily and paid-AI ceilings get a distinct alertable event: they
            # mean a quota ran out, not merely that a burst was paced.
            quota = None
            if rejected is not None and rejected.dimension == "daily":
                quota = "daily"
            elif resolved.category in {
                "ai_operations",
                "ai_question_generation",
                "ai_predictor",
            }:
                quota = "ai"
            if quota is not None:
                emit_quota_exhausted(
                    quota=quota,
                    namespace=namespace,
                    category=resolved.category,
                    dimension=rejection_dimension,
                    route_template=route_template,
                    limit=rejection_limit,
                    window_seconds=rejection_window,
                )
            # Preserve the existing 429 JSON schema/fields. Headers carry only
            # the numbers for the rejecting counter; no keys, IDs, or addresses.
            return _throttled(
                namespace,
                max_requests,
                rejection_reset,
                limit=rejection_limit,
                remaining=0,
                reset=rejection_reset,
            )

        emit_decision(
            outcome="allowed",
            namespace=namespace,
            category=resolved.category,
            dimension=checks[0].dimension,
            route_template=route_template,
            http_status=200,
            redis_latency_ms=redis_latency_ms,
            limit=checks[0].limit,
            window_seconds=checks[0].window_seconds,
        )
        response = await call_next(request)
        if success_headers:
            for name, value in success_headers.items():
                response.headers[name] = value
        return response