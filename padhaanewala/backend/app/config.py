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

    DB_HOST: str = "localhost"
    DB_PORT: int = 5433
    DB_NAME: str = "padhaanewala_dev"
    DB_USER: str = "padhaanewala"
    DB_PASSWORD: str = "dev_password_123"
    DATABASE_URL: str = (
        "postgresql+psycopg2://padhaanewala:dev_password_123@localhost:5433/padhaanewala_dev"
    )

    REDIS_URL: str = "redis://localhost:6379/0"
    RATE_LIMIT_ENABLED: bool = True

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
        return self


    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()