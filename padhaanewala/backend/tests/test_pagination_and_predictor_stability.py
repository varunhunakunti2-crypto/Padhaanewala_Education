"""Regression tests for two of the P0 correctness bugs.

P0-2  `enrichment._paginated` called `query.order_by(None)`, throwing away the
      ordering each caller had just applied, so LIMIT/OFFSET pages were not
      repeatable. `GET /api/v1/rankings` additionally handed the same limit to
      each of its two sub-queries and could return twice the requested rows.

P0-4  `predictor` derived a confidence nudge from `hash(str(college_id))`.
      Python salts string hashing per process, so the nudge differed between
      uvicorn workers and across restarts, and because confidence is the
      secondary sort key the result ordering moved too.
"""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy import event, select

from app.database import SessionLocal, engine
from app.main import app
from app.models import NIRFRanking, OtherRanking, College, Cutoff
from app.routers.predictor import _stable_jitter

client = TestClient(app)


def _seeded_colleges(limit: int = 5) -> list[College]:
    with SessionLocal() as db:
        colleges = db.scalars(
            select(College).where(College.is_active).order_by(College.id).limit(limit)
        ).all()
        return [College(id=c.id, name=c.name, slug=c.slug) for c in colleges]


def _insert_cutoffs(rows: list[Cutoff]) -> list[int]:
    """Insert and return primary keys, so teardown never touches a detached
    instance after the session closes."""
    with SessionLocal() as db:
        db.add_all(rows)
        db.commit()
        for row in rows:
            db.refresh(row)
        return [row.id for row in rows]


def _delete_cutoffs(cutoff_ids: list[int]) -> None:
    with SessionLocal() as db:
        for cutoff_id in cutoff_ids:
            db.delete(db.get(Cutoff, cutoff_id))
        db.commit()


# --------------------------------------------------------------------------
# P0-2: ordering survives pagination
# --------------------------------------------------------------------------


def _make_cutoffs(college: College, years: list[int]) -> list[int]:
    return _insert_cutoffs(
        [
            Cutoff(
                college_id=college.id,
                exam_name="neet-ug",
                year=year,
                category="General",
                # Distinct per row. `uq_cutoff_identity_coalesce` covers quota, so
                # callers that pass the same year twice (to force a sort-key tie)
                # would otherwise collide. Quota is deliberately chosen because it
                # is in that constraint but NOT in the ORDER BY, so the tie these
                # tests are about survives.
                quota=f"q{position}",
                closing_rank=1000 * (10 - year % 10),
                opening_rank=100,
            )
            for position, year in enumerate(years)
        ]
    )


def test_catalog_cutoffs_are_returned_newest_year_first():
    """`_paginated` used to strip the caller's ORDER BY, leaving the sort to
    whatever order the planner happened to produce."""
    college = _seeded_colleges(1)[0]
    # Inserted oldest-first, so an unsorted scan is detectable.
    years = [2021, 2022, 2023, 2024, 2025]
    created = _make_cutoffs(college, years)
    try:
        response = client.get(
            "/api/v1/cutoffs",
            params={"college_id": college.id, "exam_name": "neet-ug"},
        )
        assert response.status_code == 200, response.text
        returned = [row["year"] for row in response.json() if row["year"] in years]
        assert returned == sorted(years, reverse=True)
    finally:
        _delete_cutoffs(created)


def test_catalog_cutoffs_paging_walks_every_row_exactly_once():
    """A behavioural contract for the tiebreaker: the pages must partition the
    set. Note this alone does not catch the original bug, because a sequential
    scan of six rows happens to be stable; `..._query_still_sorts` below is the
    assertion that actually pins the regression."""
    college = _seeded_colleges(1)[0]
    # Same year for every row, so the caller's ORDER BY cannot break the tie.
    years = [2024] * 6
    ids = sorted(_make_cutoffs(college, years))
    try:
        def page(offset: int) -> list[int]:
            response = client.get(
                "/api/v1/cutoffs",
                params={
                    "college_id": college.id,
                    "exam_name": "neet-ug",
                    "limit": 2,
                    "offset": offset,
                },
            )
            assert response.status_code == 200, response.text
            return [row["id"] for row in response.json()]

        walked = [row for offset in (0, 2, 4) for row in page(offset)]
        assert len(walked) == 6
        assert sorted(walked) == ids
    finally:
        _delete_cutoffs(ids)


