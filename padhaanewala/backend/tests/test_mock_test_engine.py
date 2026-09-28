import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import SessionLocal
from app.main import app
from app.models import MockTest, Role, TestAttempt, TestQuestion, User

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
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    return {**payload, **response.json()}


def _create_mock_test(
    attempts_allowed: int = 3,
    negative_marking: bool = False,
    slug: str | None = None,
) -> MockTest:
    mock_test = MockTest(
        name=f"Engine Test {uuid.uuid4().hex[:6]}",
        slug=slug or f"engine-test-{uuid.uuid4().hex[:8]}",
        subject="Mathematics",
        difficulty="medium",
        question_type="mcq",
        duration_minutes=30,
        total_marks=0,
        negative_marking=negative_marking,
        negative_marks_value=1,
        attempts_allowed=attempts_allowed,
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
            explanation=f"Explanation {i}",
        )
        for i in range(1, 4)
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


def _expire_attempt(attempt_id: int, minutes_ago: int = 5) -> datetime:
    """Backdate an attempt's deadline and return the expiry that was written."""
    with SessionLocal() as db:
        attempt = db.get(TestAttempt, attempt_id)
        expires_at = datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)
        attempt.expires_at = expires_at
        db.commit()
        return expires_at


def _reload_attempt(attempt_id: int) -> TestAttempt:
    """Read the attempt back in a fresh session, i.e. only committed state."""
    with SessionLocal() as db:
        db.expire_all()
        return db.get(TestAttempt, attempt_id)


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_start_requires_auth():
    response = client.post("/api/v1/mock-tests/some-slug/start")
    assert response.status_code == 401


def test_start_not_found():
    user = _register_user()
    headers = _auth_headers(user["access_token"])
    response = client.post(
        "/api/v1/mock-tests/nonexistent-slug/start", headers=headers
    )
    assert response.status_code == 404


def test_full_attempt_flow():
    mock_test = _create_mock_test()
    try:
        user = _register_user()
        headers = _auth_headers(user["access_token"])

        start = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/start",
            headers=headers,
        )
        assert start.status_code == 200, start.text
        body = start.json()
        attempt_id = body["attempt"]["id"]
        assert body["attempt"]["status"] == "in_progress"
        assert body["attempt"]["time_remaining_seconds"] > 0
        assert len(body["questions"]) == 3
        for q in body["questions"]:
            assert "selected_answer" not in q or q["selected_answer"] is None
            assert "correct_answer" not in q

        q1, q2, q3 = [q["id"] for q in body["questions"]]

        correct = client.put(
            f"/api/v1/mock-tests/{mock_test.slug}/attempts/{attempt_id}/answers/{q1}",
            json={"selected_answer": "A"},
            headers=headers,
        )
        assert correct.status_code == 200, correct.text
        assert correct.json()["selected_answer"] == "A"
        assert "is_correct" not in correct.json()
        assert "correct_answer" not in correct.json()
        assert "explanation" not in correct.json()

        wrong = client.put(
            f"/api/v1/mock-tests/{mock_test.slug}/attempts/{attempt_id}/answers/{q2}",
            json={"selected_answer": "B"},
            headers=headers,
        )
        assert wrong.status_code == 200
        assert wrong.json()["selected_answer"] == "B"

        question_bank = client.get(
            f"/api/v1/mock-tests/{mock_test.slug}/questions"
        )
        assert question_bank.status_code == 200
        for q in question_bank.json():
            assert "correct_answer" not in q

        submit = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/attempts/{attempt_id}/submit",
            headers=headers,
        )
        assert submit.status_code == 200, submit.text
        result = submit.json()
        assert result["attempt"]["status"] == "submitted"
        assert result["attempt"]["correct_count"] == 1
        assert result["attempt"]["incorrect_count"] == 1
        assert result["attempt"]["unanswered_count"] == 1
        assert float(result["attempt"]["score"]) == 2
        assert float(result["attempt"]["total_marks"]) == 6
        assert float(result["attempt"]["percentage"]) == 33.33
        assert len(result["questions"]) == 3
        q1_result = next(q for q in result["questions"] if q["id"] == q1)
        assert q1_result["is_correct"] is True
        assert q1_result["correct_answer"] == "A"
        assert q1_result["explanation"] == "Explanation 1"

        result_again = client.get(
            f"/api/v1/mock-tests/{mock_test.slug}/attempts/{attempt_id}/result",
            headers=headers,
        )
        assert result_again.status_code == 200
        assert float(result_again.json()["attempt"]["score"]) == 2
    finally:
        _cleanup(mock_test.id)


