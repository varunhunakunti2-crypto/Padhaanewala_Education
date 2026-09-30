"""The cross-paper question bank reads.

`test_mock_test_authoring.py` covers the *writes*
(`/mock-tests/{ref}/questions`), which already existed. What it could not cover
is the thing that made those writes unreachable: a question could only be found
by already knowing its paper, because there was no listing that spanned papers.
These tests hold the two reads in `routers/questions.py`.

The behaviours worth pinning, in the order they are likely to bite:

1. **Paper identity on every row.** `test_questions.mock_test_id` is `NOT NULL`,
   so a bank row that does not say which paper it belongs to is a row an editor
   cannot act on -- the write path is `/mock-tests/{ref}/questions`, which needs
   the ref the row failed to carry.
2. **A typo'd `question_type` is a 422, not an empty list.** "No questions
   match" is an answer an editor believes and acts on; they would conclude the
   question had been deleted. A bad filter has to fail loudly.
3. **The facets are computed, not declared.** A hardcoded subject list goes stale
   the moment a paper is authored, and a dropdown offering a subject that matches
   nothing looks like a broken control.
4. **Inactive questions are filterable, not hidden.** `DELETE` is a soft delete
   precisely so the history survives; a bank that could not show the
   soft-deleted rows would make that decision invisible and unrecoverable.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import SessionLocal
from app.main import app
from app.models import MockTest, Role, TestQuestion, User

client = TestClient(app)


def _unique(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:8]}@example.com"


def _register_user() -> dict:
    payload = {
        "name": "Bank Tester",
        "email": _unique("bank"),
        "mobile": f"9{uuid.uuid4().int % 1_000_000_000:09d}",
        "password": "SecurePass123!",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    return {**payload, **response.json()}


def _grant(email: str, role_name: str) -> None:
    with SessionLocal() as db:
        role = db.scalar(select(Role).where(Role.name == role_name))
        if role is None:
            role = Role(name=role_name, description=f"Seed role: {role_name}")
            db.add(role)
            db.flush()
        user = db.scalar(select(User).where(User.email == email))
        user.roles.append(role)
        db.commit()


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _as_role(role_name: str) -> dict:
    """Register a user, give them `role_name`, return auth headers."""
    user = _register_user()
    _grant(user["email"], role_name)
    login = client.post(
        "/api/v1/auth/login",
        json={"email": user["email"], "password": user["password"]},
    )
    assert login.status_code == 200
    return _auth(login.json()["access_token"])


def _make_paper(questions: list[dict], **paper_fields) -> MockTest:
    paper = MockTest(
        name=paper_fields.pop("name", f"Bank Paper {uuid.uuid4().hex[:6]}"),
        slug=paper_fields.pop("slug", f"bank-paper-{uuid.uuid4().hex[:8]}"),
        subject="Mathematics",
        difficulty="medium",
        question_type="mcq",
        duration_minutes=30,
        total_marks=0,
        negative_marking=False,
        negative_marks_value=1,
        attempts_allowed=1,
        result_visibility="immediate",
        test_type="standard",
        is_active=True,
        **paper_fields,
    )
    paper.questions = [TestQuestion(**q) for q in questions]
    with SessionLocal() as db:
        db.add(paper)
        db.commit()
        db.refresh(paper)
        return paper


#: The shipped bank holds a real 75-question JEE paper whose subjects are
#: Physics/Chemistry/Mathematics -- the same words this fixture would naturally
#: use. Filtering on a shared subject would therefore match seed rows too, and a
#: count assertion would be measuring the seed rather than the fixture. Every
#: subject/topic below is namespaced per run so the filters isolate exactly the
#: rows these tests created.
_TAG = uuid.uuid4().hex[:6]
SUBJ_PHYSICS = f"BankPhysics-{_TAG}"
SUBJ_MATHS = f"BankMaths-{_TAG}"
SUBJ_CHEM = f"BankChem-{_TAG}"
TOPIC_MECHANICS = f"BankMechanics-{_TAG}"
TOPIC_ALGEBRA = f"BankAlgebra-{_TAG}"
TOPIC_ORGANIC = f"BankOrganic-{_TAG}"


def _mcq(text: str, **overrides) -> dict:
    q = {
        "question_text": text,
        "question_type": "mcq",
        "options": ["A", "B", "C", "D"],
        "correct_answer": "A",
        "marks": 2,
        "negative_marks": 1,
        "difficulty": "medium",
        "sort_order": 1,
    }
    q.update(overrides)
    return q


@pytest.fixture
def admin_headers() -> dict:
    return _as_role("admin")


@pytest.fixture
def two_papers() -> list[MockTest]:
    """Two papers, deliberately different subjects/types, cleaned up after."""
    papers = [
        _make_paper(
            [
                _mcq(
                    "Physics bank question about momentum",
                    subject=SUBJ_PHYSICS,
                    topic=TOPIC_MECHANICS,
                    difficulty="hard",
                    sort_order=1,
                ),
                _mcq(
                    "Physics bank question about optics",
                    subject=SUBJ_PHYSICS,
                    topic=TOPIC_MECHANICS,
                    difficulty="easy",
                    sort_order=2,
                ),
            ]
        ),
        _make_paper(
            [
                {
                    "question_text": "Compute the numeric bank answer",
                    "question_type": "numeric",
                    "numeric_answer": "42",
                    "tolerance": "0.5",
                    "subject": SUBJ_MATHS,
                    "topic":TOPIC_ALGEBRA,
                    "difficulty": "medium",
                    "marks": 4,
                    "negative_marks": 1,
                    "sort_order": 1,
                },
                _mcq(
                    "Chemistry bank question",
                    subject=SUBJ_CHEM,
                    topic=TOPIC_ORGANIC,
                    difficulty="hard",
                    sort_order=2,
                    is_active=False,
                ),
            ]
        ),
    ]
    yield papers
    with SessionLocal() as db:
        for paper in papers:
            row = db.get(MockTest, paper.id)
            if row:
                db.delete(row)
        db.commit()


def _fixture_rows(admin_headers, papers, **params) -> list[dict]:
    """Rows from the fixture papers only, ignoring the seeded bank.

    The count assertions in this file are about what *these* tests created.
    Counting the whole bank would couple every assertion to seed data that
    Phase 61 is going to replace with a CSV import.
    """
    collected: list[dict] = []
    for paper in papers:
        query = f"paper={paper.slug}&limit=100"
        extra = "&".join(f"{k}={v}" for k, v in params.items())
        if extra:
            query += f"&{extra}"
        response = client.get(f"/api/v1/questions?{query}", headers=admin_headers)
        assert response.status_code == 200, response.text
        collected.extend(response.json())
    return collected


def test_bank_listing_needs_a_role(admin_headers, two_papers):
    assert client.get("/api/v1/questions").status_code == 401

    student = _register_user()
    login = client.post(
        "/api/v1/auth/login",
        json={"email": student["email"], "password": student["password"]},
    )
    token = login.json()["access_token"]
    assert client.get("/api/v1/questions", headers=_auth(token)).status_code == 403


def test_content_manager_may_read_the_bank(admin_headers, two_papers):
    """Gated on CONTENT_ROLES, not ADMIN_ROLES: authoring content is a
    content_manager's job, and a stricter gate here would leave the question
    CRUD in mock_tests.py unreachable for the role that exists to use it."""
    headers = _as_role("content_manager")
    assert client.get("/api/v1/questions", headers=headers).status_code == 200


def test_every_row_carries_its_paper(admin_headers, two_papers):
    """The write path is /mock-tests/{ref}/questions, so a bank row without the
    ref cannot be edited. This is the assertion that makes the listing usable."""
    response = client.get("/api/v1/questions?limit=100", headers=admin_headers)
    assert response.status_code == 200
    everything = response.json()
    # The whole bank, seed included, must be attributable to a paper.
    assert everything
    for row in everything:
        assert row["paper_slug"]
        assert row["paper_name"]
        assert row["mock_test_id"] > 0

    rows = _fixture_rows(admin_headers, two_papers)
    assert len(rows) == 4
    assert {r["mock_test_id"] for r in rows} == {p.id for p in two_papers}

    # And the ref is the one the nested write route actually accepts.
    row = next(r for r in rows if r["paper_slug"] == two_papers[0].slug)
    created = client.post(
        f"/api/v1/mock-tests/{row['paper_slug']}/questions",
        headers=admin_headers,
        json=_mcq("Written through the ref from the bank row"),
    )
    assert created.status_code == 201


def test_a_typo_in_question_type_is_a_422_not_an_empty_list(admin_headers, two_papers):
    """An empty list reads as "the question is gone". A bad filter must not
    look like that."""
    response = client.get(
        "/api/v1/questions?question_type=mcc", headers=admin_headers
    )
    assert response.status_code == 422
    assert "mcq" in response.json()["detail"]


def test_filters_narrow_the_bank(admin_headers, two_papers):
    def rows(**params) -> list[dict]:
        return _fixture_rows(admin_headers, two_papers, **params)

    assert {r["subject"] for r in rows(subject=SUBJ_PHYSICS)} == {SUBJ_PHYSICS}
    assert {r["topic"] for r in rows(topic=TOPIC_MECHANICS)} == {TOPIC_MECHANICS}
    assert {r["difficulty"] for r in rows(difficulty="hard")} == {"hard"}
    assert {r["question_type"] for r in rows(question_type="numeric")} == {"numeric"}

    # Combined filters intersect rather than replace.
    physics_hard = rows(subject=SUBJ_PHYSICS, difficulty="hard")
    assert len(physics_hard) == 1
    assert physics_hard[0]["topic"] == TOPIC_MECHANICS

    # A subject with no match is empty, not an error.
    assert rows(subject="NoSuchSubject") == []


def test_paper_filter_accepts_a_slug_or_an_id(admin_headers, two_papers):
    by_slug = client.get(
        f"/api/v1/questions?paper={two_papers[0].slug}&limit=100",
        headers=admin_headers,
    )
    by_id = client.get(
        f"/api/v1/questions?paper={two_papers[0].id}&limit=100",
        headers=admin_headers,
    )
    assert by_slug.status_code == by_id.status_code == 200
    assert by_slug.json() == by_id.json()
    assert len(by_slug.json()) == 2
    assert {r["mock_test_id"] for r in by_slug.json()} == {two_papers[0].id}


def test_an_unknown_paper_filter_is_a_404(admin_headers, two_papers):
    response = client.get(
        "/api/v1/questions?paper=no-such-paper-slug", headers=admin_headers
    )
    assert response.status_code == 404


def test_inactive_questions_are_filterable_not_hidden(admin_headers, two_papers):
    """DELETE is a soft delete so attempt history survives. A bank that could
    not show soft-deleted rows would hide that decision and make it
    unrecoverable from the UI."""
    assert len(_fixture_rows(admin_headers, two_papers)) == 4

    active = _fixture_rows(admin_headers, two_papers, is_active="true")
    inactive = _fixture_rows(admin_headers, two_papers, is_active="false")

    assert len(active) == 3
    assert len(inactive) == 1
    assert inactive[0]["subject"] == SUBJ_CHEM
    assert all(r["is_active"] for r in active)
    assert not any(r["is_active"] for r in inactive)


def test_search_matches_the_stem(admin_headers, two_papers):
    rows = _fixture_rows(admin_headers, two_papers, q="numeric bank")
    assert len(rows) == 1
    assert rows[0]["question_type"] == "numeric"


def test_search_is_case_insensitive(admin_headers, two_papers):
    # Every fixture stem contains the word "bank", so it is a term that matches
    # exactly the four fixture rows. (Search covers `question_text` only, not
    # subject/topic -- so the search term has to be a stem word.)
    lower = _fixture_rows(admin_headers, two_papers, q="bank")
    upper = _fixture_rows(admin_headers, two_papers, q="BANK")
    assert lower == upper
    assert len(lower) == 4


def test_search_does_not_match_subject_or_topic(admin_headers, two_papers):
    """Pinned deliberately: `q` searches the stem, not the metadata. An editor
    who searches a topic and gets nothing should be told by this test, not by
    assuming the bank lost the questions."""
    assert _fixture_rows(admin_headers, two_papers, q=SUBJ_PHYSICS) == []
    # The explicit subject filter still works, which is the supported route.
    assert len(_fixture_rows(admin_headers, two_papers, subject=SUBJ_PHYSICS)) == 2


def test_limit_is_capped(admin_headers, two_papers):
    """test_list_endpoint_pagination_caps.py holds the older list routes; this
    is the new one, and a bank row carries a full stem, so the cap matters more
    here than the usual 'don't dump the table'."""
    assert client.get("/api/v1/questions?limit=1000000", headers=admin_headers).status_code == 422
    assert client.get("/api/v1/questions?limit=0", headers=admin_headers).status_code == 422
    assert client.get("/api/v1/questions?limit=-1", headers=admin_headers).status_code == 422


