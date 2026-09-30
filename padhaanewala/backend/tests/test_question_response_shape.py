"""Every endpoint that returns a question must return the same shared fields.

The router used to build six question response shapes by hand, each restating the
same ten fields. Adding a field to `TestQuestionResponse` therefore meant editing
six places, and the failure mode was silent rather than loud: a newly added
*optional* field falls back to its default at whichever sites nobody remembered,
so the endpoint simply omits it -- no exception, no trace, one payload quietly
missing a field the other five carry.

`_question_fields` now reads the shared set from the ORM row once. This file is
the other half of that fix, and it is deliberately *driven by the schemas*: it
enumerates `QuestionResponse.model_fields` rather than a hardcoded list, so
adding a field to any question schema makes this test start checking it
automatically and fail if a site stops reporting it.

It also pins the half of the contract that must differ between sites: the
mid-attempt shapes must not carry the answer key, while the result and admin
views must.
"""

import uuid
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import SessionLocal
from app.main import app
from app.models import MockTest, Role, TestQuestion, User
from app.schemas.catalog import (
    AdminQuestionResponse,
    ResultQuestionResponse,
)

# Aliased because the name starts with "Test", which pytest tries to collect as a
# test class. The models solve the same problem with `__test__ = False`; there is
# no reason for a schema in app code to carry a pytest concern.
from app.schemas.catalog import TestQuestionResponse as QuestionResponse

client = TestClient(app)

#: Serialised as JSON strings, so both sides are compared as Decimals.
_DECIMAL_FIELDS = frozenset(
    {"marks", "negative_marks", "numeric_answer", "tolerance", "marks_awarded"}
)


def _unique(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:8]}@example.com"


def _unique_mobile() -> str:
    return f"9{uuid.uuid4().int % 1_000_000_000:09d}"


