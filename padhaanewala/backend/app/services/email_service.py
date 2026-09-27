"""Email delivery via SMTP or the SendGrid v3 API, with a console fallback.

Same contract as `sms_service`: a configured provider is used, an unconfigured
one degrades to logging the message so the flow stays testable before the paid
accounts exist.

Verification and reset links are bearer credentials for the account, so unlike
the OTP path this module never writes the link to a log while a real provider
is configured. It also never logs message bodies.
"""

from __future__ import annotations

import json
import logging
import smtplib
import urllib.error
import urllib.request
from email.message import EmailMessage

from app.config import _is_placeholder, settings

logger = logging.getLogger(__name__)

_SENDGRID_URL = "https://api.sendgrid.com/v3/mail/send"
_HTTP_TIMEOUT_SECONDS = 10


class EmailDeliveryError(RuntimeError):
    """Raised when a configured email provider was contacted and failed."""


def _smtp_credentials_usable() -> bool:
    return not (
        _is_placeholder(settings.EMAIL_SMTP_USER)
        or _is_placeholder(settings.EMAIL_SMTP_PASSWORD)
    )


def _sendgrid_credential_usable() -> bool:
    return not _is_placeholder(settings.EMAIL_API_KEY)


def _provider() -> str:
    """The provider that will actually be used, after the credential check."""
    if settings.EMAIL_PROVIDER == "console":
        return "console"
    if settings.EMAIL_PROVIDER == "sendgrid":
        return "sendgrid" if _sendgrid_credential_usable() else "console"
    if settings.EMAIL_PROVIDER == "smtp":
        return "smtp" if _smtp_credentials_usable() else "console"
    return "console"


def build_verification_email(to_email: str, name: str, token: str) -> tuple[str, str, str]:
    """Return `(subject, text_body, html_body)` for the address-confirmation link."""
    link = f"{settings.APP_URL.rstrip('/')}/verify-email?token={token}"
    subject = "Confirm your Padhaanewala email address"
    text = (
        f"Hi {name or 'there'},\n\n"
        "Confirm your email address to finish setting up your Padhaanewala "
        f"account. This link works once and expires in "
        f"{settings.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES // 60} hours.\n\n"
        f"{link}\n\n"
        "If you did not create a Padhaanewala account you can ignore this "
        "email; nothing has changed on your account.\n"
    )
    html = (
        f"<p>Hi {name or 'there'},</p>"
        "<p>Confirm your email address to finish setting up your Padhaanewala "
        "account. This link works once and expires in "
        f"{settings.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES // 60} hours.</p>"
        f'<p><a href="{link}">Confirm my email address</a></p>'
        "<p>If you did not create a Padhaanewala account you can ignore this "
        "email; nothing has changed on your account.</p>"
    )
    return subject, text, html


def build_password_reset_email(
    to_email: str, name: str, token: str
) -> tuple[str, str, str]:
    """Return `(subject, text_body, html_body)` for the password-reset link."""
    link = f"{settings.APP_URL.rstrip('/')}/reset-password?token={token}"
    subject = "Reset your Padhaanewala password"
    text = (
        f"Hi {name or 'there'},\n\n"
        "Use the link below to choose a new Padhaanewala password. It works "
        f"once and expires in {settings.EMAIL_PASSWORD_RESET_TOKEN_TTL_MINUTES} "
        "minutes.\n\n"
        f"{link}\n\n"
        "If you did not request this, you can ignore this email. Your password "
        "will not change until someone uses the link.\n"
    )
    html = (
        f"<p>Hi {name or 'there'},</p>"
        "<p>Use the link below to choose a new Padhaanewala password. It works "
        f"once and expires in {settings.EMAIL_PASSWORD_RESET_TOKEN_TTL_MINUTES} "
        "minutes.</p>"
        f'<p><a href="{link}">Reset my password</a></p>'
        "<p>If you did not request this, you can ignore this email. Your "
        "password will not change until someone uses the link.</p>"
    )
    return subject, text, html


def _send_via_smtp(to_email: str, subject: str, text: str, html: str) -> None:
    message = EmailMessage()
    message["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM_EMAIL}>"
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(text)
    # set_content above already chose text/plain; make_alternative adds the
    # HTML part and rewrites the container into multipart/alternative.
    message.add_alternative(html, subtype="html")

    try:
        with smtplib.SMTP(
            settings.EMAIL_SMTP_HOST, settings.EMAIL_SMTP_PORT, timeout=_HTTP_TIMEOUT_SECONDS
        ) as smtp:
            smtp.starttls()
            smtp.login(settings.EMAIL_SMTP_USER, settings.EMAIL_SMTP_PASSWORD)
            smtp.send_message(message)
    except (smtplib.SMTPException, OSError) as exc:
        logger.error("SMTP delivery failed: %s", exc)
        raise EmailDeliveryError("Email provider rejected the message") from exc


def _send_via_sendgrid(to_email: str, subject: str, text: str, html: str) -> None:
    payload = json.dumps(
        {
            "personalizations": [
                {"to": [{"email": to_email}], "subject": subject}
            ],
            "from": {
                "email": settings.EMAIL_FROM_EMAIL,
                "name": settings.EMAIL_FROM_NAME,
            },
            "content": [
                {"type": "text/plain", "value": text},
                {"type": "text/html", "value": html},
            ],
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        _SENDGRID_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {settings.EMAIL_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=_HTTP_TIMEOUT_SECONDS) as response:
            response.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:200]
        logger.error("SendGrid rejected the message (HTTP %s): %s", exc.code, detail)
        raise EmailDeliveryError("Email provider rejected the message") from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        logger.error("SendGrid unreachable: %s", exc)
        raise EmailDeliveryError("Email provider is unreachable") from exc


def send_email(to_email: str, subject: str, text: str, html: str) -> str:
    """Deliver an email. Returns the provider actually used.

    `text` and `html` are logged on the console path only. On a real provider
    they are the account-recovery credential, so they are never written to a
    log that is likely to be shipped elsewhere.
    """
    provider = _provider()

    if provider == "console":
        logger.warning(
            "EMAIL_PROVIDER is not usable (EMAIL_PROVIDER=%r); email to %s not "
            "sent. Subject: %s",
            settings.EMAIL_PROVIDER,
            to_email,
            subject,
        )
        # The body is logged at DEBUG, not WARNING, so a default-INFO deployment
        # never spills a live reset link into a log aggregator.
        logger.debug("console email body for %s:\n%s", to_email, text)
        return "console"

    if provider == "smtp":
        _send_via_smtp(to_email, subject, text, html)
    else:
        _send_via_sendgrid(to_email, subject, text, html)

    logger.info("Email '%s' sent to %s via %s", subject, to_email, provider)
    return provider