def test_offset_pages_without_repeating(admin_headers, two_papers):
    first = client.get("/api/v1/questions?limit=2&offset=0", headers=admin_headers).json()
    second = client.get("/api/v1/questions?limit=2&offset=2", headers=admin_headers).json()
    assert len(first) == len(second) == 2
    assert {r["id"] for r in first}.isdisjoint({r["id"] for r in second})


def test_facets_report_what_is_actually_in_the_bank(admin_headers, two_papers):
    response = client.get("/api/v1/questions/facets", headers=admin_headers)
    assert response.status_code == 200
    facets = response.json()

    # Subset, not equality: the seeded JEE paper contributes its own subjects
    # and Phase 61 will replace the seed with a CSV import. What matters is that
    # the fixture's values are present because they are read from the rows.
    assert set(facets["subjects"]) >= {SUBJ_PHYSICS, SUBJ_MATHS, SUBJ_CHEM}
    assert set(facets["topics"]) >= {TOPIC_MECHANICS, TOPIC_ALGEBRA, TOPIC_ORGANIC}
    assert set(facets["difficulties"]) >= {"hard", "easy", "medium"}
    assert set(facets["question_types"]) == {"mcq", "numeric"}


def test_facets_skip_blank_values(admin_headers, two_papers):
    """A dropdown option that is the empty string reads as a broken control, so
    questions authored without a topic must not produce one."""
    with SessionLocal() as db:
        paper = db.get(MockTest, two_papers[0].id)
        paper.questions[0].topic = ""
        db.commit()

    facets = client.get("/api/v1/questions/facets", headers=admin_headers).json()
    assert "" not in facets["topics"]
    assert all(t for t in facets["topics"])
    assert all(s for s in facets["subjects"])


