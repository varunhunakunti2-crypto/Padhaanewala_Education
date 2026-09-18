import uuid

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Role, User

client = TestClient(app)


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


@pytest.fixture
def user_payload():
    return {
        "name": "Test Student",
        "email": _unique("student"),
        "mobile": _unique_mobile(),
        "password": "SecurePass123!",
    }


@pytest.fixture
def registered(user_payload):
    response = client.post("/api/v1/auth/register", json=user_payload)
    assert response.status_code == 201
    return {**user_payload, **response.json()}


@pytest.fixture
def admin():
    payload = {
        "name": "Test Admin",
        "email": _unique("admin"),
        "mobile": _unique_mobile(),
        "password": "SecurePass123!",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    data = {**payload, **response.json()}
    _assign_roles(data["email"], ["admin", "super_admin"])
    return data


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_register_success(registered):
    assert registered["token_type"] == "bearer"
    assert registered["access_token"]
    assert registered["refresh_token"]


def test_register_duplicate_email(registered):
    payload = {
        "name": "Another Student",
        "email": registered["email"],
        "mobile": _unique_mobile(),
        "password": "SecurePass123!",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 409


def test_register_invalid_mobile():
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Bad Mobile",
            "email": _unique("badmobile"),
            "mobile": "12345",
            "password": "SecurePass123!",
        },
    )
    assert response.status_code == 422


def test_login_success(registered):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": registered["email"], "password": "SecurePass123!"},
    )
    assert response.status_code == 200
    assert response.json()["access_token"]


def test_login_wrong_password(registered):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": registered["email"], "password": "wrong-password"},
    )
    assert response.status_code == 401


def test_me_requires_token():
    response = client.get("/api/v1/users/me")
    assert response.status_code == 401


def test_get_me(registered):
    headers = {"Authorization": f"Bearer {registered['access_token']}"}
    response = client.get("/api/v1/users/me", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == registered["email"]
    assert body["mobile"] == registered["mobile"]
    assert body["is_active"] is True


def test_get_profile(registered):
    headers = {"Authorization": f"Bearer {registered['access_token']}"}
    response = client.get("/api/v1/users/me/profile", headers=headers)
    assert response.status_code == 200
    assert response.json()["name"] == registered["name"]


def test_update_profile(registered):
    headers = {"Authorization": f"Bearer {registered['access_token']}"}
    response = client.put(
        "/api/v1/users/me",
        headers=headers,
        json={"course_interest": "B.Tech CSE", "budget_max": 500000},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["course_interest"] == "B.Tech CSE"
    assert body["budget_max"] == 500000


def test_change_password(registered):
    headers = {"Authorization": f"Bearer {registered['access_token']}"}
    response = client.put(
        "/api/v1/users/me/password",
        headers=headers,
        json={"current_password": "SecurePass123!", "new_password": "NewPass456!"},
    )
    assert response.status_code == 200

    old_login = client.post(
        "/api/v1/auth/login",
        json={"email": registered["email"], "password": "SecurePass123!"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/v1/auth/login",
        json={"email": registered["email"], "password": "NewPass456!"},
    )
    assert new_login.status_code == 200


def test_change_password_wrong_current(registered):
    headers = {"Authorization": f"Bearer {registered['access_token']}"}
    response = client.put(
        "/api/v1/users/me/password",
        headers=headers,
        json={"current_password": "wrong-current", "new_password": "NewPass456!"},
    )
    assert response.status_code == 400


def test_refresh(registered):
    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": registered["refresh_token"]},
    )
    assert response.status_code == 200
    assert response.json()["access_token"]


def test_refresh_invalid_token():
    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "not-a-valid-token-value"},
    )
    assert response.status_code == 401


def test_logout(registered):
    response = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": registered["refresh_token"]},
    )
    assert response.status_code == 200
    assert response.json()["success"] is True


def test_login_case_insensitive_email():
    payload = {
        "name": "Case Test",
        "email": f"CaseTest.{uuid.uuid4().hex[:8]}@Example.COM",
        "mobile": _unique_mobile(),
        "password": "SecurePass123!",
    }
    create = client.post("/api/v1/auth/register", json=payload)
    assert create.status_code == 201

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": payload["email"].lower(), "password": "SecurePass123!"},
    )
    assert login_response.status_code == 200


def test_access_token_rejected_as_refresh(registered):
    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": registered["access_token"]},
    )
    assert response.status_code == 401


def test_me_rejects_garbage_token():
    response = client.get(
        "/api/v1/users/me",
        headers={"Authorization": "Bearer not.a.jwt"},
    )
    assert response.status_code == 401


