"""The admin console must be able to list content it has deactivated.

`colleges`, `courses`, `exams`, `scholarships` and `universities` all filter
`is_active` unconditionally in their public list handlers, and the console reads
those same public routes to render its tables. So the moment an admin deactivated
a row it disappeared from the panel -- while `is_active` stayed writable on every
one of the `*Update` schemas, making deactivation a one-way door with no route
back. The panel's Status column read a field that was structurally always `true`,
exactly as the banners and FAQs panels did before they were fixed.

`include_inactive` now lifts the filter, gated on `CONTENT_ROLES` via the shared
`dependencies.can_view_inactive`. Because these are *public* routes, the gate is
the whole security boundary: if it were open, any anonymous caller could read
draft catalogue rows. Both directions are pinned below -- that the flag 403s
without a content role, and that it genuinely returns the hidden rows to one that
holds it. A test of only the first would pass against an endpoint that ignored the
flag entirely.
"""

import uuid

from fastapi.testclient import TestClient
import pytest

from app.database import SessionLocal
from app.main import app
from app.models import (
    College,
    CollegeCourse,
    Course,
    Exam,
    Role,
    Scholarship,
    University,
    User,
)

client = TestClient(app)

PASSWORD = "SecurePass123!"

#: Every public list route the console reads for a management table.
CATALOGUE_LISTS = [
    "/api/v1/colleges",
    "/api/v1/courses",
    "/api/v1/exams",
    "/api/v1/scholarships",
    "/api/v1/universities",
]


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #


def _unique(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:8]}@example.com"


def _unique_mobile() -> str:
    return f"9{uuid.uuid4().int % 1_000_000_000:09d}"


def _register(prefix: str) -> dict:
    payload = {
        "name": "Catalogue Test",
        "email": _unique(prefix),
        "mobile": _unique_mobile(),
        "password": PASSWORD,
        # Required, no default, since BUG-12 — see the note in
        # `test_counsellor_provisioning.py::_register`.
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


def _headers_with_role(role_name: str) -> dict[str, str]:
    account = _register(role_name)
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == account["email"]).one()
        role = db.query(Role).filter(Role.name == role_name).first()
        assert role is not None, f"role {role_name} missing - run seed_roles.py"
        user.roles = [role]
        db.commit()
    return _login(account["email"])


@pytest.fixture(scope="module")
def admin_headers():
    return _headers_with_role("admin")


@pytest.fixture(scope="module")
def student_headers():
    return _headers_with_role("student")


def _make_college(name: str, *, is_active: bool) -> College:
    college = College(
        college_id=f"C{uuid.uuid4().int % 1_000_000_000}",
        name=name,
        slug=f"test-college-{uuid.uuid4().hex[:8]}",
        college_type="university",
        ownership="private",
        is_active=is_active,
    )
    with SessionLocal() as db:
        db.add(college)
        db.commit()
        db.refresh(college)
        return college


def _make_course(name: str, *, is_active: bool) -> Course:
    course = Course(
        name=name, slug=f"course-{uuid.uuid4().hex[:8]}", is_active=is_active
    )
    with SessionLocal() as db:
        db.add(course)
        db.commit()
        db.refresh(course)
        return course


def _make_exam(name: str, *, is_active: bool) -> Exam:
    exam = Exam(
        name=name,
        slug=f"exam-{uuid.uuid4().hex[:8]}",
        conducting_authority="Test Authority",
        exam_type="national",
        is_active=is_active,
    )
    with SessionLocal() as db:
        db.add(exam)
        db.commit()
        db.refresh(exam)
        return exam


def _make_scholarship(name: str, *, is_active: bool) -> Scholarship:
    scholarship = Scholarship(
        name=name,
        slug=f"scholarship-{uuid.uuid4().hex[:8]}",
        provider="Test Provider",
        is_active=is_active,
    )
    with SessionLocal() as db:
        db.add(scholarship)
        db.commit()
        db.refresh(scholarship)
        return scholarship


def _make_university(name: str, *, is_active: bool) -> University:
    university = University(
        name=name,
        slug=f"university-{uuid.uuid4().hex[:8]}",
        is_active=is_active,
    )
    with SessionLocal() as db:
        db.add(university)
        db.commit()
        db.refresh(university)
        return university


def _set_active(model, row_id: int, is_active: bool) -> None:
    with SessionLocal() as db:
        row = db.get(model, row_id)
        assert row is not None
        row.is_active = is_active
        db.commit()


def _delete(model, row_id: int) -> None:
    with SessionLocal() as db:
        row = db.get(model, row_id)
        if row is not None:
            db.delete(row)
            db.commit()


def _names(path: str, headers: dict[str, str] | None, **params) -> set[str]:
    """Every name across all pages.

    These handlers default to `limit=50` and order by name, so a freshly created
    row can sit on page 2 and a single-page read would report it as absent -- the
    test would then "pass" for the wrong reason, or fail on ordering alone.
    """
    found: set[str] = set()
    offset = 0
    while True:
        page = client.get(
            path,
            params={**params, "limit": 100, "offset": offset},
            headers=headers,
        )
        assert page.status_code == 200, page.text
        rows = page.json()
        found.update(row["name"] for row in rows)
        if len(rows) < 100:
            return found
        offset += 100


