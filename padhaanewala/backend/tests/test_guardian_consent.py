"""Guardian-consent hardening: the code must prove a guardian, not the child.

DPDP s.9(2) only permits verifiable parental consent. A code the child can
request for themselves, or that was issued to a different child's guardian,
is a self-declaration wearing a verification badge. These tests exercise the
binding at the HTTP boundary (where the client could try to redirect the
target) and at the OTP service boundary (where challenge identity lives).
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import GuardianConsent, OtpRecord, User
from app.services import otp_service, sms_service

client = TestClient(app)


def _unique_mobile(prefix: str = "9") -> str:
    return f"{prefix}{uuid.uuid4().int % 1_000_000_000:09d}"


@pytest.fixture
def sms_outbox(monkeypatch):
    """Intercept the delivery call so the plaintext code is observable in tests."""
    box = {"sms": []}

    def fake_send_otp(mobile: str, otp: str) -> str:
        box["sms"].append({"mobile": mobile, "otp": otp})
        return "msg91"

    monkeypatch.setattr(sms_service, "send_otp", fake_send_otp)
    return box


def _register_minor() -> dict:
    email = f"minor.{uuid.uuid4().hex[:8]}@example.com"
    mobile = _unique_mobile()
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Minor Student",
            "email": email,
            "mobile": mobile,
            "password": "SecurePass123!",
            "age_band": "under_18",
        },
    )
    assert response.status_code == 201, response.text
    token = response.json()["access_token"]
    return {
        "email": email,
        "mobile": mobile,
        "headers": {"Authorization": f"Bearer {token}"},
    }


def _request_consent(minor: dict, guardian_mobile: str, *, guardian_email=None) -> dict:
    response = client.post(
        "/api/v1/compliance/parental-consent/request",
        json={
            "guardian_name": "A Parent",
            "guardian_mobile": guardian_mobile,
            "guardian_email": guardian_email,
        },
        headers=minor["headers"],
    )
    assert response.status_code == 201, response.text
    return response.json()


def _verify(minor: dict, code: str, **extra) -> dict:
    return client.post(
        "/api/v1/compliance/parental-consent/verify",
        json={"code": code, **extra},
        headers=minor["headers"],
    )


def test_guardian_contact_cannot_be_the_child(sms_outbox):
    """A self-declared 'guardian' is not verifiable consent."""
    minor = _register_minor()

    same_mobile = client.post(
        "/api/v1/compliance/parental-consent/request",
        json={"guardian_name": "Myself", "guardian_mobile": minor["mobile"]},
        headers=minor["headers"],
    )
    assert same_mobile.status_code == 422, same_mobile.text

    same_email = client.post(
        "/api/v1/compliance/parental-consent/request",
        json={
            "guardian_name": "Myself",
            "guardian_mobile": _unique_mobile("8"),
            "guardian_email": minor["email"],
        },
        headers=minor["headers"],
    )
    assert same_email.status_code == 422, same_email.text

    with SessionLocal() as db:
        user = db.query(User).filter(User.email == minor["email"]).one()
        assert db.query(GuardianConsent).filter(GuardianConsent.user_id == user.id).count() == 0


def test_email_only_guardian_consent_is_rejected(sms_outbox):
    """No email OTP delivery exists for this flow, so email-only cannot verify."""
    minor = _register_minor()
    response = client.post(
        "/api/v1/compliance/parental-consent/request",
        json={
            "guardian_name": "A Parent",
            "guardian_email": f"guardian.{uuid.uuid4().hex[:8]}@example.com",
        },
        headers=minor["headers"],
    )
    assert response.status_code == 422, response.text
    assert "mobile" in response.json()["detail"] or any(
        "mobile" in str(error.get("msg", "")) for error in response.json()["detail"]
    )


def test_consent_code_bound_to_user_and_challenge(sms_outbox):
    """A code for one child's guardian cannot verify another child's consent."""
    child_a = _register_minor()
    child_b = _register_minor()
    guardian_mobile = _unique_mobile("8")
    assert guardian_mobile not in (child_a["mobile"], child_b["mobile"])

    _request_consent(child_a, guardian_mobile)
    code_a = sms_outbox["sms"][-1]["otp"]
    consent_b = _request_consent(child_b, guardian_mobile)
    code_b = sms_outbox["sms"][-1]["otp"]

    # The second request superseded the first code for this number.
    assert _verify(child_a, code_a).status_code == 400
    # The live code belongs to child B's challenge, not child A's.
    assert _verify(child_a, code_b).status_code == 400

    verified = _verify(child_b, code_b)
    assert verified.status_code == 200, verified.text
    assert verified.json()["status"] == "verified"

    # The suffix on `otp_records.purpose` is the challenge id, with no schema
    # migration. A code minted for one consent row must not verify a different
    # challenge even for the same user and the same guardian number.
    with SessionLocal() as db:
        user_b = db.query(User).filter(User.email == child_b["email"]).one()
        issued = otp_service.issue(
            db,
            purpose=otp_service.GUARDIAN_CONSENT,
            identifier=guardian_mobile,
            user_id=user_b.id,
            challenge_id=consent_b["id"],
        )
        record = db.get(OtpRecord, issued.record.id)
        assert record.purpose == otp_service.guardian_consent_purpose(consent_b["id"])

        with pytest.raises(otp_service.OtpNotFound):
            otp_service.verify(
                db,
                purpose=otp_service.guardian_consent_purpose(consent_b["id"] + 1),
                identifier=guardian_mobile,
                secret=issued.secret,
                user_id=user_b.id,
            )


def test_client_cannot_redirect_the_verification_target(sms_outbox):
    """Verify takes only a code; the target comes from the stored consent row."""
    minor = _register_minor()
    guardian_mobile = _unique_mobile("8")
    _request_consent(minor, guardian_mobile)
    code = sms_outbox["sms"][-1]["otp"]

    override = _verify(
        minor, code, mobile=minor["mobile"], guardian_mobile=minor["mobile"]
    )
    assert override.status_code == 422, override.text

    # The untouched request still works, so the rejection was the extra fields
    # and not a broken challenge.
    valid = _verify(minor, code)
    assert valid.status_code == 200, valid.text