def _register_user() -> dict:
    payload = {
        "name": "Shape Student",
        "email": _unique("shape"),
        "mobile": _unique_mobile(),
        "password": "SecurePass123!",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    return {**payload, **response.json()}


def _make_admin(email: str) -> None:
    with SessionLocal() as db:
        role = db.scalar(select(Role).where(Role.name == "admin"))
        if role is None:
            role = Role(name="admin", description="Seed role: admin")
            db.add(role)
            db.flush()
        user = db.scalar(select(User).where(User.email == email))
        user.roles.append(role)
        db.commit()


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_paper() -> MockTest:
    """One question with a distinctive value in every column it can carry.

    `option_randomization` is left off so `options` comes back in the canonical
    order and can be compared directly.
    """
    mock_test = MockTest(
        name=f"Shape Test {uuid.uuid4().hex[:6]}",
        slug=f"shape-test-{uuid.uuid4().hex[:8]}",
        subject="Paper Subject",
        difficulty="medium",
        question_type="mcq",
        duration_minutes=30,
        total_marks=0,
        negative_marking=True,
        negative_marks_value=1,
        attempts_allowed=2,
        result_visibility="immediate",
        test_type="standard",
        is_active=True,
    )
    mock_test.questions = [
        TestQuestion(
            question_text="Distinctive question text",
            question_type="mcq",
            options=["alpha", "beta", "gamma"],
            correct_answer="beta",
            subject="Question Subject",
            topic="Question Topic",
            marks=3,
            negative_marks=1,
            difficulty="hard",
            explanation="Distinctive explanation",
            sort_order=1,
        )
    ]
    with SessionLocal() as db:
        db.add(mock_test)
        db.commit()
        db.refresh(mock_test)
        return mock_test


def _cleanup(mock_test_id: int) -> None:
    with SessionLocal() as db:
        mock_test = db.get(MockTest, mock_test_id)
        if mock_test:
            db.delete(mock_test)
            db.commit()


def _expected(question_id: int) -> dict:
    with SessionLocal() as db:
        question = db.get(TestQuestion, question_id)
        return {
            "id": question.id,
            "question_text": question.question_text,
            "question_type": question.question_type,
            "options": question.options,
            "marks": question.marks,
            "negative_marks": question.negative_marks,
            "difficulty": question.difficulty,
            "sort_order": question.sort_order,
            "subject": question.subject,
            "topic": question.topic,
        }


def _same(field: str, got, want) -> bool:
    if field in _DECIMAL_FIELDS:
        return Decimal(str(got)) == Decimal(str(want))
    return got == want


def _assert_shared(name: str, payload: dict, expected: dict) -> None:
    """Every field the base shape declares must be present and correct."""
    for field in sorted(QuestionResponse.model_fields):
        assert field in payload, (
            f"{name} omits the shared field {field!r} -- a site is constructing "
            f"this question by hand instead of using _question_fields"
        )
        assert _same(field, payload[field], expected[field]), (
            f"{name} disagrees on {field!r}: got {payload[field]!r}, "
            f"source row has {expected[field]!r}"
        )


@pytest.fixture
def all_sites() -> dict:
    """Every question-shaped response this router can produce, keyed by site."""
    paper = _create_paper()
    try:
        student = _register_user()
        headers = _auth_headers(student["access_token"])

        question_id = client.get(
            f"/api/v1/mock-tests/{paper.slug}/questions"
        ).json()[0]["id"]

        admin = _register_user()
        _make_admin(admin["email"])
        admin_headers = _auth_headers(admin["access_token"])

        listed = client.get(f"/api/v1/mock-tests/{paper.slug}/questions")
        assert listed.status_code == 200, listed.text

        started = client.post(f"/api/v1/mock-tests/{paper.slug}/start", headers=headers)
        assert started.status_code == 200, started.text
        attempt_id = started.json()["attempt"]["id"]

        detail = client.get(
            f"/api/v1/mock-tests/{paper.slug}/attempts/{attempt_id}", headers=headers
        )
        assert detail.status_code == 200, detail.text

        saved = client.put(
            f"/api/v1/mock-tests/{paper.slug}/attempts/{attempt_id}"
            f"/answers/{question_id}",
            json={"selected_answer": "beta"},
            headers=headers,
        )
        assert saved.status_code == 200, saved.text

        client.post(
            f"/api/v1/mock-tests/{paper.slug}/attempts/{attempt_id}/submit",
            headers=headers,
        )
        result = client.get(
            f"/api/v1/mock-tests/{paper.slug}/attempts/{attempt_id}/result",
            headers=headers,
        )
        assert result.status_code == 200, result.text

        admin_detail = client.get(
            f"/api/v1/mock-tests/admin/all/{paper.slug}", headers=admin_headers
        )
        assert admin_detail.status_code == 200, admin_detail.text

        yield {
            "question_id": question_id,
            "paper": paper,
            "GET /questions": listed.json()[0],
            "POST /start": started.json()["questions"][0],
            "GET /attempts/{id}": detail.json()["questions"][0],
            "PUT /answers/{qid}": saved.json(),
            "GET /result": result.json()["questions"][0],
            "GET /admin/all/{ref}": admin_detail.json()["questions"][0],
        }
    finally:
        _cleanup(paper.id)


def test_every_site_reports_the_same_shared_fields(all_sites):
    expected = _expected(all_sites["question_id"])
    for name, payload in all_sites.items():
        if name in {"question_id", "paper"}:
            continue
        _assert_shared(name, payload, expected)


def test_the_guarded_shape_is_actually_being_checked(all_sites):
    """If `model_fields` ever stops enumerating, the test above would pass vacuously.

    Pin the field count so a schema change that empties the shared set is loud
    here rather than silently neutering the guard.
    """
    shared = set(QuestionResponse.model_fields)
    assert shared == {
        "id",
        "question_text",
        "question_type",
        "options",
        "marks",
        "negative_marks",
        "difficulty",
        "sort_order",
        "subject",
        "topic",
    }, f"the shared field set changed ({sorted(shared)}); update this test deliberately"


def test_mid_attempt_sites_do_not_leak_the_answer_key(all_sites):
    """Half the contract is that these four must stay key-free."""
    for name in (
        "GET /questions",
        "POST /start",
        "GET /attempts/{id}",
        "PUT /answers/{qid}",
    ):
        payload = all_sites[name]
        assert "correct_answer" not in payload, f"{name} leaked the answer key"
        assert "numeric_answer" not in payload, f"{name} leaked the numeric key"
        assert "tolerance" not in payload, f"{name} leaked the grading tolerance"
        assert "explanation" not in payload, f"{name} leaked the explanation"


def test_result_reports_the_grading_verbatim(all_sites):
    """A green tick with no reproducible key is the failure the tolerance field exists for."""
    payload = all_sites["GET /result"]
    for field in sorted(ResultQuestionResponse.model_fields):
        assert field in payload, f"GET /result omits {field!r}"
    assert payload["is_correct"] is True
    assert payload["correct_answer"] == "beta"
    assert Decimal(payload["marks_awarded"]) == 3
    assert payload["explanation"] == "Distinctive explanation"
    assert payload["selected_answer"] == "beta"


def test_admin_detail_reports_every_field_including_the_key(all_sites):
    payload = all_sites["GET /admin/all/{ref}"]
    for field in sorted(AdminQuestionResponse.model_fields):
        assert field in payload, f"GET /admin/all/{{ref}} omits {field!r}"
    assert payload["correct_answer"] == "beta"
    assert payload["explanation"] == "Distinctive explanation"
    assert payload["is_active"] is True