# --------------------------------------------------------------------------- #
# the gate: the flag must not widen anonymous access
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize("path", CATALOGUE_LISTS)
def test_include_inactive_is_403_without_a_content_role(path, student_headers):
    """These list routes are public, so an ungated flag would publish drafts.

    Mirrors `test_banners_include_inactive_requires_admin`; kept per-path because
    the flag was added to each handler separately and a future handler could
    simply forget the gate.
    """
    anon = client.get(path, params={"include_inactive": "true"})
    assert anon.status_code == 403, anon.text

    as_student = client.get(
        path, params={"include_inactive": "true"}, headers=student_headers
    )
    assert as_student.status_code == 403, as_student.text


@pytest.mark.parametrize("path", CATALOGUE_LISTS)
def test_include_inactive_is_allowed_for_an_admin(path, admin_headers):
    assert (
        client.get(
            path, params={"include_inactive": "true"}, headers=admin_headers
        ).status_code
        == 200
    )


@pytest.mark.parametrize("path", CATALOGUE_LISTS)
def test_the_public_default_still_works_with_no_token(path):
    """The flagless public read must be untouched by any of the above."""
    assert client.get(path).status_code == 200


# --------------------------------------------------------------------------- #
# the fix: a deactivated row is hidden publicly and visible to an admin
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize(
    "path,model,maker",
    [
        ("/api/v1/colleges", College, _make_college),
        ("/api/v1/courses", Course, _make_course),
        ("/api/v1/exams", Exam, _make_exam),
        ("/api/v1/scholarships", Scholarship, _make_scholarship),
        ("/api/v1/universities", University, _make_university),
    ],
)
def test_a_deactivated_row_leaves_the_public_list_and_stays_in_the_console(
    path, model, maker, admin_headers
):
    """The whole point, per resource.

    Without this, deactivating a row was irreversible from the panel: the record
    vanished from the table that manages it, and nothing could bring it back.
    """
    name = f"Hidden {uuid.uuid4().hex[:8]}"
    row = maker(name, is_active=True)
    try:
        assert name in _names(path, None), "precondition: active rows are public"

        _set_active(model, row.id, False)

        assert name not in _names(path, None), "a deactivated row is still public"
        assert name in _names(path, admin_headers, include_inactive="true"), (
            "a deactivated row is invisible to the console that has to manage it"
        )
    finally:
        _delete(model, row.id)


def test_an_admin_can_see_both_active_and_inactive_rows_together(admin_headers):
    """The console renders one table, so the flag has to return the union.

    Returning only the inactive rows would be just as broken as hiding them.
    """
    active_name = f"Live {uuid.uuid4().hex[:8]}"
    hidden_name = f"Dark {uuid.uuid4().hex[:8]}"
    active = _make_course(active_name, is_active=True)
    hidden = _make_course(hidden_name, is_active=False)
    try:
        listed = _names("/api/v1/courses", admin_headers, include_inactive="true")
        assert active_name in listed
        assert hidden_name in listed

        public = _names("/api/v1/courses", None)
        assert active_name in public
        assert hidden_name not in public
    finally:
        _delete(Course, active.id)
        _delete(Course, hidden.id)


@pytest.mark.xfail(
    strict=True,
    reason="Pre-existing, unrelated to include_inactive: `list_colleges` applies "
    "`.distinct()` on the `course_id` branch, and PostgreSQL cannot DISTINCT over "
    "`College.facilities` / `hostel_facilities`, which are `JSON` rather than "
    "`JSONB` and have no equality operator. So GET /colleges?course_id=N answers "
    "500 for everyone -- anonymous included, with no `include_inactive` -- and "
    "this branch cannot be observed until that is fixed. Verified against the "
    "running dev server. strict=True so the marker must be removed once it is.",
)
def test_a_deactivated_college_course_link_is_visible_to_an_admin(admin_headers):
    """`CollegeCourse` has its own `is_active`, filtered inside the `course_id`
    branch of `list_colleges`.

    Lifting only `College.is_active` would show an admin a college that appears to
    offer no courses whenever the *link* was deactivated rather than the college,
    which is a different mistake than the one being fixed.
    """
    college = _make_college(f"Link College {uuid.uuid4().hex[:8]}", is_active=True)
    course = _make_course(f"Link Course {uuid.uuid4().hex[:8]}", is_active=True)
    link_id = None
    try:
        with SessionLocal() as db:
            link = CollegeCourse(
                college_id=college.id, course_id=course.id, is_active=False
            )
            db.add(link)
            db.commit()
            db.refresh(link)
            link_id = link.id

        by_course = _names(
            "/api/v1/colleges",
            admin_headers,
            course_id=course.id,
            include_inactive="true",
        )
        assert college.name in by_course, (
            "the college is hidden because its course link is deactivated"
        )

        public = _names("/api/v1/colleges", None, course_id=course.id)
        assert college.name not in public
    finally:
        _delete(CollegeCourse, link_id)
        _delete(College, college.id)
        _delete(Course, course.id)