def test_result_before_submit_rejected():
    mock_test = _create_mock_test()
    try:
        user = _register_user()
        headers = _auth_headers(user["access_token"])
        start = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/start",
            headers=headers,
        ).json()
        attempt_id = start["attempt"]["id"]
        response = client.get(
            f"/api/v1/mock-tests/{mock_test.slug}/attempts/{attempt_id}/result",
            headers=headers,
        )
        assert response.status_code == 400
    finally:
        _cleanup(mock_test.id)


def test_attempt_limit_enforced():
    mock_test = _create_mock_test(attempts_allowed=1)
    try:
        user = _register_user()
        headers = _auth_headers(user["access_token"])

        first = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/start",
            headers=headers,
        )
        assert first.status_code == 200
        first_attempt = first.json()["attempt"]["id"]

        client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/attempts/{first_attempt}/submit",
            headers=headers,
        )

        second = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/start",
            headers=headers,
        )
        assert second.status_code == 400
        assert "Attempt limit" in second.json()["detail"]

        attempts = client.get(
            f"/api/v1/mock-tests/{mock_test.slug}/attempts",
            headers=headers,
        )
        assert attempts.status_code == 200
        assert len(attempts.json()) == 1
        assert attempts.json()[0]["status"] == "submitted"
    finally:
        _cleanup(mock_test.id)


def test_attempt_ownership_enforced():
    mock_test = _create_mock_test()
    try:
        owner = _register_user()
        intruder = _register_user()
        headers = _auth_headers(owner["access_token"])
        start = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/start",
            headers=headers,
        ).json()
        attempt_id = start["attempt"]["id"]

        intruder_headers = _auth_headers(intruder["access_token"])
        response = client.get(
            f"/api/v1/mock-tests/{mock_test.slug}/attempts/{attempt_id}",
            headers=intruder_headers,
        )
        assert response.status_code == 403

        submit = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/attempts/{attempt_id}/submit",
            headers=intruder_headers,
        )
        assert submit.status_code == 403
    finally:
        _cleanup(mock_test.id)


def test_save_answer_not_your_question():
    mock_test = _create_mock_test()
    other = _create_mock_test()
    try:
        user = _register_user()
        headers = _auth_headers(user["access_token"])
        start = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/start",
            headers=headers,
        ).json()
        attempt_id = start["attempt"]["id"]

        with SessionLocal() as db:
            other_qid = db.scalar(
                select(TestQuestion)
                .where(TestQuestion.mock_test_id == other.id)
                .order_by(TestQuestion.id)
                .limit(1)
            ).id

        response = client.put(
            f"/api/v1/mock-tests/{mock_test.slug}/attempts/{attempt_id}/answers/{other_qid}",
            json={"selected_answer": "A"},
            headers=headers,
        )
        assert response.status_code == 404
    finally:
        _cleanup(mock_test.id)
        _cleanup(other.id)


