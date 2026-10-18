"""End-to-end tests for the public college-suggestion submission workflow.

Covers the guarantee the whole module exists to hold: a public submission never
becomes a published college by itself. Every path that could leak a row into
`colleges` is exercised, along with the role gates, the concurrency-safe approve,
and the audit trail.

Names are suffixed with a random token so a run never collides with rows a
previous run left behind, and `_cleanup` removes both the submission and the
college an approval created from it — the approval path is the one that writes
to `colleges`, so leaving those rows behind is what would otherwise turn the
second run red at the exact-duplicate check.
"""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import SessionLocal
from app.main import app
from app.models import AuditLog, College, CollegeSubmission, Role, User
from app.services.compliance_service import apply_age_band

client = TestClient(app)


def _unique(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:8]}@example.com"


def _unique_mobile() -> str:
    return f"9{uuid.uuid4().int % 1_000_000_000:09d}"


def _name(base: str) -> str:
    return f"{base} {uuid.uuid4().hex[:8]}"


def _register() -> tuple[str, dict]:
    """Register a fresh 18_plus user (processing consent auto-satisfied)."""
    payload = {
        "name": "Test Student",
        "email": _unique("student"),
        "mobile": _unique_mobile(),
        "password": "SecurePass123!",
        "age_band": "18_plus",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    return payload["email"], {**payload, **response.json()}


def _token_for(email: str, role_name: str) -> str:
    with SessionLocal() as db:
        role = db.scalar(select(Role).where(Role.name == role_name))
        assert role is not None, f"role {role_name!r} not seeded"
        user = db.scalar(select(User).where(User.email == email))
        user.roles.append(role)
        db.commit()
    login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "SecurePass123!"}
    )
    assert login.status_code == 200
    return login.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _submission_body(name: str, **extra) -> dict:
    body = {
        "proposed_name": name,
        "proposed_college_type": "engineering",
        "proposed_ownership": "private",
        "proposed_city": "Pune",
        "proposed_website": "https://suggested-college.example.edu.in",
    }
    body.update(extra)
    return body


def _cleanup(*submission_ids: int) -> None:
    """Delete the submissions and any college an approval created from them."""
    with SessionLocal() as db:
        for sid in submission_ids:
            row = db.get(CollegeSubmission, sid)
            if row is None:
                continue
            if row.college_id is not None:
                college = db.get(College, row.college_id)
                # Only remove a college this submission *created* — i.e. one whose
                # name is exactly the proposed name. A linked pre-existing college
                # is left alone (the link test deletes its own fixture).
                if college is not None and college.name == row.proposed_name:
                    db.delete(college)
            db.delete(row)
        db.commit()


def _submit(token: str, name: str, **extra) -> dict:
    response = client.post(
        "/api/v1/college-submissions",
        json=_submission_body(name, **extra),
        headers=_auth(token),
    )
    assert response.status_code == 201, response.text
    return response.json()


# --------------------------------------------------------------------------- #
# Submit
# --------------------------------------------------------------------------- #


def test_submit_requires_auth():
    response = client.post(
        "/api/v1/college-submissions", json=_submission_body(_name("Anon College"))
    )
    assert response.status_code == 401


def test_submit_creates_pending_submission():
    _, body = _register()
    token = body["access_token"]
    name = _name("Fresh Public College")
    response = client.post(
        "/api/v1/college-submissions",
        json=_submission_body(name),
        headers=_auth(token),
    )
    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "pending"
    assert data["proposed_name"] == name
    assert data["submitted_by"] is not None
    assert data["college_id"] is None, "a submission must not auto-create a college"
    _cleanup(data["id"])


def test_submit_rejects_exact_duplicate_college_name():
    _, body = _register()
    token = body["access_token"]
    # Pull a real, active college name from the catalog.
    existing = client.get("/api/v1/colleges").json()[0]["name"]
    response = client.post(
        "/api/v1/college-submissions",
        json=_submission_body(existing),
        headers=_auth(token),
    )
    assert response.status_code == 409


