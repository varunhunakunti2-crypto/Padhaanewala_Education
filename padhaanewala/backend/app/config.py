import os
from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

#: Values that ship in `.env.example` as documentation. Treated as "no
#: credential supplied" so that an unedited checkout degrades to console
#: delivery with a warning instead of attempting a doomed HTTP call.
_PLACEHOLDER_SECRETS = {
    "",
    "change-me",
    "changeme",
    "change_me",
    "todo",
    "xxx",
    "your-api-key",
    "your_api_key",
    "none",
    "null",
}


def _is_placeholder(value: str) -> bool:
    return value.strip().lower() in _PLACEHOLDER_SECRETS


def _is_absolute_path(value: str) -> bool:
    """True if `value` is absolute **for the platform that will run the app**.

    `os.path.isabs` answers for the machine running the check, not the machine
    that will run the service: on Windows it reports `/var/lib/padhaanewala/media`
    as relative, which is exactly the value a Linux container needs. A config
    guard that only holds on the machine that runs the tests is a guard that is
    absent in production and misfires everywhere else, so both forms are
    accepted — a leading separator, or a drive letter.
    """
    text = value.strip()
    # A leading separator (POSIX or Windows) or a drive letter. `~` is *not*
    # absolute: nothing expands it, so `~/media` would be a literal directory
    # named `~` under the working directory.
    return text.startswith(("/", "\\")) or (len(text) > 1 and text[1] == ":")


#: Methods the limiter understands. An exemption for anything else is a typo,
#: and exempting a real data method disables throttling for it.
_RATE_LIMIT_KNOWN_METHODS = frozenset(
    {"GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"}
)


def _rate_limit_int(value, *, label: str) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{label} must be an integer, got {value!r}") from None


def _validate_limit_entries(mapping, *, label: str, minimum: int) -> None:
    """Validate a ``{name: {limit, window_seconds}}`` configuration map."""
    if not isinstance(mapping, dict):
        raise ValueError(
            f"{label} must be an object of name -> {{limit, window_seconds}}"
        )
    for name, entry in mapping.items():
        item = f"{label}[{name!r}]"
        if not isinstance(entry, dict):
            raise ValueError(f"{item} must be an object with limit and window_seconds")
        if "limit" not in entry and "window_seconds" not in entry:
            raise ValueError(f"{item} must define limit and/or window_seconds")
        if "limit" in entry:
            limit = _rate_limit_int(entry["limit"], label=f"{item}.limit")
            if limit < minimum:
                raise ValueError(f"{item}.limit must be >= {minimum} (got {limit})")
        if "window_seconds" in entry:
            window = _rate_limit_int(
                entry["window_seconds"], label=f"{item}.window_seconds"
            )
            if window <= 0:
                raise ValueError(f"{item}.window_seconds must be > 0 (got {window})")


