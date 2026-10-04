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
        "age_band": "18_plus",
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
        "age_band": "18_plus",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    data = {**payload, **response.json()}
    _assign_roles(data["email"], ["admin", "super_admin"])
    return data


def _staff_with_roles(prefix: str, roles: list[str]) -> dict:
    payload = {
        "name": f"Test {prefix}",
        "email": _unique(prefix),
        "mobile": _unique_mobile(),
        "password": "SecurePass123!",
        "age_band": "18_plus",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    data = {**payload, **response.json()}
    _assign_roles(data["email"], roles)
    return data


@pytest.fixture
def plain_admin():
    """A caller holding `admin` and nothing else.

    The `admin` fixture above also holds `super_admin`, and `outranks()` reads a
    caller's *weakest* held role (`min(rank(...))`), so it cannot distinguish the
    two cases. Privilege-ceiling tests need a genuinely single-role caller.
    """
    return _staff_with_roles("plainadmin", ["admin"])


@pytest.fixture
def super_admin():
    """A caller holding only `super_admin` — the strongest possible holder."""
    return _staff_with_roles("superadmin", ["super_admin"])


def test_health():
    response = client.get("/health")
    assert response.status_code == 200

    # The endpoint now verifies PostgreSQL instead of returning a constant, so it
    # reports a checks map and a measurement timestamp. `test_health.py` covers the
    # failure path; this asserts the healthy shape.
    body = response.json()
    assert body["status"] == "ok"
    assert body["checks"]["database"]["ok"] is True
    assert body["checked_at"]


def test_register_success(registered):
    assert registered["token_type"] == "bearer"
    assert registered["access_token"]
    # Phase 3: the refresh credential travels as an HttpOnly cookie, never in a
    # body any script in the origin can read.
    assert registered["refresh_token"] is None


def test_register_duplicate_email(registered):
    payload = {
        "name": "Another Student",
        "email": registered["email"],
        "mobile": _unique_mobile(),
        "password": "SecurePass123!",
        "age_band": "18_plus",
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
    # Phase 3: the shared TestClient carries the HttpOnly cookie set at
    # registration, so refresh reads it and rotates it.
    response = client.post("/api/v1/auth/refresh", json={})
    assert response.status_code == 200
    assert response.json()["access_token"]


def test_refresh_invalid_token():
    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "not-a-valid-token-value"},
    )
    assert response.status_code == 401


def test_logout(registered):
    response = client.post("/api/v1/auth/logout", json={})
    assert response.status_code == 200
    assert response.json()["success"] is True


