"""Phase 1.6 follow-through: every list endpoint must cap `limit`.

Phase 1.6 added `Query(..., le=...)` to eight `limit` parameters, which closed
`?limit=1000000` returning the whole table. It could only close the parameters it
found, and four list routes had **no `limit` parameter at all** — so
`/universities`, `/faqs`, `/banners` and `/blog-categories` ignored the parameter
completely and returned every row. The fix that motivated Phase 1.6 was still
reachable on four of the routes.

They were also the four routes that broke the frontend's paged walk. `lib/
api-server.ts` pages with `?limit=&offset=` and stops when a page comes back
short. An endpoint that ignores `offset` returns the same full list on every
request, so the walk appends it repeatedly until it hits its own 5000-row
ceiling. On `/universities` that is 155 universities duplicated about 32 times
across 33 sequential round trips. It was latent only because `getUniversities()`
has no caller yet — which is not the same as correct.

The banner case is the subtle one. Visibility was evaluated in Python *after* the
whole table was loaded, so it could not be moved behind `LIMIT`/`OFFSET` without
changing which rows a page contained. `_visibility_predicate` is the SQL form of
`_is_visible`; the last test in this file holds the two to each other.
"""

import uuid
from contextlib import contextmanager
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import (
    FAQ,
    Banner,
    BlogCategory,
    College,
    Cutoff,
    Role,
    StudentProfile,
    University,
    User,
)
from app.routers.banners import _is_visible, _visibility_predicate

client = TestClient(app)

#: Every route that used to accept any `limit` — and in fact ignored it.
CAPPED_ROUTES = [
    "/api/v1/universities",
    "/api/v1/faqs",
    "/api/v1/banners",
    "/api/v1/blog-categories",
]


@contextmanager
def _isolated(model, rows):
    """Swap a table's contents for `rows`, then put the originals back.

    These tests must commit their fixtures, because the endpoints under test read
    through their own session and would not see uncommitted rows. A committed
    `DELETE` cannot be rolled back, so a test that clears a table and re-inserts
    only its own fixtures leaves the shared seeded catalog empty for whatever
    runs next — which is how `test_catalog.py::test_list_universities` ended up
    asserting against zero rows depending on collection order.

    Snapshot and restore is the only version of this that is order-independent.
    """
    with SessionLocal() as db:
        snapshot = [
            {col.name: getattr(row, col.name) for col in model.__table__.columns}
            for row in db.query(model).all()
        ]
        db.query(model).delete()
        db.add_all(rows)
        db.commit()
    try:
        yield
    finally:
        with SessionLocal() as db:
            db.query(model).delete()
            db.commit()
            if snapshot:
                db.execute(model.__table__.insert(), snapshot)
                db.commit()


@pytest.mark.parametrize("path", CAPPED_ROUTES)
def test_absurd_limit_is_rejected(path):
    """The Phase 1.6 abuse case, on the four routes it missed."""
    response = client.get(f"{path}?limit=1000000")
    assert response.status_code == 422, (
        f"{path} accepted limit=1000000 — this route has no upper bound, so it "
        "returns the whole table whatever the caller asks for"
    )


@pytest.mark.parametrize("path", CAPPED_ROUTES)
@pytest.mark.parametrize("value", ["0", "-5", "abc"])
def test_malformed_limit_is_rejected(path, value):
    assert client.get(f"{path}?limit={value}").status_code == 422


@pytest.mark.parametrize("path", CAPPED_ROUTES)
def test_limit_above_the_declared_cap_is_rejected(path):
    # The exact bound is read from the route signature rather than hardcoded, so
    # this test keeps meaning something if someone tightens or loosens a cap.
    bound = _declared_bound(path)
    assert bound is not None, f"could not read a limit bound for {path}"
    assert client.get(f"{path}?limit={bound}").status_code == 200
    assert client.get(f"{path}?limit={bound + 1}").status_code == 422