def _validate_rate_limit_config(cfg, *, production: bool) -> None:
    """Validate every rate-limit setting at startup (P10).

    Two classes of problem are refused here rather than discovered in traffic:

    * **Dangerous production combinations** — a kill switch, a method exemption
      that unthrottles real traffic, a non-Redis ``REDIS_URL``, or a zero limit
      that silently disables a route.
    * **Malformed maps** — a typo such as ``window_seconds: "60s"`` would
      otherwise be ignored by the rule setters (they keep the default), so the
      operator would believe a limit was changed when it was not.

    Every message names the setting and echoes only its non-secret value. The
    Redis URL is never echoed; only the expected scheme is stated. This runs for
    all environments, with the production-only checks gated on ``production``.
    """
    minimum = 1 if production else 0

    if production:
        if not bool(getattr(cfg, "RATE_LIMIT_ENABLED", True)):
            raise ValueError(
                "RATE_LIMIT_ENABLED must be true in production; disabling the "
                "limiter removes every login, enquiry and AI quota"
            )
        if not bool(getattr(cfg, "RATE_LIMIT_POLICY_ENGINE_ENABLED", True)):
            raise ValueError(
                "RATE_LIMIT_POLICY_ENGINE_ENABLED must be true in production; "
                "disabling it bypasses the centralized route policy engine"
            )
        exempt = {
            str(method).upper()
            for method in (getattr(cfg, "RATE_LIMIT_EXEMPT_METHODS", []) or [])
        }
        dangerous = exempt & ({"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"})
        if dangerous:
            raise ValueError(
                "RATE_LIMIT_EXEMPT_METHODS must not exempt real traffic methods "
                f"in production (got {sorted(dangerous)}); only OPTIONS is safe"
            )
        redis_url = str(getattr(cfg, "REDIS_URL", "") or "")
        if not redis_url.startswith(("redis://", "rediss://", "unix://")):
            raise ValueError(
                "REDIS_URL must use the redis://, rediss:// or unix:// scheme in "
                "production; the shared counters cannot work with any other URL"
            )

    for attr in (
        "RATE_LIMIT_CATEGORY_DEFAULTS",
        "RATE_LIMIT_NAMED_DEFAULTS",
        "RATE_LIMIT_READ_CATEGORY_LIMITS",
        "RATE_LIMIT_P7_STUDENT_LIMITS",
        "RATE_LIMIT_P8_CRM_LIMITS",
        "RATE_LIMIT_P9_ROLE_LIMITS",
        "RATE_LIMIT_P9_SENSITIVE_LIMITS",
        "RATE_LIMIT_P3_IDENTIFIER_LIMITS",
        "RATE_LIMIT_P3_DAILY_LIMITS",
        "RATE_LIMIT_P8_IDENTIFIER_LIMITS",
    ):
        _validate_limit_entries(
            getattr(cfg, attr, {}) or {}, label=attr, minimum=minimum
        )

    identity = getattr(cfg, "RATE_LIMIT_P3_CATEGORY_IDENTITY_LIMITS", {}) or {}
    if not isinstance(identity, dict):
        raise ValueError(
            "RATE_LIMIT_P3_CATEGORY_IDENTITY_LIMITS must be an object of "
            "category -> {ip_limit, user_limit, ip_window, user_window}"
        )
    for name, entry in identity.items():
        item = f"RATE_LIMIT_P3_CATEGORY_IDENTITY_LIMITS[{name!r}]"
        if not isinstance(entry, dict):
            raise ValueError(f"{item} must be an object")
        for key in ("ip_limit", "user_limit"):
            value = entry.get(key)
            if value is None:
                continue  # None deliberately disables this dimension
            limit = _rate_limit_int(value, label=f"{item}.{key}")
            if limit < minimum:
                raise ValueError(f"{item}.{key} must be >= {minimum} (got {limit})")
        for key in ("ip_window", "user_window"):
            value = entry.get(key)
            if value is None:
                continue
            window = _rate_limit_int(value, label=f"{item}.{key}")
            if window <= 0:
                raise ValueError(f"{item}.{key} must be > 0 (got {window})")

    extras = getattr(cfg, "RATE_LIMIT_P3_CATEGORY_EXTRA_LIMITS", {}) or {}
    if not isinstance(extras, dict):
        raise ValueError(
            "RATE_LIMIT_P3_CATEGORY_EXTRA_LIMITS must be an object of "
            "category -> [dimension/limit/window entries]"
        )
    for name, entries in extras.items():
        if not isinstance(entries, list):
            raise ValueError(
                f"RATE_LIMIT_P3_CATEGORY_EXTRA_LIMITS[{name!r}] must be a list"
            )
        for index, entry in enumerate(entries):
            item = f"RATE_LIMIT_P3_CATEGORY_EXTRA_LIMITS[{name!r}][{index}]"
            if not isinstance(entry, dict):
                raise ValueError(f"{item} must be an object")
            dimension = str(entry.get("dimension", "")).lower()
            if dimension not in {"ip", "user"}:
                raise ValueError(f"{item}.dimension must be 'ip' or 'user'")
            limit = _rate_limit_int(entry.get("limit"), label=f"{item}.limit")
            window = _rate_limit_int(
                entry.get("window_seconds"), label=f"{item}.window_seconds"
            )
            if limit < minimum:
                raise ValueError(f"{item}.limit must be >= {minimum} (got {limit})")
            if window <= 0:
                raise ValueError(f"{item}.window_seconds must be > 0 (got {window})")

    unauthenticated = getattr(cfg, "RATE_LIMIT_P9_UNAUTHENTICATED_ADMIN", {}) or {}
    if not isinstance(unauthenticated, dict):
        raise ValueError(
            "RATE_LIMIT_P9_UNAUTHENTICATED_ADMIN must be an object with "
            "limit and window_seconds"
        )
    _validate_limit_entries(
        {"unauthenticated_admin": unauthenticated},
        label="RATE_LIMIT_P9_UNAUTHENTICATED_ADMIN",
        minimum=minimum,
    )

    exempt = {
        str(method).upper()
        for method in (getattr(cfg, "RATE_LIMIT_EXEMPT_METHODS", []) or [])
    }
    unknown = exempt - _RATE_LIMIT_KNOWN_METHODS
    if unknown:
        raise ValueError(
            f"RATE_LIMIT_EXEMPT_METHODS contains unknown methods {sorted(unknown)}"
        )

    fallback_methods = {
        str(method).upper()
        for method in (
            getattr(cfg, "RATE_LIMIT_DEFAULT_FALLBACK_METHODS", []) or []
        )
    }
    unknown = fallback_methods - _RATE_LIMIT_KNOWN_METHODS
    if unknown:
        raise ValueError(
            "RATE_LIMIT_DEFAULT_FALLBACK_METHODS contains unknown methods "
            f"{sorted(unknown)}"
        )
    if bool(getattr(cfg, "RATE_LIMIT_DEFAULT_FALLBACK_ENABLED", False)):
        limit = _rate_limit_int(
            getattr(cfg, "RATE_LIMIT_DEFAULT_FALLBACK_LIMIT", 0),
            label="RATE_LIMIT_DEFAULT_FALLBACK_LIMIT",
        )
        window = _rate_limit_int(
            getattr(cfg, "RATE_LIMIT_DEFAULT_FALLBACK_WINDOW_SECONDS", 0),
            label="RATE_LIMIT_DEFAULT_FALLBACK_WINDOW_SECONDS",
        )
        if limit <= 0 or window <= 0:
            raise ValueError(
                "RATE_LIMIT_DEFAULT_FALLBACK_LIMIT and "
                "RATE_LIMIT_DEFAULT_FALLBACK_WINDOW_SECONDS must both be > 0 "
                "when the fallback policy is enabled"
            )
        if not fallback_methods:
            raise ValueError(
                "RATE_LIMIT_DEFAULT_FALLBACK_METHODS must not be empty when the "
                "fallback policy is enabled"
            )

    def _validate_override(
        entry, *, label: str, default_match: str
    ) -> None:
        if not isinstance(entry, dict):
            raise ValueError(f"{label} must be an object")
        enabled = bool(entry.get("enabled", True))
        # An override without a limit can only be a disabled placeholder. If it
        # is enabled, the limit is the whole point of the entry, and silently
        # defaulting it would create a route the operator believes is configured
        # when it is not.
        if enabled and "limit" not in entry:
            raise ValueError(
                f"{label}.limit is required unless the override is disabled"
            )
        limit = _rate_limit_int(entry.get("limit", 0), label=f"{label}.limit")
        window = _rate_limit_int(
            entry.get("window_seconds", 60), label=f"{label}.window_seconds"
        )
        if window <= 0:
            raise ValueError(f"{label}.window_seconds must be > 0 (got {window})")
        if enabled and limit < minimum:
            raise ValueError(f"{label}.limit must be >= {minimum} (got {limit})")
        match = str(entry.get("match", default_match))
        if match not in {"exact", "prefix"}:
            raise ValueError(f"{label}.match must be 'exact' or 'prefix'")
        methods = {str(m).upper() for m in (entry.get("methods") or [])}
        unknown_methods = methods - _RATE_LIMIT_KNOWN_METHODS
        if unknown_methods:
            raise ValueError(
                f"{label}.methods contains unknown methods {sorted(unknown_methods)}"
            )

    exact = getattr(cfg, "RATE_LIMIT_EXACT_OVERRIDES", {}) or {}
    if not isinstance(exact, dict):
        raise ValueError("RATE_LIMIT_EXACT_OVERRIDES must be an object")
    for pattern, entry in exact.items():
        _validate_override(
            entry,
            label=f"RATE_LIMIT_EXACT_OVERRIDES[{pattern!r}]",
            default_match="exact",
        )
    prefix = getattr(cfg, "RATE_LIMIT_PREFIX_OVERRIDES", []) or []
    if not isinstance(prefix, list):
        raise ValueError("RATE_LIMIT_PREFIX_OVERRIDES must be a list")
    for index, entry in enumerate(prefix):
        _validate_override(
            entry,
            label=f"RATE_LIMIT_PREFIX_OVERRIDES[{index}]",
            default_match="prefix",
        )



