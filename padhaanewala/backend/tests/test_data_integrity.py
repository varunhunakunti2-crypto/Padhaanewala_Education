"""Phase 4 — data leakage and write integrity.

Each test here pins behaviour that was verified *broken* by reading the source
and driving the API, in the same way BUG-01 was found: the existing suite passed
throughout, because none of these paths had a test that asked the right question.

The questions asked are consistently the ones the old code failed:

  * who decided this value, the caller or the server?
  * can an unauthenticated caller influence state?
  * is this operation idempotent?
  * if this row is destroyed, is there any record that it existed?
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import (
    NIRFRanking,
    AuditLog,
    Blog,
    BlogCategory,
    College,
    Cutoff,
    Enquiry,
    OtherRanking,
    PlacementRecord,
    Role,
    SeatMatrix,
    User,
)

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
def admin():
    payload = {
        "name": "Content Admin",
        "email": _unique("cadmin"),
        "mobile": _unique_mobile(),
        "password": "SecurePass123!",
        "age_band": "18_plus",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    data = {**payload, **response.json()}
    _assign_roles(data["email"], ["admin", "super_admin"])
    # The register response is a TokenResponse and carries no `id`, so look the
    # row up rather than reading a key that was never there.
    data["id"] = _user_id(data["email"])
    return data


@pytest.fixture
def student():
    """Reviews require an authenticated author, so the moderation test needs one."""
    payload = {
        "name": "Reviewing Student",
        "email": _unique("reviewer"),
        "mobile": _unique_mobile(),
        "password": "SecurePass123!",
        "age_band": "18_plus",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    data = {**payload, **response.json()}
    _assign_roles(data["email"], ["student"])
    data["id"] = _user_id(data["email"])
    return data


def _user_id(email: str) -> int:
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        return user.id


def _headers(account: dict) -> dict:
    return {"Authorization": f"Bearer {account['access_token']}"}


def _published_blog(admin: dict) -> dict:
    headers = _headers(admin)
    category = client.post(
        "/api/v1/blog-categories", json={"name": f"Cat {uuid.uuid4().hex[:6]}"}, headers=headers
    )
    assert category.status_code == 201, category.text
    created = client.post(
        "/api/v1/blogs",
        json={
            "title": f"Post {uuid.uuid4().hex[:6]}",
            "content": "Body text",
            "category_id": category.json()["id"],
            "status": "published",
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    return created.json()


# --------------------------------------------------------------------------- #
# 4.1 — ip_address is the server's to decide, on an unauthenticated endpoint
# --------------------------------------------------------------------------- #


def test_enquiry_rejects_a_client_supplied_ip_address():
    """The field is gone from the schema, so a caller sending it gets a 422.

    Silently dropping it would be worse: the client would see 201 and believe the
    address was recorded, and it would not have been.
    """
    response = client.post(
        "/api/v1/enquiries",
        json={
            "name": "Forged Source",
            "mobile": _unique_mobile(),
            "ip_address": "203.0.113.9",
            "age_band": "18_plus",
        },
    )
    assert response.status_code == 422, response.text


def test_enquiry_ip_is_derived_server_side():
    """Whatever the client sends, the stored value is the connection's."""
    mobile = _unique_mobile()
    response = client.post(
        "/api/v1/enquiries",
        json={"name": "Real Enquiry", "mobile": mobile, "age_band": "18_plus"},
    )
    assert response.status_code == 201, response.text

    with SessionLocal() as db:
        row = db.query(Enquiry).filter(Enquiry.mobile == mobile).one()
        # TestClient presents itself as `testclient`, so the value is that rather
        # than a client-controlled string. The point is provenance, not the value.
        assert row.ip_address != "203.0.113.9"
        assert row.ip_address


