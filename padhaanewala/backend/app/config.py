import hashlib
import os
import re
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


# SHA-256 fingerprints only — never the key material itself. The source values
# are generated locally in an ignored `.env.development` and must never appear in
# source control, logs or build artefacts. A fingerprint is one-way and, for a
# 256-bit random input, reveals nothing usable to an attacker; it exists solely
# so a deployed environment cannot boot with a known development key.
_KNOWN_DEV_KEY_FINGERPRINTS = frozenset(
    {
        "31e2c32578acb03e6bdb5772ba59112fc812ebb4cb9af86b2c61404b15d7b2c7",
        "c8799280537510e1f13adaac4c414f57176d7e3f422c215d6e6b0c1784bc47f5",
        "0cc581d8e346cfbc67cf233b05d8e115ee0f3fb923bdfd13e5802e41b9f58c15",
    }
)

#: HMAC keys shorter than 32 bytes weaken the MAC. Hex-encoded keys therefore
#: need 64 characters; arbitrary strings need 32 characters plus real variety.
_MIN_JWT_KEY_BYTES = 32
_MIN_KEY_CHAR_VARIETY = 10
_HEX_KEY = re.compile(r"[0-9a-fA-F]+\Z")


def _jwt_key_problem(value: str, label: str) -> str | None:
    """Return a reason why ``value`` is unsafe as an HMAC signing key, or None.

    Deliberately reports *why* a key was rejected but never echoes the value:
    validation errors travel into logs and CI output, and a key that leaks there
    is worse than a key that merely fails a check.
    """
    text = (value or "").strip()
    if _is_placeholder(text):
        return f"{label} is empty or a placeholder"
    if hashlib.sha256(text.encode("utf-8")).hexdigest() in _KNOWN_DEV_KEY_FINGERPRINTS:
        return f"{label} is a known development key"
    if _HEX_KEY.fullmatch(text):
        if len(text) < _MIN_JWT_KEY_BYTES * 2:
            return (
                f"{label} must be at least {_MIN_JWT_KEY_BYTES * 2} hex characters "
                f"({_MIN_JWT_KEY_BYTES} bytes)"
            )
    elif len(text) < _MIN_JWT_KEY_BYTES:
        return f"{label} must be at least {_MIN_JWT_KEY_BYTES} characters"
    if len(set(text)) < _MIN_KEY_CHAR_VARIETY:
        return f"{label} has insufficient character variety for {_MIN_JWT_KEY_BYTES} bytes of entropy"
    return None


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
    #: Rotation only. A token signed with the previous key keeps verifying until
    #: this value is cleared after the grace window. Signing always uses the
    #: current key, so a retired key can never mint a new token.
    JWT_PREVIOUS_SECRET_KEY: str = ""
    JWT_PREVIOUS_REFRESH_SECRET_KEY: str = ""
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
    # Session ledger. The refresh token is delivered as an HttpOnly cookie,
    # never in a response body that any script in the origin can read. Its path
    # is the whole origin so the Next.js proxy can perform its optimistic page
    # guard: a signed-in browser attaches the cookie to `/dashboard`, `/admin`
    # and `/mock-tests` as well as the auth API. The cookie is not a role or
    # session proof for page content — every protected API still re-checks the
    # token and role server-side. `MAX_ACTIVE_REFRESH_TOKENS` bounds *concurrent
    # sessions* (rotation families), not token rows — one device refreshing
    # every 25 minutes writes ~1,700 rows over its 30-day life and must never
    # be treated as 1,700 sessions.
    REFRESH_COOKIE_NAME: str = "pdw_refresh"
    REFRESH_COOKIE_PATH: str = "/"
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
    EMAIL_FROM_EMAIL: str = "no-reply@padhaanewala.com"
    EMAIL_FROM_NAME: str = "Padhaanewala"
    #: When true, `POST /auth/login` refuses an unverified account with 403,
    #: `POST /auth/register` withholds the session, and production refuses to
    #: boot unless verification is actually configured.
    EMAIL_VERIFICATION_REQUIRED: bool = False
    #: Emergency kill switch for signup. Production still requires email
    #: verification while registration is open; a deployment that closes signup
    #: may turn this off without having to leave a second gate disabled.
    REGISTRATION_ENABLED: bool = True
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

    @property
    def jwt_access_keys(self) -> tuple[str, ...]:
        """Current first, retired second; duplicates and blanks removed.

        Signing uses only ``JWT_SECRET_KEY``. This tuple exists purely so
        verification can accept tokens issued before a rotation.
        """
        return tuple(
            dict.fromkeys(
                key.strip()
                for key in (self.JWT_SECRET_KEY, self.JWT_PREVIOUS_SECRET_KEY)
                if key and key.strip()
            )
        )

    @property
    def jwt_refresh_keys(self) -> tuple[str, ...]:
        return tuple(
            dict.fromkeys(
                key.strip()
                for key in (
                    self.JWT_REFRESH_SECRET_KEY,
                    self.JWT_PREVIOUS_REFRESH_SECRET_KEY,
                )
                if key and key.strip()
            )
        )

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
                "origins instead, e.g. CORS_ORIGINS=https://padhaanewala.com"
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
        # H-07 — signing-key checks apply to every *deployed* environment. A
        # staging service is reachable by the public and carries the same user
        # database shape as production; the old guard only fired for production,
        # so a staging deployment could boot on committed development keys.
        if self.APP_ENV in ("staging", "production"):
            for label, key in (
                ("JWT_SECRET_KEY", self.JWT_SECRET_KEY),
                ("JWT_REFRESH_SECRET_KEY", self.JWT_REFRESH_SECRET_KEY),
                ("JWT_PREVIOUS_SECRET_KEY", self.JWT_PREVIOUS_SECRET_KEY),
                ("JWT_PREVIOUS_REFRESH_SECRET_KEY", self.JWT_PREVIOUS_REFRESH_SECRET_KEY),
            ):
                # Previous keys are optional; an empty value means "no rotation
                # in progress" and must not be turned into a boot failure.
                if label.startswith("JWT_PREVIOUS") and not (key or "").strip():
                    continue
                problem = _jwt_key_problem(key, label)
                if problem is not None:
                    raise ValueError(f"{label} is unsafe in {self.APP_ENV}: {problem}")
            # Key separation is enforced across both current and retired slots:
            # using one string for two purposes would let a refresh token verify
            # as an access token (or vice versa) during a rotation.
            current_and_previous = (
                self.JWT_SECRET_KEY,
                self.JWT_REFRESH_SECRET_KEY,
                self.JWT_PREVIOUS_SECRET_KEY,
                self.JWT_PREVIOUS_REFRESH_SECRET_KEY,
            )
            supplied = [key.strip() for key in current_and_previous if key and key.strip()]
            if len(set(supplied)) != len(supplied):
                raise ValueError(
                    "JWT access, refresh and rotation keys must all be distinct "
                    f"in {self.APP_ENV}"
                )
            if self.JWT_ALGORITHM not in ("HS256", "HS384", "HS512"):
                raise ValueError(
                    f"JWT_ALGORITHM must be an HMAC algorithm in {self.APP_ENV}, got "
                    f"{self.JWT_ALGORITHM!r}. Asymmetric algorithms would require "
                    "a public key and are not configured."
                )

        if self.APP_ENV == "production":
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
            # Rate limiting is one of the few controls that still works before a
            # user is authenticated. Turning it off in production makes OTP,
            # password and signup endpoints answerable at attacker speed, so a
            # disabled flag is a deployment error rather than a preference.
            if not self.RATE_LIMIT_ENABLED:
                raise ValueError(
                    "RATE_LIMIT_ENABLED must not be false in production; "
                    "unauthenticated auth and signup endpoints would be unlimited"
                )
            # An unverified signup would otherwise hold no usable session, but
            # leaving the flag off in production means nobody can sign in at all
            # and makes the gate look optional in the deployed configuration.
            # Fail at boot with an actionable message instead.
            if self.REGISTRATION_ENABLED and not self.EMAIL_VERIFICATION_REQUIRED:
                raise ValueError(
                    "EMAIL_VERIFICATION_REQUIRED must be true in production while "
                    "registration is enabled; set it explicitly, or set "
                    "REGISTRATION_ENABLED=false if signup is intentionally closed"
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