def _declared_bound(path: str) -> int | None:
    import inspect

    from app.routers import banners as banners_mod
    from app.routers import blogs as blogs_mod
    from app.routers import faqs as faqs_mod
    from app.routers import universities as universities_mod

    handler = {
        "/api/v1/universities": universities_mod.list_universities,
        "/api/v1/faqs": faqs_mod.list_faqs,
        "/api/v1/banners": banners_mod.list_banners,
        "/api/v1/blog-categories": blogs_mod.list_categories,
    }[path]

    param = inspect.signature(handler).parameters["limit"]
    default = param.default
    # Pydantic v2 does not expose `le` on the Query object itself. The bound
    # arrives as an `annotated_types.Le` entry inside `.metadata`, so
    # `hasattr(default, "le")` is False for *every* route, capped or not, and an
    # assertion written that way fails unconditionally instead of testing
    # anything.
    caps = [m.le for m in getattr(default, "metadata", ()) if hasattr(m, "le")]
    assert caps, f"{path} limit has no le= bound"
    return caps[0]


def test_universities_paginates_rather_than_returning_one_page():
    """`offset` must actually move, or the frontend walk duplicates forever."""
    with _isolated(
        University,
        [
            University(
                name=f"Paging University {i:03d}",
                slug=f"paging-university-{i:03d}",
                is_active=True,
            )
            for i in range(7)
        ],
    ):
        first = client.get("/api/v1/universities?limit=3&offset=0")
        assert first.status_code == 200
        assert len(first.json()) == 3

        second = client.get("/api/v1/universities?limit=3&offset=3")
        assert second.status_code == 200
        assert len(second.json()) == 3

        ids = {row["id"] for row in first.json()} | {row["id"] for row in second.json()}
        assert len(ids) == 6, "pages 1 and 2 overlap — offset is not being honoured"

        last = client.get("/api/v1/universities?limit=3&offset=6")
        assert len(last.json()) == 1, "the walk must terminate on a short final page"


def test_faqs_offset_does_not_overlap():
    with _isolated(
        FAQ,
        [
            FAQ(
                question=f"Paging question {i:02d}",
                answer="answer",
                entity_type="college",
                entity_id=1,
                is_active=True,
            )
            for i in range(5)
        ],
    ):
        page1 = client.get("/api/v1/faqs?entity_type=college&entity_id=1&limit=2&offset=0")
        page2 = client.get("/api/v1/faqs?entity_type=college&entity_id=1&limit=2&offset=2")
        assert len(page1.json()) == 2
        assert len(page2.json()) == 2
        assert {f["id"] for f in page1.json()}.isdisjoint({f["id"] for f in page2.json()})


def test_banner_limit_is_applied_after_the_date_filter():
    """Pagination must not resurrect rows the visibility rule excludes.

    A regression here is silent: `limit` is applied in SQL *before* the date
    window in the previous implementation, so a page could come back short or
    contain a banner that should not be live.
    """
    today = date.today()
    with _isolated(
        Banner,
        [
            Banner(
                title="live no window",
                image_url="/x.png",
                position="home_top",
                is_active=True,
                display_order=i,
            )
            for i in range(4)
        ]
        + [
            Banner(
                title="live with window",
                image_url="/x.png",
                position="home_top",
                is_active=True,
                display_order=10,
                start_date=today - timedelta(days=1),
                end_date=today + timedelta(days=1),
            ),
            Banner(
                title="expired",
                image_url="/x.png",
                position="home_top",
                is_active=True,
                display_order=11,
                start_date=today - timedelta(days=10),
                end_date=today - timedelta(days=1),
            ),
            Banner(
                title="not yet started",
                image_url="/x.png",
                position="home_top",
                is_active=True,
                display_order=12,
                start_date=today + timedelta(days=1),
                end_date=today + timedelta(days=10),
            ),
            Banner(
                title="inactive",
                image_url="/x.png",
                position="home_top",
                is_active=False,
                display_order=13,
            ),
        ],
    ):
        titles: set[str] = set()
        offset = 0
        while True:
            page = client.get(f"/api/v1/banners?limit=2&offset={offset}")
            assert page.status_code == 200
            rows = page.json()
            if not rows:
                break
            titles.update(r["title"] for r in rows)
            if len(rows) < 2:
                break
            offset += len(rows)

        assert "expired" not in titles
        assert "not yet started" not in titles
        assert "inactive" not in titles
        assert titles == {"live no window", "live with window"}, (
            f"unexpected titles: {titles}"
        )


