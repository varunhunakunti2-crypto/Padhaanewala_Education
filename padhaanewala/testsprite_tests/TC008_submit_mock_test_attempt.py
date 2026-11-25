
# Loaded from tmp/config.json so generated scripts never embed credentials.
_TESTSPRITE_FIXTURE_HELPER = True
import json as _json
from pathlib import Path as _Path

_TESTSPRITE_CONFIG = _json.loads(
    (_Path(__file__).resolve().parent / "tmp" / "config.json").read_text(encoding="utf-8")
)
TEST_EMAIL = _TESTSPRITE_CONFIG["loginUser"]
TEST_PASSWORD = _TESTSPRITE_CONFIG["loginPassword"]
import requests


def test_submit_mock_test_attempt():
    base_url = "http://127.0.0.1:8000/api/v1"
    session = requests.Session()
    session.headers.update({"Accept": "application/json"})

    try:
        login_response = session.post(
            f"{base_url}/auth/login",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
            },
            timeout=30,
        )
        assert login_response.status_code == 200, (
            f"Login failed with status {login_response.status_code}: "
            f"{login_response.text}"
        )
        login_data = login_response.json()
        token = login_data.get("access_token")
        assert token, "Login response did not include access_token"
        session.headers["Authorization"] = f"Bearer {token}"

        catalog_response = session.get(
            f"{base_url}/mock-tests",
            timeout=30,
        )
        assert catalog_response.status_code == 200, (
            f"Mock test catalog request failed with status "
            f"{catalog_response.status_code}: {catalog_response.text}"
        )
        papers = catalog_response.json()
        assert isinstance(papers, list), "Mock test catalog must be a plain array"

        def has_no_available_attempts(paper):
            for key in ("available_attempts", "attempts_remaining", "remaining_attempts"):
                value = paper.get(key)
                if value is not None:
                    try:
                        if int(value) <= 0:
                            return True
                    except (TypeError, ValueError):
                        pass
            return False

        candidates = []
        for paper in papers:
            if not isinstance(paper, dict) or has_no_available_attempts(paper):
                continue
            question_count = paper.get("question_count", paper.get("questions_count"))
            if question_count is not None:
                try:
                    if int(question_count) <= 0:
                        continue
                except (TypeError, ValueError):
                    pass

            paper_ref = paper.get("ref") or paper.get("slug") or paper.get("id")
            if paper_ref is not None:
                candidates.append(str(paper_ref))

        assert candidates, "No mock test paper with available attempts was found"

        started_attempt = None
        paper_ref = None
        for candidate_ref in candidates:
            response = session.post(
                f"{base_url}/mock-tests/{candidate_ref}/start",
                json={},
                timeout=30,
            )
            if response.status_code == 200:
                started_attempt = response.json()
                paper_ref = candidate_ref
                break

        assert started_attempt is not None, "Could not start an available mock test paper"
        attempt_id = started_attempt.get("attempt_id")
        questions = started_attempt.get("questions")
        assert attempt_id is not None, "Start response did not include attempt_id"
        assert isinstance(questions, list) and questions, (
            "Start response must include a non-empty questions array"
        )

        answers = []
        for question in questions:
            assert isinstance(question, dict), "Each question must be an object"
            question_id = question.get("question_id", question.get("id"))
            assert question_id is not None, "A started question did not include an ID"
            answers.append(
                {
                    "question_id": int(question_id),
                    "selected_answer": "A",
                }
            )

        submit_url = f"{base_url}/mock-tests/{paper_ref}/submit"
        submit_response = session.post(
            submit_url,
            json={"answers": answers},
            timeout=30,
        )
        assert submit_response.status_code == 200, (
            f"Submission failed with status {submit_response.status_code}: "
            f"{submit_response.text}"
        )
        result_data = submit_response.json()
        assert isinstance(result_data, dict), "Submit response must be a JSON object"
        assert result_data.get("attempt_id") is not None, (
            "Submit response did not include attempt_id"
        )

        score_keys = {
            "score",
            "total_score",
            "percentage",
            "correct_answers",
            "correct_count",
            "marks_obtained",
        }

        def contains_score_data(value):
            if isinstance(value, dict):
                if score_keys.intersection(value):
                    return True
                return any(contains_score_data(item) for item in value.values())
            if isinstance(value, list):
                return any(contains_score_data(item) for item in value)
            return False

        assert contains_score_data(result_data), (
            "Submit response did not include score or result data"
        )

        duplicate_response = session.post(
            submit_url,
            json={"answers": answers},
            timeout=30,
        )
        assert duplicate_response.status_code == 400, (
            f"Submitting the same attempt twice should return 400, got "
            f"{duplicate_response.status_code}: {duplicate_response.text}"
        )

        unauthenticated_response = requests.post(
            submit_url,
            json={"answers": answers},
            timeout=30,
        )
        assert unauthenticated_response.status_code == 401, (
            f"Unauthenticated submission should return 401, got "
            f"{unauthenticated_response.status_code}: "
            f"{unauthenticated_response.text}"
        )
    finally:
        session.close()


if __name__ == "__main__":
    test_submit_mock_test_attempt()