import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _unique(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:8]}@example.com"


def _unique_mobile() -> str:
    return f"9{uuid.uuid4().int % 1_000_000_000:09d}"


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