def test_login_case_insensitive_email():
    payload = {
        "name": "Case Test",
        "email": f"CaseTest.{uuid.uuid4().hex[:8]}@Example.COM",
        "mobile": _unique_mobile(),
        "password": "SecurePass123!",
        "age_band": "18_plus",
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


def test_get_roles_forbidden_for_student(registered):
    """`GET /roles` hands out the ids `PATCH /users/{id}` accepts, so it is
    admin-only. A student reads their own roles from `/users/me/roles`."""
    _assign_roles(registered["email"], ["student"])
    headers = {"Authorization": f"Bearer {registered['access_token']}"}
    response = client.get("/api/v1/roles", headers=headers)
    assert response.status_code == 403


def test_get_roles_allowed_for_admin(admin):
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    response = client.get("/api/v1/roles", headers=headers)
    assert response.status_code == 200, response.text
    names = [r["name"] for r in response.json()]
    assert "student" in names
    assert "super_admin" in names


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

    # The listing is capped at 50 per page and ordered by id, so a brand new user
    # is on the *last* page once the suite has created more than 50 of them.
    # Walking the pages keeps this asserting what it means to assert -- that an
    # admin's listing includes every user -- rather than depending on how many
    # users happen to exist by the time this runs.
    seen: list[str] = []
    offset = 0
    while True:
        response = client.get(
            "/api/v1/users",
            params={"limit": 50, "offset": offset},
            headers=headers,
        )
        assert response.status_code == 200, response.text
        body = response.json()
        page = body["items"]
        seen.extend(user["email"] for user in page)
        if len(page) < 50:
            break
        offset += 50

    assert registered["email"] in seen


def test_admin_list_users_reports_the_full_total(admin, registered):
    """`total` must describe the account base, not the page.

    Without it the console cannot distinguish "50 users" from "50 of 312", so an
    admin managing a large base has no way to know the listing is truncated.
    """
    _assign_roles(registered["email"], ["student"])
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    response = client.get(
        "/api/v1/users", params={"limit": 1, "offset": 0}, headers=headers
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 1
    assert body["total"] > 1, "total should count every user, not the page"
    assert body["limit"] == 1
    assert body["offset"] == 0


def test_admin_list_users_filters_by_is_active(admin, registered):
    """The "Inactive" chip has to filter accounts, not just the current page."""
    _assign_roles(registered["email"], ["student"])
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    target = client.get(
        "/api/v1/users", params={"search": registered["email"]}, headers=headers
    ).json()["items"][0]

    client.patch(
        f"/api/v1/users/{target['id']}",
        json={"is_active": False},
        headers=headers,
    )

    active = client.get(
        "/api/v1/users",
        params={"is_active": True, "search": registered["email"]},
        headers=headers,
    ).json()
    assert active["items"] == []

    inactive = client.get(
        "/api/v1/users",
        params={"is_active": False, "search": registered["email"]},
        headers=headers,
    ).json()
    assert [u["email"] for u in inactive["items"]] == [registered["email"]]


def test_admin_list_users_filters_by_role(admin, registered):
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    _assign_roles(registered["email"], ["student"])

    admins = client.get(
        "/api/v1/users", params={"role": "admin"}, headers=headers
    ).json()
    assert any(u["email"] == admin["email"] for u in admins["items"])
    assert all("admin" in u["roles"] for u in admins["items"])

    # An unknown role name must return nothing rather than silently ignoring the
    # filter, which would hand back an unfiltered page that looks like a match.
    unknown = client.get(
        "/api/v1/users", params={"role": "no_such_role"}, headers=headers
    ).json()
    assert unknown["items"] == []
    assert unknown["total"] == 0


def test_admin_list_users_search_matches_the_students_name(admin, registered):
    """Search must reach the name, not just email and mobile.

    The console's name column is the profile name, so a filter that only matched
    an email would fail to find the very value it displays.
    """
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    response = client.put(
        "/api/v1/users/me",
        json={"name": "Zainab Qureshi"},
        headers={"Authorization": f"Bearer {registered['access_token']}"},
    )
    assert response.status_code == 200, response.text

    found = client.get(
        "/api/v1/users", params={"search": "Zainab Qureshi"}, headers=headers
    ).json()
    assert [u["email"] for u in found["items"]] == [registered["email"]]
    assert found["items"][0]["display_name"] == "Zainab Qureshi"


def test_get_roles_marks_each_role_grantable_for_the_caller(plain_admin):
    """`grantable` must reflect R4.8, so the UI never offers a 403.

    `PRIVILEGE_ORDER` is most-privileged-first and `outranks` is a strict `<`, so
    a caller may grant a role *strictly below* their own. For a plain `admin`
    (rank 1) that means everything from `content_manager` down, and explicitly
    not `admin` — a plain admin cannot mint a peer admin; only a `super_admin`
    can. That is the whole reason this flag exists: the console used to gate its
    one hardcoded "make admin" toggle on a client-side role check, which is the
    same ordering reimplemented in TypeScript and free to drift.
    """
    headers = {"Authorization": f"Bearer {plain_admin['access_token']}"}
    roles = {
        r["name"]: r for r in client.get("/api/v1/roles", headers=headers).json()
    }

    assert roles["super_admin"]["grantable"] is False
    assert roles["admin"]["grantable"] is False
    assert roles["content_manager"]["grantable"] is True
    assert roles["counsellor"]["grantable"] is True
    assert roles["student"]["grantable"] is True


def test_super_admin_may_grant_admin_but_not_super_admin(super_admin):
    """Even the top role is withheld, and that is the policy working.

    `outranks` is a strict `<`, so no role outranks `super_admin` — not even
    `super_admin` itself — and `PATCH /users/{id}` refuses to grant it. Minting
    the top role is a script-level operation (see `scripts/seed_roles.py`), so
    the console must not imply otherwise. Had this row been marked grantable, the
    UI would have shown a super_admin a "promote to super_admin" control that
    could only ever return 403.
    """
    headers = {"Authorization": f"Bearer {super_admin['access_token']}"}
    roles = {r["name"]: r for r in client.get("/api/v1/roles", headers=headers).json()}

    assert roles["super_admin"]["grantable"] is False
    assert roles["admin"]["grantable"] is True
    assert roles["counsellor"]["grantable"] is True


def test_grantable_matches_what_the_write_path_actually_permits(plain_admin, registered):
    """The flag must agree with `PATCH /users/{id}`, or the console lies again.

    A flag that said "grantable" while the write returns 403 would reintroduce the
    exact defect this endpoint exists to remove, so assert the two agree rather
    than asserting the flag's value in isolation.
    """
    _assign_roles(registered["email"], ["student"])
    headers = {"Authorization": f"Bearer {plain_admin['access_token']}"}
    target = client.get(
        "/api/v1/users", params={"search": registered["email"]}, headers=headers
    ).json()["items"][0]
    roles = client.get("/api/v1/roles", headers=headers).json()

    for role in roles:
        patch = client.patch(
            f"/api/v1/users/{target['id']}",
            json={"role_ids": [role["id"]]},
            headers=headers,
        )
        if role["grantable"]:
            assert patch.status_code == 200, (
                f"{role['name']} is advertised as grantable but the write "
                f"rejected it: {patch.status_code} {patch.text}"
            )
            # Restore a base state so each role is tested from the same place.
            _assign_roles(registered["email"], ["student"])
        else:
            assert patch.status_code == 403, (
                f"{role['name']} is advertised as not grantable but the write "
                f"accepted it: {patch.status_code} {patch.text}"
            )


def test_admin_list_users_search(admin, registered):
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    response = client.get(
        "/api/v1/users",
        params={"search": registered["mobile"]},
        headers=headers,
    )
    assert response.status_code == 200
    assert any(u["mobile"] == registered["mobile"] for u in response.json()["items"])


def test_admin_get_user_detail(admin, registered):
    _assign_roles(registered["email"], ["student"])
    headers = {"Authorization": f"Bearer {admin['access_token']}"}
    listing = client.get(
        "/api/v1/users", params={"search": registered["email"]}, headers=headers
    ).json()["items"]
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
    ).json()["items"]
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
    ).json()["items"]
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
    ).json()["items"]
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