def test_submit_endpoint_bulk_flow():
    mock_test = _create_mock_test(attempts_allowed=2)
    try:
        user = _register_user()
        headers = _auth_headers(user["access_token"])

        question_bank = client.get(
            f"/api/v1/mock-tests/{mock_test.slug}/questions"
        ).json()
        assert len(question_bank) == 3
        q1, q2, q3 = [q["id"] for q in question_bank]

        submit = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/submit",
            json={
                "answers": [
                    {"question_id": q1, "selected_answer": "A"},
                    {"question_id": q2, "selected_answer": "B"},
                ]
            },
            headers=headers,
        )
        assert submit.status_code == 200, submit.text
        result = submit.json()
        assert result["attempt"]["status"] == "submitted"
        assert result["attempt"]["correct_count"] == 1
        assert result["attempt"]["incorrect_count"] == 1
        assert result["attempt"]["unanswered_count"] == 1
        assert float(result["attempt"]["score"]) == 2
        assert float(result["attempt"]["total_marks"]) == 6
        assert float(result["attempt"]["percentage"]) == 33.33
        assert len(result["questions"]) == 3
        q1_result = next(q for q in result["questions"] if q["id"] == q1)
        assert q1_result["is_correct"] is True
        assert q1_result["correct_answer"] == "A"
        assert q1_result["explanation"] == "Explanation 1"

        attempts = client.get(
            f"/api/v1/mock-tests/{mock_test.slug}/attempts",
            headers=headers,
        )
        assert attempts.status_code == 200
        assert len(attempts.json()) == 1
        assert attempts.json()[0]["status"] == "submitted"
    finally:
        _cleanup(mock_test.id)


def test_submit_endpoint_uses_in_progress_attempt():
    mock_test = _create_mock_test(attempts_allowed=3)
    try:
        user = _register_user()
        headers = _auth_headers(user["access_token"])

        start = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/start",
            headers=headers,
        ).json()
        attempt_id = start["attempt"]["id"]
        q1, q2, q3 = [q["id"] for q in start["questions"]]

        client.put(
            f"/api/v1/mock-tests/{mock_test.slug}/attempts/{attempt_id}/answers/{q1}",
            json={"selected_answer": "A"},
            headers=headers,
        )

        submit = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/submit",
            json={"answers": [{"question_id": q2, "selected_answer": "B"}]},
            headers=headers,
        )
        assert submit.status_code == 200, submit.text
        result = submit.json()
        assert result["attempt"]["id"] == attempt_id
        assert result["attempt"]["correct_count"] == 1
        assert result["attempt"]["incorrect_count"] == 1
        assert float(result["attempt"]["score"]) == 2

        attempts = client.get(
            f"/api/v1/mock-tests/{mock_test.slug}/attempts",
            headers=headers,
        ).json()
        assert len(attempts) == 1
    finally:
        _cleanup(mock_test.id)


def test_submit_endpoint_invalid_question():
    mock_test = _create_mock_test()
    try:
        user = _register_user()
        headers = _auth_headers(user["access_token"])
        question_bank = client.get(
            f"/api/v1/mock-tests/{mock_test.slug}/questions"
        ).json()
        q1 = question_bank[0]["id"]

        response = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/submit",
            json={
                "answers": [
                    {"question_id": q1, "selected_answer": "A"},
                    {"question_id": 987654321, "selected_answer": "B"},
                ]
            },
            headers=headers,
        )
        assert response.status_code == 404
    finally:
        _cleanup(mock_test.id)


def test_submit_endpoint_resubmit_rejected():
    mock_test = _create_mock_test(attempts_allowed=2)
    try:
        user = _register_user()
        headers = _auth_headers(user["access_token"])
        question_bank = client.get(
            f"/api/v1/mock-tests/{mock_test.slug}/questions"
        ).json()
        answers = {"answers": [{"question_id": q["id"], "selected_answer": "A"} for q in question_bank]}

        first = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/submit",
            json=answers,
            headers=headers,
        )
        assert first.status_code == 200

        second = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/submit",
            json=answers,
            headers=headers,
        )
        assert second.status_code == 400
        assert "already submitted" in second.json()["detail"]
    finally:
        _cleanup(mock_test.id)


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