def test_blog_categories_paginate():
    with _isolated(
        BlogCategory,
        [BlogCategory(name=f"Cat {i:02d}", slug=f"cat-{i:02d}", is_active=True) for i in range(4)],
    ):
        page1 = client.get("/api/v1/blog-categories?limit=2&offset=0")
        page2 = client.get("/api/v1/blog-categories?limit=2&offset=2")
        assert len(page1.json()) == 2
        assert {c["id"] for c in page1.json()}.isdisjoint({c["id"] for c in page2.json()})
        assert len(client.get("/api/v1/blog-categories?limit=2&offset=4").json()) == 0


# ---------------------------------------------------------------------------
# `offset` bounds — the sibling defect Phase 1.6 left behind.
#
# Phase 1.6 above bounded `limit` on these handlers but left `offset` declared
# as a bare `int = 0`. A bare int accepts negatives, and `-1` reaches Postgres
# as `OFFSET -1`, which psycopg rejects with
# `errors.InvalidRowCountInResultOffsetClause` — a 500, not a 422. On the public
# catalogue routes that is an unauthenticated 500 one request away from any
# crawler, scanner or idle `?page=` link. The bound is read off the signatures
# rather than hardcoded so it keeps meaning something if a default changes.
# ---------------------------------------------------------------------------

#: Public list routes: no token needed, so the 500 was reachable by anyone.
PUBLIC_OFFSET_ROUTES = [
    "/api/v1/colleges",
    "/api/v1/courses",
    "/api/v1/exams",
    "/api/v1/scholarships",
    "/api/v1/blogs",
]


@pytest.mark.parametrize("path", PUBLIC_OFFSET_ROUTES)
def test_negative_offset_is_rejected_not_500(path):
    response = client.get(f"{path}?limit=10&offset=-1")
    assert response.status_code == 422, (
        f"{path} answered {response.status_code} to offset=-1; a bare `int = 0` "
        "hands the negative straight to Postgres and the OFFSET clause raises"
    )


def _offset_ge(handler) -> int | None:
    """Read the `ge` bound off a handler's `offset` parameter, if any."""

    import inspect

    param = inspect.signature(handler).parameters.get("offset")
    assert param is not None, f"{handler.__qualname__} has no offset parameter"
    bounds = [
        m.ge for m in getattr(param.default, "metadata", ()) if hasattr(m, "ge")
    ]
    return bounds[0] if bounds else None


def test_every_list_route_bounds_its_offset():
    """Every handler that takes an `offset` must declare `ge=0`.

    Signature-level, so it needs no database and cannot be defeated by a handler
    whose table happens to be empty.
    """

    from app.routers import (  # noqa: PLC0415
        audit,
        blogs,
        college_submissions,
        colleges,
        courses,
        exams,
        media,
        mock_tests,
        scholarships,
    )

    handlers = [
        colleges.list_colleges,
        courses.list_courses,
        exams.list_exams,
        scholarships.list_scholarships,
        blogs.list_blogs,
        media.list_media,
        audit.list_audit_logs,
        college_submissions.list_submissions,
        mock_tests.list_mock_tests,
        mock_tests.admin_list_mock_tests,
        mock_tests.admin_list_attempts_for_review,
    ]

    for handler in handlers:
        assert _offset_ge(handler) == 0, (
            f"{handler.__module__}.{handler.__qualname__} declares offset without "
            "`Query(0, ge=0)`; ?offset=-1 would 500 instead of 422"
        )


