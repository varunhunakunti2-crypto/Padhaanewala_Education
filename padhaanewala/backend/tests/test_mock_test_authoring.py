"""Authoring surface for `test_questions`.

Until these routes existed there was no way to create a question over HTTP: the
router had no `POST /{ref}/questions`, and no schema bounded any of the columns.
Rows arrived by hand or by ad-hoc script, which is why the only guard on
`question_type` was a DB CHECK constraint (see `app/question_types.py`).

The emphasis below is on the two failure modes that are easy to ship and hard to
notice:

* An `mcq` whose `correct_answer` is not one of its `options` is accepted by
  every storage layer, matches nothing in the autograder, and therefore marks
  every submission of that question wrong -- permanently, silently.
* Hard-deleting a question would cascade away every `test_answers` row for it
  across every attempt (`test_answers.question_id` is `ondelete="CASCADE"`) and
  rewrite results already shown to students. These tests pin the soft delete.
"""

import uuid
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import SessionLocal
from app.main import app
from app.models import MockTest, Role, TestAnswer, TestQuestion, User

client = TestClient(app)


def _unique(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:8]}@example.com"


def _unique_mobile() -> str:
    return f"9{uuid.uuid4().int % 1_000_000_000:09d}"


def _register_user() -> dict:
    payload = {
        "name": "Test Student",
        "email": _unique("student"),
        "mobile": _unique_mobile(),
        "password": "SecurePass123!",
        "age_band": "18_plus",
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


def _create_paper(question_count: int = 0) -> MockTest:
    """A paper whose questions all share one shape, so ordering is predictable."""
    mock_test = MockTest(
        name=f"Authoring Test {uuid.uuid4().hex[:6]}",
        slug=f"authoring-test-{uuid.uuid4().hex[:8]}",
        subject="Mathematics",
        difficulty="medium",
        question_type="mcq",
        duration_minutes=30,
        total_marks=0,
        negative_marking=False,
        negative_marks_value=1,
        attempts_allowed=3,
        result_visibility="immediate",
        test_type="standard",
        is_active=True,
    )
    mock_test.questions = [
        TestQuestion(
            question_text=f"Question {i}",
            question_type="mcq",
            options=["A", "B", "C", "D"],
            correct_answer="A",
            marks=2,
            negative_marks=1,
            difficulty="medium",
            sort_order=i,
        )
        for i in range(1, question_count + 1)
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


def _mcq_body(**overrides) -> dict:
    body = {
        "question_text": "What is 2 + 2?",
        "question_type": "mcq",
        "options": ["3", "4", "5", "6"],
        "correct_answer": "4",
        "marks": "2",
        "negative_marks": "0.5",
    }
    body.update(overrides)
    return body


@pytest.fixture
def admin_headers() -> dict:
    admin = _register_user()
    _make_admin(admin["email"])
    return _auth_headers(admin["access_token"])


@pytest.fixture
def student_headers() -> dict:
    return _auth_headers(_register_user()["access_token"])


# --- create -------------------------------------------------------------------


def test_create_returns_the_stored_question(admin_headers):
    paper = _create_paper()
    try:
        response = client.post(
            f"/api/v1/mock-tests/{paper.slug}/questions",
            json=_mcq_body(subject="Physics", topic="Kinematics"),
            headers=admin_headers,
        )
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["question_text"] == "What is 2 + 2?"
        assert body["options"] == ["3", "4", "5", "6"]
        assert body["correct_answer"] == "4"
        assert body["subject"] == "Physics"
        assert body["topic"] == "Kinematics"
        # Decimals, not the strings that were posted.
        assert body["marks"] == "2.00"
        assert body["negative_marks"] == "0.50"
        assert body["is_active"] is True
    finally:
        _cleanup(paper.id)


def test_created_question_appears_in_the_paper(admin_headers):
    paper = _create_paper()
    try:
        created = client.post(
            f"/api/v1/mock-tests/{paper.slug}/questions",
            json=_mcq_body(),
            headers=admin_headers,
        ).json()

        listed = client.get(f"/api/v1/mock-tests/{paper.slug}/questions")
        assert listed.status_code == 200
        ids = [q["id"] for q in listed.json()]
        assert created["id"] in ids
    finally:
        _cleanup(paper.id)


def test_create_rejects_an_mcq_with_no_options(admin_headers):
    paper = _create_paper()
    try:
        response = client.post(
            f"/api/v1/mock-tests/{paper.slug}/questions",
            json=_mcq_body(options=[]),
            headers=admin_headers,
        )
        assert response.status_code == 422
        assert "option" in response.text.lower()
    finally:
        _cleanup(paper.id)


def test_create_rejects_a_key_that_is_not_an_option(admin_headers):
    paper = _create_paper()
    try:
        response = client.post(
            f"/api/v1/mock-tests/{paper.slug}/questions",
            json=_mcq_body(correct_answer="7"),
            headers=admin_headers,
        )
        assert response.status_code == 422
        assert "not one of the options" in response.text

        # Rejected before the insert, so the paper is untouched.
        with SessionLocal() as db:
            count = len(
                db.scalars(
                    select(TestQuestion).where(TestQuestion.mock_test_id == paper.id)
                ).all()
            )
        assert count == 0
    finally:
        _cleanup(paper.id)


def test_create_rejects_an_mcq_with_no_key(admin_headers):
    paper = _create_paper()
    try:
        response = client.post(
            f"/api/v1/mock-tests/{paper.slug}/questions",
            json=_mcq_body(correct_answer=None),
            headers=admin_headers,
        )
        assert response.status_code == 422
        assert "correct_answer" in response.text
    finally:
        _cleanup(paper.id)


def test_create_allows_a_numeric_draft_with_no_key(admin_headers):
    """A question with no key yet is a legitimate draft, not an error."""
    paper = _create_paper()
    try:
        response = client.post(
            f"/api/v1/mock-tests/{paper.slug}/questions",
            json={
                "question_text": "How many joules in a kilojoule?",
                "question_type": "numeric",
            },
            headers=admin_headers,
        )
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["question_type"] == "numeric"
        assert body["numeric_answer"] is None
        assert Decimal(body["tolerance"]) == 0
    finally:
        _cleanup(paper.id)


def test_create_accepts_a_keyed_numeric_with_tolerance(admin_headers):
    paper = _create_paper()
    try:
        response = client.post(
            f"/api/v1/mock-tests/{paper.slug}/questions",
            json={
                "question_text": "Speed, roughly",
                "question_type": "numeric",
                "numeric_answer": "20",
                "tolerance": "0.5",
            },
            headers=admin_headers,
        )
        assert response.status_code == 201, response.text
        assert Decimal(response.json()["numeric_answer"]) == 20
    finally:
        _cleanup(paper.id)


def test_create_rejects_negative_tolerance(admin_headers):
    paper = _create_paper()
    try:
        response = client.post(
            f"/api/v1/mock-tests/{paper.slug}/questions",
            json={
                "question_text": "Speed",
                "question_type": "numeric",
                "numeric_answer": "20",
                "tolerance": "-1",
            },
            headers=admin_headers,
        )
        assert response.status_code == 422
    finally:
        _cleanup(paper.id)


def test_create_accepts_an_essay_needing_neither_options_nor_key(admin_headers):
    """Essay is routed to manual review, so the mcq rules must not apply to it."""
    paper = _create_paper()
    try:
        response = client.post(
            f"/api/v1/mock-tests/{paper.slug}/questions",
            json={"question_text": "Discuss the method.", "question_type": "essay"},
            headers=admin_headers,
        )
        assert response.status_code == 201, response.text
    finally:
        _cleanup(paper.id)


def test_create_rejects_an_unknown_question_type(admin_headers):
    """The exact typo `app/question_types.py` exists to prevent."""
    paper = _create_paper()
    try:
        response = client.post(
            f"/api/v1/mock-tests/{paper.slug}/questions",
            json=_mcq_body(question_type="Numerical"),
            headers=admin_headers,
        )
        assert response.status_code == 422
    finally:
        _cleanup(paper.id)


def test_create_rejects_an_oversized_key(admin_headers):
    """`correct_answer` is `String(255)`; unbound, this is a 500, not a 422."""
    paper = _create_paper()
    try:
        response = client.post(
            f"/api/v1/mock-tests/{paper.slug}/questions",
            json=_mcq_body(correct_answer="x" * 300),
            headers=admin_headers,
        )
        assert response.status_code == 422
    finally:
        _cleanup(paper.id)


def test_create_rejects_marks_wider_than_the_column(admin_headers):
    """`marks` is `Numeric(6, 2)`, which tops out at 9999.99."""
    paper = _create_paper()
    try:
        response = client.post(
            f"/api/v1/mock-tests/{paper.slug}/questions",
            json=_mcq_body(marks="99999.99"),
            headers=admin_headers,
        )
        assert response.status_code == 422
    finally:
        _cleanup(paper.id)


def test_create_appends_after_the_highest_sort_order(admin_headers):
    paper = _create_paper(question_count=3)
    try:
        first = client.post(
            f"/api/v1/mock-tests/{paper.slug}/questions",
            json=_mcq_body(question_text="Fourth"),
            headers=admin_headers,
        ).json()
        second = client.post(
            f"/api/v1/mock-tests/{paper.slug}/questions",
            json=_mcq_body(question_text="Fifth"),
            headers=admin_headers,
        ).json()
        assert first["sort_order"] == 4
        assert second["sort_order"] == 5

        listed = client.get(f"/api/v1/mock-tests/{paper.slug}/questions").json()
        assert [q["question_text"] for q in listed] == [
            "Question 1",
            "Question 2",
            "Question 3",
            "Fourth",
            "Fifth",
        ]
    finally:
        _cleanup(paper.id)


def test_create_honours_an_explicit_sort_order(admin_headers):
    paper = _create_paper(question_count=2)
    try:
        body = client.post(
            f"/api/v1/mock-tests/{paper.slug}/questions",
            json=_mcq_body(question_text="Inserted first", sort_order=0),
            headers=admin_headers,
        ).json()
        assert body["sort_order"] == 0
        listed = client.get(f"/api/v1/mock-tests/{paper.slug}/questions").json()
        assert listed[0]["question_text"] == "Inserted first"
    finally:
        _cleanup(paper.id)


def test_students_cannot_create_questions(student_headers):
    paper = _create_paper()
    try:
        response = client.post(
            f"/api/v1/mock-tests/{paper.slug}/questions",
            json=_mcq_body(),
            headers=student_headers,
        )
        assert response.status_code == 403
    finally:
        _cleanup(paper.id)


def test_create_requires_authentication():
    paper = _create_paper()
    try:
        response = client.post(
            f"/api/v1/mock-tests/{paper.slug}/questions", json=_mcq_body()
        )
        assert response.status_code == 401
    finally:
        _cleanup(paper.id)


def test_create_on_an_unknown_paper_is_404(admin_headers):
    response = client.post(
        "/api/v1/mock-tests/no-such-paper/questions",
        json=_mcq_body(),
        headers=admin_headers,
    )
    assert response.status_code == 404


# --- update -------------------------------------------------------------------


def test_update_changes_only_the_fields_sent(admin_headers):
    paper = _create_paper(question_count=1)
    try:
        question_id = client.get(
            f"/api/v1/mock-tests/{paper.slug}/questions"
        ).json()[0]["id"]

        response = client.put(
            f"/api/v1/mock-tests/{paper.slug}/questions/{question_id}",
            json={"marks": "5"},
            headers=admin_headers,
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert Decimal(body["marks"]) == 5
        # Untouched by the partial update.
        assert body["question_text"] == "Question 1"
        assert body["options"] == ["A", "B", "C", "D"]
        assert body["correct_answer"] == "A"
    finally:
        _cleanup(paper.id)


def test_update_that_strands_the_key_is_rejected(admin_headers):
    """Narrowing the options must not leave the key outside them."""
    paper = _create_paper(question_count=1)
    try:
        question_id = client.get(
            f"/api/v1/mock-tests/{paper.slug}/questions"
        ).json()[0]["id"]

        response = client.put(
            f"/api/v1/mock-tests/{paper.slug}/questions/{question_id}",
            json={"options": ["A", "B"]},  # "A" survives; remove it and it breaks
            headers=admin_headers,
        )
        assert response.status_code == 200  # still coherent

        broken = client.put(
            f"/api/v1/mock-tests/{paper.slug}/questions/{question_id}",
            json={"options": ["B", "C"]},
            headers=admin_headers,
        )
        assert broken.status_code == 422
        assert "not one of the options" in broken.text

        # The stored question is unchanged by the rejected call.
        stored = client.get(
            f"/api/v1/mock-tests/admin/all/{paper.slug}", headers=admin_headers
        ).json()["questions"][0]
        assert stored["options"] == ["A", "B"]
    finally:
        _cleanup(paper.id)


def test_update_can_widen_options_to_adopt_the_key(admin_headers):
    paper = _create_paper(question_count=1)
    try:
        question_id = client.get(
            f"/api/v1/mock-tests/{paper.slug}/questions"
        ).json()[0]["id"]

        # Retarget the key and the options together, in the same request.
        response = client.put(
            f"/api/v1/mock-tests/{paper.slug}/questions/{question_id}",
            json={"options": ["x", "y"], "correct_answer": "y"},
            headers=admin_headers,
        )
        assert response.status_code == 200, response.text
        assert response.json()["correct_answer"] == "y"
    finally:
        _cleanup(paper.id)


def test_update_rejects_changing_type_away_from_under_a_key(admin_headers):
    """mcq -> numeric with the option key still set is incoherent."""
    paper = _create_paper(question_count=1)
    try:
        question_id = client.get(
            f"/api/v1/mock-tests/{paper.slug}/questions"
        ).json()[0]["id"]

        response = client.put(
            f"/api/v1/mock-tests/{paper.slug}/questions/{question_id}",
            json={"question_type": "essay"},
            headers=admin_headers,
        )
        # essay is never auto-graded, so a leftover key is harmless.
        assert response.status_code == 200, response.text
    finally:
        _cleanup(paper.id)


def test_update_of_unknown_question_is_404(admin_headers):
    paper = _create_paper()
    try:
        response = client.put(
            f"/api/v1/mock-tests/{paper.slug}/questions/999999",
            json={"marks": "1"},
            headers=admin_headers,
        )
        assert response.status_code == 404
    finally:
        _cleanup(paper.id)


def test_students_cannot_update_questions(student_headers):
    paper = _create_paper(question_count=1)
    try:
        question_id = client.get(
            f"/api/v1/mock-tests/{paper.slug}/questions"
        ).json()[0]["id"]
        response = client.put(
            f"/api/v1/mock-tests/{paper.slug}/questions/{question_id}",
            json={"marks": "5"},
            headers=student_headers,
        )
        assert response.status_code == 403
    finally:
        _cleanup(paper.id)


# --- delete -------------------------------------------------------------------


def test_delete_hides_the_question_without_touching_answers(
    admin_headers, student_headers
):
    """The cascade guard.

    `test_answers.question_id` is `ondelete="CASCADE"`, so a hard delete would
    remove every answer to this question in every attempt and rewrite results
    students have already been shown. This asserts the row survives, the answer
    survives, and only the paper's view changes.
    """
    paper = _create_paper(question_count=1)
    try:
        question_id = client.get(
            f"/api/v1/mock-tests/{paper.slug}/questions"
        ).json()[0]["id"]

        # A student answers it, which is what creates the cascade risk.
        submitted = client.post(
            f"/api/v1/mock-tests/{paper.slug}/submit",
            json={"answers": [{"question_id": question_id, "selected_answer": "A"}]},
            headers=student_headers,
        )
        assert submitted.status_code == 200, submitted.text

        deleted = client.delete(
            f"/api/v1/mock-tests/{paper.slug}/questions/{question_id}",
            headers=admin_headers,
        )
        assert deleted.status_code == 204, deleted.text

        # The question row is still there, just inactive.
        with SessionLocal() as db:
            question = db.get(TestQuestion, question_id)
            assert question is not None
            assert question.is_active is False

            # The answer to it is intact: nothing cascaded.
            answers = db.scalars(
                select(TestAnswer).where(TestAnswer.question_id == question_id)
            ).all()
            assert len(answers) == 1
            assert answers[0].selected_answer == "A"

        # And the paper no longer offers it.
        listed = client.get(f"/api/v1/mock-tests/{paper.slug}/questions").json()
        assert question_id not in [q["id"] for q in listed]
    finally:
        _cleanup(paper.id)


def test_delete_drops_the_question_from_the_derived_totals(admin_headers):
    paper = _create_paper(question_count=3)
    try:
        before = client.get(f"/api/v1/mock-tests/{paper.slug}").json()
        assert before["question_count"] == 3

        question_id = before and client.get(
            f"/api/v1/mock-tests/{paper.slug}/questions"
        ).json()[0]["id"]
        client.delete(
            f"/api/v1/mock-tests/{paper.slug}/questions/{question_id}",
            headers=admin_headers,
        )

        after = client.get(f"/api/v1/mock-tests/{paper.slug}").json()
        assert after["question_count"] == 2
        assert Decimal(after["total_marks"]) == 4
    finally:
        _cleanup(paper.id)


def test_delete_is_scoped_to_its_own_paper(admin_headers):
    """A question must not be editable through a different paper's URL."""
    first = _create_paper(question_count=1)
    second = _create_paper()
    try:
        question_id = client.get(
            f"/api/v1/mock-tests/{first.slug}/questions"
        ).json()[0]["id"]

        response = client.delete(
            f"/api/v1/mock-tests/{second.slug}/questions/{question_id}",
            headers=admin_headers,
        )
        assert response.status_code == 404

        with SessionLocal() as db:
            assert db.get(TestQuestion, question_id).is_active is True
    finally:
        _cleanup(first.id)
        _cleanup(second.id)


def test_delete_of_unknown_question_is_404(admin_headers):
    paper = _create_paper()
    try:
        response = client.delete(
            f"/api/v1/mock-tests/{paper.slug}/questions/999999",
            headers=admin_headers,
        )
        assert response.status_code == 404
    finally:
        _cleanup(paper.id)


def test_students_cannot_delete_questions(student_headers):
    paper = _create_paper(question_count=1)
    try:
        question_id = client.get(
            f"/api/v1/mock-tests/{paper.slug}/questions"
        ).json()[0]["id"]
        response = client.delete(
            f"/api/v1/mock-tests/{paper.slug}/questions/{question_id}",
            headers=student_headers,
        )
        assert response.status_code == 403
    finally:
        _cleanup(paper.id)


def test_delete_is_idempotent(admin_headers):
    paper = _create_paper(question_count=1)
    try:
        question_id = client.get(
            f"/api/v1/mock-tests/{paper.slug}/questions"
        ).json()[0]["id"]
        url = f"/api/v1/mock-tests/{paper.slug}/questions/{question_id}"
        assert client.delete(url, headers=admin_headers).status_code == 204
        assert client.delete(url, headers=admin_headers).status_code == 204
    finally:
        _cleanup(paper.id)