def test_admin_endpoints():
    mock_test = _create_mock_test()
    try:
        regular = _register_user()
        headers = _auth_headers(regular["access_token"])
        forbidden = client.get("/api/v1/mock-tests/admin/all", headers=headers)
        assert forbidden.status_code == 403

        admin = _register_user()
        _make_admin(admin["email"])
        admin_headers = _auth_headers(admin["access_token"])

        listing = client.get("/api/v1/mock-tests/admin/all", headers=admin_headers)
        assert listing.status_code == 200, listing.text
        assert any(t["slug"] == mock_test.slug for t in listing.json())

        detail = client.get(
            f"/api/v1/mock-tests/admin/all/{mock_test.slug}",
            headers=admin_headers,
        )
        assert detail.status_code == 200, detail.text
        body = detail.json()
        assert body["slug"] == mock_test.slug
        assert len(body["questions"]) == 3
        assert body["attempt_count"] == 0
        for q in body["questions"]:
            assert q["correct_answer"] == "A"
            assert q["explanation"] == f"Explanation {q['sort_order']}"

        inactive = client.get(
            "/api/v1/mock-tests/admin/all",
            params={"is_active": False},
            headers=admin_headers,
        )
        assert inactive.status_code == 200
    finally:
        _cleanup(mock_test.id)


def test_attempt_detail_nested_path():
    mock_test = _create_mock_test()
    try:
        user = _register_user()
        headers = _auth_headers(user["access_token"])
        start = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/start",
            headers=headers,
        ).json()
        attempt_id = start["attempt"]["id"]

        detail = client.get(
            f"/api/v1/mock-tests/{mock_test.slug}/attempts/{attempt_id}",
            headers=headers,
        )
        assert detail.status_code == 200, detail.text
        assert detail.json()["attempt"]["id"] == attempt_id
        assert len(detail.json()["questions"]) == 3
        for q in detail.json()["questions"]:
            assert "correct_answer" not in q

        other_test = _create_mock_test()
        try:
            wrong = client.get(
                f"/api/v1/mock-tests/{other_test.slug}/attempts/{attempt_id}",
                headers=headers,
            )
            assert wrong.status_code == 404
        finally:
            _cleanup(other_test.id)
    finally:
        _cleanup(mock_test.id)


# --------------------------------------------------------------------------
# P0-1: the attempt deadline was not enforced
# --------------------------------------------------------------------------


def test_expired_attempt_submit_is_finalised_at_the_deadline():
    """`submit_attempt` carried no expiry check at all.

    A student could let the clock run out (or walk away for hours) and still get
    an attempt graded and committed as though it were on time. The deadline now
    finalises the attempt, and `submitted_at` records the deadline rather than
    whenever the request happened to notice.
    """
    mock_test = _create_mock_test(attempts_allowed=3)
    try:
        user = _register_user()
        headers = _auth_headers(user["access_token"])
        start = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/start", headers=headers
        ).json()
        attempt_id = start["attempt"]["id"]
        q1 = start["questions"][0]["id"]

        # Answer legitimately, while the attempt is still live.
        saved = client.put(
            f"/api/v1/mock-tests/{mock_test.slug}/attempts/{attempt_id}/answers/{q1}",
            json={"selected_answer": "A"},
            headers=headers,
        )
        assert saved.status_code == 200

        expires_at = _expire_attempt(attempt_id)

        response = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/attempts/{attempt_id}/submit",
            headers=headers,
        )
        assert response.status_code == 200, response.text
        assert response.json()["attempt"]["status"] == "submitted"

        # Grading is committed and stamped with the deadline, not with "now".
        stored = _reload_attempt(attempt_id)
        assert stored.status == "submitted"
        assert stored.submitted_at is not None
        committed = stored.submitted_at
        if committed.tzinfo is None:
            committed = committed.replace(tzinfo=timezone.utc)
        assert abs((committed - expires_at).total_seconds()) < 1
        # The one correct answer saved before the deadline still counts.
        assert stored.correct_count == 1
        assert stored.incorrect_count == 0
    finally:
        _cleanup(mock_test.id)