def test_sql_visibility_predicate_agrees_with_the_python_one():
    """Two implementations of one rule is a defect, so they are held together.

    `_is_visible` was the original; `_visibility_predicate` was added so the rule
    could run inside a `WHERE` clause. If they ever diverge, the list endpoint
    and the detail endpoint will disagree about whether a banner is live, and
    the detail endpoint's check is the one the reader will trust.
    """
    today = date.today()
    cases = [
        (None, None),
        (today, None),
        (None, today),
        (today, today),
        (today - timedelta(days=1), today + timedelta(days=1)),
        (today - timedelta(days=10), today - timedelta(days=1)),
        (today + timedelta(days=1), today + timedelta(days=10)),
        (today - timedelta(days=5), today - timedelta(days=2)),
    ]

    with SessionLocal() as db:
        db.query(Banner).delete()
        banners = [
            Banner(
                title=f"case {i}",
                image_url="/x.png",
                is_active=True,
                start_date=start,
                end_date=end,
            )
            for i, (start, end) in enumerate(cases)
        ]
        db.add_all(banners)
        db.commit()
        db.refresh(banners[0])

        sql_visible = {
            b.id
            for b in db.query(Banner)
            .filter(_visibility_predicate(today))
            .all()
        }
        # Both sides of the comparison have to be read while the session is still
        # open. The `with` block closes it on exit, after which the ORM instances
        # are detached and any attribute read raises DetachedInstanceError.
        db_ids = {b.id for b in banners}
        python_visible = {b.id for b in banners if _is_visible(b)}
        db.commit()

    assert len(db_ids) == len(cases)
    assert sql_visible == python_visible, (
        "the SQL and Python visibility rules disagree; see the per-case detail"
    )
    # Sanity: the fixture must actually exercise both outcomes, or the equality
    # above is trivially true.
    assert python_visible != db_ids, "no case was filtered out — fixture is degenerate"
    assert python_visible, "every case was filtered out — fixture is degenerate"

    with SessionLocal() as db:
        db.query(Banner).delete()
        db.commit()


# ---------------------------------------------------------------------------
# M3: the remaining list endpoints share one bounded policy.
#
# The Phase 1.6 work above closed four public catalogue routes, but the
# enrichment/catalog-data routes and the authenticated account lists still either
# had no bound or hand-rolled their own cap. A caller could ask an enrichment
# route for the entire table, and every new hand-rolled `Query(50, le=200)` was a
# fresh place for the policy to drift. `app/utils/pagination.py` now owns the
# contract: default 100, hard cap 500, non-negative offset, enforced in the
# FastAPI signature so it appears in OpenAPI.
# ---------------------------------------------------------------------------

PUBLIC_SHARED_LIMIT_HANDLERS = [
    "list_cutoffs",
    "list_fees",
    "list_placements",
    "list_rankings",
    "list_nirf_rankings",
    "list_other_rankings",
    "list_seat_matrix",
    "list_admissions",
    "catalog_cutoffs",
    "catalog_fees",
    "catalog_placements",
    "catalog_rankings",
    "catalog_seat_matrix",
    "catalog_admissions",
]

AUTH_SHARED_LIMIT_HANDLERS = [
    "list_saved_colleges",
    "list_my_consents",
    "list_my_requests",
    "list_all_requests",
    "list_notifications",
    "list_notification_sends",
    "my_notifications",
]


def _shared_limit_handlers():
    """Resolve handler objects by name so this file need not import every router."""
    from app.routers import (
        compliance as compliance_mod,
        consent as consent_mod,
        enrichment as enrichment_mod,
        notifications as notifications_mod,
        saved_colleges as saved_colleges_mod,
    )

    modules = (
        enrichment_mod,
        saved_colleges_mod,
        consent_mod,
        compliance_mod,
        notifications_mod,
    )
    handlers = {}
    for module in modules:
        for name in PUBLIC_SHARED_LIMIT_HANDLERS + AUTH_SHARED_LIMIT_HANDLERS:
            handler = getattr(module, name, None)
            if handler is not None:
                handlers[name] = handler
    missing = set(PUBLIC_SHARED_LIMIT_HANDLERS + AUTH_SHARED_LIMIT_HANDLERS) - handlers.keys()
    assert not missing, f"shared-limit handlers not found: {sorted(missing)}"
    return handlers