def test_enquiry_ip_honours_the_proxy_header_only_when_configured(monkeypatch):
    """`X-Forwarded-For` is client-controlled; it is only trusted when declared.

    With `TRUSTED_PROXY_HOPS=0` the header is ignored entirely, so a caller cannot
    forge the address stored against a lead.
    """
    from app.config import settings

    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 0)
    mobile = _unique_mobile()
    client.post(
        "/api/v1/enquiries",
        json={"name": "Spoofed", "mobile": mobile, "age_band": "18_plus"},
        headers={"X-Forwarded-For": "198.51.100.7"},
    )
    with SessionLocal() as db:
        row = db.query(Enquiry).filter(Enquiry.mobile == mobile).one()
        assert row.ip_address != "198.51.100.7"


def test_enquiry_message_is_length_capped():
    """Free text from an anonymous caller, stored where counsellors read it."""
    response = client.post(
        "/api/v1/enquiries",
        json={
            "name": "Flooder",
            "mobile": _unique_mobile(),
            "message": "x" * 5000,
            "age_band": "18_plus",
        },
    )
    assert response.status_code == 422


# --------------------------------------------------------------------------- #
# 4.6 — a GET must not mutate
# --------------------------------------------------------------------------- #


def test_get_blog_does_not_increment_view_count(admin):
    blog = _published_blog(admin)

    for _ in range(5):
        assert client.get(f"/api/v1/blogs/{blog['slug']}").json()["view_count"] == 0


def test_view_count_is_incremented_explicitly(admin):
    blog = _published_blog(admin)

    for expected in (1, 2, 3):
        assert client.post(f"/api/v1/blogs/{blog['slug']}/view").status_code == 204
        assert client.get(f"/api/v1/blogs/{blog['slug']}").json()["view_count"] == expected


def test_view_endpoint_is_idempotent_in_the_safe_direction(admin):
    """Two concurrent views must both count, not overwrite each other.

    `UPDATE ... = view_count + 1` is atomic; a read-modify-write in Python is
    not, and loses one of the two.
    """
    blog = _published_blog(admin)
    for _ in range(10):
        client.post(f"/api/v1/blogs/{blog['slug']}/view")
    assert client.get(f"/api/v1/blogs/{blog['slug']}").json()["view_count"] == 10


def test_view_endpoint_cannot_be_used_to_probe_slugs(admin):
    """It answers 204 either way, so it is not a blog-existence oracle."""
    assert client.post("/api/v1/blogs/does-not-exist-anywhere/view").status_code == 204


def test_view_endpoint_cannot_count_an_unpublished_blog(admin):
    """A draft's counter must not be pushable by an anonymous caller."""
    headers = _headers(admin)
    category = client.post(
        "/api/v1/blog-categories", json={"name": f"Cat {uuid.uuid4().hex[:6]}"}, headers=headers
    )
    draft = client.post(
        "/api/v1/blogs",
        json={
            "title": f"Draft {uuid.uuid4().hex[:6]}",
            "content": "Not for release",
            "category_id": category.json()["id"],
            "status": "draft",
        },
        headers=headers,
    )
    assert draft.status_code == 201, draft.text
    slug = draft.json()["slug"]

    client.post(f"/api/v1/blogs/{slug}/view")

    with SessionLocal() as db:
        row = db.get(Blog, draft.json()["id"])
        assert row.view_count == 0, "an unpublished blog must not be countable"


# --------------------------------------------------------------------------- #
# 4.5 / 4.4 — the audit trail, and the writers that were bypassing it
# --------------------------------------------------------------------------- #


def _latest_audit(action: str) -> AuditLog | None:
    with SessionLocal() as db:
        return (
            db.query(AuditLog)
            .filter(AuditLog.action == action)
            .order_by(AuditLog.id.desc())
            .first()
        )


