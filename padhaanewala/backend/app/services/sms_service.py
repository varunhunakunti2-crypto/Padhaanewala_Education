"""SMS delivery, via MSG91, with a console fallback.

Phase 3's completion gate needs an OTP to arrive on a real handset, which needs
a paid MSG91 account (M1 in the project checklist). Rather than block on that,
this module treats "no usable credential" as a first-class state: the OTP is
written to the log instead of being sent, and the call still succeeds. That
keeps the entire flow exercisable end to end today, and adding real credentials
later switches delivery to MSG91 with no change at any call site.

The provider is selected by `SMS_PROVIDER`, but a provider name alone is not
taken as proof that delivery will work — an unedited checkout ships
`SMS_API_KEY=change-me` with `SMS_PROVIDER=msg91`, and calling MSG91 with that
would produce an opaque 401 from the provider. `_credentials_usable` therefore
gates on the credential, not the name.
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.parse
import urllib.request

from app.config import _is_placeholder, settings

logger = logging.getLogger(__name__)

_MSG91_FLOW_URL = "https://control.msg91.com/api/v5/flow/"

#: Never let a provider call hold a request thread indefinitely. OTP login is an
#: interactive path; a hung socket is worse than a fast failure.
_HTTP_TIMEOUT_SECONDS = 10


class SmsDeliveryError(RuntimeError):
    """Raised when a configured provider was contacted and refused/failed.

    Deliberately distinct from "not configured": callers surface this as a 502,
    because the user did nothing wrong and retrying later is reasonable.
    """


def _credentials_usable() -> bool:
    return not _is_placeholder(settings.SMS_API_KEY)


def _provider() -> str:
    """The provider that will actually be used, after the credential check."""
    if settings.SMS_PROVIDER == "console":
        return "console"
    if not _credentials_usable():
        return "console"
    return "msg91"


def format_mobile(mobile: str) -> str:
    """Render a stored 10-digit mobile as MSG91 wants it: `91XXXXXXXXX`.

    Indian DLT registration is keyed on the full international number, so a
    bare 10-digit value is rejected at the provider. The `+` is also dropped
    because MSG91's `mobile` parameter takes digits only.
    """
    digits = "".join(ch for ch in mobile if ch.isdigit())
    if len(digits) == 10:
        return f"91{digits}"
    return digits


def send_otp(mobile: str, otp: str) -> str:
    """Send a 6-digit OTP. Returns the provider actually used.

    The OTP is logged only on the console path, and never when a real provider
    is configured — an application log is a much weaker secret store than a
    provider's own delivery records, and it is routinely shipped to log
    aggregators.
    """
    provider = _provider()

    if provider == "console":
        logger.warning(
            "SMS_PROVIDER is not usable (SMS_PROVIDER=%r, credential %s); "
            "OTP for %s is %s -- not sent to any handset",
            settings.SMS_PROVIDER,
            "missing" if not _credentials_usable() else "present",
            format_mobile(mobile),
            otp,
        )
        return "console"

    params = urllib.parse.urlencode(
        {
            "token": settings.SMS_API_KEY,
            "template_id": settings.SMS_DLT_TEMPLATE_ID,
            "mobile": format_mobile(mobile),
            "otp": otp,
        }
    )
    request = urllib.request.Request(
        f"{_MSG91_FLOW_URL}?{params}",
        headers={"Accept": "application/json"},
    )

    try:
        with urllib.request.urlopen(request, timeout=_HTTP_TIMEOUT_SECONDS) as response:
            body = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        # The response body can contain the rejected field, but never echo the
        # full URL back: it carries the API key as a query parameter.
        detail = exc.read().decode("utf-8", errors="replace")[:200]
        logger.error("MSG91 rejected the OTP send (HTTP %s): %s", exc.code, detail)
        raise SmsDeliveryError("SMS provider rejected the message") from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        logger.error("MSG91 unreachable: %s", exc)
        raise SmsDeliveryError("SMS provider is unreachable") from exc

    # MSG91 answers 200 with {"type": "success", ...} on success, but also uses
    # 200 for some soft failures, so the payload is inspected rather than the
    # status code alone.
    try:
        parsed = json.loads(body)
    except json.JSONDecodeError:
        logger.error("MSG91 returned a non-JSON body: %s", body[:200])
        raise SmsDeliveryError("SMS provider returned an unreadable response")

    if parsed.get("type") != "success":
        logger.error("MSG91 reported a failure: %s", json.dumps(parsed)[:200])
        raise SmsDeliveryError("SMS provider reported a failure")

    logger.info("OTP sent to %s via MSG91", format_mobile(mobile))
    return "msg91"