SHARED_LIMIT_HANDLERS = _shared_limit_handlers()


def _declared_int_bounds(param):
    """Read default/le/ge from a FastAPI `Query` parameter, Pydantic v2 style.

    `Query` does not expose `.le` directly in Pydantic v2; the bound lives in
    `.metadata` as an `annotated_types.Le` instance. Reading it through the
    signature keeps this a contract test rather than a response-shape test that
    happens to pass when the table is empty.
    """
    default, ge, le = getattr(param.default, "default", None), [], []
    for marker in getattr(param.default, "metadata", ()):
        if hasattr(marker, "ge"):
            ge.append(marker.ge)
        if hasattr(marker, "le"):
            le.append(marker.le)
    return default, ge, le


@pytest.mark.parametrize(
    "name",
    PUBLIC_SHARED_LIMIT_HANDLERS + AUTH_SHARED_LIMIT_HANDLERS,
)
def test_shared_list_limit_defaults_to_100_and_caps_at_500(name):
    """Every selected list handler must use the shared 100/500 contract."""
    import inspect

    params = inspect.signature(SHARED_LIMIT_HANDLERS[name]).parameters
    default, ge, le = _declared_int_bounds(params["limit"])
    assert default == 100, f"{name}: default limit is {default}, expected 100"
    assert ge == [1], f"{name}: limit must be >= 1, got {ge}"
    assert le == [500], f"{name}: limit must be <= 500, got {le}"

    offset_default, offset_ge, _ = _declared_int_bounds(params["offset"])
    assert offset_default == 0, f"{name}: default offset is {offset_default}"
    assert offset_ge == [0], f"{name}: offset must be >= 0, got {offset_ge}"


PUBLIC_SHARED_LIMIT_ROUTES = [
    "/api/v1/cutoffs",
    "/api/v1/fees",
    "/api/v1/placements",
    "/api/v1/rankings",
    "/api/v1/seat-matrix",
    "/api/v1/admissions",
]


@pytest.mark.parametrize("path", PUBLIC_SHARED_LIMIT_ROUTES)
def test_public_enrichment_routes_accept_500_and_refuse_501(path):
    assert client.get(path).status_code == 200
    assert client.get(path, params={"limit": 500}).status_code == 200

    over_cap = client.get(path, params={"limit": 501})
    assert over_cap.status_code == 422, f"{path} accepted limit=501: {over_cap.text}"

    negative_offset = client.get(path, params={"offset": -1})
    assert negative_offset.status_code == 422, (
        f"{path} accepted offset=-1: {negative_offset.text}"
    )


def test_colleges_route_keeps_its_50_default_but_uses_the_shared_cap():
    """`?limit=200` is a valid page request, not an abuse attempt.

    `test_catalog.py` walks up to 200 colleges to find one with courses. The
    hand-rolled Phase 1.6 cap of 100 turned that into a 422, and the caller then
    tried to iterate over the error object. The shared helper keeps the existing
    default of 50 while moving the ceiling to the policy's 500.
    """
    import inspect

    from app.routers import colleges as colleges_mod

    params = inspect.signature(colleges_mod.list_colleges).parameters
    default, ge, le = _declared_int_bounds(params["limit"])
    assert default == 50
    assert ge == [1]
    assert le == [500]
    assert client.get("/api/v1/colleges?limit=200").status_code == 200
    assert client.get("/api/v1/colleges?limit=500").status_code == 200
    assert client.get("/api/v1/colleges?limit=501").status_code == 422


def _active_college():
    with SessionLocal() as db:
        college = (
            db.query(College)
            .filter(College.is_active.is_(True))
            .order_by(College.id)
            .first()
        )
        assert college is not None, "seed data must contain an active college"
        return college.id, college.slug


def test_college_scoped_enrichment_route_uses_the_shared_cap():
    """The prefix-routed enrichment lists must be bounded too, not just catalog."""
    _, slug = _active_college()
    url = f"/api/v1/colleges/{slug}/cutoffs"
    assert client.get(url, params={"limit": 500}).status_code == 200
    assert client.get(url, params={"limit": 501}).status_code == 422