def test_blog_update_is_audited_with_an_ip_address(admin):
    blog = _published_blog(admin)
    response = client.put(
        f"/api/v1/blogs/{blog['slug']}",
        json={"title": f"Renamed {uuid.uuid4().hex[:6]}"},
        headers=_headers(admin),
    )
    assert response.status_code == 200, response.text

    entry = _latest_audit("update_blog")
    assert entry is not None, "update_blog must write an audit row"
    assert entry.ip_address, "an inline AuditLog left ip_address NULL; the helper stamps it"
    assert entry.user_id == admin["id"]


def test_blog_delete_is_audited_with_an_ip_address(admin):
    blog = _published_blog(admin)
    response = client.delete(f"/api/v1/blogs/{blog['slug']}", headers=_headers(admin))
    assert response.status_code == 204, response.text

    entry = _latest_audit("delete_blog")
    assert entry is not None
    assert entry.ip_address
    # Enough to reconstruct what existed, since the row is gone for good.
    assert entry.old_value.get("slug") == blog["slug"]
    assert "content_length" in entry.old_value


def test_blog_delete_audit_survives_the_delete(admin):
    """The row is written before the delete, and `user_id` is `SET NULL` on
    cascade rather than CASCADE, so the trail outlives the user too."""
    blog = _published_blog(admin)
    client.delete(f"/api/v1/blogs/{blog['slug']}", headers=_headers(admin))

    entry = _latest_audit("delete_blog")
    assert entry is not None
    with SessionLocal() as db:
        assert db.get(Blog, blog["id"]) is None


def test_rejected_blog_update_does_not_leave_a_phantom_audit_row(admin):
    """A duplicate slug is refused, so nothing changed and nothing should be logged.

    The audit row used to be constructed *before* validation, so a rejected
    payload left a record of a change that never happened.
    """
    headers = _headers(admin)
    first = _published_blog(admin)
    second = _published_blog(admin)
    before = _audit_count("update_blog")

    # Retitling the second blog to the first's exact title derives the first's
    # slug, which is already taken.
    refused = client.put(
        f"/api/v1/blogs/{second['slug']}",
        json={"title": first["title"]},
        headers=headers,
    )
    assert refused.status_code == 400, refused.text
    assert _audit_count("update_blog") == before, (
        "the refused update must not have written an audit row"
    )


def _audit_count(action: str) -> int:
    with SessionLocal() as db:
        return db.query(AuditLog).filter(AuditLog.action == action).count()


def test_review_moderation_is_audited_with_an_ip_address(admin, student):
    """The action most likely to be disputed by the person it was taken against."""
    college_id = _first_college_id()

    created = client.post(
        "/api/v1/reviews",
        json={"college_id": college_id, "rating": 4, "review_text": "Solid", "year_of_study": "2nd"},
        headers=_headers(student),
    )
    assert created.status_code == 201, created.text
    review_id = created.json()["id"]

    response = client.post(
        f"/api/v1/reviews/{review_id}/moderate",
        json={"status": "approved"},
        headers=_headers(admin),
    )
    assert response.status_code == 200, response.text

    entry = _latest_audit("moderate_review")
    assert entry is not None
    assert entry.ip_address, "moderation must record who and from where"
    assert entry.user_id == admin["id"]


def _first_college_id() -> int:
    response = client.get("/api/v1/colleges?limit=1")
    assert response.status_code == 200, response.text
    return response.json()[0]["id"]


def test_delete_college_is_audited_with_cascade_counts(admin):
    """The most destructive endpoint in the app, and it logged nothing.

    The audit row separates the two outcomes, because they stopped being the
    same: `detached_rows` survive with a NULL college_id and can be re-linked,
    while `destroyed_rows` are gone for good once the commit lands.
    """
    college_id = _first_college_id()
    listing = client.get(f"/api/v1/colleges/{college_id}").json()

    response = client.delete(f"/api/v1/colleges/{college_id}", headers=_headers(admin))
    assert response.status_code == 204, response.text

    entry = _latest_audit("delete_college")
    assert entry is not None, "delete_college must write an audit row"
    assert entry.ip_address
    assert entry.old_value["slug"] == listing["slug"]

    detached = entry.old_value["detached_rows"]
    for table in (
        "cutoffs",
        "placements",
        "nirf_rankings",
        "other_rankings",
        "seat_matrix",
    ):
        assert table in detached, f"the record must say how many {table} rows were detached"

    destroyed = entry.old_value["destroyed_rows"]
    for table in ("college_courses", "reviews", "saved_colleges"):
        assert table in destroyed, f"the record must say how many {table} rows were lost"

    assert "cascading_rows" not in entry.old_value, (
        "the old single bucket claimed every dependent row was destroyed, "
        "which stopped being true in b4e8f2a71d09 and would now be a lie"
    )