def test_bulk_submit_after_expiry_persists_the_auto_grade():
    """The bulk submit path graded the expired attempt, then raised 400.

    Raising rolled the session back, so the auto-grade was thrown away and the
    attempt stayed `in_progress` forever, still consuming one of the student's
    `attempts_allowed` with no result ever recorded. The late answers must be
    discarded, but the finalisation must be committed.
    """
    mock_test = _create_mock_test(attempts_allowed=2)
    try:
        user = _register_user()
        headers = _auth_headers(user["access_token"])
        start = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/start", headers=headers
        ).json()
        attempt_id = start["attempt"]["id"]
        q1, q2, _ = [q["id"] for q in start["questions"]]

        client.put(
            f"/api/v1/mock-tests/{mock_test.slug}/attempts/{attempt_id}/answers/{q1}",
            json={"selected_answer": "A"},
            headers=headers,
        )
        expires_at = _expire_attempt(attempt_id)

        response = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/submit",
            json={"answers": [{"question_id": q2, "selected_answer": "A"}]},
            headers=headers,
        )
        assert response.status_code == 200, response.text
        assert response.json()["attempt"]["status"] == "submitted"

        # Committed, not rolled back.
        stored = _reload_attempt(attempt_id)
        assert stored.status == "submitted"
        committed = stored.submitted_at
        if committed.tzinfo is None:
            committed = committed.replace(tzinfo=timezone.utc)
        assert abs((committed - expires_at).total_seconds()) < 1

        # The late answer to q2 was discarded, so only q1 is graded.
        assert stored.correct_count == 1
        assert stored.incorrect_count == 0
        assert stored.unanswered_count == 2
    finally:
        _cleanup(mock_test.id)


def test_save_answer_after_expiry_is_rejected_and_finalises():
    mock_test = _create_mock_test(attempts_allowed=3)
    try:
        user = _register_user()
        headers = _auth_headers(user["access_token"])
        start = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/start", headers=headers
        ).json()
        attempt_id = start["attempt"]["id"]
        q1, q2, _ = [q["id"] for q in start["questions"]]

        _expire_attempt(attempt_id)

        response = client.put(
            f"/api/v1/mock-tests/{mock_test.slug}/attempts/{attempt_id}/answers/{q1}",
            json={"selected_answer": "A"},
            headers=headers,
        )
        assert response.status_code == 400
        assert "already submitted" in response.json()["detail"]

        stored = _reload_attempt(attempt_id)
        assert stored.status == "submitted"
        assert stored.correct_count == 0
    finally:
        _cleanup(mock_test.id)


def test_reported_total_marks_tracks_the_questions_that_can_be_answered():
    """The advertised total must be the number grading divides by.

    `mock_tests.total_marks` is written once at creation -- before any question
    exists -- and nothing recomputed it, so the API advertised a total that had
    no relationship to the paper: `_create_mock_test` still stores 0 next to
    three questions worth 6. It also counted deactivated questions, so an
    inactive question kept inflating the total and a student who answered
    everything they were actually shown could not reach 100%.
    """
    mock_test = _create_mock_test()
    try:
        question_bank = client.get(
            f"/api/v1/mock-tests/{mock_test.slug}/questions"
        ).json()
        assert len(question_bank) == 3

        served = client.get(f"/api/v1/mock-tests/{mock_test.slug}").json()
        assert float(served["total_marks"]) == 6
        assert served["question_count"] == 3

        def perfect_run():
            bank = client.get(f"/api/v1/mock-tests/{mock_test.slug}/questions").json()
            response = client.post(
                f"/api/v1/mock-tests/{mock_test.slug}/submit",
                json={
                    "answers": [
                        {"question_id": q["id"], "selected_answer": "A"} for q in bank
                    ]
                },
                headers=_auth_headers(_register_user()["access_token"]),
            )
            assert response.status_code == 200, response.text
            return response.json()["attempt"]

        attempt = perfect_run()
        assert float(attempt["total_marks"]) == 6
        assert float(attempt["percentage"]) == 100.0

        # Retiring a question changes the paper's worth, and the advertised
        # total has to change with it.
        with SessionLocal() as db:
            victim = db.get(TestQuestion, question_bank[0]["id"])
            victim.is_active = False
            db.commit()

        served = client.get(f"/api/v1/mock-tests/{mock_test.slug}").json()
        assert float(served["total_marks"]) == 4
        assert served["question_count"] == 2

        attempt = perfect_run()
        assert float(attempt["total_marks"]) == 4
        # The invariant that matters: a perfect run is always exactly 100%.
        assert float(attempt["percentage"]) == 100.0
    finally:
        _cleanup(mock_test.id)


