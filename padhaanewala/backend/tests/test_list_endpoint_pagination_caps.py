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

from contextlib import contextmanager
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import FAQ, Banner, BlogCategory, University
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