def test_catalog_cutoffs_query_still_sorts():
    """Direct guard on the regression.

    `_paginated` used to call `query.order_by(None)`, which erases the ORDER BY
    the caller had just applied. Nothing in the response then guarantees an
    order, so LIMIT/OFFSET pages are not repeatable. Assert on the SQL that
    actually reaches the database: it must still sort, and the primary key must
    be the final tiebreaker, which is what makes equal-sort-key rows stable.
    """
    college = _seeded_colleges(1)[0]
    created = _make_cutoffs(college, [2024, 2023])
    captured: list[str] = []

    def record(conn, cursor, statement, parameters, context, executemany):
        if "FROM cutoffs" in statement:
            captured.append(" ".join(statement.split()))

    event.listen(engine, "before_cursor_execute", record)
    try:
        response = client.get(
            "/api/v1/cutoffs",
            params={
                "college_id": college.id,
                "exam_name": "neet-ug",
                "limit": 1,
                "offset": 0,
            },
        )
        assert response.status_code == 200, response.text
    finally:
        event.remove(engine, "before_cursor_execute", record)
        _delete_cutoffs(created)

    paged = [s for s in captured if "LIMIT" in s]
    assert paged, f"no limited cutoffs query was captured: {captured}"
    for statement in paged:
        assert "ORDER BY" in statement, f"paged query lost its ORDER BY: {statement}"
        # The caller's sort keys, then the primary key as a unique tiebreaker:
        # "ORDER BY cutoffs.year DESC, cutoffs.exam_name, cutoffs.category,
        #  cutoffs.id LIMIT ...".
        order_by = statement.split("ORDER BY", 1)[1]
        keys = [k.strip() for k in order_by.split(" LIMIT ", 1)[0].split(",")]
        assert keys[0] == "cutoffs.year DESC", f"caller ordering lost: {statement}"
        assert keys[-1] == "cutoffs.id", f"no primary-key tiebreaker: {statement}"


# --------------------------------------------------------------------------
# P0-2: /rankings applies one window across both ranking tables
# --------------------------------------------------------------------------


def _make_rankings(
    college: College, nirf_years: list[int], other_years: list[int]
) -> list[NIRFRanking | OtherRanking]:
    rows: list[NIRFRanking | OtherRanking] = [
        NIRFRanking(
            college_id=college.id, category="University", year=year, rank=10 + i, score=90.0
        )
        for i, year in enumerate(nirf_years)
    ] + [
        OtherRanking(
            college_id=college.id,
            ranking_body="State University",
            category="State",
            year=year,
            rank=20 + i,
        )
        for i, year in enumerate(other_years)
    ]
    with SessionLocal() as db:
        db.add_all(rows)
        db.commit()
        for row in rows:
            db.refresh(row)
        return rows


def _delete_rankings(rows: list[NIRFRanking | OtherRanking]) -> None:
    with SessionLocal() as db:
        for row in rows:
            db.delete(db.get(type(row), row.id))
        db.commit()


def test_catalog_rankings_limit_is_applied_once_not_once_per_table():
    """The endpoint merged two tables but passed `limit` to each query, so
    `?limit=1` could return 2 rows."""
    college = _seeded_colleges(1)[0]
    created = _make_rankings(college, [2023, 2024], [2022, 2025])
    try:
        response = client.get(
            "/api/v1/rankings", params={"college_id": college.id, "limit": 1}
        )
        assert response.status_code == 200, response.text
        assert len(response.json()) == 1

        for limit in (1, 2, 3):
            page = client.get(
                "/api/v1/rankings", params={"college_id": college.id, "limit": limit}
            ).json()
            assert len(page) == limit, f"limit={limit} returned {len(page)} rows"
    finally:
        _delete_rankings(created)