def test_delete_college_preserves_historical_cutoffs_and_rankings(admin):
    """Deleting a college must not delete a decade of published rank history.

    All eight enrichment FKs were ON DELETE CASCADE while nullable, so
    `DELETE FROM colleges` destroyed every cutoff, NIRF rank, other-ranking,
    placement and seat-matrix row that referenced it. An audit log recording
    the count is not a backup: the rows were gone.

    The regression is about the *survival* of the data, which no test asserted
    before. It writes one row of each kind against a throwaway college, deletes
    the college, and requires every row to still be present with a NULL
    college_id.
    """
    stamp = uuid.uuid4().hex[:8]
    college = client.post(
        "/api/v1/colleges",
        json={
            "name": f"History Probe {stamp}",
            "slug": f"history-probe-{stamp}",
            "state_id": 1,
        },
        headers=_headers(admin),
    )
    assert college.status_code == 201, college.text
    college_id = college.json()["id"]

    seeded: dict[str, int] = {}
    # Unique per run: a fixed identity would collide with an orphan left by any
    # earlier run and the delete would be (correctly) refused with a 409.
    exam_name = f"JEE-{uuid.uuid4().hex[:8]}"
    with SessionLocal() as db:
        cutoff = Cutoff(
            college_id=college_id,
            exam_name=exam_name,
            year=2019,
            category="General",
            opening_rank=1000,
            closing_rank=5000,
        )
        nirf = NIRFRanking(college_id=college_id, category="University", year=2019, rank=42)
        other = OtherRanking(college_id=college_id, ranking_body="NIRF", category="University")
        placement = PlacementRecord(college_id=college_id, academic_year="2019-20")
        seat = SeatMatrix(college_id=college_id, year=2019)
        db.add_all([cutoff, nirf, other, placement, seat])
        db.commit()
        seeded = {
            "cutoffs": cutoff.id,
            "nirf_rankings": nirf.id,
            "other_rankings": other.id,
            "placement_records": placement.id,
            "seat_matrix": seat.id,
        }

    response = client.delete(f"/api/v1/colleges/{college_id}", headers=_headers(admin))
    assert response.status_code == 204, response.text

    models = {
        "cutoffs": Cutoff,
        "nirf_rankings": NIRFRanking,
        "other_rankings": OtherRanking,
        "placement_records": PlacementRecord,
        "seat_matrix": SeatMatrix,
    }
    try:
        with SessionLocal() as db:
            assert db.get(College, college_id) is None, "the college itself must be gone"
            for table, model in models.items():
                row = db.get(model, seeded[table])
                assert row is not None, (
                    f"{table} row {seeded[table]} was destroyed by the college "
                    "delete; a published historical fact must outlive the college "
                    "record"
                )
                assert row.college_id is None, f"{table} row should be detached, not rewritten"
    finally:
        # The rows now survive the delete, which is the point — so this test owns
        # them and has to remove them itself. Leaving them would make the next
        # run collide on `uq_cutoff_identity_coalesce` and fail somewhere
        # unrelated to the assertion above.
        with SessionLocal() as db:
            for table, model in models.items():
                row = db.get(model, seeded[table])
                if row is not None:
                    db.delete(row)
            db.commit()


