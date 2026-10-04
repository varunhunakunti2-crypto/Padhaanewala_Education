"""Manual grading — the write path `pending_review_count` always implied.

`_grade_attempt` routes an `essay` to `pending_review_count` and leaves the
verdict NULL, because there is nothing in the paper to compare a written answer
against. That was half a design: the attempt recorded that a verdict was owed
and no code anywhere could pay it, so an essay stayed at zero marks for the life
of the account and the attempt's total silently excluded it.

Every test here asks the question the old code failed:

  * can the verdict actually be written, and does the attempt's total move?
  * does the student see the mark and the grader's reason?
  * can the student grade their own work, or grade it unauthenticated?
  * can a grader award more than the question is worth?
  * does a later recount destroy the manual grade? `_recompute_attempt_totals`
    exists precisely so that it does not, and that is not a property you can
    observe without writing it down.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import AuditLog, MockTest, Role, TestAnswer, TestQuestion, User
from app.question_types import QuestionType

client = TestClient(app)

ESSAY_TEXT = "Explain the derivation of the quadratic formula."
MCQ_TEXT = "Pick A."
ESSAY_MARKS = 5
MCQ_MARKS = 2


def _unique(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:8]}@example.com"


def _unique_mobile() -> str:
    return f"9{uuid.uuid4().int % 1_000_000_000:09d}"


def _assign_roles(email: str, role_names: list[str]) -> None:
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        roles = []
        for name in role_names:
            role = db.query(Role).filter(Role.name == name).first()
            if role is None:
                role = Role(name=name, description=f"test:{name}")
                db.add(role)
                db.flush()
            roles.append(role)
        user.roles = roles
        db.commit()


def _account(prefix: str, roles: list[str]) -> dict:
    payload = {
        "name": "Grading Tester",
        "email": _unique(prefix),
        "mobile": _unique_mobile(),
        "password": "SecurePass123!",
        "age_band": "18_plus",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    _assign_roles(payload["email"], roles)
    return {**payload, **response.json()}


def _headers(account: dict) -> dict:
    return {"Authorization": f"Bearer {account['access_token']}"}


def _user_id(email: str) -> int:
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        return user.id


@pytest.fixture
def paper():
    """One paper carrying an essay and an MCQ, so a single attempt exercises
    both the auto-graded and the human-graded half of the tallies."""
    with SessionLocal() as db:
        row = MockTest(
            name=f"Grading {uuid.uuid4().hex[:6]}",
            slug=f"grading-{uuid.uuid4().hex[:8]}",
            difficulty="medium",
            question_type=QuestionType.ESSAY.value,
            duration_minutes=30,
            total_marks=0,
            negative_marking=False,
            negative_marks_value=0,
            attempts_allowed=3,
            result_visibility="immediate",
            test_type="standard",
            is_active=True,
        )
        db.add(row)
        db.flush()
        db.add(
            TestQuestion(
                mock_test_id=row.id,
                question_text=ESSAY_TEXT,
                question_type=QuestionType.ESSAY.value,
                marks=ESSAY_MARKS,
                sort_order=1,
            )
        )
        db.add(
            TestQuestion(
                mock_test_id=row.id,
                question_text=MCQ_TEXT,
                question_type=QuestionType.MCQ.value,
                options=["A", "B"],
                correct_answer="A",
                marks=MCQ_MARKS,
                sort_order=2,
            )
        )
        db.commit()
        db.refresh(row)
        yield row
    with SessionLocal() as db:
        db.delete(db.get(MockTest, row.id))
        db.commit()


def _question_ids(mock_test: MockTest) -> dict[str, int]:
    with SessionLocal() as db:
        return {
            q.question_text: q.id
            for q in db.query(TestQuestion)
            .filter(TestQuestion.mock_test_id == mock_test.id)
            .all()
        }


def _submit(mock_test: MockTest, account: dict) -> dict:
    """Submit both questions: the MCQ correctly, the essay with prose."""
    ids = _question_ids(mock_test)
    response = client.post(
        f"/api/v1/mock-tests/{mock_test.slug}/submit",
        json={
            "answers": [
                {"question_id": ids[MCQ_TEXT], "selected_answer": "A"},
                {"question_id": ids[ESSAY_TEXT], "selected_answer": "Because..."},
            ]
        },
        headers=_headers(account),
    )
    assert response.status_code == 200, response.text
    return response.json()


def _grade(
    attempt_id: int,
    question_id: int,
    account: dict,
    body: dict,
):
    return client.post(
        f"/api/v1/mock-tests/admin/review-attempts/{attempt_id}"
        f"/answers/{question_id}/grade",
        json=body,
        headers=_headers(account),
    )


# --------------------------------------------------------------------------- #
# The gap itself
# --------------------------------------------------------------------------- #


def test_an_essay_is_pending_until_a_human_pays_the_verdict(paper):
    """Baseline: the counter exists, and nothing yet has a way to reduce it."""
    student = _account("essay", ["student"])
    result = _submit(paper, student)

    essay = next(q for q in result["questions"] if q["question_text"] == ESSAY_TEXT)
    assert essay["is_correct"] is None
    assert essay["marks_awarded"] is None
    assert result["attempt"]["pending_review_count"] == 1
    # Only the MCQ contributes; the essay is not counted as wrong, it is counted
    # as owed.
    assert float(result["attempt"]["score"]) == float(MCQ_MARKS)


def test_the_attempt_reaches_zero_pending_once_graded(paper):
    student = _account("paid", ["student"])
    grader = _account("marker", ["admin"])
    submitted = _submit(paper, student)
    attempt_id = submitted["attempt"]["id"]
    essay_id = _question_ids(paper)[ESSAY_TEXT]

    response = _grade(
        attempt_id, essay_id, grader, {"marks_awarded": 3, "grader_feedback": "Good, missing the constant."}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["is_correct"] is True
    assert float(body["marks_awarded"]) == 3.0
    assert body["graded_by"] is not None
    assert body["graded_at"] is not None

    attempt = body["attempt"]
    assert attempt["pending_review_count"] == 0
    # 2 from the MCQ + 3 of the essay's 5, over a 7-mark paper.
    assert float(attempt["score"]) == 5.0
    assert float(attempt["percentage"]) == round(5 * 100 / (ESSAY_MARKS + MCQ_MARKS), 2)
    assert attempt["correct_count"] == 2


def test_the_mark_and_the_reason_reach_the_student(paper):
    """A mark with no explanation is a number the student cannot argue with."""
    student = _account("seen", ["student"])
    grader = _account("marker2", ["admin"])
    submitted = _submit(paper, student)
    essay_id = _question_ids(paper)[ESSAY_TEXT]

    graded = _grade(
        submitted["attempt"]["id"],
        essay_id,
        grader,
        {"marks_awarded": 4, "grader_feedback": "Lost a mark for the sign."},
    )
    assert graded.status_code == 200, graded.text

    result = client.get(
        f"/api/v1/mock-tests/{paper.slug}/attempts/"
        f"{submitted['attempt']['id']}/result",
        headers=_headers(student),
    )
    assert result.status_code == 200, result.text
    essay = next(
        q for q in result.json()["questions"] if q["question_text"] == ESSAY_TEXT
    )
    assert float(essay["marks_awarded"]) == 4.0
    assert essay["is_correct"] is True
    assert essay["grader_feedback"] == "Lost a mark for the sign."


def test_partial_credit_that_is_not_binary_is_representable(paper):
    """The whole reason a human marks an essay:3-of-5 is not correct/incorrect."""
    student = _account("partial", ["student"])
    grader = _account("marker3", ["admin"])
    submitted = _submit(paper, student)
    essay_id = _question_ids(paper)[ESSAY_TEXT]

    response = _grade(
        submitted["attempt"]["id"], essay_id, grader, {"marks_awarded": 3}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    # `is_correct` was omitted, so it is inferred from the marks: something was
    # awarded, so the attempt counts the question as answered correctly.
    assert body["is_correct"] is True
    assert float(body["marks_awarded"]) == 3.0

    # ...and zero is a legitimate verdict too, distinct from "not yet marked".
    response = _grade(
        submitted["attempt"]["id"], essay_id, grader, {"marks_awarded": 0}
    )
    assert response.status_code == 200, response.text
    assert response.json()["is_correct"] is False
    assert response.json()["attempt"]["pending_review_count"] == 0


# --------------------------------------------------------------------------- #
# Authority
# --------------------------------------------------------------------------- #


def test_a_student_cannot_grade_their_own_answer(paper):
    student = _account("selfmark", ["student"])
    submitted = _submit(paper, student)
    essay_id = _question_ids(paper)[ESSAY_TEXT]

    response = _grade(
        submitted["attempt"]["id"], essay_id, student, {"marks_awarded": 5}
    )
    assert response.status_code == 403


def test_grading_requires_authentication(paper):
    student = _account("anonmark", ["student"])
    submitted = _submit(paper, student)
    essay_id = _question_ids(paper)[ESSAY_TEXT]

    response = client.post(
        f"/api/v1/mock-tests/admin/review-attempts/{submitted['attempt']['id']}"
        f"/answers/{essay_id}/grade",
        json={"marks_awarded": 5},
    )
    assert response.status_code == 401


# --------------------------------------------------------------------------- #
# Refusals
# --------------------------------------------------------------------------- #


def test_more_marks_than_the_question_is_worth_is_a_422(paper):
    student = _account("overmark", ["student"])
    grader = _account("marker4", ["admin"])
    submitted = _submit(paper, student)
    essay_id = _question_ids(paper)[ESSAY_TEXT]

    response = _grade(
        submitted["attempt"]["id"],
        essay_id,
        grader,
        {"marks_awarded": ESSAY_MARKS + 1},
    )
    assert response.status_code == 422
    assert str(ESSAY_MARKS) in response.json()["detail"]

    # The refusal did not partially apply.
    with SessionLocal() as db:
        answer = db.query(TestAnswer).filter(
            TestAnswer.attempt_id == submitted["attempt"]["id"],
            TestAnswer.question_id == essay_id,
        ).one()
        assert answer.is_correct is None
        assert answer.marks_awarded is None
        assert answer.graded_by is None


def test_a_question_the_student_never_answered_cannot_be_graded(paper):
    """A grade for silence would be a mark for a question nobody attempted."""
    student = _account("silent", ["student"])
    grader = _account("marker5", ["admin"])
    ids = _question_ids(paper)

    response = client.post(
        f"/api/v1/mock-tests/{paper.slug}/submit",
        json={"answers": [{"question_id": ids[MCQ_TEXT], "selected_answer": "A"}]},
        headers=_headers(student),
    )
    assert response.status_code == 200, response.text
    attempt_id = response.json()["attempt"]["id"]

    # The essay was never answered, so no answer row carries a verdict to set.
    response = _grade(attempt_id, ids[ESSAY_TEXT], grader, {"marks_awarded": 5})
    assert response.status_code == 409


def test_an_attempt_that_is_still_running_cannot_be_graded(paper):
    grader = _account("early", ["admin"])
    student = _account("runner", ["student"])
    started = client.post(
        f"/api/v1/mock-tests/{paper.slug}/start", headers=_headers(student)
    )
    assert started.status_code == 200, started.text
    attempt_id = started.json()["attempt"]["id"]
    essay_id = _question_ids(paper)[ESSAY_TEXT]

    response = _grade(attempt_id, essay_id, grader, {"marks_awarded": 5})
    assert response.status_code == 409


# --------------------------------------------------------------------------- #
# Durability of the verdict
# --------------------------------------------------------------------------- #


def test_a_manual_grade_survives_a_later_recount(paper):
    """`_recompute_attempt_totals` must read the row, not the answer key.

    The autograder would award the essay 0 or 5 from a key that does not exist,
    so any recount that re-derived verdicts would silently discard partial
    credit. Two recounts are exercised: grading the *other* answer on the same
    attempt, which is the path that actually recomputes, and re-submitting,
    which is the cheapest round trip back through the result builder.
    """
    student = _account("durable", ["student"])
    grader = _account("marker6", ["admin"])
    submitted = _submit(paper, student)
    attempt_id = submitted["attempt"]["id"]
    ids = _question_ids(paper)

    _grade(attempt_id, ids[ESSAY_TEXT], grader, {"marks_awarded": 3})
    _grade(attempt_id, ids[ESSAY_TEXT], grader, {"marks_awarded": 4})

    # Grading the auto-graded MCQ on the same attempt forces a second recount of
    # every tally. The essay's partial credit must come out the other side.
    also = _grade(attempt_id, ids[MCQ_TEXT], grader, {"marks_awarded": MCQ_MARKS})
    assert also.status_code == 200, also.text
    assert float(also.json()["attempt"]["score"]) == float(MCQ_MARKS + 4)
    assert also.json()["attempt"]["pending_review_count"] == 0

    recount = client.post(
        f"/api/v1/mock-tests/{paper.slug}/attempts/{attempt_id}/submit",
        headers=_headers(student),
    )
    assert recount.status_code == 200, recount.text
    essay = next(
        q for q in recount.json()["questions"] if q["question_text"] == ESSAY_TEXT
    )
    assert float(essay["marks_awarded"]) == 4.0
    assert float(recount.json()["attempt"]["score"]) == float(MCQ_MARKS + 4)


def test_regrading_overwrites_and_audits_the_previous_verdict(paper):
    student = _account("regrade", ["student"])
    grader = _account("marker7", ["admin"])
    submitted = _submit(paper, student)
    attempt_id = submitted["attempt"]["id"]
    essay_id = _question_ids(paper)[ESSAY_TEXT]

    _grade(attempt_id, essay_id, grader, {"marks_awarded": 1})
    second = _grade(attempt_id, essay_id, grader, {"marks_awarded": 5})
    assert second.status_code == 200, second.text
    assert float(second.json()["marks_awarded"]) == 5.0

    with SessionLocal() as db:
        rows = (
            db.query(AuditLog)
            .filter(
                AuditLog.action == "grade_answer",
                AuditLog.user_id == _user_id(grader["email"]),
            )
            .order_by(AuditLog.id.desc())
            .all()
        )
        assert rows, "grading wrote no audit row"
        latest = rows[0]
        assert float(latest.new_value["marks_awarded"]) == 5.0
        assert float(latest.old_value["marks_awarded"]) == 1.0
        # 4.5 — the source IP is stamped, not left to the caller.
        assert latest.ip_address


# --------------------------------------------------------------------------- #
# The queue
# --------------------------------------------------------------------------- #


def test_the_queue_lists_only_attempts_that_owe_a_verdict(paper):
    student = _account("queued", ["student"])
    grader = _account("marker8", ["admin"])
    submitted = _submit(paper, student)
    attempt_id = submitted["attempt"]["id"]
    essay_id = _question_ids(paper)[ESSAY_TEXT]

    open_queue = client.get(
        "/api/v1/mock-tests/admin/review-attempts", headers=_headers(grader)
    )
    assert open_queue.status_code == 200, open_queue.text
    mine = [r for r in open_queue.json() if r["attempt"]["id"] == attempt_id]
    assert len(mine) == 1
    assert mine[0]["student_email"] == student["email"]
    reviewable = [a for a in mine[0]["answers"] if a["question_id"] == essay_id]
    assert len(reviewable) == 1
    assert reviewable[0]["is_correct"] is None
    # The ceiling travels with the row, so the grader cannot ask for a number
    # they are not allowed to award.
    assert float(reviewable[0]["marks"]) == float(ESSAY_MARKS)

    _grade(attempt_id, essay_id, grader, {"marks_awarded": 3})

    after = client.get(
        "/api/v1/mock-tests/admin/review-attempts", headers=_headers(grader)
    )
    assert [
        r for r in after.json() if r["attempt"]["id"] == attempt_id
    ] == [], "a fully marked attempt is still in the open queue"

    everything = client.get(
        "/api/v1/mock-tests/admin/review-attempts?pending_only=false",
        headers=_headers(grader),
    )
    assert everything.status_code == 200, everything.text
    assert attempt_id in [r["attempt"]["id"] for r in everything.json()]


def test_the_queue_is_closed_to_students(paper):
    student = _account("peek", ["student"])
    _submit(paper, student)
    assert (
        client.get("/api/v1/mock-tests/admin/review-attempts", headers=_headers(student)).status_code
        == 403
    )
    assert client.get("/api/v1/mock-tests/admin/review-attempts").status_code == 401