def test_catalog_rankings_offset_walks_the_merged_set_without_repeats():
    college = _seeded_colleges(1)[0]
    created = _make_rankings(college, [2023, 2024], [2022, 2025])
    try:
        everything = client.get(
            "/api/v1/rankings", params={"college_id": college.id}
        ).json()
        assert len(everything) == 4
        expected = [(r["ranking_type"], r["id"]) for r in everything]

        paged = []
        for offset in range(4):
            page = client.get(
                "/api/v1/rankings",
                params={"college_id": college.id, "limit": 1, "offset": offset},
            ).json()
            assert len(page) == 1, f"offset={offset} returned {len(page)} rows"
            paged.append((page[0]["ranking_type"], page[0]["id"]))

        assert paged == expected
        assert len(set(paged)) == 4
    finally:
        _delete_rankings(created)


def test_catalog_rankings_ranking_type_filter_still_limits():
    college = _seeded_colleges(1)[0]
    created = _make_rankings(college, [2023, 2024], [2022, 2025])
    try:
        response = client.get(
            "/api/v1/rankings",
            params={"college_id": college.id, "ranking_type": "nirf", "limit": 1},
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["ranking_type"] == "nirf"
    finally:
        _delete_rankings(created)


# --------------------------------------------------------------------------
# P0-4: the confidence nudge must not depend on the process
# --------------------------------------------------------------------------


def test_stable_jitter_is_a_pinned_content_hash():
    """Golden values. If anyone swaps this back for `hash()`, the per-process salt
    makes these fail on all but one unlucky interpreter run."""
    assert _stable_jitter(1) == 2105799639
    assert _stable_jitter(7) == 3113635717
    assert _stable_jitter(42) == 2360033542
    assert _stable_jitter(1000) == 1035629273


def test_stable_jitter_does_not_depend_on_the_builtin_hash():
    """The old expression is per-process randomised; over enough samples it cannot
    coincide with a content hash, so this fails fast if the old code returns."""
    collisions = sum(
        1 for cid in range(500) if _stable_jitter(cid) == hash(str(cid))
    )
    assert collisions < 5, (
        f"{collisions}/500 collisions with hash() suggests _stable_jitter is "
        "still delegating to the randomised builtin"
    )


def test_predictor_confidence_is_identical_across_identical_requests():
    colleges = _seeded_colleges(3)
    if len(colleges) < 2:
        return
    created_ids = _insert_cutoffs(
        [
            Cutoff(
                college_id=college.id,
                exam_name="neet-ug",
                year=2024,
                category="General",
                closing_rank=50000,
                opening_rank=1000,
            )
            for college in colleges
        ]
    )
    payload = {"exam": "neet-ug", "category": "General", "rank": 40000}
    try:
        runs = []
        for _ in range(3):
            response = client.post("/api/v1/predictor", json=payload)
            assert response.status_code == 200, response.text
            body = response.json()
            runs.append(
                [
                    (r["college"]["id"], r["bucket"], r["confidence"])
                    for r in body["results"]
                ]
            )
        assert runs[0], "expected at least one predicted college"
        assert runs[0] == runs[1] == runs[2]
    finally:
        _delete_cutoffs(created_ids)


def test_predictor_confidence_matches_the_pinned_jitter():
    """Ties the score the endpoint returns back to `_stable_jitter`, so the two
    cannot drift apart silently."""
    colleges = _seeded_colleges(2)
    if len(colleges) < 2:
        return
    college = colleges[0]
    created_ids = _insert_cutoffs(
        [
            Cutoff(
                college_id=college.id,
                exam_name="neet-ug",
                year=2024,
                category="General",
                closing_rank=50000,
                opening_rank=1000,
            )
        ]
    )
    try:
        response = client.post(
            "/api/v1/predictor",
            json={"exam": "neet-ug", "category": "General", "rank": 40000},
        )
        assert response.status_code == 200, response.text
        result = next(
            r for r in response.json()["results"] if r["college"]["id"] == college.id
        )
        # rank 40000 against a 50000 cutoff is ratio 0.8, the `highly-suitable`
        # branch, which starts from 90 before the per-college nudge is applied.
        base = 90
        nudge = round((_stable_jitter(college.id) % 11 - 5) * 1.5)
        assert result["confidence"] == max(4, min(97, base + nudge))
    finally:
        _delete_cutoffs(created_ids)