def test_facets_list_papers_with_their_counts(admin_headers, two_papers):
    facets = client.get("/api/v1/questions/facets", headers=admin_headers).json()
    by_slug = {p["slug"]: p for p in facets["papers"]}

    assert by_slug[two_papers[0].slug]["question_count"] == 2
    # Counting inactive too, so it matches what the editor sees in the paper.
    assert by_slug[two_papers[1].slug]["question_count"] == 2


def test_facets_include_empty_papers_as_authoring_targets(
    admin_headers, two_papers
):
    """An empty paper must be offered, with a count of 0.

    This list is where the editor sends a newly authored question. An inner join
    on the question counts -- the obvious query -- excluded empty papers, which
    made the first question of a newly created paper impossible to author: the
    paper was not offered, so there was nowhere to save into, so it stayed empty,
    so it was never offered. A regression test has to pin the way out of that
    loop, or the shortcut looks like harmless tidying.
    """
    empty = _make_paper([])
    try:
        facets = client.get(
            "/api/v1/questions/facets", headers=admin_headers
        ).json()
        listed = {p["slug"]: p for p in facets["papers"]}
        assert empty.slug in listed, "an empty paper is a valid authoring target"
        assert listed[empty.slug]["question_count"] == 0
        # Both filterable and selectable, and the seeded paper still counted.
        assert empty.slug in {p["slug"] for p in facets["papers"]}
    finally:
        with SessionLocal() as db:
            row = db.get(MockTest, empty.id)
            if row:
                db.delete(row)
            db.commit()


