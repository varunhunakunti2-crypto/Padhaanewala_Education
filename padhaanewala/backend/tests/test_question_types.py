"""`question_type` is a closed vocabulary, not free text.

Covers the enum added in `app/question_types.py` and the CHECK constraints
added in revision `d5f2a8c71e63`.

The bug this closes: the autograder branches on exact string equality. A value
it did not recognise -- `"Numerical"`, `"MCQ"` -- matched neither the numeric nor
the MCQ branch, so `_is_answer_correct` returned `None`, which `_grade_attempt`
treats as *ungradable*. A typo therefore did not raise; it silently withheld
the student's marks and counted the question as unanswered.

`test_questions` is the table that actually needed the DB constraint: it has no
create endpoint and no seed script, so rows arrive by hand or via an ad-hoc
script, and no Pydantic layer sits in that path to catch anything.
"""

import os
import re
import uuid
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.main import app
from app.models import MockTest, Role, TestQuestion, User
from app.question_types import (
    ALL_QUESTION_TYPES,
    AUTO_GRADED_QUESTION_TYPES,
    QuestionType,
    is_known,
)
from app.schemas.catalog import MockTestCreate, MockTestUpdate

client = TestClient(app)
TEST_SCHEMA = os.environ["PADHAANEWALA_SCHEMA"]

BACKEND_ROOT = Path(__file__).resolve().parent.parent
MIGRATION = (
    BACKEND_ROOT
    / "alembic"
    / "versions"
    / "d5f2a8c71e63_constrain_question_type.py"
)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #


def _unique(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:8]}@example.com"


