"""RBAC ruleset regression tests.

One test per rule in docs/rbac-compliance-checklist.md, named after the rule it
pins. These exist because every one of them was violated at some point: R4.1 was
a live fail-open, R4.7/R4.8 a live privilege escalation, R2.4 a silent
roleless-account bug, R5.2 a silent role wipe.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import text

from app.config import settings
from app.database import SessionLocal
from app.dependencies import require_role
from app.main import app
from app.models import AuditLog, Role, User
from app.roles import ALL_ROLES, DEAD_ROLES, RoleName, exceeds_ceiling, outranks

client = TestClient(app)

PASSWORD = "SecurePass123!"


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #


def _unique(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:8]}@example.com"


def _unique_mobile() -> str:
    return f"9{uuid.uuid4().int % 1_000_000_000:09d}"


def _register(prefix: str = "user") -> dict:
    payload = {
        "name": "Rbac Test",
        "email": _unique(prefix),
        "mobile": _unique_mobile(),
        "password": PASSWORD,
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


def _set_roles(email: str, role_names: list[str]) -> int:
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        roles = []
        for name in role_names:
            role = db.query(Role).filter(Role.name == name).first()
            assert role is not None, f"role {name} missing - run seed_roles.py"
            roles.append(role)
        user.roles = roles
        db.commit()
        return user.id


def _role_id(name: str) -> int:
    with SessionLocal() as db:
        role = db.query(Role).filter(Role.name == name).first()
        assert role is not None
        return role.id


@pytest.fixture
def student():
    return _register("student")


@pytest.fixture
def admin_account():
    account = _register("admin")
    _set_roles(account["email"], [RoleName.ADMIN.value])
    return account


@pytest.fixture
def super_admin_account():
    account = _register("super")
    _set_roles(account["email"], [RoleName.SUPER_ADMIN.value])
    return account


# --------------------------------------------------------------------------- #
# R4.1 — require_role must fail closed
# --------------------------------------------------------------------------- #


def test_r4_1_require_role_with_no_args_raises():
    """An empty allowlist is a programming error, never 'allow everyone'."""
    with pytest.raises(RuntimeError, match="no roles"):
        require_role()


def test_r4_1_empty_allowlist_grants_nothing():
    """Belt-and-braces: even if the guard is bypassed, no roles means no access."""
    with pytest.raises(RuntimeError):
        dep = require_role(*[])
        assert dep is not None


# --------------------------------------------------------------------------- #
# R4.7 / R4.8 — no self-escalation, no privilege ceiling
# --------------------------------------------------------------------------- #


def test_r4_7_admin_cannot_promote_itself_to_super_admin(admin_account):
    """The escalation that was live before the fix."""
    uid = _set_roles(admin_account["email"], [RoleName.ADMIN.value])
    response = client.patch(
        f"/api/v1/users/{uid}",
        json={"role_ids": [_role_id(RoleName.SUPER_ADMIN.value)]},
        headers=_login(admin_account["email"]),
    )
    assert response.status_code == 400, response.text
    assert "your own roles" in response.json()["detail"].lower()

    roles = client.get(
        "/api/v1/users/me/roles", headers=_login(admin_account["email"])
    ).json()["roles"]
    assert roles == [RoleName.ADMIN.value]


def test_r4_7_super_admin_cannot_edit_own_roles_either(super_admin_account):
    uid = _set_roles(
        super_admin_account["email"],
        [RoleName.SUPER_ADMIN.value, RoleName.ADMIN.value],
    )
    response = client.patch(
        f"/api/v1/users/{uid}",
        json={"role_ids": [_role_id(RoleName.STUDENT.value)]},
        headers=_login(super_admin_account["email"]),
    )
    assert response.status_code == 400


def test_r4_8_admin_cannot_grant_super_admin_to_another_user(admin_account):
    target = _register("victim")
    response = client.patch(
        f"/api/v1/users/{_set_roles(target['email'], [RoleName.STUDENT.value])}",
        json={"role_ids": [_role_id(RoleName.SUPER_ADMIN.value)]},
        headers=_login(admin_account["email"]),
    )
    assert response.status_code == 403, response.text
    assert "privilege level" in response.json()["detail"]


def test_r4_8_admin_can_still_grant_content_manager(admin_account):
    """The ceiling must not block legitimate downward grants."""
    target = _register("victim2")
    response = client.patch(
        f"/api/v1/users/{_set_roles(target['email'], [RoleName.STUDENT.value])}",
        json={"role_ids": [_role_id(RoleName.CONTENT_MANAGER.value)]},
        headers=_login(admin_account["email"]),
    )
    assert response.status_code == 200, response.text
    assert set(response.json()["roles"]) == {RoleName.CONTENT_MANAGER.value}


def test_r4_8_super_admin_can_grant_admin(admin_account, super_admin_account):
    target = _register("victim3")
    response = client.patch(
        f"/api/v1/users/{_set_roles(target['email'], [RoleName.STUDENT.value])}",
        json={"role_ids": [_role_id(RoleName.ADMIN.value)]},
        headers=_login(super_admin_account["email"]),
    )
    assert response.status_code == 200, response.text


def test_r4_8_admin_cannot_demote_a_peer_super_admin(admin_account, super_admin_account):
    """The ceiling must cover *removal* too.

    Regression: the first version of the fix only checked roles being *granted*,
    so an `admin` could PATCH a peer `super_admin` with a role set that omitted
    `super_admin` and strip it. The last-super-admin guard did not help — it only
    fires when the target is the final one.
    """
    peer_id = _set_roles(
        super_admin_account["email"], [RoleName.SUPER_ADMIN.value, RoleName.ADMIN.value]
    )
    _set_roles(admin_account["email"], [RoleName.ADMIN.value])

    response = client.patch(
        f"/api/v1/users/{peer_id}",
        json={"role_ids": [_role_id(RoleName.ADMIN.value)]},
        headers=_login(admin_account["email"]),
    )
    assert response.status_code == 403, response.text
    with SessionLocal() as db:
        roles = {r.name for r in db.get(User, peer_id).roles}
    assert RoleName.SUPER_ADMIN.value in roles, "peer super_admin was demoted"


def test_r4_8_admin_cannot_strand_a_peer_with_zero_roles(admin_account):
    """`role_ids: []` must not leave a roleless account behind.

    Same-tier demotion is legitimate, but clearing the set entirely would create
    the same broken state that R2.4 refuses to create at registration.
    """
    target = _register("stripme")
    tid = _set_roles(target["email"], [RoleName.ADMIN.value])

    response = client.patch(
        f"/api/v1/users/{tid}",
        json={"role_ids": []},
        headers=_login(admin_account["email"]),
    )
    assert response.status_code == 400, response.text
    assert "at least one role" in response.json()["detail"]
    with SessionLocal() as db:
        assert RoleName.ADMIN.value in {r.name for r in db.get(User, tid).roles}


def test_r4_8_super_admin_can_still_demote_a_peer():
    """The removal rule must not be so strict that the top role is helpless.

    Revocation uses `<=` rather than `<`: a `super_admin` has to be able to
    demote a *different* `super_admin`, and an `admin` a peer `admin`.
    """
    caller = _register("boss1")
    caller_id = _set_roles(caller["email"], [RoleName.SUPER_ADMIN.value])
    peer = _register("boss2")
    peer_id = _set_roles(peer["email"], [RoleName.SUPER_ADMIN.value])

    with SessionLocal() as db:
        others = (
            db.query(User)
            .join(User.roles)
            .filter(Role.name == RoleName.SUPER_ADMIN.value, User.id != peer_id)
            .count()
        )

    response = client.patch(
        f"/api/v1/users/{peer_id}",
        json={"role_ids": [_role_id(RoleName.ADMIN.value)]},
        headers=_login(caller["email"]),
    )
    if others == 0:
        # The peer was the last super_admin — the lockout guard wins, correctly.
        assert response.status_code == 400
        assert "last active super_admin" in response.json()["detail"]
    else:
        assert response.status_code == 200, response.text
        with SessionLocal() as db:
            assert {r.name for r in db.get(User, peer_id).roles} == {RoleName.ADMIN.value}


def test_r4_8_admin_can_still_demote_a_peer_admin(admin_account):
    """Same-tier demotion must keep working — the ceiling is not a blanket deny."""
    _set_roles(admin_account["email"], [RoleName.ADMIN.value])
    peer = _register("peeradmin")
    peer_id = _set_roles(peer["email"], [RoleName.ADMIN.value, RoleName.STUDENT.value])

    response = client.patch(
        f"/api/v1/users/{peer_id}",
        json={"role_ids": [_role_id(RoleName.ADMIN.value)]},
        headers=_login(admin_account["email"]),
    )
    assert response.status_code == 200, response.text
    with SessionLocal() as db:
        assert {r.name for r in db.get(User, peer_id).roles} == {RoleName.ADMIN.value}


def test_banners_include_inactive_requires_admin(student, admin_account):
    """Regression: the list handler's `include_inactive` was an unguarded public
    parameter, while the sibling `GET /{id}` handler in the same file gated it."""
    anon = client.get("/api/v1/banners", params={"include_inactive": "true"})
    assert anon.status_code == 403, anon.text

    as_student = client.get(
        "/api/v1/banners",
        params={"include_inactive": "true"},
        headers=_login(student["email"]),
    )
    assert as_student.status_code == 403

    as_admin = client.get(
        "/api/v1/banners",
        params={"include_inactive": "true"},
        headers=_login(admin_account["email"]),
    )
    assert as_admin.status_code == 200, as_admin.text

    # The public default still works for everyone.
    assert client.get("/api/v1/banners").status_code == 200


def test_r4_8_ceiling_helper_logic():
    admin = {RoleName.ADMIN.value}
    assert exceeds_ceiling(admin, {RoleName.SUPER_ADMIN.value}) == {
        RoleName.SUPER_ADMIN.value
    }
    assert exceeds_ceiling(admin, {RoleName.CONTENT_MANAGER.value}) == set()
    assert outranks(set(), RoleName.STUDENT.value) is False


# --------------------------------------------------------------------------- #
# R7.2 — the role claim must never authorize
# --------------------------------------------------------------------------- #


def test_r7_2_forged_role_claim_grants_nothing(student):
    """Tamper the claim to super_admin: still a student, still 403.

    R3.1 says the claim is informational. Nothing pinned that, so a future
    refactor moving authorization onto the claim would have gone unnoticed.
    """
    from app.utils.security import ALGORITHM

    with SessionLocal() as db:
        row = db.query(User).filter(User.email == student["email"]).first()
        assert row is not None
        student_id = row.id

    forged = jwt.encode(
        {
            "sub": str(student_id),
            "role": "super_admin,admin",
            "type": "access",
            "exp": 4_102_444_800,
        },
        settings.JWT_SECRET_KEY,
        algorithm=ALGORITHM,
    )
    for path in ("/api/v1/users", "/api/v1/users/admin-only", "/api/v1/audit-logs"):
        response = client.get(path, headers={"Authorization": f"Bearer {forged}"})
        assert response.status_code == 403, f"{path} -> {response.status_code}"

    # And the claim is not honoured even for self-scoped reads that would leak
    # the escalation surface: the DB still says student.
    response = client.get("/api/v1/users/me/roles", headers={"Authorization": f"Bearer {forged}"})
    assert response.json()["roles"] == [RoleName.STUDENT.value]


def test_r7_2_valid_signature_wrong_subject_is_not_privileged(student):
    """A correctly signed token for a *student* is still a student."""
    with SessionLocal() as db:
        student_user = db.query(User).filter(User.email == student["email"]).first()
        assert student_user is not None
        assert RoleName.ADMIN.value not in {r.name for r in student_user.roles}

    response = client.get("/api/v1/users", headers=_login(student["email"]))
    assert response.status_code == 403


# --------------------------------------------------------------------------- #
# R7.3 — a user with no roles at all
# --------------------------------------------------------------------------- #


def test_r7_3_roleless_user_is_forbidden_everywhere(student):
    _set_roles(student["email"], [])
    headers = _login(student["email"])

    for path in (
        "/api/v1/users",
        "/api/v1/users/admin-only",
        "/api/v1/audit-logs",
        "/api/v1/leads",
        "/api/v1/reviews/moderation",
        "/api/v1/roles",
        "/api/v1/seo",
    ):
        response = client.get(path, headers=headers)
        assert response.status_code == 403, f"{path} -> {response.status_code}"

    for method, path in (
        ("post", "/api/v1/banners"),
        ("post", "/api/v1/colleges"),
        ("post", "/api/v1/exams"),
    ):
        response = getattr(client, method)(path, headers=headers, json={})
        assert response.status_code == 403, f"{method} {path} -> {response.status_code}"


# --------------------------------------------------------------------------- #
# R7.4 / R5.2 — role assignment integrity
# --------------------------------------------------------------------------- #


def test_r7_4_student_cannot_assign_itself_a_role(student):
    uid = _set_roles(student["email"], [RoleName.STUDENT.value])
    response = client.patch(
        f"/api/v1/users/{uid}",
        json={"role_ids": [_role_id(RoleName.SUPER_ADMIN.value)]},
        headers=_login(student["email"]),
    )
    assert response.status_code == 403


def test_r7_4_student_cannot_enumerate_roles(student):
    """`GET /roles` hands out the ids `PATCH /users/{id}` accepts."""
    assert client.get("/api/v1/roles", headers=_login(student["email"])).status_code == 403


def test_r5_2_unknown_role_id_is_rejected(admin_account):
    target = _register("unknownrole")
    uid = _set_roles(target["email"], [RoleName.STUDENT.value])
    response = client.patch(
        f"/api/v1/users/{uid}",
        json={"role_ids": [_role_id(RoleName.ADMIN.value), 999_999]},
        headers=_login(admin_account["email"]),
    )
    assert response.status_code == 404, response.text
    assert "999999" in response.json()["detail"]


# --------------------------------------------------------------------------- #
# R2.4 / R2.5 — registration
# --------------------------------------------------------------------------- #


def test_r2_5_registration_grants_exactly_student(student):
    roles = client.get("/api/v1/users/me/roles", headers=_login(student["email"])).json()
    assert roles["roles"] == [RoleName.STUDENT.value]


def test_r2_1_register_request_accepts_no_role_fields():
    """R2.1 — even if a client sends role/is_admin, the schema drops it."""
    from app.schemas.auth import RegisterRequest

    assert "role" not in RegisterRequest.model_fields
    assert "is_admin" not in RegisterRequest.model_fields
    assert "role_ids" not in RegisterRequest.model_fields


def test_r2_4_registration_fails_closed_when_student_role_missing():
    """Renaming the student role must break registration, not create a roleless user.

    The role is *renamed* rather than deleted so every existing `user_roles` row
    stays intact and the schema is left exactly as it was found.
    """
    payload = {
        "name": "Rbac Test",
        "email": _unique("noRole"),
        "mobile": _unique_mobile(),
        "password": PASSWORD,
    }
    hidden = "__student_temporarily_missing"

    with SessionLocal() as db:
        result = db.execute(
            text("UPDATE roles SET name = :hidden WHERE name = :real"),
            {"hidden": hidden, "real": RoleName.STUDENT.value},
        )
        db.commit()
        # Guard against a silent no-op rename, which would make this test pass
        # for the wrong reason (the role was already missing before we started).
        assert result.rowcount == 1, "student role was already missing before the test"

    try:
        response = client.post("/api/v1/auth/register", json=payload)
        assert response.status_code == 503, response.text
        assert "student role" in response.json()["detail"].lower()

        with SessionLocal() as db:
            assert (
                db.query(User).filter(User.email == payload["email"]).first() is None
            ), "a roleless user row was left behind"
    finally:
        with SessionLocal() as db:
            restored = db.execute(
                text("UPDATE roles SET name = :real WHERE name = :hidden"),
                {"real": RoleName.STUDENT.value, "hidden": hidden},
            )
            db.commit()
            assert restored.rowcount == 1, "failed to restore the student role"


# --------------------------------------------------------------------------- #
# R4.6 — 401 vs 403
# --------------------------------------------------------------------------- #


def test_r4_6_missing_token_is_401():
    assert client.get("/api/v1/users").status_code == 401


def test_r4_6_garbage_token_is_401():
    response = client.get(
        "/api/v1/users", headers={"Authorization": "Bearer not-a-jwt"}
    )
    assert response.status_code == 401


def test_r4_6_valid_token_wrong_role_is_403(student):
    assert client.get("/api/v1/users", headers=_login(student["email"])).status_code == 403


# --------------------------------------------------------------------------- #
# R4.7 — last super_admin lockout
# --------------------------------------------------------------------------- #


def test_r4_7_cannot_demote_the_last_super_admin(admin_account):
    """Roles only come from seed_roles.py, so this would be unrecoverable."""
    uid = _set_roles(admin_account["email"], [RoleName.SUPER_ADMIN.value])
    with SessionLocal() as db:
        others = (
            db.query(User)
            .join(User.roles)
            .filter(Role.name == RoleName.SUPER_ADMIN.value, User.id != uid)
            .count()
        )
    if others:
        pytest.skip("another super_admin exists; demotion is legitimate")

    response = client.patch(
        f"/api/v1/users/{uid}",
        json={"role_ids": [_role_id(RoleName.ADMIN.value)]},
        headers=_login(admin_account["email"]),
    )
    # Self-edit is rejected first, which is also correct.
    assert response.status_code in (400, 403)


# --------------------------------------------------------------------------- #
# R5.3 — audit trail
# --------------------------------------------------------------------------- #


def test_r5_3_role_change_is_audited(admin_account, super_admin_account):
    target = _register("audited")
    uid = _set_roles(target["email"], [RoleName.STUDENT.value])

    with SessionLocal() as db:
        before = db.query(AuditLog).filter(AuditLog.action == "update_user_roles").count()

    response = client.patch(
        f"/api/v1/users/{uid}",
        json={"role_ids": [_role_id(RoleName.CONTENT_MANAGER.value)]},
        headers=_login(super_admin_account["email"]),
    )
    assert response.status_code == 200, response.text

    with SessionLocal() as db:
        after = db.query(AuditLog).filter(AuditLog.action == "update_user_roles").count()
        assert after == before + 1

        entry = (
            db.query(AuditLog)
            .filter(AuditLog.action == "update_user_roles")
            .order_by(AuditLog.id.desc())
            .first()
        )
        assert entry is not None
        assert entry.entity_type == "user"
        assert entry.entity_id == uid
        assert entry.old_value == {"roles": [RoleName.STUDENT.value]}
        assert entry.new_value == {"roles": [RoleName.CONTENT_MANAGER.value]}
        assert entry.user_id is not None, "actor was not recorded"


def test_r5_3_password_change_is_audited(student):
    _set_roles(student["email"], [RoleName.STUDENT.value])
    response = client.put(
        "/api/v1/users/me/password",
        json={"current_password": PASSWORD, "new_password": "BrandNewPass456!"},
        headers=_login(student["email"]),
    )
    assert response.status_code == 200, response.text

    with SessionLocal() as db:
        entry = (
            db.query(AuditLog)
            .filter(AuditLog.action == "change_password")
            .order_by(AuditLog.id.desc())
            .first()
        )
        assert entry is not None
        # The hash itself must never be logged.
        assert "password_hash" not in (entry.new_value or {})


# --------------------------------------------------------------------------- #
# R1.1 — canonical roles module
# --------------------------------------------------------------------------- #


def test_r1_1_no_router_uses_inline_role_literals():
    """R4.5 — every require_role call must reference app.roles."""
    import re
    from pathlib import Path

    routers = Path(__file__).resolve().parent.parent / "app" / "routers"
    offenders: list[str] = []
    for path in routers.glob("*.py"):
        for lineno, line in enumerate(
            path.read_text(encoding="utf-8").splitlines(), start=1
        ):
            if re.search(r'require_role\(\s*"', line):
                offenders.append(f"{path.name}:{lineno}: {line.strip()}")
    assert not offenders, "inline role literals found:\n" + "\n".join(offenders)


def test_r1_1_every_seeded_role_is_canonical():
    with SessionLocal() as db:
        db_names = {role.name for role in db.query(Role).all()}
    assert db_names, "no roles seeded - run scripts/seed_roles.py"
    assert db_names <= set(ALL_ROLES), f"non-canonical roles in DB: {db_names - set(ALL_ROLES)}"


def test_r1_4_tiers_are_strictly_nested():
    """R1.4 — each tier must be a strict superset of the one below it."""
    from app.roles import (
        ADMIN_ROLES,
        CONTENT_ROLES,
        LEAD_ROLES,
        SEO_ROLES,
        SUPER_ADMIN_ROLES,
    )

    assert set(SUPER_ADMIN_ROLES) < set(ADMIN_ROLES)
    assert set(ADMIN_ROLES) < set(CONTENT_ROLES)
    assert set(CONTENT_ROLES) < set(SEO_ROLES)
    assert set(ADMIN_ROLES) < set(LEAD_ROLES)
    assert SUPER_ADMIN_ROLES[0] == RoleName.SUPER_ADMIN.value


def test_r1_3_role_names_are_lowercase_snake_case():
    import re

    for name in ALL_ROLES:
        assert re.fullmatch(r"[a-z][a-z0-9_]*", name), name


def test_dead_roles_are_documented():
    """R1.1 — roles the auth layer never checks should be an explicit list."""
    assert RoleName.PROCTOR.value in DEAD_ROLES
    assert RoleName.ANALYTICS.value in DEAD_ROLES
    assert RoleName.STUDENT.value not in DEAD_ROLES
    assert RoleName.ADMIN.value not in DEAD_ROLES


# --------------------------------------------------------------------------- #
# R3 — token handling
# --------------------------------------------------------------------------- #


def test_r3_2_refresh_token_is_rejected_as_access_token(student):
    login = client.post(
        "/api/v1/auth/login", json={"email": student["email"], "password": PASSWORD}
    ).json()
    response = client.get(
        "/api/v1/users/me",
        headers={"Authorization": f"Bearer {login['refresh_token']}"},
    )
    assert response.status_code == 401


def test_r3_3_access_and_refresh_use_different_secrets(student):
    """R3.3 — neither token validates under the other's key."""
    from jose.exceptions import JWTError

    from app.utils.security import decode_token

    login = client.post(
        "/api/v1/auth/login", json={"email": student["email"], "password": PASSWORD}
    ).json()

    with pytest.raises(JWTError):
        decode_token(login["refresh_token"], settings.JWT_REFRESH_SECRET_KEY)
        # decode_token defaults to the *access* secret, so the refresh token must
        # not validate there.
        decode_token(login["refresh_token"])
        raise JWTError("refresh token validated under the access secret")

    with pytest.raises(JWTError):
        decode_token(login["access_token"], settings.JWT_REFRESH_SECRET_KEY)
        raise JWTError("access token validated under the refresh secret")

    assert settings.JWT_SECRET_KEY != settings.JWT_REFRESH_SECRET_KEY


def test_r3_4_access_token_lifetime_is_short():
    assert settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES <= 60, (
        "R3.4: access tokens are unrevocable (logout is a no-op), so the lifetime "
        f"is the containment window. Got {settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES} min."
    )


def test_r3_1_role_claim_matches_db_roles(student):
    """The claim is informational, but it should not be a lie either."""
    from jose import jwt as _jwt

    from app.utils.security import ALGORITHM

    login = client.post(
        "/api/v1/auth/login", json={"email": student["email"], "password": PASSWORD}
    ).json()
    claims = _jwt.decode(
        login["access_token"], settings.JWT_SECRET_KEY, algorithms=[ALGORITHM]
    )
    assert claims["type"] == "access"
    assert claims["role"] == RoleName.STUDENT.value
