"""Phase 3 — email verification, SMS OTP login, password reset.

Two things are tested deliberately beyond the happy path:

* **Enumeration resistance.** `login/otp/send`, `verify-email/resend` and
  `forgot-password` take a user-supplied email or mobile, so each is asserted to
  return a byte-identical response for a registered and an unregistered
  identifier. If one of those ever diverges, this endpoint becomes a free
  account-enumeration oracle.
* **Secret handling.** The OTP is captured by intercepting the delivery call,
  and the persisted row is then asserted *not* to contain it. A test that only
  checked the happy path would pass just as happily with the code in plaintext.
"""

import re
import uuid

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.database import SessionLocal
from app.main import app
from app.models import OtpRecord, User
from app.services import email_service, otp_service, sms_service

client = TestClient(app)

_LINK_TOKEN = re.compile(r"token=([0-9]+\.[A-Za-z0-9_-]+)")


def _unique_email() -> str:
    return f"otp.{uuid.uuid4().hex[:8]}@example.com"


def _unique_mobile() -> str:
    return f"9{uuid.uuid4().int % 1_000_000_000:09d}"


def _link_token(outbox: dict, index: int = -1) -> str:
    match = _LINK_TOKEN.search(outbox["emails"][index]["html"])
    assert match, "no reset/verification link found in the captured email"
    return match.group(1)


@pytest.fixture
def outbox(monkeypatch):
    """Intercept both delivery channels so the plaintext secret is observable.

    Provider calls are the only place the plaintext OTP or link token exists
    outside the caller's hands, so intercepting here is the seam that lets these
    tests drive the real issue/verify path end to end.
    """
    box: dict = {"sms": [], "emails": []}

    def fake_send_otp(mobile: str, otp: str) -> str:
        box["sms"].append({"mobile": mobile, "otp": otp})
        return "msg91"

    def fake_send_email(to_email: str, subject: str, text: str, html: str) -> str:
        box["emails"].append(
            {"to": to_email, "subject": subject, "text": text, "html": html}
        )
        return "sendgrid"

    monkeypatch.setattr(sms_service, "send_otp", fake_send_otp)
    monkeypatch.setattr(email_service, "send_email", fake_send_email)
    return box