def test_percentage_stays_within_zero_and_one_hundred():
    """A percentage is a share of the paper, so it cannot be negative.

    Negative marking drives the raw score below zero, and `score * 100 /
    total_marks` was stored unclamped -- an all-wrong attempt on a +4/-1 paper
    persisted -25.00. The score itself stays negative on purpose: the penalty has
    to be visible, and each one is still recorded per-answer in `marks_awarded`.
    """
    mock_test = _create_mock_test(negative_marking=True)
    try:
        user = _register_user()
        headers = _auth_headers(user["access_token"])
        question_bank = client.get(
            f"/api/v1/mock-tests/{mock_test.slug}/questions"
        ).json()
        # A deliberately wrong option for every question.
        response = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/submit",
            json={
                "answers": [
                    {"question_id": q["id"], "selected_answer": "NOT_AN_OPTION"}
                    for q in question_bank
                ]
            },
            headers=headers,
        )
        assert response.status_code == 200, response.text
        attempt = response.json()["attempt"]
        assert attempt["incorrect_count"] == len(question_bank)
        assert float(attempt["score"]) < 0, "the penalty must still be recorded"
        assert 0 <= float(attempt["percentage"]) <= 100
        # Every penalty is still visible per answer.
        assert all(
            float(r["marks_awarded"]) < 0 for r in response.json()["questions"]
        )
    finally:
        _cleanup(mock_test.id)


def test_fractional_marks_are_not_truncated():
    """`marks` is Numeric(6, 2) end to end, so fractions must survive grading.

    `_marks_for` used to return `int(question.marks)`, which truncated towards
    zero: a 2.5-mark question paid 2, a 0.5-mark question paid nothing, and a
    0.5 penalty vanished. Worse, the score is a sum of those truncated values
    while `total_marks` sums the untruncated `marks`, so a flawless run was
    reported as 80% instead of 100%.
    """
    mock_test = MockTest(
        name=f"Fractional {uuid.uuid4().hex[:6]}",
        slug=f"fractional-{uuid.uuid4().hex[:8]}",
        difficulty="medium",
        question_type="mcq",
        duration_minutes=30,
        total_marks=0,
        negative_marking=True,
        negative_marks_value=Decimal("0.5"),
        attempts_allowed=2,
        result_visibility="immediate",
        is_active=True,
    )
    mock_test.questions = [
        TestQuestion(
            question_text=f"Half marks {i}",
            question_type="mcq",
            options=["A", "B"],
            correct_answer="A",
            marks=Decimal("2.5"),
            negative_marks=Decimal("0.5"),
            sort_order=i + 1,
        )
        for i in range(2)
    ]
    with SessionLocal() as db:
        db.add(mock_test)
        db.commit()
        db.refresh(mock_test)
    try:
        user = _register_user()
        headers = _auth_headers(user["access_token"])
        question_bank = client.get(
            f"/api/v1/mock-tests/{mock_test.slug}/questions"
        ).json()
        assert len(question_bank) == 2

        # All correct: 2 x 2.5.
        response = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/submit",
            json={
                "answers": [
                    {"question_id": q["id"], "selected_answer": "A"}
                    for q in question_bank
                ]
            },
            headers=headers,
        )
        assert response.status_code == 200, response.text
        attempt = response.json()["attempt"]
        assert float(attempt["score"]) == 5.0
        assert float(attempt["total_marks"]) == 5.0
        # The regression: a perfect run must not report as less than 100%.
        assert float(attempt["percentage"]) == 100.0
        rows = response.json()["questions"]
        assert all(float(r["marks_awarded"]) == 2.5 for r in rows)

        # Now all wrong on a second attempt: 2 x -0.5, which truncation used to
        # round to zero.
        started = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/start", headers=headers
        )
        assert started.status_code == 200, started.text
        second = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/submit",
            json={
                "answers": [
                    {"question_id": q["id"], "selected_answer": "B"}
                    for q in question_bank
                ]
            },
            headers=headers,
        )
        assert second.status_code == 200, second.text
        wrong_attempt = second.json()["attempt"]
        assert wrong_attempt["incorrect_count"] == 2
        assert float(wrong_attempt["score"]) == -1.0
    finally:
        _cleanup(mock_test.id)


