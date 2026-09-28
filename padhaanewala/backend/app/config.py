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
                    "a public key and are not configured."
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