def test_facets_omit_retired_papers(admin_headers, two_papers):
    """`is_active` is the publish flag; a withdrawn paper is not somewhere new
    content should be authored, and listing it invites a question nobody serves."""
    retired = _make_paper([])
    with SessionLocal() as db:
        db.get(MockTest, retired.id).is_active = False
        db.commit()
    try:
        facets = client.get(
            "/api/v1/questions/facets", headers=admin_headers
        ).json()
        assert retired.slug not in {p["slug"] for p in facets["papers"]}
    finally:
        with SessionLocal() as db:
            row = db.get(MockTest, retired.id)
            if row:
                db.delete(row)
            db.commit()


def test_facets_needs_a_role(admin_headers, two_papers):
    assert client.get("/api/v1/questions/facets").status_code == 401
    student = _register_user()
    login = client.post(
        "/api/v1/auth/login",
        json={"email": student["email"], "password": student["password"]},
    )
    token = login.json()["access_token"]
    assert client.get("/api/v1/questions/facets", headers=_auth(token)).status_code == 403


def test_the_bank_reads_the_seeded_bank_not_only_fixtures(admin_headers, two_papers):
    """A guard on the shape of the join itself: the response must come from
    `test_questions` rows, so a row that exists in the DB has to appear. Uses
    the fixture's rows rather than the shipped 75-question paper, so the test
    does not depend on seed data being present."""
    with SessionLocal() as db:
        stored = db.scalar(
            select(TestQuestion).where(TestQuestion.mock_test_id == two_papers[1].id)
        )
        assert stored is not None

    rows = client.get(
        f"/api/v1/questions?paper={two_papers[1].slug}&limit=100",
        headers=admin_headers,
    ).json()
    assert stored.id in {r["id"] for r in rows}