def test_public_enrichment_offset_walks_pages_without_overlap():
    college_id, _ = _active_college()
    exam = f"pagination-cap-{uuid.uuid4().hex[:8]}"
    rows = [
        Cutoff(
            college_id=college_id,
            exam_name=exam,
            year=2030,
            category="General",
            # Distinct quota values keep the functional unique index happy while
            # leaving the caller's ORDER BY tied, which is where paging breaks.
            quota=f"q{i}",
            opening_rank=i + 1,
            closing_rank=100 + i,
        )
        for i in range(5)
    ]

    with _isolated(Cutoff, rows):
        pages = []
        for offset in (0, 2, 4):
            response = client.get(
                "/api/v1/cutoffs",
                params={
                    "college_id": college_id,
                    "exam_name": exam,
                    "limit": 2,
                    "offset": offset,
                },
            )
            assert response.status_code == 200, response.text
            pages.append(response.json())

        assert [len(page) for page in pages] == [2, 2, 1]
        id_sets = [{row["id"] for row in page} for page in pages]
        for i, first in enumerate(id_sets):
            for second in id_sets[i + 1 :]:
                assert first.isdisjoint(second), "enrichment pages overlap"
        assert len(set().union(*id_sets)) == 5, "the walk missed or duplicated a row"


@pytest.fixture
def authenticated_headers_with_admin_role():
    """One fresh account with the profile and role the account lists need.

    A fresh user keeps the consent paging test from seeing rows left behind by
    another test; the admin role unlocks the staff queue and notification log.
    """
    email = f"pagination.{uuid.uuid4().hex[:8]}@example.com"
    password = "SecurePass123!"
    registered = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Pagination Tester",
            "email": email,
            "mobile": f"9{uuid.uuid4().int % 1_000_000_000:09d}",
            "password": password,
            "age_band": "18_plus",
        },
    )
    assert registered.status_code == 201, registered.text

    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).one()
        if not db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first():
            db.add(StudentProfile(user_id=user.id, target_exam="jee-main"))
        admin = db.query(Role).filter(Role.name == "admin").one()
        if admin not in user.roles:
            user.roles.append(admin)
        db.commit()

    login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


AUTH_SHARED_LIMIT_ROUTES = [
    "/api/v1/saved-colleges",
    "/api/v1/consent",
    "/api/v1/compliance/requests",
    "/api/v1/compliance/admin/requests",
    "/api/v1/notifications",
    "/api/v1/notifications/sends",
    "/api/v1/notifications/my",
]


@pytest.mark.parametrize("path", AUTH_SHARED_LIMIT_ROUTES)
def test_authenticated_lists_accept_500_and_refuse_501(
    path, authenticated_headers_with_admin_role
):
    headers = authenticated_headers_with_admin_role
    assert client.get(path, headers=headers).status_code == 200
    assert client.get(path, params={"limit": 500}, headers=headers).status_code == 200

    over_cap = client.get(path, params={"limit": 501}, headers=headers)
    assert over_cap.status_code == 422, f"{path} accepted limit=501: {over_cap.text}"


def test_authenticated_list_offset_does_not_overlap(
    authenticated_headers_with_admin_role,
):
    headers = authenticated_headers_with_admin_role
    created_ids = []
    for i in range(3):
        response = client.post(
            "/api/v1/consent",
            json={
                "consent_type": "marketing",
                "consent_version": "v1",
                "consent_text": f"pagination consent {i}",
                "granted": True,
            },
            headers=headers,
        )
        assert response.status_code == 201, response.text
        created_ids.append(response.json()["id"])

    pages = [
        client.get(
            "/api/v1/consent", params={"limit": 1, "offset": offset}, headers=headers
        )
        for offset in range(3)
    ]
    assert [page.status_code for page in pages] == [200, 200, 200]
    walked = [page.json()[0]["id"] for page in pages]
    assert all(len(page.json()) == 1 for page in pages)
    assert sorted(walked) == sorted(created_ids), "consent pages overlap or skip rows"