def test_get_my_roles(registered):
    _assign_roles(registered["email"], ["student"])
    headers = {"Authorization": f"Bearer {registered['access_token']}"}
    response = client.get("/api/v1/users/me/roles", headers=headers)
    assert response.status_code == 200
    assert "student" in response.json()["roles"]


def test_get_roles_requires_auth():
    response = client.get("/api/v1/roles")
    assert response.status_code == 401


def test_get_roles(registered):
    _assign_roles(registered["email"], ["student"])
    headers = {"Authorization": f"Bearer {registered['access_token']}"}
    response = client.get("/api/v1/roles", headers=headers)
    assert response.status_code == 200
    names = [r["name"] for r in response.json()]
    assert "student" in names


def test_admin_list_users_forbidden_for_student(registered):
    _assign_roles(registered["email"], ["student"])
    headers = {"Authorization": f"Bearer {registered['access_token']}"}
    response = client.get("/api/v1/users", headers=headers)
    assert response.status_code == 403


def test_admin_list_users_missing_token():
    response = client.get("/api/v1/users")
    assert response.status_code == 401


def test_admin_list_users(admin, registered):
    _assign_roles(registered["email"], ["student"])
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    response = client.get("/api/v1/users", headers=headers)
    assert response.status_code == 200
    emails = [u["email"] for u in response.json()]
    assert registered["email"] in emails


def test_admin_list_users_search(admin, registered):
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    response = client.get(
        "/api/v1/users",
        params={"search": registered["mobile"]},
        headers=headers,
    )
    assert response.status_code == 200
    assert any(u["mobile"] == registered["mobile"] for u in response.json())


def test_admin_get_user_detail(admin, registered):
    _assign_roles(registered["email"], ["student"])
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    listing = client.get(
        "/api/v1/users", params={"search": registered["email"]}, headers=headers
    ).json()
    target_id = next(u["id"] for u in listing if u["email"] == registered["email"])

    response = client.get(f"/api/v1/users/{target_id}", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == registered["email"]
    assert "student" in body["roles"]


def test_admin_update_user_not_found(admin):
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    response = client.patch(
        "/api/v1/users/999999999",
        json={"is_active": False},
        headers=headers,
    )
    assert response.status_code == 404


def test_admin_cannot_deactivate_self(admin):
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    listing = client.get(
        "/api/v1/users", params={"search": admin["email"]}, headers=headers
    ).json()
    own_id = next(u["id"] for u in listing if u["email"] == admin["email"])

    response = client.patch(
        f"/api/v1/users/{own_id}",
        json={"is_active": False},
        headers=headers,
    )
    assert response.status_code == 400


def test_admin_assign_roles(admin, registered):
    _assign_roles(registered["email"], ["student"])
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    listing = client.get(
        "/api/v1/users", params={"search": registered["email"]}, headers=headers
    ).json()
    target_id = next(u["id"] for u in listing if u["email"] == registered["email"])

    roles_list = client.get("/api/v1/roles", headers=headers).json()
    counsellor_id = next(r["id"] for r in roles_list if r["name"] == "counsellor")

    response = client.patch(
        f"/api/v1/users/{target_id}",
        json={"role_ids": [counsellor_id]},
        headers=headers,
    )
    assert response.status_code == 200
    assert "counsellor" in response.json()["roles"]
    assert "student" not in response.json()["roles"]

    my_roles = client.get(
        "/api/v1/users/me/roles",
        headers={"Authorization": f"Bearer {registered['access_token']}"},
    ).json()
    assert "counsellor" in my_roles["roles"]


def test_admin_deactivates_user_and_blocks_login(admin, registered):
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    listing = client.get(
        "/api/v1/users", params={"search": registered["email"]}, headers=headers
    ).json()
    target_id = next(u["id"] for u in listing if u["email"] == registered["email"])

    response = client.patch(
        f"/api/v1/users/{target_id}",
        json={"is_active": False},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["is_active"] is False

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": registered["email"], "password": "SecurePass123!"},
    )
    assert login_response.status_code == 403

    me_response = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {registered['access_token']}"},
    )
    assert me_response.status_code == 401


def test_admin_only_stub_forbidden_for_student(registered):
    _assign_roles(registered["email"], ["student"])
    headers = {"Authorization": f"Bearer {registered['access_token']}"}
    response = client.get("/api/v1/users/admin-only", headers=headers)
    assert response.status_code == 403


def test_admin_only_stub_allowed(admin):
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    response = client.get("/api/v1/users/admin-only", headers=headers)
    assert response.status_code == 200