def _register_user() -> dict:
    payload = {
        "name": "Test Student",
        "email": _unique("student"),
        "mobile": f"9{uuid.uuid4().int % 1_000_000_000:09d}",
        "password": "SecurePass123!",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    return {**payload, **response.json()}


def _promote_to_admin(email: str) -> None:
    with SessionLocal() as db:
        role = db.scalar(select(Role).where(Role.name == "admin"))
        if role is None:
            role = Role(name="admin", description="Seed role: admin")
            db.add(role)
            db.flush()
        user = db.scalar(select(User).where(User.email == email))
        user.roles.append(role)
        db.commit()


def _create_paper(**overrides) -> MockTest:
    fields = {
        "name": f"Type Test {uuid.uuid4().hex[:6]}",
        "slug": f"type-test-{uuid.uuid4().hex[:8]}",
        "difficulty": "medium",
        "question_type": QuestionType.MCQ.value,
        "duration_minutes": 30,
        "total_marks": 0,
        "negative_marking": False,
        "negative_marks_value": 0,
        "attempts_allowed": 3,
        "result_visibility": "immediate",
        "test_type": "standard",
        "is_active": True,
    }
    fields.update(overrides)
    with SessionLocal() as db:
        mock_test = MockTest(**fields)
        db.add(mock_test)
        db.commit()
        db.refresh(mock_test)
        return mock_test


def _question_ids(paper: MockTest) -> dict[str, int]:
    with SessionLocal() as db:
        return {
            q.question_text: q.id
            for q in db.query(TestQuestion)
            .filter(TestQuestion.mock_test_id == paper.id)
            .all()
        }


def _submit(paper: MockTest, answers: list[dict]) -> dict:
    """Submit in one shot, the way `test_question_subject_numeric.py` does."""
    user = _register_user()
    response = client.post(
        f"/api/v1/mock-tests/{paper.slug}/submit",
        json={"answers": answers},
        headers={"Authorization": f"Bearer {user['access_token']}"},
    )
    assert response.status_code == 200, response.text
    return response.json()


# --------------------------------------------------------------------------- #
# The enum itself
# --------------------------------------------------------------------------- #


def test_every_question_type_is_lowercase():
    """A mixed-case value would fail the CHECK, so the rule is not cosmetic."""
    for value in ALL_QUESTION_TYPES:
        assert value == value.lower(), f"{value!r} is not lowercase"
        assert " " not in value, f"{value!r} contains whitespace"


def test_is_known_accepts_the_enum_and_nothing_else():
    assert is_known("mcq")
    assert is_known("numeric")
    assert is_known("essay")
    # The exact values that used to slip through as typos.
    assert not is_known("numerical")
    assert not is_known("MCQ")
    assert not is_known("Numeric")
    assert not is_known("")


def test_only_mcq_and_numeric_are_auto_graded():
    """`essay` must stay outside the auto-graded set.

    That is what keeps manual review reachable: an essay is scored `None`
    rather than being silently marked wrong.
    """
    assert AUTO_GRADED_QUESTION_TYPES == {"mcq", "numeric"}
    assert QuestionType.ESSAY.value not in AUTO_GRADED_QUESTION_TYPES


# --------------------------------------------------------------------------- #
# Drift guards -- the enum, the migration and the DB must not diverge
# --------------------------------------------------------------------------- #


def test_migration_allowed_list_matches_the_enum():
    """The migration hardcodes its values on purpose; keep them in step.

    It cannot import the enum (a revision must reproduce the schema it wrote),
    so this assertion is what stops the two from drifting apart silently.
    """
    source = MIGRATION.read_text(encoding="utf-8")
    match = re.search(
        r"ALLOWED_QUESTION_TYPES[^=]*=\s*\(([^)]*)\)", source, re.DOTALL
    )
    assert match, "could not find ALLOWED_QUESTION_TYPES in the migration"
    declared = tuple(re.findall(r'"([^"]+)"', match.group(1)))
    assert declared == ALL_QUESTION_TYPES


@pytest.mark.parametrize("table", ["mock_tests", "test_questions"])
def test_db_constraint_matches_the_enum(table: str):
    """The live CHECK must accept exactly the canonical set."""
    with SessionLocal() as db:
        definitions = dict(
            db.execute(
                text(
                    """
                    SELECT conname, pg_get_constraintdef(oid)
                      FROM pg_constraint
                     WHERE conrelid = to_regclass(:table)
                       AND contype = 'c'
                       AND conname = :name
                    """
                ),
                {"table": f"{TEST_SCHEMA}.{table}", "name": f"ck_{table}_question_type"},
            ).all()
        )
    assert definitions, f"no CHECK constraint on {table}.question_type"

    accepted = set(re.findall(r"'([^']+)'::character varying", definitions[f"ck_{table}_question_type"]))
    assert accepted == set(ALL_QUESTION_TYPES)


def test_router_does_not_use_inline_question_type_literals():
    """Grading must branch on the enum, so a rename cannot half-apply.

    This is the same technique `test_rbac_rules.py` uses for roles.
    """
    source = (BACKEND_ROOT / "app" / "routers" / "mock_tests.py").read_text(
        encoding="utf-8"
    )
    literals = set(
        re.findall(r'question_type\s*(?:==|!=)\s*"([^"]+)"', source)
    )
    assert not literals, f"inline question_type literals in the router: {literals}"


# --------------------------------------------------------------------------- #
# The write path -- Pydantic
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize("bad", ["numerical", "MCQ", "Numeric", "mcq ", ""])
def test_mock_test_create_rejects_an_unknown_type(bad: str):
    with pytest.raises(Exception) as excinfo:
        MockTestCreate(name="Some Paper", question_type=bad)
    assert "question_type" in str(excinfo.value)


@pytest.mark.parametrize("good", ["mcq", "numeric", "essay"])
def test_mock_test_create_accepts_every_canonical_type(good: str):
    assert MockTestCreate(name="Some Paper", question_type=good).question_type == good


def test_mock_test_update_rejects_an_unknown_type():
    with pytest.raises(Exception) as excinfo:
        MockTestUpdate(question_type="numerical")
    assert "question_type" in str(excinfo.value)


def test_mock_test_update_still_allows_omitting_the_field():
    """PATCH semantics: absent must stay absent, not become a default."""
    assert MockTestUpdate().question_type is None


def test_api_rejects_an_unknown_type_with_422():
    user = _register_user()
    _promote_to_admin(user["email"])
    response = client.post(
        "/api/v1/mock-tests",
        headers={"Authorization": f"Bearer {user['access_token']}"},
        json={"name": f"Bad Type {uuid.uuid4().hex[:6]}", "question_type": "numerical"},
    )
    assert response.status_code == 422, response.text
    assert "question_type" in response.text


# --------------------------------------------------------------------------- #
# The hand-written path -- the DB constraint
# --------------------------------------------------------------------------- #


@pytest.mark.parametrize("bad", ["numerical", "MCQ", "fill in the blank"])
def test_db_rejects_an_unknown_type_on_a_question(bad: str):
    """The only guard on this path: questions are inserted without Pydantic."""
    paper = _create_paper()
    try:
        with SessionLocal() as db:
            db.add(
                TestQuestion(
                    mock_test_id=paper.id,
                    question_text="Typed by hand",
                    question_type=bad,
                    options=["A", "B"],
                    correct_answer="A",
                )
            )
            with pytest.raises(IntegrityError):
                db.commit()
            db.rollback()
    finally:
        with SessionLocal() as db:
            db.delete(db.get(MockTest, paper.id))
            db.commit()


@pytest.mark.parametrize("good", ["mcq", "numeric", "essay"])
def test_db_accepts_every_canonical_type_on_a_question(good: str):
    paper = _create_paper()
    try:
        with SessionLocal() as db:
            db.add(
                TestQuestion(
                    mock_test_id=paper.id,
                    question_text=f"A {good} question",
                    question_type=good,
                    options=["A", "B"],
                    correct_answer="A",
                )
            )
            db.commit()
    finally:
        with SessionLocal() as db:
            db.delete(db.get(MockTest, paper.id))
            db.commit()


# --------------------------------------------------------------------------- #
# Behaviour preserved by the enum swap
# --------------------------------------------------------------------------- #


def test_mcq_still_grades_by_exact_match():
    paper = _create_paper()
    try:
        with SessionLocal() as db:
            db.add(
                TestQuestion(
                    mock_test_id=paper.id,
                    question_text="Pick A.",
                    question_type=QuestionType.MCQ.value,
                    options=["A", "B"],
                    correct_answer="A",
                    marks=2,
                    sort_order=1,
                )
            )
            db.commit()

        ids = _question_ids(paper)
        result = _submit(paper, [{"question_id": ids["Pick A."], "selected_answer": "A"}])
        assert result["attempt"]["correct_count"] == 1
        assert result["questions"][0]["is_correct"] is True
        assert float(result["attempt"]["score"]) == 2.0
    finally:
        with SessionLocal() as db:
            db.delete(db.get(MockTest, paper.id))
            db.commit()


def test_numeric_still_grades_within_tolerance():
    """Guards the literal -> enum swap in `_is_answer_correct`."""
    paper = _create_paper()
    try:
        with SessionLocal() as db:
            db.add(
                TestQuestion(
                    mock_test_id=paper.id,
                    question_text="Round this.",
                    question_type=QuestionType.NUMERIC.value,
                    numeric_answer=Decimal("1.4142"),
                    tolerance=Decimal("0.005"),
                    marks=4,
                    sort_order=1,
                )
            )
            db.commit()

        ids = _question_ids(paper)
        result = _submit(
            paper, [{"question_id": ids["Round this."], "selected_answer": "1.41"}]
        )
        assert result["attempt"]["correct_count"] == 1
        assert result["questions"][0]["is_correct"] is True
        assert float(result["attempt"]["score"]) == 4.0
    finally:
        with SessionLocal() as db:
            db.delete(db.get(MockTest, paper.id))
            db.commit()


def test_essay_is_routed_to_manual_review():
    """The escape hatch: no verdict, no marks, counted as unanswered.

    This is the behaviour an unrecognised value used to produce by accident.
    Making it an explicit type is the point of adding it.
    """
    paper = _create_paper()
    try:
        with SessionLocal() as db:
            db.add(
                TestQuestion(
                    mock_test_id=paper.id,
                    question_text="Explain the derivation.",
                    question_type=QuestionType.ESSAY.value,
                    marks=4,
                    sort_order=1,
                )
            )
            db.commit()

        ids = _question_ids(paper)
        result = _submit(
            paper,
            [{"question_id": ids["Explain the derivation."], "selected_answer": "Because..."}],
        )
        assert result["questions"][0]["is_correct"] is None
        assert result["questions"][0]["marks_awarded"] is None
        assert result["attempt"]["correct_count"] == 0
        assert result["attempt"]["incorrect_count"] == 0
        # The student answered it, so it is not unattempted. It is awaiting manual
        # marking, which is its own tally.
        assert result["attempt"]["unanswered_count"] == 0
        assert result["attempt"]["pending_review_count"] == 1
        assert float(result["attempt"]["score"]) == 0.0
    finally:
        with SessionLocal() as db:
            db.delete(db.get(MockTest, paper.id))
            db.commit()
