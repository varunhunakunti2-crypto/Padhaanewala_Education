import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import SessionLocal
from app.main import app
from app.models import MockTest, TestQuestion

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
            f"/api/v1/mock-tests/attempts/{attempt_id}/answers/{q1}",
            json={"selected_answer": "A"},
            headers=headers,
        )
        assert correct.status_code == 200, correct.text
        assert correct.json()["is_correct"] is True
        assert float(correct.json()["marks_awarded"]) == 2

        wrong = client.put(
            f"/api/v1/mock-tests/attempts/{attempt_id}/answers/{q2}",
            json={"selected_answer": "B"},
            headers=headers,
        )
        assert wrong.status_code == 200
        assert wrong.json()["is_correct"] is False

        question_bank = client.get(
            f"/api/v1/mock-tests/{mock_test.slug}/questions"
        )
        assert question_bank.status_code == 200
        for q in question_bank.json():
            assert "correct_answer" not in q

        submit = client.post(
            f"/api/v1/mock-tests/attempts/{attempt_id}/submit",
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
            f"/api/v1/mock-tests/attempts/{attempt_id}/result",
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
            f"/api/v1/mock-tests/attempts/{attempt_id}/result",
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
            f"/api/v1/mock-tests/attempts/{first_attempt}/submit",
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
            f"/api/v1/mock-tests/attempts/{attempt_id}",
            headers=intruder_headers,
        )
        assert response.status_code == 403

        submit = client.post(
            f"/api/v1/mock-tests/attempts/{attempt_id}/submit",
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
            f"/api/v1/mock-tests/attempts/{attempt_id}/answers/{other_qid}",
            json={"selected_answer": "A"},
            headers=headers,
        )
        assert response.status_code == 404
    finally:
        _cleanup(mock_test.id)
        _cleanup(other.id)