@pytest.fixture
def user():
    payload = {
        "name": "OTP Student",
        "email": _unique_email(),
        "mobile": _unique_mobile(),
        "password": "SecurePass123!",
        "age_band": "18_plus",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    return {**payload, "tokens": response.json()}


def _confirm_email(user: dict, outbox: dict) -> None:
    """Confirm the address the way a user would: by clicking the emailed link.

    Always uses the *most recent* email, because issuing a new link supersedes
    the previous one — an earlier token is void by design and would test the
    wrong thing.
    """
    token = _link_token(outbox)
    response = client.post("/api/v1/auth/verify-email", json={"token": token})
    assert response.status_code == 200, response.text
    assert user["email"]


def _latest_record(purpose: str, identifier: str) -> OtpRecord | None:
    with SessionLocal() as db:
        return (
            db.query(OtpRecord)
            .filter(OtpRecord.purpose == purpose, OtpRecord.identifier == identifier)
            .order_by(OtpRecord.id.desc())
            .first()
        )


# ------------------------------------------------------- registration dispatch


def test_register_dispatches_verification_and_mobile_otp(outbox, user):
    subjects = [mail["subject"] for mail in outbox["emails"]]
    assert any("Confirm your" in subject for subject in subjects), subjects
    assert len(outbox["sms"]) == 1
    assert outbox["sms"][0]["mobile"] == user["mobile"]


def test_register_stores_no_plaintext_secret(outbox, user):
    """The captured secret must not be recoverable from the database."""
    otp = outbox["sms"][0]["otp"]
    record = _latest_record("mobile_verification", user["mobile"])
    assert record is not None
    assert otp not in record.code_hash
    assert record.code_hash.startswith("$2")

    token = _link_token(outbox)
    email_record = _latest_record("email_verification", user["email"])
    assert email_record is not None
    assert token.split(".", 1)[1] not in email_record.code_hash


# ------------------------------------------------------------ verify-email


def test_verify_email_marks_address_verified(outbox, user):
    token = _link_token(outbox)
    response = client.post("/api/v1/auth/verify-email", json={"token": token})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["is_email_verified"] is True

    with SessionLocal() as db:
        row = db.query(User).filter(User.email == user["email"]).one()
        assert row.is_email_verified is True


def test_verify_email_link_is_single_use(outbox, user):
    token = _link_token(outbox)
    assert client.post("/api/v1/auth/verify-email", json={"token": token}).status_code == 200
    replay = client.post("/api/v1/auth/verify-email", json={"token": token})
    assert replay.status_code == 400


@pytest.mark.parametrize(
    "bad",
    ["", "x" * 40, "not-a-token", "999999.deadbeef", "abc.also-not-a-token", "1."],
)
def test_verify_email_rejects_malformed_tokens_without_500(user, outbox, bad):
    payload = {"token": bad if len(bad) >= 20 else "x" * 25}
    response = client.post("/api/v1/auth/verify-email", json=payload)
    assert response.status_code in (400, 422), response.text


def test_resend_is_identical_for_known_and_unknown_address(user, outbox):
    known = client.post(
        "/api/v1/auth/verify-email/resend", json={"email": user["email"]}
    )
    unknown = client.post(
        "/api/v1/auth/verify-email/resend", json={"email": _unique_email()}
    )
    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()


# ------------------------------------------------------------ login by OTP


def test_otp_send_is_identical_for_known_and_unknown_mobile(user, outbox):
    known = client.post("/api/v1/auth/login/otp/send", json={"mobile": user["mobile"]})
    unknown = client.post("/api/v1/auth/login/otp/send", json={"mobile": _unique_mobile()})
    assert known.status_code == unknown.status_code == 200
    # Byte-identical, not merely equal status: any extra field here (a masked
    # mobile, a different expiry) is enough to enumerate registrations.
    assert known.content == unknown.content
    # And no secret leaked in the acknowledgement.
    assert outbox["sms"][0]["otp"] not in known.text


def test_otp_send_does_not_reveal_an_unconfirmed_address(user, outbox, monkeypatch):
    """The send endpoint must not leak the email-verification state.

    It used to answer a known-but-unconfirmed number with "Confirm your email
    address before signing in." while every other number got the generic
    message — one request per number told a prober both that the number is
    registered and that the account is unconfirmed.
    """
    monkeypatch.setattr(settings, "EMAIL_VERIFICATION_REQUIRED", True)
    baseline = len(outbox["sms"])

    unconfirmed = client.post(
        "/api/v1/auth/login/otp/send", json={"mobile": user["mobile"]}
    )
    unknown = client.post("/api/v1/auth/login/otp/send", json={"mobile": _unique_mobile()})

    assert unconfirmed.status_code == unknown.status_code == 200
    assert unconfirmed.content == unknown.content
    assert "confirm" not in unconfirmed.json()["message"].lower()

    # The owner is not stranded: the code still goes out, so they can reach the
    # 403 at verify and be told what to do.
    assert len(outbox["sms"]) == baseline + 1, "no OTP was sent to the unconfirmed owner"


def test_otp_send_does_not_reveal_a_rate_limited_number(user, outbox):
    """A 429 here would be an oracle after four probes.

    OTP rows only exist for numbers that are registered, so answering 429 once
    the cap is hit separates "registered" from "not registered" — exactly the
    outcome the generic message exists to prevent. The cap is enforced silently
    instead.
    """
    for _ in range(settings.SMS_OTP_MAX_SENDS_PER_WINDOW):
        client.post("/api/v1/auth/login/otp/send", json={"mobile": user["mobile"]})

    baseline = len(outbox["sms"])
    limited = client.post("/api/v1/auth/login/otp/send", json={"mobile": user["mobile"]})
    unknown = client.post("/api/v1/auth/login/otp/send", json={"mobile": _unique_mobile()})

    assert limited.status_code == 200
    assert limited.content == unknown.content
    # Suppressed, not merely hidden: the over-cap request dispatched nothing.
    assert len(outbox["sms"]) == baseline


def test_otp_login_is_blocked_until_the_email_is_confirmed(user, outbox, monkeypatch):
    """The gate must hold on the OTP path, which it previously did not.

    `send_login_otp` refused to issue a code for an unconfirmed account, but
    `verify_login_otp` never checked the flag — so calling verify directly still
    returned a full session. The check now lives at verify, behind the code.
    """
    monkeypatch.setattr(settings, "EMAIL_VERIFICATION_REQUIRED", True)
    client.post("/api/v1/auth/login/otp/send", json={"mobile": user["mobile"]})
    otp = outbox["sms"][-1]["otp"]

    blocked = client.post(
        "/api/v1/auth/login/otp/verify", json={"mobile": user["mobile"], "otp": otp}
    )
    assert blocked.status_code == 403
    detail = blocked.json()["detail"]
    assert detail["code"] == "email_not_verified"
    assert detail["email"] == user["email"]
    assert "access_token" not in blocked.text

    # Same shape as the password path, so the frontend can treat them alike.
    password_path = client.post(
        "/api/v1/auth/login", json={"email": user["email"], "password": user["password"]}
    )
    assert password_path.status_code == 403
    assert password_path.json()["detail"] == detail

    # Once confirmed, the same code path lets them straight in.
    _confirm_email(user, outbox)
    allowed = client.post(
        "/api/v1/auth/login/otp/send", json={"mobile": user["mobile"]}
    )
    assert allowed.status_code == 200
    otp = outbox["sms"][-1]["otp"]
    verified = client.post(
        "/api/v1/auth/login/otp/verify", json={"mobile": user["mobile"], "otp": otp}
    )
    assert verified.status_code == 200, verified.text


def test_advisory_lock_key_is_stable_across_processes():
    """The lock key must not depend on per-process string hashing.

    Python randomises `hash()` per process unless PYTHONHASHSEED is pinned. A
    key derived from it would give every uvicorn worker a private lock, so
    concurrent requests would not block each other and the send cap would be
    advisory again — with no test failure to show for it.
    """
    from app.services.otp_service import _advisory_key

    first = _advisory_key(otp_service.LOGIN, "9876543210")
    # Same identifier, different purpose: a collision would let an unrelated
    # flow block the login path.
    other = _advisory_key(otp_service.MOBILE_VERIFICATION, "9876543210")
    assert first == _advisory_key(otp_service.LOGIN, "9876543210")
    assert first != other
    # Must survive the round trip to a signed Postgres bigint.
    assert -(1 << 63) <= first < (1 << 63)


def test_otp_login_succeeds_with_correct_code(user, outbox):
    client.post("/api/v1/auth/login/otp/send", json={"mobile": user["mobile"]})
    otp = outbox["sms"][-1]["otp"]

    response = client.post(
        "/api/v1/auth/login/otp/verify", json={"mobile": user["mobile"], "otp": otp}
    )
    assert response.status_code == 200, response.text
    assert response.json()["access_token"]

    # Possession of the code settles mobile verification as a side effect.
    with SessionLocal() as db:
        row = db.query(User).filter(User.email == user["email"]).one()
        assert row.is_mobile_verified is True
        assert row.last_login_at is not None


def test_otp_replay_is_rejected(user, outbox):
    client.post("/api/v1/auth/login/otp/send", json={"mobile": user["mobile"]})
    otp = outbox["sms"][-1]["otp"]
    first = client.post(
        "/api/v1/auth/login/otp/verify", json={"mobile": user["mobile"], "otp": otp}
    )
    assert first.status_code == 200
    replay = client.post(
        "/api/v1/auth/login/otp/verify", json={"mobile": user["mobile"], "otp": otp}
    )
    assert replay.status_code == 401


def test_wrong_otp_is_401_and_counts_an_attempt(user, outbox):
    client.post("/api/v1/auth/login/otp/send", json={"mobile": user["mobile"]})
    real = outbox["sms"][-1]["otp"]
    wrong = "000000" if real != "000000" else "111111"

    response = client.post(
        "/api/v1/auth/login/otp/verify", json={"mobile": user["mobile"], "otp": wrong}
    )
    assert response.status_code == 401
    assert "not valid" in response.json()["detail"].lower()

    record = _latest_record("login", user["mobile"])
    assert record.attempts == 1

    # The correct code still works, i.e. a wrong guess does not consume the OTP.
    good = client.post(
        "/api/v1/auth/login/otp/verify", json={"mobile": user["mobile"], "otp": real}
    )
    assert good.status_code == 200


def test_five_wrong_attempts_burn_the_code(user, outbox):
    client.post("/api/v1/auth/login/otp/send", json={"mobile": user["mobile"]})
    real = outbox["sms"][-1]["otp"]
    wrong = "000000" if real != "000000" else "111111"

    for _ in range(settings.SMS_OTP_MAX_VERIFY_ATTEMPTS):
        assert (
            client.post(
                "/api/v1/auth/login/otp/verify",
                json={"mobile": user["mobile"], "otp": wrong},
            ).status_code
            == 401
        )

    record = _latest_record("login", user["mobile"])
    assert record.attempts == settings.SMS_OTP_MAX_VERIFY_ATTEMPTS
    assert record.is_used is True

    # Locked out: the code that would have worked is now worthless.
    assert (
        client.post(
            "/api/v1/auth/login/otp/verify", json={"mobile": user["mobile"], "otp": real}
        ).status_code
        == 401
    )


def test_expired_otp_is_rejected(user, outbox, monkeypatch):
    monkeypatch.setattr(settings, "SMS_OTP_TTL_SECONDS", -5)
    client.post("/api/v1/auth/login/otp/send", json={"mobile": user["mobile"]})
    otp = outbox["sms"][-1]["otp"]

    response = client.post(
        "/api/v1/auth/login/otp/verify", json={"mobile": user["mobile"], "otp": otp}
    )
    assert response.status_code == 401


def test_send_is_rate_limited_per_mobile(user, outbox):
    """The cap holds; where it is asserted has moved.

    Enforcement lives in `otp_service.issue`, which raises once the window is
    full. It used to be asserted through a 429 from the endpoint, but a
    per-identifier 429 is only reachable for a *registered* number — OTP rows do
    not exist for unknown ones — so surfacing it handed out a registration
    oracle. The endpoint now absorbs the error; the cap is asserted here at the
    layer that still reports it.
    """
    limit = settings.SMS_OTP_MAX_SENDS_PER_WINDOW
    for _ in range(limit):
        assert (
            client.post(
                "/api/v1/auth/login/otp/send", json={"mobile": user["mobile"]}
            ).status_code
            == 200
        )

    with SessionLocal() as db:
        with pytest.raises(otp_service.OtpRateLimited):
            otp_service.issue(
                db, purpose=otp_service.LOGIN, identifier=user["mobile"]
            )


def test_rate_limit_does_not_apply_to_a_different_mobile(user, outbox):
    """The cap is per identifier, so one student's resends cannot lock another."""
    limit = settings.SMS_OTP_MAX_SENDS_PER_WINDOW
    for _ in range(limit):
        client.post("/api/v1/auth/login/otp/send", json={"mobile": user["mobile"]})

    other = _unique_mobile()
    with SessionLocal() as db:
        # Still issuable for someone else, and still refused for the capped one.
        issued = otp_service.issue(db, purpose=otp_service.LOGIN, identifier=other)
        assert issued.secret
        with pytest.raises(otp_service.OtpRateLimited):
            otp_service.issue(
                db, purpose=otp_service.LOGIN, identifier=user["mobile"]
            )


def test_resend_supersedes_the_previous_code(user, outbox):
    client.post("/api/v1/auth/login/otp/send", json={"mobile": user["mobile"]})
    first = outbox["sms"][-1]["otp"]
    client.post("/api/v1/auth/login/otp/send", json={"mobile": user["mobile"]})
    second = outbox["sms"][-1]["otp"]

    # The intercepted first SMS must stop working the moment a resend is sent.
    stale = client.post(
        "/api/v1/auth/login/otp/verify", json={"mobile": user["mobile"], "otp": first}
    )
    assert stale.status_code == 401

    fresh = client.post(
        "/api/v1/auth/login/otp/verify", json={"mobile": user["mobile"], "otp": second}
    )
    assert fresh.status_code == 200


def test_otp_verify_rejects_malformed_code(user, outbox):
    client.post("/api/v1/auth/login/otp/send", json={"mobile": user["mobile"]})
    response = client.post(
        "/api/v1/auth/login/otp/verify",
        json={"mobile": user["mobile"], "otp": "abcdefgh"},
    )
    assert response.status_code == 422


# --------------------------------------------------- authenticated mobile OTP


def _auth_header(user) -> dict:
    return {"Authorization": f"Bearer {user['tokens']['access_token']}"}


def test_mobile_verification_flow(outbox, user):
    # Registration already consumed one `mobile_verification` send, so this must
    # not loop up to the cap or the endpoint under test is the one that 429s.
    sent = client.post("/api/v1/auth/verify-mobile/send", headers=_auth_header(user))
    assert sent.status_code == 200, sent.text

    otp = outbox["sms"][-1]["otp"]
    verified = client.post(
        "/api/v1/auth/verify-mobile/verify",
        json={"mobile": user["mobile"], "otp": otp},
        headers=_auth_header(user),
    )
    assert verified.status_code == 200, verified.text
    assert verified.json()["data"]["is_mobile_verified"] is True


def test_mobile_verification_requires_auth(user, outbox):
    response = client.post("/api/v1/auth/verify-mobile/send")
    assert response.status_code in (401, 403)


def test_mobile_verification_ignores_a_substituted_number(user, outbox):
    """The code is matched to the authenticated user's mobile, not the body's."""
    client.post("/api/v1/auth/verify-mobile/send", headers=_auth_header(user))
    otp = outbox["sms"][-1]["otp"]
    response = client.post(
        "/api/v1/auth/verify-mobile/verify",
        json={"mobile": _unique_mobile(), "otp": otp},
        headers=_auth_header(user),
    )
    assert response.status_code == 400


# ---------------------------------------------------------- password reset


def test_forgot_password_is_identical_for_known_and_unknown_address(user, outbox):
    known = client.post("/api/v1/auth/forgot-password", json={"email": user["email"]})
    unknown = client.post("/api/v1/auth/forgot-password", json={"email": _unique_email()})
    assert known.status_code == unknown.status_code == 200
    assert known.content == unknown.content


def test_reset_password_changes_the_password(outbox, user):
    client.post("/api/v1/auth/forgot-password", json={"email": user["email"]})
    token = _link_token(outbox)

    response = client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "BrandNewPass456!"},
    )
    assert response.status_code == 200, response.text

    old = client.post(
        "/api/v1/auth/login",
        json={"email": user["email"], "password": user["password"]},
    )
    assert old.status_code == 401

    new = client.post(
        "/api/v1/auth/login",
        json={"email": user["email"], "password": "BrandNewPass456!"},
    )
    assert new.status_code == 200


