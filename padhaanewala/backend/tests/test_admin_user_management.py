"""Admin account management: read one, edit identity, delete.

`tests/test_admin_access.py` pins *who* may reach the user routes. This module
pins what the routes do once an admin is through, because the console's View /
Edit / Delete buttons are only as real as the endpoints behind them. Each test
drives the HTTP surface the panel calls rather than the service layer, so a
router that forgets to persist a field fails here.

The delete tests assert on dependent rows as well: `users` is referenced by
twenty-odd tables with a mix of `ON DELETE CASCADE` and `ON DELETE SET NULL`,
and the endpoint deliberately relies on those rules instead of re-implementing
them. A change that swaps the Core `DELETE` for an ORM `db.delete()` would try
to null NOT NULL foreign keys and surface as a 500 — the profile assertion is
what catches that.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import SessionLocal
from app.main import app
from app.models import Role, StudentProfile, User

client = TestClient(app)

PASSWORD = "SecurePass123!"


def _unique(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:8]}@example.com"


def _unique_mobile() -> str:
    return f"9{uuid.uuid4().int % 1_000_000_000:09d}"


def _assign_roles(email: str, role_names: list[str]) -> None:
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        roles = []
        for name in role_names:
            role = db.query(Role).filter(Role.name == name).first()
            if role is None:
                role = Role(name=name, description=f"test:{name}")
                db.add(role)
                db.flush()
            roles.append(role)
        user.roles = roles
        db.commit()


def _register(prefix: str, name: str = "Account Test") -> dict:
    payload = {
        "name": name,
        "email": _unique(prefix),
        "mobile": _unique_mobile(),
        "password": PASSWORD,
        "age_band": "18_plus",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    return payload


def _login(email: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _id_for(email: str) -> int:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        assert user is not None
        return user.id


@pytest.fixture
def admin_account():
    account = _register("admin")
    _assign_roles(account["email"], ["admin"])
    return account


@pytest.fixture
def super_admin_account():
    account = _register("super")
    _assign_roles(account["email"], ["admin", "super_admin"])
    return account


@pytest.fixture
def student_account():
    return _register("student", name="Student To Edit")


def test_admin_reads_one_account(admin_account, student_account):
    headers = _login(admin_account["email"])
    student_id = _id_for(student_account["email"])

    response = client.get(f"/api/v1/users/{student_id}", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["id"] == student_id
    assert body["email"] == student_account["email"]
    assert body["display_name"] == "Student To Edit"
    assert body["roles"] == ["student"]
    assert body["is_mobile_verified"] is False


def test_student_cannot_read_another_account(student_account):
    other = _register("other")
    headers = _login(student_account["email"])

    response = client.get(f"/api/v1/users/{_id_for(other['email'])}", headers=headers)
    assert response.status_code == 403, response.text


def test_patch_edits_identity_and_clears_verification(admin_account, student_account):
    headers = _login(admin_account["email"])
    student_id = _id_for(student_account["email"])

    # Registration leaves both flags false, so set them to prove the endpoint
    # *clears* a verification rather than merely leaving one unset.
    with SessionLocal() as db:
        user = db.get(User, student_id)
        assert user is not None
        user.is_email_verified = True
        db.commit()

    new_email = _unique("moved")
    response = client.patch(
        f"/api/v1/users/{student_id}",
        headers=headers,
        json={"display_name": "Renamed Student", "email": new_email},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["display_name"] == "Renamed Student"
    assert body["email"] == new_email
    assert body["is_email_verified"] is False

    with SessionLocal() as db:
        profile = db.scalar(
            select(StudentProfile).where(StudentProfile.user_id == student_id)
        )
        assert profile is not None and profile.name == "Renamed Student"


def test_patch_rejects_an_email_already_in_use(admin_account, student_account):
    headers = _login(admin_account["email"])
    student_id = _id_for(student_account["email"])

    response = client.patch(
        f"/api/v1/users/{student_id}",
        headers=headers,
        json={"email": admin_account["email"]},
    )
    assert response.status_code == 409, response.text


def test_patch_rejects_an_invalid_mobile(admin_account, student_account):
    headers = _login(admin_account["email"])
    student_id = _id_for(student_account["email"])

    response = client.patch(
        f"/api/v1/users/{student_id}", headers=headers, json={"mobile": "12345"}
    )
    assert response.status_code == 422, response.text


def test_delete_removes_the_account_and_its_profile(admin_account, student_account):
    headers = _login(admin_account["email"])
    student_id = _id_for(student_account["email"])

    response = client.delete(f"/api/v1/users/{student_id}", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["success"] is True

    assert client.get(f"/api/v1/users/{student_id}", headers=headers).status_code == 404
    with SessionLocal() as db:
        assert db.get(User, student_id) is None
        profile = db.scalar(
            select(StudentProfile).where(StudentProfile.user_id == student_id)
        )
        assert profile is None


def test_admin_cannot_delete_themselves(admin_account):
    headers = _login(admin_account["email"])
    response = client.delete(
        f"/api/v1/users/{_id_for(admin_account['email'])}", headers=headers
    )
    assert response.status_code == 400, response.text


def test_student_cannot_delete_an_account(student_account):
    other = _register("other")
    headers = _login(student_account["email"])

    response = client.delete(
        f"/api/v1/users/{_id_for(other['email'])}", headers=headers
    )
    assert response.status_code == 403, response.text


def test_plain_admin_cannot_delete_a_super_admin(admin_account, super_admin_account):
    headers = _login(admin_account["email"])
    response = client.delete(
        f"/api/v1/users/{_id_for(super_admin_account['email'])}", headers=headers
    )
    assert response.status_code == 403, response.text