def test_submit_rejects_bad_website_scheme():
    _, body = _register()
    token = body["access_token"]
    response = client.post(
        "/api/v1/college-submissions",
        json=_submission_body(
            _name("Scheme College"), proposed_website="javascript:alert(1)"
        ),
        headers=_auth(token),
    )
    assert response.status_code == 422


def test_submit_rejects_unknown_field():
    _, body = _register()
    token = body["access_token"]
    bad = _submission_body(_name("Extra Field College"))
    bad["is_active"] = True
    response = client.post(
        "/api/v1/college-submissions", json=bad, headers=_auth(token)
    )
    assert response.status_code == 422


def test_submit_rejects_name_that_sanitises_below_the_minimum():
    # `"  a  "` satisfies `Field(min_length=2)` on the *raw* string, so without a
    # second check the strip leaves a one-character name in a NOT NULL column.
    _, body = _register()
    token = body["access_token"]
    response = client.post(
        "/api/v1/college-submissions",
        json=_submission_body("  a  "),
        headers=_auth(token),
    )
    assert response.status_code == 422


def test_submit_rejects_a_control_byte_only_name():
    # Strips to "", which the NOT NULL column accepts and `_slugify` turns into
    # an empty slug — the value that later collides on the unique colleges slug.
    _, body = _register()
    token = body["access_token"]
    response = client.post(
        "/api/v1/college-submissions",
        json=_submission_body("\x01\x01"),
        headers=_auth(token),
    )
    assert response.status_code == 422


def test_submit_rejects_punctuation_only_name():
    _, body = _register()
    token = body["access_token"]
    response = client.post(
        "/api/v1/college-submissions",
        json=_submission_body("--"),
        headers=_auth(token),
    )
    assert response.status_code == 422


def test_submit_rejects_unknown_state_id():
    _, body = _register()
    token = body["access_token"]
    response = client.post(
        "/api/v1/college-submissions",
        json=_submission_body(_name("Bad State College"), proposed_state_id=10**9),
        headers=_auth(token),
    )
    # 422, not the IntegrityError the FK would raise if it were left to the
    # database, and not 404 — which the frontend reads as "the row is gone".
    assert response.status_code == 422


def test_submit_stores_a_resolvable_state_id():
    _, body = _register()
    token = body["access_token"]
    states = client.get("/api/v1/locations/states").json()
    assert states, "states must be seeded for this test"
    state = states[0]
    payload = _submit(token, _name("Stateful College"), proposed_state_id=state["id"])
    assert payload["proposed_state_id"] == state["id"]
    _cleanup(payload["id"])


def test_submit_stores_fuzzy_duplicate_hint():
    _, body = _register()
    token = body["access_token"]
    existing = client.get("/api/v1/colleges").json()[0]["name"]
    # Append a suffix so it is not an *exact* match (which would 409) but still
    # shares a significant token with the real college.
    payload = _submit(token, f"{existing} North Campus")
    assert payload["possible_duplicate_college_id"] is not None
    _cleanup(payload["id"])


# --------------------------------------------------------------------------- #
# Read paths: my / queue / by id
# --------------------------------------------------------------------------- #


def test_my_submissions_only_returns_own():
    _, body = _register()
    token = body["access_token"]
    created = _submit(token, _name("My Own College"))
    mine = client.get("/api/v1/college-submissions/my", headers=_auth(token))
    assert mine.status_code == 200
    ids = [s["id"] for s in mine.json()]
    assert created["id"] in ids
    _cleanup(created["id"])


def test_queue_requires_content_role():
    _, body = _register()
    token = body["access_token"]  # plain user, no staff role
    response = client.get("/api/v1/college-submissions", headers=_auth(token))
    assert response.status_code == 403


def test_queue_visible_to_admin():
    email, _ = _register()
    admin_token = _token_for(email, "admin")
    response = client.get("/api/v1/college-submissions", headers=_auth(admin_token))
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_by_id_owner_or_staff_only():
    _, body = _register()
    owner_token = body["access_token"]
    created = _submit(owner_token, _name("Private College Row"))

    # Owner can read it.
    assert (
        client.get(
            f"/api/v1/college-submissions/{created['id']}", headers=_auth(owner_token)
        ).status_code
        == 200
    )

    # A stranger gets 404 (existence not confirmed).
    _, other_body = _register()
    other_token = other_body["access_token"]
    assert (
        client.get(
            f"/api/v1/college-submissions/{created['id']}", headers=_auth(other_token)
        ).status_code
        == 404
    )
    _cleanup(created["id"])


