"""The per-type ranking *read* endpoints, which used not to exist.

Every other enrichment resource — cutoffs, fees, placements, seat matrix,
admissions — serves `GET /api/v1/colleges/{college_ref}/<resource>` for its list
alongside the per-row writes. Rankings was the exception: it had the merged
`GET /{college_ref}/rankings` plus `POST`/`PUT`/`DELETE` under
`/{college_ref}/rankings/nirf` and `/{college_ref}/rankings/other`, and nothing
that would answer a GET.

The frontend's `getNirfRankings` / `getOtherRankings` reach for the per-type list
the same way they reach for the other five, so both got **405 Method Not
Allowed** — the path matched, the method did not. `serverGet` maps any non-2xx to
`null`, `serverGetAll` maps that to `[]`, and the college page rendered an empty
rankings section at HTTP 200. The only trace was one build-log line, which is
what finally surfaced it.

So the assertions here are about *the status code*, not just the rows: a 405 here
is the whole bug, and a test that only checked the merged endpoint would have
stayed green throughout.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.database import SessionLocal
from app.main import app
from app.models import NIRFRanking, OtherRanking

client = TestClient(app)

NIRF_PATH = "/api/v1/colleges/{ref}/rankings/nirf"
OTHER_PATH = "/api/v1/colleges/{ref}/rankings/other"


@pytest.fixture
def college():
    """An active college plus one row in each ranking table, removed afterwards."""
    from app.models import College

    slug = f"ranking-read-{uuid.uuid4().hex[:8]}"
    with SessionLocal() as db:
        row = College(
            college_id=f"R{uuid.uuid4().int % 1_000_000_000}",
            name="Ranking Read Fixture",
            slug=slug,
            college_type="university",
            ownership="private",
            is_active=True,
        )
        db.add(row)
        db.flush()
        db.add(NIRFRanking(college_id=row.id, category="Engineering", year=2026, rank=12))
        db.add(NIRFRanking(college_id=row.id, category="Overall", year=2025, rank=30))
        db.add(
            OtherRanking(
                college_id=row.id,
                ranking_body="India Today",
                category="Engineering",
                year=2026,
                rank=41,
            )
        )
        db.commit()
        db.refresh(row)
        yield slug

    # The enrichment tables are ON DELETE SET NULL (migration b4e8f2a71d09), so
    # deleting the college detaches these rows rather than taking them with it.
    # Leaving them behind would detach the college_id to NULL and eventually trip
    # the unique constraint on a later run.
    with SessionLocal() as db:
        college_id = db.scalar(select(College.id).where(College.slug == slug))
        db.execute(delete(NIRFRanking).where(NIRFRanking.college_id == college_id))
        db.execute(delete(OtherRanking).where(OtherRanking.college_id == college_id))
        row = db.get(College, college_id)
        if row:
            db.delete(row)
        db.commit()


def test_both_ranking_paths_accept_get():
    """The bug itself, asserted against the schema rather than through the app.

    Without this, the tests below would still pass if the two GETs were removed
    again and the 405 came back, because every other test in this file would be
    asserting on a 405 body.
    """
    paths = app.openapi()["paths"]
    assert "get" in paths[NIRF_PATH.format(ref="{college_ref}")], (
        "GET on the per-type NIRF list is missing; a client reaching for it gets "
        "405 from the POST route on the same path"
    )
    assert "get" in paths[OTHER_PATH.format(ref="{college_ref}")], (
        "GET on the per-type other-ranking list is missing; same 405 shape as NIRF"
    )


def test_get_nirf_list_is_not_405(college):
    res = client.get(NIRF_PATH.format(ref=college))
    assert res.status_code == 200, res.text
    assert res.status_code != 405


def test_get_other_list_is_not_405(college):
    res = client.get(OTHER_PATH.format(ref=college))
    assert res.status_code == 200, res.text
    assert res.status_code != 405


def test_each_list_returns_only_its_own_rows(college):
    """The merged endpoint proved the rows exist; these prove the split is real."""
    nirf = client.get(NIRF_PATH.format(ref=college)).json()
    other = client.get(OTHER_PATH.format(ref=college)).json()

    assert sorted(r["category"] for r in nirf) == ["Engineering", "Overall"]
    assert all("ranking_body" not in r for r in nirf)
    assert [r["ranking_body"] for r in other] == ["India Today"]


def test_the_two_lists_agree_with_the_merged_endpoint(college):
    """One college, one read of each table, one merged read — the same rows.

    Guards the split against drifting from `/{college_ref}/rankings`: a filter
    applied to only one of the three would show up here as a count difference.
    """
    merged = client.get(f"/api/v1/colleges/{college}/rankings").json()
    nirf = client.get(NIRF_PATH.format(ref=college)).json()
    other = client.get(OTHER_PATH.format(ref=college)).json()

    assert len(merged) == len(nirf) + len(other)


def test_nirf_list_is_newest_year_first_and_filterable(college):
    res = client.get(NIRF_PATH.format(ref=college))
    assert [r["year"] for r in res.json()] == [2026, 2025]

    one = client.get(NIRF_PATH.format(ref=college), params={"year": 2026})
    assert one.status_code == 200
    assert [r["category"] for r in one.json()] == ["Engineering"]

    by_category = client.get(
        NIRF_PATH.format(ref=college), params={"category": "Overall"}
    )
    assert [r["year"] for r in by_category.json()] == [2025]


def test_other_list_filters_by_body(college):
    res = client.get(
        OTHER_PATH.format(ref=college), params={"ranking_body": "India Today"}
    )
    assert res.status_code == 200
    assert len(res.json()) == 1

    miss = client.get(OTHER_PATH.format(ref=college), params={"ranking_body": "Nobody"})
    assert miss.status_code == 200
    assert miss.json() == []


def test_ranking_reads_need_no_auth(college):
    """A public page must not 401 for a rankings badge."""
    for path in (NIRF_PATH, OTHER_PATH):
        res = client.get(path.format(ref=college))
        assert res.status_code == 200, f"{path} returned {res.status_code}"


def test_an_inactive_college_is_404_on_the_split_reads(college):
    """Reads go through `_get_active_college`, writes through `_find_college_by_ref`.

    Worth pinning: the split endpoints are the ones the public page calls, and a
    retired college must not keep serving its rank table.
    """
    from app.models import College

    with SessionLocal() as db:
        row = db.scalar(select(College).where(College.slug == college))
        row.is_active = False
        db.commit()

    try:
        for path in (NIRF_PATH, OTHER_PATH):
            res = client.get(path.format(ref=college))
            assert res.status_code == 404, f"{path} returned {res.status_code}"
    finally:
        with SessionLocal() as db:
            row = db.scalar(select(College).where(College.slug == college))
            row.is_active = True
            db.commit()


def test_an_unknown_college_is_404(college):
    res = client.get(NIRF_PATH.format(ref="no-such-college"))
    assert res.status_code == 404
