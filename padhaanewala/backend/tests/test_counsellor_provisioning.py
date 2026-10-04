"""The ``counsellor`` role and the ``counsellors`` profile row must agree.

These two were never connected. ``PATCH /users/{id}`` set the role and never
touched ``counsellors``, and no other code path inserted that row either -- only
the hand-written helpers in ``test_phase9.py`` did. So in a real database the
roster was permanently empty: ``GET /counsellors`` returned ``[]``, the admin
console's assign dropdown was blank, ``PATCH /leads/{id}/assign`` had nobody to
accept a lead, and ``services/lead_handoff`` balanced over an empty pool. No test
caught it because every test that needed a counsellor inserted the row itself,
which is exactly the step production could not perform.

``routers/users.py::_sync_counsellor_profile`` now reconciles the row on every
admin role/account change. Each test below drives the **API** rather than
assigning roles directly in the database, because a direct ``user.roles = [...]``
assignment bypasses the reconciliation and would make these tests pass against
the old broken code.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import SessionLocal
from app.main import app
from app.models import Counsellor, Role, User
from app.roles import RoleName

client = TestClient(app)

PASSWORD = "SecurePass123!"


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #


def _unique(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:8]}@example.com"


def _unique_mobile() -> str:
    return f"9{uuid.uuid4().int % 1_000_000_000:09d}"


def _register(prefix: str = "user", name: str = "Counsellor Test") -> dict:
    payload = {
        "name": name,
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


def _user_id(email: str) -> int:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        assert user is not None
        return user.id


def _role_id(name: str) -> int:
    with SessionLocal() as db:
        role = db.scalar(select(Role).where(Role.name == name))
        assert role is not None, f"role {name} missing - run seed_roles.py"
        return role.id


def _profile(email: str) -> Counsellor | None:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        assert user is not None
        return db.scalar(select(Counsellor).where(Counsellor.user_id == user.id))


@pytest.fixture
def admin_headers():
    account = _register("cadm")
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == account["email"]))
        assert user is not None
        user.roles = [db.scalar(select(Role).where(Role.name == RoleName.ADMIN.value))]
        db.commit()
    return _login(account["email"])


@pytest.fixture
def target():
    """A plain registered student, holding only the ``student`` role.

    The name is unique per test on purpose. ``GET /counsellors`` returns the whole
    roster and the suite shares one database, so a fixed name would let a
    counsellor provisioned by an earlier test satisfy a later test's roster
    assertion.
    """
    name = f"Priya Sharma {uuid.uuid4().hex[:6]}"
    return _register("ctarget", name=name)


def _patch_user(headers: dict[str, str], user_id: int, **body) -> dict:
    response = client.patch(f"/api/v1/users/{user_id}", json=body, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def _grant_counsellor(headers: dict[str, str], email: str) -> None:
    _patch_user(
        headers,
        _user_id(email),
        role_ids=[_role_id(RoleName.STUDENT.value), _role_id(RoleName.COUNSELLOR.value)],
    )


def _revoke_counsellor(headers: dict[str, str], email: str) -> None:
    _patch_user(headers, _user_id(email), role_ids=[_role_id(RoleName.STUDENT.value)])


# --------------------------------------------------------------------------- #
# granting the role provisions the row
# --------------------------------------------------------------------------- #


def test_granting_the_role_creates_the_profile_row(admin_headers, target):
    """The whole point: the role grant is what makes a counsellor exist."""
    assert _profile(target["email"]) is None, "precondition: no row before the grant"

    _grant_counsellor(admin_headers, target["email"])

    profile = _profile(target["email"])
    assert profile is not None, "granting the counsellor role created no profile row"
    assert profile.is_active is True


def test_provisioned_row_is_named_from_the_student_profile(admin_headers, target):
    """`users` has no name column, so `display_name` is the only source.

    Falls back to `student_profiles.name`, and to the email when even that is
    missing -- never a blank label in the assign dropdown.
    """
    _grant_counsellor(admin_headers, target["email"])

    profile = _profile(target["email"])
    assert profile is not None
    assert profile.name == target["name"]
    assert profile.max_leads == 100


def test_new_row_appears_on_the_admin_roster(admin_headers, target):
    """End-to-end: the roster the console reads is no longer empty.

    This is the assertion that would have caught the original bug. It reads the
    real endpoint rather than the database, so it also proves the panel has
    something to render.
    """
    _grant_counsellor(admin_headers, target["email"])

    response = client.get("/api/v1/counsellors", headers=admin_headers)
    assert response.status_code == 200, response.text
    names = [row["name"] for row in response.json()]
    assert target["name"] in names


def test_regranting_the_same_roles_does_not_duplicate_the_row(admin_headers, target):
    """`counsellors.user_id` is UNIQUE, so a second row would be an IntegrityError.

    The console re-sends the full role set on every save, so this is the common
    case, not an edge case.
    """
    user_id = _user_id(target["email"])

    _grant_counsellor(admin_headers, target["email"])
    _grant_counsellor(admin_headers, target["email"])

    with SessionLocal() as db:
        rows = db.scalars(
            select(Counsellor).where(Counsellor.user_id == user_id)
        ).all()
    assert len(rows) == 1


def test_a_non_counsellor_role_creates_no_row(admin_headers, target):
    """Grants in general must not fabricate counsellor profiles."""
    _patch_user(
        admin_headers,
        _user_id(target["email"]),
        role_ids=[_role_id(RoleName.STUDENT.value), _role_id(RoleName.REVIEWER.value)],
    )

    assert _profile(target["email"]) is None


def test_counsellor_manager_is_not_provisioned(admin_headers, target):
    """`counsellor_manager` is in `DEAD_ROLES` -- it grants no capability at all.

    Provisioning a lead-roster profile for it would put someone on the assign
    list who cannot open a single lead.
    """
    _patch_user(
        admin_headers,
        _user_id(target["email"]),
        role_ids=[
            _role_id(RoleName.STUDENT.value),
            _role_id(RoleName.COUNSELLOR_MANAGER.value),
        ],
    )

    assert _profile(target["email"]) is None


# --------------------------------------------------------------------------- #
# removing the role deactivates, never deletes
# --------------------------------------------------------------------------- #


def test_revoking_the_role_deactivates_but_keeps_the_row(admin_headers, target):
    """`enquiries.counsellor_id` references the row; deleting it would take the
    assignment history with it. So the row is deactivated, not removed."""
    _grant_counsellor(admin_headers, target["email"])
    assert _profile(target["email"]) is not None

    _revoke_counsellor(admin_headers, target["email"])

    profile = _profile(target["email"])
    assert profile is not None, "the row was deleted instead of deactivated"
    assert profile.is_active is False


def test_a_deactivated_counsellor_leaves_the_default_roster(admin_headers, target):
    """`GET /counsellors` filters on `is_active`, so revocation must remove them
    from the list an admin can assign to."""
    _grant_counsellor(admin_headers, target["email"])
    _revoke_counsellor(admin_headers, target["email"])

    response = client.get("/api/v1/counsellors", headers=admin_headers)
    assert response.status_code == 200, response.text
    assert target["name"] not in [row["name"] for row in response.json()]


def test_regranting_after_revocation_reactivates_the_same_row(admin_headers, target):
    """Re-granting must not strand the counsellor as inactive.

    `/counsellors` is a GET-only router, so there is no console control that
    could undo an inactive flag -- which is why the role assignment reconciles
    it in both directions rather than only on creation.
    """
    _grant_counsellor(admin_headers, target["email"])
    _revoke_counsellor(admin_headers, target["email"])

    _grant_counsellor(admin_headers, target["email"])

    profile = _profile(target["email"])
    assert profile is not None
    assert profile.is_active is True


# --------------------------------------------------------------------------- #
# the account's own active flag gates the roster too
# --------------------------------------------------------------------------- #


def test_deactivating_the_account_takes_the_counsellor_off_the_roster(
    admin_headers, target
):
    """`PATCH /leads/{id}/assign` gates on `Counsellor.is_active` alone and never
    reads the linked user. Reconciling only on role change would therefore leave
    a deactivated account listed and assignable -- and the leads handed to it
    would go to somebody who can no longer sign in."""
    _grant_counsellor(admin_headers, target["email"])
    user_id = _user_id(target["email"])

    _patch_user(admin_headers, user_id, is_active=False)

    profile = _profile(target["email"])
    assert profile is not None
    assert profile.is_active is False

    response = client.get("/api/v1/counsellors", headers=admin_headers)
    assert target["name"] not in [row["name"] for row in response.json()]


def test_reactivating_the_account_restores_the_counsellor(admin_headers, target):
    _grant_counsellor(admin_headers, target["email"])
    user_id = _user_id(target["email"])

    _patch_user(admin_headers, user_id, is_active=False)
    _patch_user(admin_headers, user_id, is_active=True)

    profile = _profile(target["email"])
    assert profile is not None
    assert profile.is_active is True


def test_role_and_account_changed_together_reach_the_right_end_state(
    admin_headers, target
):
    """One PATCH carrying both fields must reconcile from the final state, not
    from whichever branch happened to run first."""
    _grant_counsellor(admin_headers, target["email"])
    user_id = _user_id(target["email"])

    # Grant + deactivate in a single call: inactive wins.
    _patch_user(
        admin_headers,
        user_id,
        role_ids=[
            _role_id(RoleName.STUDENT.value),
            _role_id(RoleName.COUNSELLOR.value),
        ],
        is_active=False,
    )
    assert _profile(target["email"]).is_active is False

    # Reactivate without touching roles: active again.
    _patch_user(admin_headers, user_id, is_active=True)
    assert _profile(target["email"]).is_active is True