# --------------------------------------------------------------------------
# P0-3: non-MCQ answers were always tallied as incorrect
# --------------------------------------------------------------------------

def _create_mixed_mock_test() -> MockTest:
    """One gradable MCQ, one subjective question, one MCQ published with no key."""
    mock_test = MockTest(
        name=f"Mixed Test {uuid.uuid4().hex[:6]}",
        slug=f"mixed-test-{uuid.uuid4().hex[:8]}",
        difficulty="medium",
        question_type="mcq",
        duration_minutes=30,
        total_marks=0,
        negative_marking=True,
        negative_marks_value=1,
        attempts_allowed=2,
        result_visibility="immediate",
        is_active=True,
    )
    mock_test.questions = [
        TestQuestion(
            question_text="Gradable multiple choice",
            question_type="mcq",
            options=["A", "B"],
            correct_answer="A",
            marks=4,
            negative_marks=2,
            sort_order=1,
        ),
        TestQuestion(
            question_text="Explain the reasoning in your own words",
            question_type="essay",
            options=None,
            correct_answer="A model answer, for manual marking",
            marks=6,
            negative_marks=3,
            sort_order=2,
        ),
        TestQuestion(
            question_text="Published without an answer key",
            question_type="mcq",
            options=["A", "B"],
            correct_answer=None,
            marks=2,
            negative_marks=1,
            sort_order=3,
        ),
    ]
    with SessionLocal() as db:
        db.add(mock_test)
        db.commit()
        db.refresh(mock_test)
        return mock_test


def test_ungradable_answers_are_not_counted_incorrect():
    """A subjective answer was falling into the `else` branch of the grading loop.

    `is_correct` is None for anything that is not auto-gradable, and None is
    falsy, so every essay/numeric answer was tallied as incorrect while scoring
    zero marks. These must instead be left for manual review.

    "Left for manual review" used to mean "counted as unanswered", which
    reported two questions the student had actually answered as never attempted.
    Pending-review is now its own tally, so the paper still partitions but each
    bucket means what its name says.
    """
    mock_test = _create_mixed_mock_test()
    try:
        user = _register_user()
        headers = _auth_headers(user["access_token"])
        question_bank = client.get(
            f"/api/v1/mock-tests/{mock_test.slug}/questions"
        ).json()
        assert len(question_bank) == 3
        by_text = {q["question_text"]: q["id"] for q in question_bank}
        mcq = by_text["Gradable multiple choice"]
        essay = by_text["Explain the reasoning in your own words"]
        keyless = by_text["Published without an answer key"]

        # Every answer is submitted, and the two ungradable ones even match the
        # stored key, so a correct answer cannot be what turned them incorrect.
        response = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/submit",
            json={
                "answers": [
                    {"question_id": mcq, "selected_answer": "A"},
                    {"question_id": essay, "selected_answer": "A model answer, for manual marking"},
                    {"question_id": keyless, "selected_answer": "A"},
                ]
            },
            headers=headers,
        )
        assert response.status_code == 200, response.text
        attempt = response.json()["attempt"]

        assert attempt["correct_count"] == 1
        assert attempt["incorrect_count"] == 0
        # Every question was answered, so none is unattempted. The two ungradable
        # answers are pending review, not marked wrong and not blank.
        assert attempt["unanswered_count"] == 0
        assert attempt["pending_review_count"] == 2
        assert (
            attempt["correct_count"]
            + attempt["incorrect_count"]
            + attempt["unanswered_count"]
            + attempt["pending_review_count"]
            == 3
        )
        # Only the gradable question contributes marks. Negative marking is on,
        # so a regression here would also show up as a negative score.
        assert float(attempt["score"]) == 4
        assert float(attempt["total_marks"]) == 12
        assert float(attempt["percentage"]) == 33.33

        rows = {q["id"]: q for q in response.json()["questions"]}
        assert rows[essay]["is_correct"] is None
        assert rows[essay]["marks_awarded"] is None
        assert rows[keyless]["is_correct"] is None
        assert rows[keyless]["marks_awarded"] is None
        assert rows[mcq]["is_correct"] is True
        assert float(rows[mcq]["marks_awarded"]) == 4
    finally:
        _cleanup(mock_test.id)