class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=os.getenv("PADHAANEWALA_ENV_FILE", ".env.development"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    APP_ENV: Literal["development", "staging", "production"] = "development"
    APP_NAME: str = "Padhaanewala"
    APP_URL: str = "http://localhost:3000"
    API_URL: str = "http://localhost:8000"
    SECRET_KEY: str = "change-me"
    CORS_ORIGINS: str = "http://localhost:3000"
    TIMEZONE: str = "Asia/Kolkata"

    #: Hosts permitted in the `Host` header. Empty means "derive from
    #: APP_URL/URL", never "allow everything" — a Host header is attacker
    #: controlled and is used to build absolute URLs and cache keys.
    ALLOWED_HOSTS: str = ""

    #: Number of reverse proxies in front of the app (Caddy, Cloudflare, ...).
    #: `X-Forwarded-For` is a client-supplied list, so the client IP is only
    #: trustworthy by taking the entry this many hops from the right. At 0 the
    #: header is ignored entirely and the socket peer is used. Wrong in one
    #: direction it lets an attacker forge their IP to defeat rate limiting and
    #: poison the audit log; wrong in the other it blames an innocent user.
    TRUSTED_PROXY_HOPS: int = 0

    DB_HOST: str = "localhost"
    DB_PORT: int = 5433
    DB_NAME: str = "padhaanewala_dev"
    DB_USER: str = "padhaanewala"
    DB_PASSWORD: str = "dev_password_123"

    #: Connection pool. Sized for production, not for a single script — the
    #: SQLAlchemy default of 5/10 was exhausted by build-time prerendering and
    #: hung a request for 11 minutes before timing out.
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT_SECONDS: int = 10
    DATABASE_URL: str = (
        "postgresql+psycopg2://padhaanewala:dev_password_123@localhost:5433/padhaanewala_dev"
    )

    REDIS_URL: str = "redis://localhost:6379/0"
    RATE_LIMIT_ENABLED: bool = True

    #: Socket timeout for Redis commands. Deliberately small: Redis is a
    #: fast-fail dependency on the request path, and the default 5 s socket
    #: timeout would hold a request open for five seconds on every write while
    #: a Redis node is unreachable. Failing fast is what lets the rate limiter
    #: decide its open/closed behaviour instead of the whole worker stalling.
    REDIS_SOCKET_TIMEOUT_SECONDS: float = 0.25

    #: `health_check` pings Redis to decide whether to report degraded. Kept
    #: short for the same reason, but independent of the request-path timeout
    #: so a probe can be retried without compounding the outage.
    REDIS_HEALTH_TIMEOUT_SECONDS: float = 0.5

    #: Whether a Redis failure throttles or permits. `False` keeps the previous
    #: fail-open behaviour for every route; the rate limiter still fails closed
    #: on `/api/v1/auth/*` regardless, because an unreachable counter on the
    #: login path is exactly the window an attacker picks. This flag governs the
    #: public lead-capture and predictor routes only.
    RATE_LIMIT_FAIL_OPEN: bool = True

    # --- P10 observability -------------------------------------------------
    # Structured JSON events go to the existing stdout log stream (the one
    # Caddy already writes JSON to). The allowed-request event is off by
    # default because public catalogue reads are high-volume; throttles,
    # dependency failures and quota exhaustion are always emitted. Enabling it
    # adds per-route statistics to the log stream, which the log platform
    # aggregates. The helpers accept only bounded labels — never an IP, user
    # id, identifier hash, token, prompt or raw path.
    RATE_LIMIT_OBSERVABILITY_ENABLED: bool = True
    RATE_LIMIT_OBSERVABILITY_LOG_ALLOWED: bool = False

    # --- Centralized rate-limit policy engine (P2) -----------------------
    # Single source of truth for route classification lives in
    # `app.middleware.rate_limit_policy`. Defaults below preserve existing
    # effective limits/coverage; endpoint-specific protections are added in
    # later phases.
    RATE_LIMIT_POLICY_ENGINE_ENABLED: bool = True
    # Explicit method exemptions (OPTIONS kept safe for CORS preflight).
    RATE_LIMIT_EXEMPT_METHODS: list[str] = ["OPTIONS"]
    # Default fallback for unclassified requests. Disabled in P2 to avoid
    # silently changing endpoint limits while architecture is introduced.
    RATE_LIMIT_DEFAULT_FALLBACK_ENABLED: bool = False
    RATE_LIMIT_DEFAULT_FALLBACK_CATEGORY: str = "anonymous_api"
    RATE_LIMIT_DEFAULT_FALLBACK_NAMESPACE: str = "default"
    RATE_LIMIT_DEFAULT_FALLBACK_LIMIT: int = 60
    RATE_LIMIT_DEFAULT_FALLBACK_WINDOW_SECONDS: int = 60
    RATE_LIMIT_DEFAULT_FALLBACK_METHODS: list[str] = ["POST", "PUT", "PATCH", "DELETE"]
    RATE_LIMIT_DEFAULT_FALLBACK_FAIL_CLOSED: bool | None = None
    # Configurable overrides (JSON-compatible structures via env/settings):
    # exact: {"/path": {"limit":..,"window_seconds":..,"methods":[..], ...}}
    # prefix: [{"pattern":"/prefix","match":"prefix","limit":..,"window_seconds":..,"methods":[..], ...}]
    RATE_LIMIT_EXACT_OVERRIDES: dict = {}
    RATE_LIMIT_PREFIX_OVERRIDES: list = []
    # Category default policy values (centralized, configurable).
    RATE_LIMIT_CATEGORY_DEFAULTS: dict[str, dict[str, int]] = {
        "authenticated_api": {"limit": 120, "window_seconds": 60},
        "anonymous_api": {"limit": 60, "window_seconds": 60},
        "public_catalogue": {"limit": 60, "window_seconds": 60},
        "authentication": {"limit": 20, "window_seconds": 60},
        "student_operations": {"limit": 60, "window_seconds": 60},
        "mock_test_operations": {"limit": 60, "window_seconds": 60},
        # P6 — AI endpoints are cost-bearing. The route-level limit is a second
        # ceiling behind the per-identity/daily dimensions below; the identity
        # limits are the primary control because they follow the verified user
        # across IPs. These values are applied to write rules for the categories
        # listed in ``RATE_LIMIT_WRITE_LIMIT_CONFIG_CATEGORIES``.
        "ai_operations": {"limit": 10, "window_seconds": 60},
        "ai_question_generation": {"limit": 3, "window_seconds": 60},
        "ai_predictor": {"limit": 10, "window_seconds": 60},
        "file_uploads": {"limit": 30, "window_seconds": 60},
        "enquiries_crm": {"limit": 5, "window_seconds": 3600},
        "admin_operations": {"limit": 120, "window_seconds": 60},
    }
    # Initial named endpoint-category defaults (P2 requirements).
    RATE_LIMIT_NAMED_DEFAULTS: dict[str, dict[str, int]] = {
        "college_search": {"limit": 30, "window_seconds": 60},
        "course_search": {"limit": 30, "window_seconds": 60},
        "catalogue_statistics": {"limit": 10, "window_seconds": 60},
        "dashboard_analytics": {"limit": 30, "window_seconds": 60},
    }
    # --- P4 read-route limits (GET/HEAD only) ----------------------------
    # Centralized starting limits for explicitly classified read routes. These
    # are applied by `app.middleware.rate_limit_policy.build_runtime_rules`, so
    # changing a value here takes effect without touching code. Routes not
    # listed/classified remain unthrottled (no blanket GET rule).
    RATE_LIMIT_READ_CATEGORY_LIMITS: dict[str, dict[str, int]] = {
        "anonymous_api": {"limit": 60, "window_seconds": 60},
        "public_catalogue": {"limit": 60, "window_seconds": 60},
        "college_search": {"limit": 30, "window_seconds": 60},
        "course_search": {"limit": 30, "window_seconds": 60},
        "catalogue_statistics": {"limit": 10, "window_seconds": 60},
        "catalogue_listings": {"limit": 60, "window_seconds": 60},
        "media_access": {"limit": 30, "window_seconds": 60},
        "dashboard_analytics": {"limit": 30, "window_seconds": 60},
    }

    # Write-route categories whose route-level limit/window is read from
    # ``RATE_LIMIT_CATEGORY_DEFAULTS`` at request time. Deliberately opt-in: the
    # existing auth/enquiry/predictor write rules have hand-tuned limits that are
    # not the category default, and applying the category default to them would
    # change P2/P3 behaviour. P6 adds only the AI categories here so operators
    # can tune the cost-bearing ceilings without editing code.
    RATE_LIMIT_WRITE_LIMIT_CONFIG_CATEGORIES: list[str] = [
        "ai_operations",
        "ai_question_generation",
        "ai_predictor",
    ]

    # --- Multi-dimensional rate limiting (P3) ----------------------------
    # Additive identity/identifier/daily dimensions layered on top of existing
    # endpoint-specific route policies. Existing route limits/namespaces remain
    # the primary enforcement to preserve behavior and scheduled phases.
    RATE_LIMIT_P3_ENABLED: bool = True
    # Initial P3 identity-based limits by category (IP/user). These are applied
    # as additional dimensions where safe/applicable; existing endpoint-specific
    # policies are preserved until their scheduled implementation phases.
    RATE_LIMIT_P3_CATEGORY_IDENTITY_LIMITS: dict[str, dict[str, int | None]] = {
        "authenticated_api": {"ip_limit": 60, "ip_window": 60, "user_limit": 120, "user_window": 60},
        "anonymous_api": {"ip_limit": 60, "ip_window": 60, "user_limit": None, "user_window": 60},
        # P7 student operations are already keyed by the verified user (IP only
        # as the anonymous fallback). A second shared-IP counter here would let
        # one student on a campus NAT exhaust another's quota, so it is off.
        "student_operations": {"ip_limit": None, "ip_window": 60, "user_limit": None, "user_window": 60},
        "admin_operations": {"ip_limit": 120, "ip_window": 60, "user_limit": 120, "user_window": 60},
        "ai_operations": {"ip_limit": 10, "ip_window": 60, "user_limit": 10, "user_window": 60},
        # P6 — PDF/Gemini import: 3/min per identity; the extra 5/10min ceiling
        # is added by ``RATE_LIMIT_P3_CATEGORY_EXTRA_LIMITS`` below.
        "ai_question_generation": {"ip_limit": 3, "ip_window": 60, "user_limit": 3, "user_window": 60},
        # Predictor is deterministic and calls no paid provider; it is limited
        # for capacity/abuse reasons, not spend, and stays fail-open.
        "ai_predictor": {"ip_limit": 10, "ip_window": 60, "user_limit": 10, "user_window": 60},
        "file_uploads": {"ip_limit": 5, "ip_window": 600, "user_limit": 5, "user_window": 600},
        # Safe defaults for other categories (additive dimensions may be enabled later).
        "authentication": {"ip_limit": 60, "ip_window": 60, "user_limit": None, "user_window": 60},
        "public_catalogue": {"ip_limit": 60, "ip_window": 60, "user_limit": None, "user_window": 60},
        "mock_test_operations": {"ip_limit": 60, "ip_window": 60, "user_limit": 120, "user_window": 60},
        "enquiries_crm": {"ip_limit": 60, "ip_window": 60, "user_limit": None, "user_window": 60},
        # P4: dashboard reads are primarily user-keyed (30/min); this IP ceiling
        # is an anti-abuse guard for one address fanning out across accounts.
        "dashboard_analytics": {"ip_limit": 120, "ip_window": 60, "user_limit": None, "user_window": 60},
    }
    # Route categories/prefixes where P3 category user/IP dimensions are applied
    # now (without replacing existing endpoint-specific route policies). P3.1
    # activates the configured identity limits for every category that has
    # explicitly classified write routes (see
    # `app.middleware.rate_limit_policy.default_policy_rules`). Categories
    # without an explicit classification here intentionally receive no
    # category-level dimensions.
    RATE_LIMIT_P3_APPLY_IDENTITY_FOR_CATEGORIES: list[str] = [
        "authentication",
        "authenticated_api",
        "anonymous_api",
        "student_operations",
        "admin_operations",
        "ai_operations",
        "ai_question_generation",
        "ai_predictor",
        "file_uploads",
        "dashboard_analytics",
    ]
    RATE_LIMIT_P3_APPLY_IDENTITY_FOR_PREFIXES: list[str] = [
        "/api/v1/auth",
    ]
    # Identifier+IP protection for login/register/OTP/password reset flows.
    RATE_LIMIT_P3_IDENTIFIER_LIMITS: dict[str, dict[str, int]] = {
        "auth:login:email": {"limit": 10, "window_seconds": 600},
        "auth:login:ip": {"limit": 20, "window_seconds": 600},
        "auth:register:email": {"limit": 5, "window_seconds": 3600},
        "auth:register:phone": {"limit": 5, "window_seconds": 3600},
        "auth:register:ip": {"limit": 10, "window_seconds": 3600},
        "auth:otp_send:phone": {"limit": 5, "window_seconds": 600},
        "auth:otp_send:email": {"limit": 5, "window_seconds": 600},
        "auth:otp_send:ip": {"limit": 20, "window_seconds": 600},
        "auth:otp_verify:phone": {"limit": 10, "window_seconds": 600},
        "auth:otp_verify:ip": {"limit": 30, "window_seconds": 600},
        "auth:password_reset:email": {"limit": 5, "window_seconds": 3600},
        "auth:password_reset:ip": {"limit": 10, "window_seconds": 3600},
    }
    # Daily usage identity limits (applied where explicitly configured).
    # Example key: "ai_operations:user" -> {"limit": 100, "window_seconds": 86400}
    # P6: UTC calendar-day buckets. The user key is shared across every IP, so a
    # signed-in caller cannot reset their quota by changing network. The ``:ip``
    # key is applied only when there is no verified user (anonymous requests),
    # which protects NAT/shared addresses without making a campus IP cap an
    # authenticated student's limit.
    RATE_LIMIT_P3_DAILY_LIMITS: dict[str, dict[str, int]] = {
        "ai_operations:user": {"limit": 100, "window_seconds": 86400},
        "ai_operations:ip": {"limit": 100, "window_seconds": 86400},
        "ai_question_generation:user": {"limit": 10, "window_seconds": 86400},
        "ai_question_generation:ip": {"limit": 10, "window_seconds": 86400},
        "ai_predictor:user": {"limit": 50, "window_seconds": 86400},
        "ai_predictor:ip": {"limit": 50, "window_seconds": 86400},
    }
    # Additional per-identity windows for a category, on top of the single
    # ip/user pair in ``RATE_LIMIT_P3_CATEGORY_IDENTITY_LIMITS``. P6 uses this
    # for the PDF/Gemini import's 5-per-10-minutes ceiling.
    RATE_LIMIT_P3_CATEGORY_EXTRA_LIMITS: dict[str, list[dict]] = {
        "ai_question_generation": [
            {"dimension": "ip", "limit": 5, "window_seconds": 600},
            {"dimension": "user", "limit": 5, "window_seconds": 600},
        ],
    }

    # --- P7 student operations & mock-test limits -------------------------
    # Endpoint-specific limits for the student-facing write/read surfaces. The
    # keys are stable operation names mapped to explicit route templates in
    # `app.middleware.rate_limit_policy.default_policy_rules`; an operator can
    # tune any number here (or set it to 0 to disable that operation) without
    # touching code. These are *per-operation primary buckets keyed by the
    # verified JWT subject*, with the trusted client IP used only as the
    # fallback for an unauthenticated/invalid-token caller (whose request is
    # then rejected by the endpoint's auth dependency).
    #
    # No additional shared-IP counter is applied to these operations: a student
    # on a campus NAT must not consume another student's quota. See
    # ``RATE_LIMIT_P3_CATEGORY_IDENTITY_LIMITS`` ("student_operations").
    RATE_LIMIT_P7_STUDENT_LIMITS: dict[str, dict[str, int]] = {
        "mock_test_start": {"limit": 10, "window_seconds": 60},
        "mock_test_answer": {"limit": 60, "window_seconds": 60},
        "mock_test_submit": {"limit": 5, "window_seconds": 600},
        "mock_test_review": {"limit": 5, "window_seconds": 3600},
        "saved_college_write": {"limit": 30, "window_seconds": 60},
        "profile_update": {"limit": 10, "window_seconds": 60},
        "consent_write": {"limit": 5, "window_seconds": 3600},
        "student_notifications": {"limit": 30, "window_seconds": 60},
    }

    # --- P8 CRM, enquiry and lead-generation limits ------------------------
    # The public site has one intake endpoint (`POST /api/v1/enquiries`) that
    # serves the admission, counselling and contact forms, so those three
    # operations share the stricter `public_enquiry` ceiling. Admin/counsellor
    # "add lead" uses the same route: the verified access-token role selects
    # `lead_create` instead, so staff are not held to the public form limit.
    #
    # A non-positive or malformed value leaves the centralized default in place
    # rather than silently unthrottling a route that can trigger paid
    # notifications or CRM writes. Lead writes are keyed by the verified JWT
    # subject; public submissions are keyed by the same subject when signed in
    # and by the trusted client IP otherwise. No shared-IP category counter is
    # applied, so students behind one NAT stay independent.
    RATE_LIMIT_P8_CRM_LIMITS: dict[str, dict[str, int]] = {
        "public_enquiry": {"limit": 3, "window_seconds": 600},
        "lead_create": {"limit": 10, "window_seconds": 60},
        "lead_update": {"limit": 30, "window_seconds": 60},
        "blog_view": {"limit": 10, "window_seconds": 3600},
    }
    # Identifier windows for the public intake form. Values are normalized with
    # the same helpers OTP/auth use and SHA-256 hashed before they become Redis
    # key material; raw email/mobile never reaches a key or a log line. They are
    # additive to the primary request ceiling and are what make "rotate the IP,
    # resend the same phone" expensive.
    RATE_LIMIT_P8_IDENTIFIER_LIMITS: dict[str, dict[str, int]] = {
        "enquiry:phone": {"limit": 3, "window_seconds": 600},
        "enquiry:email": {"limit": 3, "window_seconds": 600},
    }

    # --- P9 admin operations, role-based limits and sensitive actions ------
    # General admin ceilings, selected from the *verified* access-token role
    # claim. These are throttling tiers only; the endpoint's own
    # ``require_role`` guard still performs the authoritative DB-backed
    # authorization check. A token carrying several roles receives the
    # highest-ranked tier it holds (``app.roles.PRIVILEGE_ORDER``), so it can
    # never combine two tiers or choose one from the request.
    #
    # The base value applies to every caller with no recognised admin role --
    # including anonymous, student and forged-token callers. That is what keeps
    # an unauthenticated caller from receiving an administrator's quota even if
    # it reaches an admin route (where the endpoint then rejects it).
    RATE_LIMIT_P9_ROLE_LIMITS: dict[str, dict[str, int]] = {
        "super_admin": {"limit": 180, "window_seconds": 60},
        "admin": {"limit": 120, "window_seconds": 60},
        "content_manager": {"limit": 120, "window_seconds": 60},
        "seo_manager": {"limit": 90, "window_seconds": 60},
        "counsellor": {"limit": 90, "window_seconds": 60},
    }
    RATE_LIMIT_P9_UNAUTHENTICATED_ADMIN: dict[str, int] = {
        "limit": 10,
        "window_seconds": 60,
    }
    # Sensitive operations keep their own fixed ceiling regardless of role:
    # promotion is not a reason to allow a super_admin to bulk-import, upload or
    # rewrite settings faster. Every entry is a per-user bucket (trusted IP only
    # when there is no verified token), and every mutation fails closed on a
    # Redis outage.
    #
    # ``bulk_import`` deliberately does not replace the stricter P6
    # ``POST /question-imports/pdf`` ceiling (3/min), which remains the paid
    # Gemini import's limit; the 5/min bulk ceiling covers the review-all bulk
    # action on the same router.
    RATE_LIMIT_P9_SENSITIVE_LIMITS: dict[str, dict[str, int]] = {
        "bulk_import": {"limit": 5, "window_seconds": 60},
        "media_upload": {"limit": 10, "window_seconds": 600},
        "settings_update": {"limit": 10, "window_seconds": 60},
        "ai_settings": {"limit": 3, "window_seconds": 60},
        "role_change": {"limit": 5, "window_seconds": 60},
        "user_mutation": {"limit": 20, "window_seconds": 60},
        "audit_read": {"limit": 30, "window_seconds": 60},
    }

    JWT_SECRET_KEY: str = "change-me"
    JWT_REFRESH_SECRET_KEY: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    # R3.4 — short access-token lifetime. `POST /auth/logout` is a no-op echo stub
    # with no denylist, so a leaked access token cannot be revoked and the window
    # *is* the containment. 30 minutes bounds the damage of a stolen token.
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    BCRYPT_ROUNDS: int = 12

    #: Production access tokens may not exceed this. R3.4 caps the window at
    #: 60 minutes; anything above is rejected at startup rather than shipped.
    MAX_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ---------------------------------------------------------------- Phase 3
    # Session ledger. The refresh token is delivered as an HttpOnly cookie scoped
    # to the auth path, never in a response body that any script in the origin
    # can read. `MAX_ACTIVE_REFRESH_TOKENS` bounds *concurrent sessions*
    # (rotation families), not token rows — one device refreshing every 25
    # minutes writes ~1,700 rows over its 30-day life and must never be treated
    # as 1,700 sessions.
    REFRESH_COOKIE_NAME: str = "pdw_refresh"
    REFRESH_COOKIE_PATH: str = "/api/v1/auth"
    MAX_ACTIVE_REFRESH_TOKENS: int = 8

    # ---------------------------------------------------------------- Phase 3
    # Email delivery. `console` renders the message to the log instead of
    # sending it, which is the only mode that can work before the (paid) provider
    # accounts exist. The provider value is deliberately *not* the switch that
    # decides real vs. console delivery — `email_service` also treats an
    # unconfigured credential as "not configured" and falls back, so a developer
    # who leaves the shipped `change-me` in place gets a warning and a log line
    # rather than a connection error.
    EMAIL_PROVIDER: Literal["smtp", "sendgrid", "console"] = "console"
    EMAIL_API_KEY: str = "change-me"
    EMAIL_SMTP_HOST: str = "smtp.mailtrap.io"
    EMAIL_SMTP_PORT: int = 2525
    EMAIL_SMTP_USER: str = "change-me"
    EMAIL_SMTP_PASSWORD: str = "change-me"
    EMAIL_FROM_EMAIL: str = "no-reply@padhaanewala.in"
    EMAIL_FROM_NAME: str = "Padhaanewala"
    #: When true, `POST /auth/login` refuses an unverified account with 403.
    EMAIL_VERIFICATION_REQUIRED: bool = False
    #: Link lifetimes. Email links are long-lived because they are only usable
    #: once and are the sole recovery path; a password-reset link is short-lived
    #: because it is a bearer credential for the account itself.
    EMAIL_VERIFICATION_TOKEN_TTL_MINUTES: int = 1440
    EMAIL_PASSWORD_RESET_TOKEN_TTL_MINUTES: int = 60

    # SMS delivery via MSG91. India requires a registered DLT template id for
    # every transactional message, so the template is a first-class setting
    # rather than something inferred from the sender id.
    SMS_PROVIDER: Literal["msg91", "console"] = "console"
    SMS_API_KEY: str = "change-me"
    SMS_SENDER_ID: str = "PADNEWL"
    SMS_DLT_TEMPLATE_ID: str = "change-me"
    SMS_OTP_LENGTH: int = 6
    SMS_OTP_TTL_SECONDS: int = 300
    SMS_OTP_MAX_SENDS_PER_WINDOW: int = 3
    SMS_OTP_RATE_WINDOW_MINUTES: int = 10
    SMS_OTP_MAX_VERIFY_ATTEMPTS: int = 5

    # --- Uploaded media -------------------------------------------------
    #
    # The `media` table has always been a *registry* of URLs, not a store: it
    # records where an image already lives. There was no way to put a file into
    # the system through the API, so every seeded row pointed at
    # `https://example.com/img.jpg` and the admin panel's "Upload" button fired
    # a toast.
    #
    # Files are written under this root and served back by
    # `GET /media/files/{id}`, which is same-origin — so the root is part of the
    # trusted computing base, and only raster formats are accepted. SVG is
    # refused for exactly that reason. See `app/media_store.py`.
    MEDIA_ROOT: str = "var/media"
    #: Ceiling per file, checked against the bytes actually read rather than the
    #: declared `Content-Length`, which is client-controlled.
    MEDIA_MAX_BYTES: int = 5 * 1024 * 1024
    #: Public path prefix for the serving route. The value is baked into
    #: `media.url`, so changing it after seeding orphans existing rows.
    MEDIA_URL_PREFIX: str = "/api/v1/media/files"

    # --- PDF question import ---------------------------------------------
    #
    # An admin uploads a question-paper PDF and Gemini drafts MCQs from the
    # extracted text. Nothing reaches a student until an admin approves each
    # draft, so the AI's output is never trusted -- see
    # `app/services/question_generation.py`.
    #
    # These are deliberately separate from `MEDIA_*`: a question paper is 5-40 MB
    # of PDF, not a 5 MB hero image, and it is never served back over the
    # same-origin media route. It is read once, turned into rows, and discarded.
    PDF_IMPORT_MAX_BYTES: int = 20 * 1024 * 1024
    #: Pages read from a PDF. A 300-page compiled book is not a question paper,
    #: and the cost of a generation call is roughly proportional to the text
    #: sent. Refusing is better than silently truncating a paper mid-question.
    PDF_IMPORT_MAX_PAGES: int = 200
    #: Characters of extracted text handed to the model per call. Chosen so a
    #: page of dense prose fits with room to spare; the text is chunked on
    #: paragraph boundaries rather than mid-sentence.
    PDF_IMPORT_CHUNK_CHARS: int = 12000
    #: Extracted-text floor. Below this the PDF is almost certainly a scan, and
    #: `pypdf` would return a few stray glyphs -- a generation call on that
    #: either fails or invents questions out of nothing.
    PDF_IMPORT_MIN_TEXT_CHARS: int = 200
    #: Ceiling on drafts per job, whatever the admin asked for. Enforced because
    #: the cost and the review burden both scale with it, and a single upload
    #: that produced 900 drafts would be unusable rather than generous.
    PDF_IMPORT_MAX_DRAFTS: int = 200
    #: Wall-clock ceiling for one Gemini call.
    PDF_IMPORT_LLM_TIMEOUT_SECONDS: float = 120.0
    #: Output tokens per call. Each draft is a few hundred tokens, so this
    #: covers roughly `PDF_IMPORT_MAX_DRAFTS` short questions per chunk.
    PDF_IMPORT_LLM_MAX_OUTPUT_TOKENS: int = 8192
    #: Drafts produced per chunk when the admin does not specify. A page of
    #: notes yields few exam-worthy questions, and padding a paper with
    #: invented ones is worse than a short paper.
    PDF_IMPORT_DEFAULT_DRAFTS_PER_CHUNK: int = 5

    #: Google AI Studio credential and model. Backend only -- never in the
    #: frontend bundle, and never echoed in a response.
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # --- Phase 9: DPDP compliance ----------------------------------------
    #
    # Verifiable parental consent. DPDP s.9(2) requires it to be verifiable, and
    # s.9(4) allows the Data Fiduciary to require the guardian to re-verify
    # periodically "for the sake of protecting the child's interest". Neither
    # period is a matter of taste, so both are settings with defaults that err
    # towards re-confirmation rather than towards indefinite silent processing.
    #
    # 365 days, not "never": a child who was 17 when a parent agreed is 18 when
    # it lapses, and the flag flips in their favour without anything being
    # re-collected. Consent that outlives the reason for it is not consent.
    GUARDIAN_CONSENT_VALIDITY_DAYS: int = 365
    #: Whether personal-data writes are refused for a user whose age is
    #: undeclared. Set to false only to keep a pre-launch development checkout
    #: usable; the Phase 9 gate is otherwise unenforceable, because every write
    #: path branches on this one answer.
    REQUIRE_AGE_DECLARATION: bool = True
    #: DPDP Rules 2025 answer a data-principal request within 90 days. This is a
    #: statutory constant, not a preference — it is surfaced here only so the
    #: value can be read by the SLA sweep and asserted by a test without
    #: importing the model module. Never raise it.
    DATA_REQUEST_SLA_DAYS: int = 90
    #: How long an opened data request is given before `retention_sweep.py`
    #: flags it. Set below the statutory deadline on purpose: the point is to
    #: find out at 75 days that something will breach at 90, not at 90 that it
    #: already has.
    DATA_REQUEST_WARN_DAYS: int = 15

    @model_validator(mode="after")
    def _guard_production_defaults(self):
        # A wildcard CORS origin combined with `allow_credentials=True` lets any
        # website on the internet read authenticated responses out of a logged-in
        # visitor's browser. There is no safe way to combine the two, so this is
        # refused at startup rather than left to a human to notice.
        if "*" in self.cors_origin_list and self.APP_ENV != "development":
            raise ValueError(
                "CORS_ORIGINS must not contain '*' outside development. "
                "allow_credentials=True with a wildcard origin lets any site "
                "read authenticated API responses cross-origin. List the exact "
                "origins instead, e.g. CORS_ORIGINS=https://padhaanewala.in"
            )
        if self.TRUSTED_PROXY_HOPS < 0:
            raise ValueError("TRUSTED_PROXY_HOPS must be >= 0")
        if self.REDIS_SOCKET_TIMEOUT_SECONDS <= 0 or self.REDIS_HEALTH_TIMEOUT_SECONDS <= 0:
            # redis-py treats a non-positive socket timeout as "block forever",
            # which silently turns a Redis outage into a hung event loop.
            raise ValueError(
                "REDIS_SOCKET_TIMEOUT_SECONDS and REDIS_HEALTH_TIMEOUT_SECONDS "
                "must both be > 0"
            )
        # --- P10 rate-limit configuration ---------------------------------
        # Runs in every environment. Production additionally refuses a
        # disabled limiter/engine, a data-method exemption and a non-Redis URL.
        _validate_rate_limit_config(self, production=self.APP_ENV == "production")
        # --- Phase 9 sanity, in every environment --------------------------
        # A negative consent window would make every consent instantly expired
        # and block every minor; a zero one would make consent permanent, which
        # s.9(4) does not allow. Both are configuration errors, not preferences.
        if self.GUARDIAN_CONSENT_VALIDITY_DAYS < 1:
            raise ValueError(
                f"GUARDIAN_CONSENT_VALIDITY_DAYS must be >= 1, got "
                f"{self.GUARDIAN_CONSENT_VALIDITY_DAYS}"
            )
        # The warning has to land *before* the deadline it is warning about, or
        # the sweep only tells you about a breach on the day it happens.
        if self.DATA_REQUEST_WARN_DAYS < 0:
            raise ValueError(
                f"DATA_REQUEST_WARN_DAYS must be >= 0, got "
                f"{self.DATA_REQUEST_WARN_DAYS}"
            )
        if self.DATA_REQUEST_WARN_DAYS >= self.DATA_REQUEST_SLA_DAYS:
            raise ValueError(
                f"DATA_REQUEST_WARN_DAYS ({self.DATA_REQUEST_WARN_DAYS}) must be "
                f"less than DATA_REQUEST_SLA_DAYS ({self.DATA_REQUEST_SLA_DAYS}); "
                "a warning that fires after the deadline is not a warning"
            )
        if self.APP_ENV == "production":
            if self.JWT_SECRET_KEY in ("change-me", ""):
                raise ValueError("JWT_SECRET_KEY must be set in production")
            if self.JWT_REFRESH_SECRET_KEY in ("change-me", ""):
                raise ValueError("JWT_REFRESH_SECRET_KEY must be set in production")
            if self.JWT_REFRESH_SECRET_KEY == self.JWT_SECRET_KEY:
                raise ValueError(
                    "JWT_REFRESH_SECRET_KEY must differ from JWT_SECRET_KEY in production"
                )
            if "dev_password_123" in self.DATABASE_URL or self.DB_PASSWORD == "dev_password_123":
                raise ValueError("production must not use default dev database credentials")
            if self.JWT_ACCESS_TOKEN_EXPIRE_MINUTES > self.MAX_ACCESS_TOKEN_EXPIRE_MINUTES:
                raise ValueError(
                    "JWT_ACCESS_TOKEN_EXPIRE_MINUTES must be "
                    f"<= {self.MAX_ACCESS_TOKEN_EXPIRE_MINUTES} in production "
                    f"(got {self.JWT_ACCESS_TOKEN_EXPIRE_MINUTES}); access tokens "
                    "cannot be revoked because logout is not stateful"
                )
            # A console provider in production means verification links and OTPs
            # are written to a log file and never reach the user, while
            # `EMAIL_VERIFICATION_REQUIRED` still blocks their login. That is a
            # site nobody can sign in to, so refuse to boot instead.
            #
            # The credential to check depends on the provider: SMTP never reads
            # `EMAIL_API_KEY`, so demanding it would refuse to boot a perfectly
            # valid production SMTP setup whose API key is still the default.
            if self.EMAIL_PROVIDER == "console":
                raise ValueError(
                    "production must not use EMAIL_PROVIDER=console; 'console' "
                    "delivery would silently discard every verification and "
                    "reset link"
                )
            if self.EMAIL_PROVIDER == "smtp":
                if _is_placeholder(self.EMAIL_SMTP_USER) or _is_placeholder(
                    self.EMAIL_SMTP_PASSWORD
                ):
                    raise ValueError(
                        "production EMAIL_PROVIDER=smtp requires a real "
                        "EMAIL_SMTP_USER and EMAIL_SMTP_PASSWORD"
                    )
            elif _is_placeholder(self.EMAIL_API_KEY):
                raise ValueError(
                    "production EMAIL_PROVIDER=sendgrid requires a real "
                    "EMAIL_API_KEY"
                )
            if _is_placeholder(self.EMAIL_FROM_EMAIL):
                raise ValueError(
                    "production requires a real EMAIL_FROM_EMAIL (the sender must "
                    "be a domain you control, or deliverability is zero)"
                )
            if self.SMS_PROVIDER == "console" or _is_placeholder(self.SMS_API_KEY):
                raise ValueError(
                    "production must use SMS_PROVIDER=msg91 with a configured "
                    "SMS_API_KEY; 'console' delivery would silently discard every OTP"
                )
            # A MSG91 call with an unregistered DLT template is rejected at send
            # time, so the app would boot "healthy" and fail every OTP — the same
            # silent failure the console check above exists to prevent.
            if _is_placeholder(self.SMS_DLT_TEMPLATE_ID):
                raise ValueError(
                    "production requires a registered SMS_DLT_TEMPLATE_ID; India "
                    "mandates DLT approval per transactional template and MSG91 "
                    "rejects sends without one"
                )
            if not self.ALLOWED_HOSTS:
                raise ValueError(
                    "ALLOWED_HOSTS must be set in production (comma-separated). "
                    "An unset value would fall back to the app URLs, which is not "
                    "the public domain when the app is served by a proxy."
                )
            if self.BCRYPT_ROUNDS < 12:
                raise ValueError(
                    f"BCRYPT_ROUNDS must be >= 12 in production (got "
                    f"{self.BCRYPT_ROUNDS})"
                )
            if self.JWT_ALGORITHM not in ("HS256", "HS384", "HS512"):
                raise ValueError(
                    f"JWT_ALGORITHM must be an HMAC algorithm, got "
                    f"{self.JWT_ALGORITHM!r}. Asymmetric algorithms would require "
                    f"a public key and are not configured."
                )
            if not _is_absolute_path(self.MEDIA_ROOT):
                raise ValueError(
                    f"MEDIA_ROOT must be an absolute path in production, got the "
                    f"relative path {self.MEDIA_ROOT!r}. A relative root resolves "
                    "against the process working directory, which inside the "
                    "container is inside the image's writable layer — so uploads "
                    "appear to work and are destroyed by the next image rebuild. "
                    "Mount a named volume and set e.g. "
                    "MEDIA_ROOT=/var/lib/padhaanewala/media."
                )
            # Uploaded files are served back same-origin from this root, so the
            # root is part of the trusted computing base: whatever else lives
            # under it is reachable through the serving route.
            #
            # The floor is three path components — an application-specific
            # directory two levels down, e.g. `/var/lib/padhaanewala/media`. That
            # is deliberately not a list of forbidden directories. A blocklist
            # has to enumerate every system path, and `/var/lib` sits one level
            # above the recommended value while `/usr/local/bin` sits two levels
            # below a system root, so no prefix rule separates them honestly.
            # Depth is the property that actually holds: a directory dedicated to
            # this service's uploads is always namespaced, and every value a
            # human types by mistake — `/`, `/var`, `/app/media`, `/data/uploads`
            # — is shallower than that.
            #
            # Scope, stated plainly: this is a guard against gross mistakes, not a
            # containment control. It accepts a wrong but deep path such as
            # `/usr/local/bin/images`. What actually bounds the blast radius is
            # that `GET /media/files/{id}` only ever reads a path derived from a
            # `media` row's own id, entity and sniffed type — no route walks the
            # root — so a file that is not in the table is not reachable even
            # though it sits under it.
            components = [c for c in self.MEDIA_ROOT.replace("\\", "/").split("/") if c]
            if len(components) < 3:
                raise ValueError(
                    f"MEDIA_ROOT={self.MEDIA_ROOT!r} is too shallow to be a dedicated "
                    "upload directory. Uploaded files are served same-origin from "
                    "this root, so a shared or system directory would put whatever "
                    "else lives there inside the app's origin. Use an "
                    "application-specific path at least two levels down, e.g. "
                    "/var/lib/padhaanewala/media."
                )
            if self.MEDIA_MAX_BYTES < 1 or self.MEDIA_MAX_BYTES > 50 * 1024 * 1024:
                raise ValueError(
                    f"MEDIA_MAX_BYTES must be between 1 byte and 50 MiB, got "
                    f"{self.MEDIA_MAX_BYTES}"
                )
            # The prefix is concatenated into `media.url` and compared against it
            # to decide whether a row's file is ours to serve, so a prefix that
            # is not a plain absolute path would make that test meaningless.
            if (
                not self.MEDIA_URL_PREFIX.startswith("/")
                or self.MEDIA_URL_PREFIX.endswith("/")
                or ".." in self.MEDIA_URL_PREFIX
            ):
                raise ValueError(
                    f"MEDIA_URL_PREFIX must be an absolute path with no trailing "
                    f"slash and no '..', got {self.MEDIA_URL_PREFIX!r}"
                )
        return self


    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def allowed_host_list(self) -> list[str]:
        """Hosts accepted in the `Host` header.

        Falls back to the hostnames of APP_URL and API_URL so local
        development needs no extra configuration, while `_guard_production_
        defaults` refuses to start production without an explicit value.
        """
        if self.ALLOWED_HOSTS.strip():
            return [h.strip() for h in self.ALLOWED_HOSTS.split(",") if h.strip()]
        derived: list[str] = []
        for url in (self.APP_URL, self.API_URL):
            host = url.split("://", 1)[-1].split("/", 1)[0].split(":")[0]
            if host and host not in derived:
                derived.append(host)
        return derived or ["localhost"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()