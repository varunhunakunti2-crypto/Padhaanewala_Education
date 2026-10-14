"""The platform-wide Settings panel, end to end.

`SettingsSection` used to be decorative: hardcoded inputs and a Save button that
only raised a toast, so nothing an admin typed was ever stored. These tests hold
the server contract that makes it real:

* only an admin may read or write the row, and it is a singleton
* a save persists, proved by a second read rather than by the 200 alone
* the update is partial, so one changed field cannot blank the rest
* values are validated, because the public site publishes them
* every save leaves an audit row

Absolute default values are deliberately not asserted: the row is mutable, so a
test pinning ``site_name == "padhaanewala"`` would fail the moment an admin
renames the site through the console -- which is the feature working.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import AuditLog, Role, SiteSetting, User

client = TestClient(app)

PASSWORD = "SecurePass123!"
SETTINGS = "/api/v1/settings"

FIELD_KEYS = {
    "site_name",
    "support_email",
    "contact_phone",
    "counselling_hours",
    "default_timezone",
    "number_formatting",
    "updated_at",
}


def _unique(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:8]}@example.com"


def _unique_mobile() -> str:
    return f"9{uuid.uuid4().int % 1_000_000_000:09d}"


def _register(prefix: str) -> tuple[str, str]:
    """Register a fresh account, returning ``(email, access_token)``."""
    email = _unique(prefix)
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Settings Test",
            "email": email,
            "mobile": _unique_mobile(),
            "password": PASSWORD,
            "age_band": "18_plus",
        },
    )
    assert response.status_code == 201, response.text
    return email, response.json()["access_token"]


def _grant_admin(email: str) -> None:
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        role = db.query(Role).filter(Role.name == "admin").first()
        assert role is not None
        user.roles.append(role)
        db.commit()


@pytest.fixture
def admin_headers() -> dict[str, str]:
    email, token = _register("settings.admin")
    _grant_admin(email)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def student_headers() -> dict[str, str]:
    _, token = _register("settings.student")
    return {"Authorization": f"Bearer {token}"}


def test_settings_require_authentication():
    assert client.get(SETTINGS).status_code in (401, 403)
    assert client.put(SETTINGS, json={"site_name": "x"}).status_code in (401, 403)


def test_student_cannot_read_or_write(student_headers):
    assert client.get(SETTINGS, headers=student_headers).status_code == 403
    response = client.put(
        SETTINGS, json={"site_name": "hijacked"}, headers=student_headers
    )
    assert response.status_code == 403


def test_admin_reads_every_field(admin_headers):
    response = client.get(SETTINGS, headers=admin_headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == FIELD_KEYS
    for key in FIELD_KEYS - {"updated_at"}:
        assert isinstance(body[key], str)
        assert body[key] != ""


def test_a_save_persists_across_reads(admin_headers):
    name = f"Padhaanewala {uuid.uuid4().hex[:6]}"
    saved = client.put(SETTINGS, json={"site_name": name}, headers=admin_headers)
    assert saved.status_code == 200, saved.text
    assert saved.json()["site_name"] == name

    reread = client.get(SETTINGS, headers=admin_headers)
    assert reread.status_code == 200
    assert reread.json()["site_name"] == name


def test_update_is_partial_and_leaves_other_fields_alone(admin_headers):
    baseline = client.put(
        SETTINGS,
        json={
            "site_name": "Baseline Site",
            "support_email": "baseline@padhaanewala.in",
            "contact_phone": "+91 90000 00001",
        },
        headers=admin_headers,
    )
    assert baseline.status_code == 200, baseline.text

    changed = client.put(
        SETTINGS,
        json={"counselling_hours": "Mon-Fri, 10 AM - 6 PM IST"},
        headers=admin_headers,
    )
    assert changed.status_code == 200, changed.text
    body = changed.json()
    assert body["counselling_hours"] == "Mon-Fri, 10 AM - 6 PM IST"
    assert body["site_name"] == "Baseline Site"
    assert body["support_email"] == "baseline@padhaanewala.in"
    assert body["contact_phone"] == "+91 90000 00001"


def test_whitespace_is_stripped(admin_headers):
    response = client.put(
        SETTINGS, json={"site_name": "  Padded  "}, headers=admin_headers
    )
    assert response.status_code == 200, response.text
    assert response.json()["site_name"] == "Padded"


def test_invalid_email_is_rejected(admin_headers):
    response = client.put(
        SETTINGS, json={"support_email": "not-an-email"}, headers=admin_headers
    )
    assert response.status_code == 422


@pytest.mark.parametrize("blank", ["", "   "])
def test_blank_site_name_is_rejected(admin_headers, blank):
    response = client.put(SETTINGS, json={"site_name": blank}, headers=admin_headers)
    assert response.status_code == 422


def test_unknown_field_is_rejected(admin_headers):
    response = client.put(
        SETTINGS, json={"site_name": "Fine", "id": 99}, headers=admin_headers
    )
    assert response.status_code == 422


def test_timezone_is_constrained(admin_headers):
    bad = client.put(
        SETTINGS, json={"default_timezone": "Mars/Olympus"}, headers=admin_headers
    )
    assert bad.status_code == 422

    ok = client.put(SETTINGS, json={"default_timezone": "UTC"}, headers=admin_headers)
    assert ok.status_code == 200, ok.text
    assert ok.json()["default_timezone"] == "UTC"


def test_number_formatting_is_constrained(admin_headers):
    bad = client.put(
        SETTINGS, json={"number_formatting": "roman"}, headers=admin_headers
    )
    assert bad.status_code == 422


def test_every_save_is_audited(admin_headers):
    name = f"Audited {uuid.uuid4().hex[:6]}"
    assert (
        client.put(SETTINGS, json={"site_name": name}, headers=admin_headers).status_code
        == 200
    )
    with SessionLocal() as db:
        row = (
            db.query(AuditLog)
            .filter(AuditLog.entity_type == "site_settings")
            .order_by(AuditLog.id.desc())
            .first()
        )
    assert row is not None
    assert row.action == "update_site_settings"
    assert row.new_value == {"site_name": name}


def test_the_row_stays_a_singleton(admin_headers):
    assert (
        client.put(SETTINGS, json={"site_name": "Singleton"}, headers=admin_headers).status_code
        == 200
    )
    with SessionLocal() as db:
        assert db.query(SiteSetting).count() == 1