def test_wrong_mcq_still_gets_negative_marks():
    """The fix must not stop genuinely wrong MCQs from being penalised."""
    mock_test = _create_mock_test(negative_marking=True)
    try:
        user = _register_user()
        headers = _auth_headers(user["access_token"])
        question_bank = client.get(
            f"/api/v1/mock-tests/{mock_test.slug}/questions"
        ).json()
        q1 = question_bank[0]["id"]

        response = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/submit",
            json={"answers": [{"question_id": q1, "selected_answer": "B"}]},
            headers=headers,
        )
        assert response.status_code == 200, response.text
        attempt = response.json()["attempt"]
        assert attempt["correct_count"] == 0
        assert attempt["incorrect_count"] == 1
        assert attempt["unanswered_count"] == 2
        assert attempt["pending_review_count"] == 0
        assert float(attempt["score"]) == -1
    finally:
        _cleanup(mock_test.id)


def test_blank_submission_is_unattempted_not_incorrect():
    """An empty string is an omission, so it must not be negative-marked.

    The MCQ branch compared the raw string against the key, so submitting ""
    was graded wrong and cost the student negative marks, while a blank numeric
    returned None and cost nothing. The two disagreed for the same user action.
    """
    mock_test = _create_mock_test(negative_marking=True)
    try:
        user = _register_user()
        headers = _auth_headers(user["access_token"])
        question_bank = client.get(
            f"/api/v1/mock-tests/{mock_test.slug}/questions"
        ).json()
        q1 = question_bank[0]["id"]

        response = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/submit",
            json={"answers": [{"question_id": q1, "selected_answer": "   "}]},
            headers=headers,
        )
        assert response.status_code == 200, response.text
        attempt = response.json()["attempt"]
        assert attempt["correct_count"] == 0
        assert attempt["incorrect_count"] == 0
        assert attempt["unanswered_count"] == 3
        assert attempt["pending_review_count"] == 0
        # The regression this guards: blank used to score -1.
        assert float(attempt["score"]) == 0
    finally:
        _cleanup(mock_test.id)


def test_attempt_tallies_partition_the_paper():
    """correct + incorrect + unanswered + pending_review == every question.

    Each bucket is now narrower than it used to be, so this is the check that
    the four of them still account for the whole paper.
    """
    mock_test = _create_mixed_mock_test()
    try:
        user = _register_user()
        headers = _auth_headers(user["access_token"])
        question_bank = client.get(
            f"/api/v1/mock-tests/{mock_test.slug}/questions"
        ).json()
        by_text = {q["question_text"]: q["id"] for q in question_bank}

        response = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/submit",
            json={
                "answers": [
                    # correct
                    {"question_id": by_text["Gradable multiple choice"],
                     "selected_answer": "A"},
                    # pending review
                    {"question_id": by_text["Explain the reasoning in your own words"],
                     "selected_answer": "A model answer"},
                    # left blank
                ]
            },
            headers=headers,
        )
        assert response.status_code == 200, response.text
        attempt = response.json()["attempt"]
        total = len(question_bank)
        assert (
            attempt["correct_count"]
            + attempt["incorrect_count"]
            + attempt["unanswered_count"]
            + attempt["pending_review_count"]
            == total
        )
        assert attempt["correct_count"] == 1
        assert attempt["unanswered_count"] == 1
        assert attempt["pending_review_count"] == 1
    finally:
        _cleanup(mock_test.id)