# --------------------------------------------------------------------------- #
# Owner edit + withdraw
# --------------------------------------------------------------------------- #


def test_owner_can_edit_pending_and_resets_to_pending():
    _, body = _register()
    token = body["access_token"]
    created = _submit(token, _name("Editable College"))
    renamed = _name("Editable College Renamed")
    response = client.put(
        f"/api/v1/college-submissions/{created['id']}",
        json={"proposed_city": "Chennai", "proposed_name": renamed},
        headers=_auth(token),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["proposed_city"] == "Chennai"
    assert data["proposed_name"] == renamed
    assert data["status"] == "pending"
    _cleanup(data["id"])


def test_owner_cannot_edit_reviewed_submission():
    _, body = _register()
    owner_token = body["access_token"]
    created = _submit(owner_token, _name("Frozen College"))
    admin_email, _ = _register()
    admin_token = _token_for(admin_email, "admin")
    client.post(
        f"/api/v1/college-submissions/{created['id']}/reject",
        json={"reviewer_notes": "no"},
        headers=_auth(admin_token),
    )
    response = client.put(
        f"/api/v1/college-submissions/{created['id']}",
        json={"proposed_city": "Delhi"},
        headers=_auth(owner_token),
    )
    assert response.status_code == 409
    _cleanup(created["id"])


def test_owner_edit_rejects_a_null_name():
    # Explicit `null` is *set*, so `exclude_unset` keeps it and the router would
    # write it straight into a NOT NULL column: an IntegrityError 500 for what is
    # a plain client mistake. Omitting the key is still the way to leave it alone.
    _, body = _register()
    token = body["access_token"]
    created = _submit(token, _name("Null Name College"))
    response = client.put(
        f"/api/v1/college-submissions/{created['id']}",
        json={"proposed_name": None, "proposed_city": "Panaji"},
        headers=_auth(token),
    )
    assert response.status_code == 422
    _cleanup(created["id"])


def test_owner_edit_rejects_unknown_state_id():
    _, body = _register()
    token = body["access_token"]
    created = _submit(token, _name("Bad Edit State College"))
    response = client.put(
        f"/api/v1/college-submissions/{created['id']}",
        json={"proposed_state_id": 10**9},
        headers=_auth(token),
    )
    assert response.status_code == 422
    _cleanup(created["id"])


def test_owner_edit_requires_processing_consent():
    """A withdrawn-consent account must not keep re-writing its submission.

    `POST` and `PUT` both carry the submitter's contact details, so both are
    gated; this pins the `PUT`, which was the one that was not. The session token
    stays valid, so a 403 here is the consent gate and nothing else.
    """
    email, body = _register()
    token = body["access_token"]
    created = _submit(token, _name("Consent Gated College"))

    # Move the account into the state the gate exists for: a minor with no
    # guardian consent on file. `apply_age_band` is the single writer of the
    # derived `is_minor` flag — setting `age_band` alone would leave the gate open
    # and make this test pass for the wrong reason.
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        assert user is not None
        apply_age_band(user, "under_18")
        db.commit()

    try:
        response = client.put(
            f"/api/v1/college-submissions/{created['id']}",
            json={"proposed_city": "Mysuru"},
            headers=_auth(token),
        )
        assert response.status_code == 403
        assert response.json()["detail"]["code"] == "parental_consent_required"

        # Erasure survives the withdrawal, so the owner can still withdraw it.
        assert (
            client.delete(
                f"/api/v1/college-submissions/{created['id']}", headers=_auth(token)
            ).status_code
            == 204
        )
    finally:
        with SessionLocal() as db:
            user = db.scalar(select(User).where(User.email == email))
            if user is not None:
                apply_age_band(user, "18_plus")
                db.commit()
        _cleanup(created["id"])
    _, body = _register()
    token = body["access_token"]
    created = _submit(token, _name("Withdrawn College"))
    response = client.delete(
        f"/api/v1/college-submissions/{created['id']}", headers=_auth(token)
    )
    assert response.status_code == 204
    _cleanup(created["id"])


def test_owner_cannot_withdraw_reviewed():
    _, body = _register()
    owner_token = body["access_token"]
    created = _submit(owner_token, _name("Kept College"))
    admin_email, _ = _register()
    admin_token = _token_for(admin_email, "admin")
    client.post(
        f"/api/v1/college-submissions/{created['id']}/reject",
        json={},
        headers=_auth(admin_token),
    )
    response = client.delete(
        f"/api/v1/college-submissions/{created['id']}", headers=_auth(owner_token)
    )
    assert response.status_code == 409
    _cleanup(created["id"])


# --------------------------------------------------------------------------- #
# Review actions + the create-a-college guarantee
# --------------------------------------------------------------------------- #


def test_review_actions_require_admin_not_content_manager():
    # A content_manager may *read* the queue but must not approve (which writes
    # to `colleges`).
    cm_email, _ = _register()
    cm_token = _token_for(cm_email, "content_manager")

    _, owner_body = _register()
    owner_token = owner_body["access_token"]
    created = _submit(owner_token, _name("Gated College"))

    assert (
        client.post(
            f"/api/v1/college-submissions/{created['id']}/approve",
            json={},
            headers=_auth(cm_token),
        ).status_code
        == 403
    )
    _cleanup(created["id"])


def test_approve_creates_and_links_one_college():
    _, owner_body = _register()
    owner_token = owner_body["access_token"]
    name = _name("Approve Target College")
    created = _submit(owner_token, name)

    admin_email, _ = _register()
    admin_token = _token_for(admin_email, "admin")
    response = client.post(
        f"/api/v1/college-submissions/{created['id']}/approve",
        json={"reviewer_notes": "looks real"},
        headers=_auth(admin_token),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "approved"
    assert data["college_id"] is not None
    assert data["college_slug"] is not None

    # The college actually exists, is active, and is unverified (published but
    # not yet verified).
    with SessionLocal() as db:
        college = db.get(College, data["college_id"])
        assert college is not None
        assert college.name == name
        assert college.is_active is True
        assert college.verification_status == "unverified"

    # A second approve is refused.
    again = client.post(
        f"/api/v1/college-submissions/{created['id']}/approve",
        json={},
        headers=_auth(admin_token),
    )
    assert again.status_code == 409
    _cleanup(created["id"])


def test_approve_links_existing_college_instead_of_creating():
    _, owner_body = _register()
    owner_token = owner_body["access_token"]

    marker = _name("Link Target")
    from app.routers.college_submissions import _slugify as _sub_slugify

    with SessionLocal() as db:
        college = College(
            college_id=f"LINK{uuid.uuid4().int % 1_000_000:06d}",
            name=marker,
            # The exact-duplicate check matches on `slug`, so the existing
            # college's slug must be the slugified form of its name — exactly
            # what a real admin-created college would have.
            slug=_sub_slugify(marker),
            is_active=True,
        )
        db.add(college)
        db.commit()
        existing_id = college.id

    # Submit a *different* name, then rename the target college's name to match
    # so an exact duplicate exists by approve time. (The submit-time exact check
    # would otherwise 409.)
    created = _submit(owner_token, _name("Some Other Name College"))
    with SessionLocal() as db:
        row = db.get(CollegeSubmission, created["id"])
        row.proposed_name = marker
        db.commit()

    admin_email, _ = _register()
    admin_token = _token_for(admin_email, "admin")
    response = client.post(
        f"/api/v1/college-submissions/{created['id']}/approve",
        json={},
        headers=_auth(admin_token),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["college_id"] == existing_id, "approval must link, not duplicate"

    with SessionLocal() as db:
        stored = db.get(College, existing_id)
        db.delete(stored)
        db.commit()
    _cleanup(created["id"])


def test_approve_links_a_deactivated_college_instead_of_duplicating_it():
    """Regression: an archived college was invisible to the duplicate check.

    `_find_exact_duplicate` filtered on `is_active`, so a deactivated college
    never matched — but `colleges.slug` is unique regardless of the flag, so the
    approve path tried to insert a second row with the same slug and answered
    **500**, leaving the submission pending and the reviewer unable to proceed.
    Approval must link what already exists, live or archived.
    """
    _, owner_body = _register()
    owner_token = owner_body["access_token"]

    marker = _name("Archived Target")
    from app.routers.college_submissions import _slugify as _sub_slugify

    with SessionLocal() as db:
        archived = College(
            college_id=f"ARCH{uuid.uuid4().int % 1_000_000:06d}",
            name=marker,
            slug=_sub_slugify(marker),
            is_active=False,
        )
        db.add(archived)
        db.commit()
        archived_id = archived.id

    created_id: int | None = None
    try:
        # Submit stays permissive: an archived college is not in the public list
        # the submitter was told to check against, so this is not a 409.
        created = _submit(owner_token, marker)
        created_id = created["id"]

        admin_email, _ = _register()
        admin_token = _token_for(admin_email, "admin")
        response = client.post(
            f"/api/v1/college-submissions/{created_id}/approve",
            json={"reviewer_notes": "the archived record is the same college"},
            headers=_auth(admin_token),
        )
        assert response.status_code == 200, response.text
        data = response.json()
        assert data["college_id"] == archived_id, "approval must link, not duplicate"
        # And the response says so, because the public page for an archived
        # college 404s — a link without this flag is a dead link.
        assert data["college_is_active"] is False

        with SessionLocal() as db:
            same_slug = db.scalars(
                select(College).where(College.slug == _sub_slugify(marker))
            ).all()
            assert len(same_slug) == 1, "a duplicate college was created anyway"
    finally:
        if created_id is not None:
            _cleanup(created_id)
        with SessionLocal() as db:
            row = db.get(College, archived_id)
            if row is not None:
                db.delete(row)
            db.commit()


def test_reject_sets_status_without_creating_college():
    _, owner_body = _register()
    owner_token = owner_body["access_token"]
    created = _submit(owner_token, _name("Rejected College"))
    admin_email, _ = _register()
    admin_token = _token_for(admin_email, "admin")
    response = client.post(
        f"/api/v1/college-submissions/{created['id']}/reject",
        json={"reviewer_notes": "duplicate of nothing"},
        headers=_auth(admin_token),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "rejected"
    assert data["college_id"] is None
    _cleanup(data["id"])


def test_request_changes_sets_status():
    _, owner_body = _register()
    owner_token = owner_body["access_token"]
    created = _submit(owner_token, _name("Needs Work College"))
    admin_email, _ = _register()
    admin_token = _token_for(admin_email, "admin")
    response = client.post(
        f"/api/v1/college-submissions/{created['id']}/request-changes",
        json={"reviewer_notes": "add the official website"},
        headers=_auth(admin_token),
    )
    assert response.status_code == 200
    assert response.json()["status"] == "changes_requested"
    _cleanup(created["id"])


def test_student_cannot_read_queue_or_review():
    _, body = _register()
    token = body["access_token"]
    assert (
        client.get("/api/v1/college-submissions", headers=_auth(token)).status_code
        == 403
    )

    _, owner_body = _register()
    created = _submit(owner_body["access_token"], _name("Nope College"))
    assert (
        client.post(
            f"/api/v1/college-submissions/{created['id']}/reject",
            json={},
            headers=_auth(token),
        ).status_code
        == 403
    )
    _cleanup(created["id"])


def test_review_writes_audit_rows():
    _, owner_body = _register()
    owner_token = owner_body["access_token"]
    created = _submit(owner_token, _name("Audited College"))
    admin_email, _ = _register()
    admin_token = _token_for(admin_email, "admin")
    client.post(
        f"/api/v1/college-submissions/{created['id']}/approve",
        json={},
        headers=_auth(admin_token),
    )
    with SessionLocal() as db:
        rows = db.scalars(
            select(AuditLog).where(
                AuditLog.entity_type == "college_submission",
                AuditLog.entity_id == created["id"],
            )
        ).all()
        actions = {r.action for r in rows}
        assert "submit_college_suggestion" in actions
        assert "approved_college_submission" in actions
    _cleanup(created["id"])