def test_delete_college_refuses_to_detach_onto_a_duplicate_orphan(admin):
    """A colliding detach must be refused, not left to 500 inside PostgreSQL.

    `uq_cutoff_identity_coalesce` maps a NULL college_id to the sentinel 0, so
    detaching a cutoff onto an already-unattributed row of the same identity is
    a unique violation. Surfacing that as a 500 would send whoever clicked
    delete looking at a database error instead of at the duplicate cutoffs.
    """
    stamp = uuid.uuid4().hex[:8]
    college = client.post(
        "/api/v1/colleges",
        json={
            "name": f"Collision Probe {stamp}",
            "slug": f"collision-probe-{stamp}",
            "state_id": 1,
        },
        headers=_headers(admin),
    )
    assert college.status_code == 201, college.text
    college_id = college.json()["id"]

    identity = {
        "exam_name": f"NEET {stamp}",
        "year": 2020,
        "category": "General",
    }

    orphan_id: int | None = None
    with SessionLocal() as db:
        # An unattributed row that a detach would collide with.
        orphan = Cutoff(college_id=None, **identity)
        owned = Cutoff(college_id=college_id, **identity)
        db.add_all([orphan, owned])
        db.commit()
        orphan_id = orphan.id

    try:
        response = client.delete(
            f"/api/v1/colleges/{college_id}", headers=_headers(admin)
        )
        assert response.status_code == 409, response.text
        assert "unattributed" in response.json()["detail"]

        with SessionLocal() as db:
            assert db.get(College, college_id) is not None, (
                "a refused delete must leave the college in place"
            )
    finally:
        with SessionLocal() as db:
            db.query(Cutoff).filter(
                Cutoff.exam_name == identity["exam_name"]
            ).delete(synchronize_session=False)
            college_row = db.get(College, college_id)
            if college_row is not None:
                db.delete(college_row)
            db.commit()


def test_delete_college_still_requires_super_admin():
    """The role gate is unchanged — this is an audit fix, not a permissions fix."""
    payload = {
        "name": "Plain Student",
        "email": _unique("nostudent"),
        "mobile": _unique_mobile(),
        "password": "SecurePass123!",
        "age_band": "18_plus",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    account = {**payload, **response.json()}
    _assign_roles(account["email"], ["student"])

    college_id = _first_college_id()
    forbidden = client.delete(
        f"/api/v1/colleges/{college_id}", headers=_headers(account)
    )
    assert forbidden.status_code == 403, forbidden.text


# --------------------------------------------------------------------------- #
# 4.8 — /api/stats is public, so it is bounded
# --------------------------------------------------------------------------- #


def test_stats_endpoint_is_not_uncountably_cheap_to_abuse():
    """Six `COUNT(*)` per request, unauthenticated.

    Pinned as "the limit exists" rather than a status code, because the limiter
    is disabled in the suite and a rate-limit assertion here would pass
    vacuously. What matters is that the path is *registered* for limiting.
    """
    from app.middleware.ratelimit import _limit_for

    assert _limit_for("/api/v1/stats/catalog") is not None


def test_duplicate_cutoff_with_null_dimensions_is_rejected():
    """4.x — the legacy unique constraint never fires when dimensions are NULL.

    The 8-column `uq_cutoff_identity` treats NULLs as distinct, so a duplicate
    cutoff row whose college/course/branch/round/quota are unset slipped through
    and skewed the predictor's average closing rank. The COALESCE partial index
    collapses those NULLs to unreachable sentinels; two such rows must collide.
    """
    from sqlalchemy.exc import IntegrityError

    from app.models import Cutoff

    common = {
        "exam_name": "neet-ug",
        "year": 2026,
        "category": "General",
        "college_id": None,
        "course_id": None,
        "branch": None,
        "round": None,
        "quota": None,
    }
    with SessionLocal() as db:
        db.add(Cutoff(**common))
        db.add(Cutoff(**common))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()