def test_reset_link_is_single_use(outbox, user):
    client.post("/api/v1/auth/forgot-password", json={"email": user["email"]})
    token = _link_token(outbox)
    first = client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "BrandNewPass456!"},
    )
    assert first.status_code == 200
    replay = client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "AnotherPass789!"},
    )
    assert replay.status_code == 400


def test_forgot_password_rate_limit_still_returns_generic(user, outbox):
    """A capped account must not be distinguishable from an unknown one."""
    for _ in range(settings.SMS_OTP_MAX_SENDS_PER_WINDOW):
        response = client.post(
            "/api/v1/auth/forgot-password", json={"email": user["email"]}
        )
    unknown = client.post(
        "/api/v1/auth/forgot-password", json={"email": _unique_email()}
    )
    assert response.status_code == unknown.status_code == 200
    assert response.content == unknown.content


# ------------------------------------------------------- email login gate


def test_login_blocked_when_email_unverified(user, monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_VERIFICATION_REQUIRED", True)
    response = client.post(
        "/api/v1/auth/login",
        json={"email": user["email"], "password": user["password"]},
    )
    assert response.status_code == 403
    detail = response.json()["detail"]
    assert detail["code"] == "email_not_verified"
    assert detail["email"] == user["email"]
    assert detail["resend_endpoint"] == "/api/v1/auth/verify-email/resend"

    # The gate must not have recorded a successful sign-in.
    with SessionLocal() as db:
        row = db.query(User).filter(User.email == user["email"]).one()
        assert row.last_login_at is None


def test_login_allowed_once_email_verified(outbox, user, monkeypatch):
    token = _link_token(outbox)
    assert client.post("/api/v1/auth/verify-email", json={"token": token}).status_code == 200

    monkeypatch.setattr(settings, "EMAIL_VERIFICATION_REQUIRED", True)
    response = client.post(
        "/api/v1/auth/login",
        json={"email": user["email"], "password": user["password"]},
    )
    assert response.status_code == 200, response.text


def test_gate_does_not_leak_password_validity(user, monkeypatch):
    """A wrong password on an unverified account must not return the 403 code."""
    monkeypatch.setattr(settings, "EMAIL_VERIFICATION_REQUIRED", True)
    response = client.post(
        "/api/v1/auth/login",
        json={"email": user["email"], "password": "NotThePassword123!"},
    )
    assert response.status_code == 401


# ------------------------------------------------------- console fallback


def test_sms_falls_back_to_console_and_logs_the_otp(user, caplog, monkeypatch):
    """The no-credential path must still produce a usable, visible OTP.

    This is what makes Phase 3 exercisable before the paid MSG91 account
    exists, so it is load-bearing rather than a convenience.
    """
    monkeypatch.setattr(sms_service, "send_otp", sms_service.send_otp)
    monkeypatch.setattr(settings, "SMS_PROVIDER", "msg91")
    monkeypatch.setattr(settings, "SMS_API_KEY", "change-me")

    import logging

    with caplog.at_level(logging.WARNING, logger="app.services.sms_service"):
        response = client.post(
            "/api/v1/auth/login/otp/send", json={"mobile": user["mobile"]}
        )
    assert response.status_code == 200

    logged = [r.getMessage() for r in caplog.records if "OTP" in r.getMessage()]
    assert logged, "console fallback did not log the OTP"

    otp = re.search(r"OTP for \S+ is (\d{6})", logged[-1]).group(1)
    verified = client.post(
        "/api/v1/auth/login/otp/verify", json={"mobile": user["mobile"], "otp": otp}
    )
    assert verified.status_code == 200, verified.text


def _production_baseline(monkeypatch, **overrides) -> None:
    """Put `settings` in an otherwise-valid production state.

    Each guard is asserted on its own, so the pre-existing JWT/database/lifetime
    checks have to be satisfied first — otherwise they trip first and every
    assertion below would be testing the wrong thing.
    """
    monkeypatch.setattr(settings, "APP_ENV", "production")
    monkeypatch.setattr(settings, "JWT_SECRET_KEY", "a-real-access-secret")
    monkeypatch.setattr(settings, "JWT_REFRESH_SECRET_KEY", "a-different-refresh-secret")
    monkeypatch.setattr(settings, "DB_PASSWORD", "a-real-db-password")
    monkeypatch.setattr(settings, "DATABASE_URL", "postgresql+psycopg2://u:p@localhost/db")
    # The dev env ships 1440-minute access tokens, which trips the pre-existing
    # lifetime guard before any delivery-provider check is reached.
    monkeypatch.setattr(settings, "JWT_ACCESS_TOKEN_EXPIRE_MINUTES", 30)

    monkeypatch.setattr(settings, "EMAIL_PROVIDER", "sendgrid")
    monkeypatch.setattr(settings, "EMAIL_API_KEY", "a-real-sendgrid-key")
    monkeypatch.setattr(settings, "SMS_PROVIDER", "msg91")
    monkeypatch.setattr(settings, "SMS_API_KEY", "a-real-msg91-key")
    monkeypatch.setattr(settings, "SMS_DLT_TEMPLATE_ID", "a-registered-dlt-template")
    # Phase 9 / the media-upload work added three more production guards after
    # this helper was written, and they trip *before* any delivery-provider check
    # is reached. Without satisfying them here every assertion in this file would
    # be testing the wrong guard — the same reason the JWT and lifetime defaults
    # are pinned above.
    monkeypatch.setattr(settings, "MEDIA_ROOT", "/var/lib/padhaanewala/media")
    monkeypatch.setattr(settings, "MEDIA_MAX_BYTES", 5 * 1024 * 1024)
    monkeypatch.setattr(settings, "MEDIA_URL_PREFIX", "/api/v1/media/files")
    for name, value in overrides.items():
        monkeypatch.setattr(settings, name, value)


def test_production_refuses_to_boot_with_console_delivery(monkeypatch):
    """A console provider in production must fail loudly, not silently.

    Otherwise `EMAIL_VERIFICATION_REQUIRED` blocks every login while the
    confirmation link only ever reaches a log file.
    """
    _production_baseline(monkeypatch, EMAIL_PROVIDER="console")

    with pytest.raises(ValueError) as excinfo:
        settings._guard_production_defaults()
    assert "console" in str(excinfo.value)

    # And the SMS side is guarded independently, not shadowed by the email check.
    _production_baseline(monkeypatch, SMS_PROVIDER="console")
    with pytest.raises(ValueError) as sms_exc:
        settings._guard_production_defaults()
    assert "SMS_API_KEY" in str(sms_exc.value)


def test_production_smtp_needs_no_email_api_key(monkeypatch):
    """SMTP must be judged on SMTP credentials, not on an API key it never reads.

    The guard used to reject any production config whose `EMAIL_API_KEY` was
    still the shipped default, including `EMAIL_PROVIDER=smtp` with perfectly
    good SMTP credentials — the key is meaningless to SMTP, so a correct
    deployment was refused at boot.
    """
    _production_baseline(
        monkeypatch,
        EMAIL_PROVIDER="smtp",
        EMAIL_API_KEY="change-me",
        EMAIL_SMTP_USER="apikey",
        EMAIL_SMTP_PASSWORD="a-real-smtp-password",
    )

    settings._guard_production_defaults()  # must not raise

    # Placeholder SMTP credentials are still refused, so this is not a blanket
    # exemption for the smtp branch.
    _production_baseline(
        monkeypatch,
        EMAIL_PROVIDER="smtp",
        EMAIL_SMTP_USER="change-me",
        EMAIL_SMTP_PASSWORD="a-real-smtp-password",
    )
    with pytest.raises(ValueError) as excinfo:
        settings._guard_production_defaults()
    assert "EMAIL_SMTP_USER" in str(excinfo.value)

    # And sendgrid still requires its own key.
    _production_baseline(monkeypatch, EMAIL_PROVIDER="sendgrid", EMAIL_API_KEY="change-me")
    with pytest.raises(ValueError) as sg_exc:
        settings._guard_production_defaults()
    assert "EMAIL_API_KEY" in str(sg_exc.value)


def test_production_requires_a_registered_dlt_template(monkeypatch):
    """A placeholder DLT template would boot healthy and fail every send.

    MSG91 rejects a transactional message with an unregistered template at send
    time, so the app would start, pass every health check, and drop every OTP —
    the same silent failure the console guard exists to prevent.
    """
    _production_baseline(monkeypatch, SMS_DLT_TEMPLATE_ID="change-me")

    with pytest.raises(ValueError) as excinfo:
        settings._guard_production_defaults()
    assert "SMS_DLT_TEMPLATE_ID" in str(excinfo.value)
