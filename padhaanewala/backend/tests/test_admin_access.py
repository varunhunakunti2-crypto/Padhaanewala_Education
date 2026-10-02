"""Access boundary for the admin console.

The frontend gates `/admin` on the client via `RequireAdmin`, which trusts
`GET /api/v1/users/me/roles`. That is UX only, so these tests pin the server-side
contract the guard depends on:

* self-registration must never mint an admin-capable role
* `GET /users/me/roles` must report the truth for both account kinds
* a plain student must be refused by every admin-gated endpoint group
* an `admin` must be allowed through those same endpoints
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Role, User

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


def _register(prefix: str) -> dict:
    payload = {
        "name": "Access Test",
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


@pytest.fixture
def student():
    return _register("student")


@pytest.fixture
def admin_account():
    account = _register("admin")
    _assign_roles(account["email"], ["admin", "super_admin"])
    return account


# Reads the admin dashboard shell performs on mount that carry CRM or
# user data. These must be refused for a student.
ADMIN_GATED_READS = [
    "/api/v1/users",
    "/api/v1/users/admin-only",
    "/api/v1/audit-logs",
    "/api/v1/leads",
    "/api/v1/reviews/moderation",
]

# Reads that are deliberately public because the same rows render on the
# marketing site. They are listed here so nobody "fixes" them into a 403.
PUBLIC_READS = [
    "/api/v1/banners",
    "/api/v1/media",
]

# Writes are unambiguously admin-only on every content router.
ADMIN_GATED_WRITES = [
    ("post", "/api/v1/banners", {}),
    ("post", "/api/v1/media", {}),
    ("post", "/api/v1/colleges", {}),
    ("post", "/api/v1/exams", {}),
    ("post", "/api/v1/notifications", {}),
]


def test_registration_never_grants_admin_role(student):
    """The guard trusts /users/me/roles, so registration must not return an admin role."""
    response = client.get("/api/v1/users/me/roles", headers=_login(student["email"]))
    assert response.status_code == 200, response.text
    roles = response.json()["roles"]
    assert "student" in roles
    assert not ({"admin", "super_admin"} & set(roles)), roles


def test_student_roles_are_reported(student):
    response = client.get("/api/v1/users/me/roles", headers=_login(student["email"]))
    assert response.status_code == 200
    assert response.json()["roles"] == sorted(response.json()["roles"])


def test_admin_roles_are_reported(admin_account):
    response = client.get(
        "/api/v1/users/me/roles", headers=_login(admin_account["email"])
    )
    assert response.status_code == 200
    assert set(response.json()["roles"]) >= {"admin", "super_admin"}


def test_student_is_forbidden_from_admin_reads(student):
    headers = _login(student["email"])
    for path in ADMIN_GATED_READS:
        response = client.get(path, headers=headers)
        assert response.status_code == 403, f"{path} returned {response.status_code}"


def test_student_cannot_write_admin_content(student):
    headers = _login(student["email"])
    for method, path, body in ADMIN_GATED_WRITES:
        response = getattr(client, method)(path, headers=headers, json=body)
        assert response.status_code == 403, f"{method.upper()} {path} returned {response.status_code}"


def test_admin_is_allowed_into_admin_reads(admin_account):
    headers = _login(admin_account["email"])
    for path in ADMIN_GATED_READS:
        response = client.get(path, headers=headers)
        assert response.status_code != 403, f"{path} returned 403 for an admin"


def test_public_reads_stay_public(student):
    headers = _login(student["email"])
    for path in PUBLIC_READS:
        response = client.get(path, headers=headers)
        assert response.status_code == 200, f"{path} returned {response.status_code}"


def test_student_can_still_reach_student_endpoints(student):
    """Blocking /admin must not cost a student their own dashboard data."""
    headers = _login(student["email"])
    assert client.get("/api/v1/saved-colleges", headers=headers).status_code == 200
    assert client.get("/api/v1/notifications/my", headers=headers).status_code == 200
    assert client.get("/api/v1/reviews/my", headers=headers).status_code == 200


def test_roles_endpoint_requires_authentication():
    assert client.get("/api/v1/users/me/roles").status_code in (401, 403)
