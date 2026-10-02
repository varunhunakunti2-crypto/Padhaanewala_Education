"""Query-count regression tests.

An N+1 is invisible in a response body: every field is correct, every assertion
about values passes, and the page is just slow. Nothing short of counting the
statements catches it, which is why these tests exist rather than a handful of
assertions that the endpoint returns the right `course_name`.

The thresholds are deliberately loose. They are not a statement that these
endpoints use exactly N queries — they are a tripwire that fires when a page
goes back to one-query-per-row. The old behaviour was `limit + 1` (up to 501 for
the catalogue routers); anything in single digits to low tens is a real fix, and
a number in the hundreds is the bug returning.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event

from app.database import SessionLocal, engine
from app.main import app
from app.models import AuditLog, College, Cutoff, Role, SeatMatrix, User

client = TestClient(app)


@pytest.fixture
def counting_db():
    """Count the SELECTs one request issues, per endpoint.

    Counts statements through the SQLAlchemy event hook rather than by reading
    a server log, so the number is attributable to the request under test and
    not to the fixture setup that preceded it.
    """
    counter: list[str] = []

    def _before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        counter.append(statement)

    event.listen(engine, "before_cursor_execute", _before_cursor_execute)
    try:
        yield counter
    finally:
        event.remove(engine, "before_cursor_execute", _before_cursor_execute)


def _count_selects(counter: list[str]) -> int:
    return sum(1 for s in counter if s.lstrip().upper().startswith("SELECT"))


@pytest.fixture
def college_with_enrichment():
    """A college owning enough cutoffs and seat rows to make an N+1 obvious."""
    stamp = uuid.uuid4().hex[:8]
    with SessionLocal() as db:
        college = College(
            # `colleges.college_id` is a NOT NULL external code, not the primary
            # key — `id` is. Omitting it is a NotNullViolation at insert.
            college_id=f"C{uuid.uuid4().int % 1_000_000_000}",
            name=f"Query Count College {stamp}",
            slug=f"query-count-{stamp}",
            college_type="university",
            ownership="private",
            state_id=1,
            is_active=True,
        )
        db.add(college)
        db.commit()
        db.refresh(college)
        college_id = college.id

    with SessionLocal() as db:
        db.add_all(
            [
                Cutoff(
                    college_id=college_id,
                    exam_name=f"EXAM{i}",
                    year=2000 + i,
                    category="General",
                )
                for i in range(12)
            ]
            + [
                SeatMatrix(college_id=college_id, year=2000 + i)
                for i in range(12)
            ]
        )
        db.commit()

    yield college_id

    with SessionLocal() as db:
        db.query(Cutoff).filter(Cutoff.college_id == college_id).delete(
            synchronize_session=False
        )
        db.query(SeatMatrix).filter(SeatMatrix.college_id == college_id).delete(
            synchronize_session=False
        )
        row = db.get(College, college_id)
        if row is not None:
            db.delete(row)
        db.commit()


def test_cutoff_list_does_not_query_per_row(college_with_enrichment, counting_db):
    """12 cutoffs must not cost 13 queries.

    Every row here has a NULL course_id, so the naive per-row course lookup
    short-circuits and this test would pass while the bug lived. The rows
    therefore carry real course ids, and the college is linked to enough
    courses that a per-row lookup is visible in the count.
    """
    college_id = college_with_enrichment
    with SessionLocal() as db:
        from app.models import Course

        courses = db.query(Course).limit(12).all()
        cutoffs = db.query(Cutoff).filter(Cutoff.college_id == college_id).all()
        for cutoff, course in zip(cutoffs, courses):
            cutoff.course_id = course.id
        db.commit()

    counting_db.clear()
    response = client.get(f"/api/v1/colleges/{college_id}/cutoffs")
    assert response.status_code == 200, response.text
    assert len(response.json()) == 12

    # Non-vacuity: if the event hook were attached to the wrong engine, or the
    # session were served from a cache, the counter would be empty and every
    # upper-bound assertion below would pass while checking nothing.
    assert counting_db, "no statements were observed; the counter is not working"

    # 1 for the college, 1 for the cutoffs, 1 for the college eager-load,
    # 1 for the batched course names. Room for a couple more, but nowhere
    # near the 13 a per-row lookup would produce.
    assert _count_selects(counting_db) <= 6, (
        f"cutoff list issued {_count_selects(counting_db)} SELECTs for 12 rows; "
        "the per-row course lookup is back"
    )


def test_seat_matrix_list_does_not_query_per_row(college_with_enrichment, counting_db):
    college_id = college_with_enrichment
    with SessionLocal() as db:
        from app.models import Course

        courses = db.query(Course).limit(12).all()
        seats = db.query(SeatMatrix).filter(SeatMatrix.college_id == college_id).all()
        for seat, course in zip(seats, courses):
            seat.course_id = course.id
        db.commit()

    counting_db.clear()
    response = client.get(f"/api/v1/colleges/{college_id}/seat-matrix")
    assert response.status_code == 200, response.text
    assert len(response.json()) == 12

    assert counting_db, "no statements were observed; the counter is not working"
    assert _count_selects(counting_db) <= 6, (
        f"seat matrix issued {_count_selects(counting_db)} SELECTs for 12 rows; "
        "the per-row course lookup is back"
    )


def test_course_name_is_still_returned_after_batching(college_with_enrichment):
    """The optimisation must not have traded correctness for the query count."""
    college_id = college_with_enrichment
    with SessionLocal() as db:
        from app.models import Course

        course = db.query(Course).first()
        cutoff = db.query(Cutoff).filter(Cutoff.college_id == college_id).first()
        cutoff.course_id = course.id
        db.commit()
        # Read the id inside the session: after `close()` the instance is
        # detached and touching an attribute raises rather than returning a
        # stale value, which is a confusing way to fail.
        cutoff_id = cutoff.id
        expected = course.name

    rows = client.get(f"/api/v1/colleges/{college_id}/cutoffs").json()
    matched = [r for r in rows if r["id"] == cutoff_id]
    assert matched, "the cutoff under test disappeared from the response"
    assert matched[0]["course_name"] == expected


def _seed_distinct_actor_users(count: int) -> list[int]:
    """Create `count` users, because that is what an N+1 on `user_id` needs.

    This is the detail that made two earlier versions of this test worthless.
    Seeding every audit row against a *single* actor leaves `db.get(User, ...)`
    hitting the session identity map after the first row, so the query count
    does not scale and the unfixed code passes. Real audit pages are written by
    many different admins, which is exactly the case that exposed the bug.
    """
    suffix = uuid.uuid4().hex[:8]
    with SessionLocal() as db:
        # `User` has no `name` column; `display_name` is a property that reads
        # the student profile and falls back to the email address.
        users = [
            User(
                email=f"actor.{suffix}.{i}@example.com",
                mobile=f"9{uuid.uuid4().int % 1_000_000_000:09d}",
                password_hash="x",
                age_band="18_plus",
            )
            for i in range(count)
        ]
        db.add_all(users)
        db.commit()
        ids = [u.id for u in users]
    return ids


def test_audit_log_list_does_not_query_per_row(counting_db):
    """The audit page used to cost one `db.get(User, ...)` per distinct user.

    This is the screen an admin opens when something has already gone wrong, so
    it being the slowest page in the product was the wrong place to economise.

    The rows are seeded explicitly rather than left to whatever other tests
    happen to have written. An earlier version listed an audit table that was
    empty when this file ran alone, so it passed with a query count of zero
    against the *unfixed* code — green, and proving nothing.
    """
    payload = {
        "name": "Audit Reader",
        "email": f"auditreader.{uuid.uuid4().hex[:8]}@example.com",
        "mobile": f"9{uuid.uuid4().int % 1_000_000_000:09d}",
        "password": "SecurePass123!",
        "age_band": "18_plus",
    }
    registered = client.post("/api/v1/auth/register", json=payload)
    assert registered.status_code == 201, registered.text
    account = {**payload, **registered.json()}

    with SessionLocal() as db:
        user = db.query(User).filter(User.email == account["email"]).first()
        role = db.query(Role).filter(Role.name == "admin").first()
        if role is None:
            role = Role(name="admin", description="test:admin")
            db.add(role)
            db.flush()
        user.roles = [role]
        db.commit()

    small_actors = _seed_distinct_actor_users(5)
    large_actors = _seed_distinct_actor_users(25)
    actor_tag = f"qc{uuid.uuid4().hex[:6]}"
    headers = {"Authorization": f"Bearer {account['access_token']}"}

    def selects_for(action: str, row_count: int, actors: list[int]) -> int:
        with SessionLocal() as db:
            db.query(AuditLog).filter(AuditLog.action == action).delete(
                synchronize_session=False
            )
            db.add_all(
                [
                    AuditLog(
                        action=action,
                        entity_type="probe",
                        # Distinct actors: this is what makes the count scale
                        # when the per-row lookup is present.
                        user_id=actors[i],
                        old_value={"n": i},
                    )
                    for i in range(row_count)
                ]
            )
            db.commit()

        counting_db.clear()
        response = client.get(
            "/api/v1/audit-logs",
            params={"action": action, "limit": 200},
            headers=headers,
        )
        assert response.status_code == 200, response.text
        assert len(response.json()) == row_count, (
            f"expected {row_count} audit rows for {action}, got "
            f"{len(response.json())}; the fixture is not seeding what this test "
            "claims to measure"
        )
        assert counting_db, "no statements were observed; the counter is not working"
        return _count_selects(counting_db)

    try:
        small = selects_for(f"{actor_tag}_small", 5, small_actors)
        large = selects_for(f"{actor_tag}_large", 25, large_actors)

        # The assertion is non-scaling, not an arbitrary constant. Five rows
        # written by five different people and twenty-five rows written by
        # twenty-five must cost the same number of statements; the old per-row
        # `db.get(User, ...)` made the second cost twenty more than the first.
        assert large == small, (
            f"audit list issued {small} SELECTs for 5 rows but {large} for 25; "
            "the query count must not scale with the number of rows"
        )

        # And the eager load must not have changed the payload shape.
        rows = client.get(
            "/api/v1/audit-logs",
            params={"action": f"{actor_tag}_large", "limit": 200},
            headers=headers,
        ).json()
        assert all("username" in row for row in rows)
        assert all(row["username"] for row in rows), (
            "every seeded row has an actor, so every username must resolve"
        )
    finally:
        with SessionLocal() as db:
            db.query(AuditLog).filter(AuditLog.action.like(f"{actor_tag}%")).delete(
                synchronize_session=False
            )
            db.commit()
