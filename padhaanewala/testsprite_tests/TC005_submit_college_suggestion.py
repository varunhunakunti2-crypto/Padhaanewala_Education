
# Loaded from tmp/config.json so generated scripts never embed credentials.
_TESTSPRITE_FIXTURE_HELPER = True
import json as _json
from pathlib import Path as _Path

_TESTSPRITE_CONFIG = _json.loads(
    (_Path(__file__).resolve().parent / "tmp" / "config.json").read_text(encoding="utf-8")
)
TEST_EMAIL = _TESTSPRITE_CONFIG["loginUser"]
TEST_PASSWORD = _TESTSPRITE_CONFIG["loginPassword"]
import uuid

import requests


def test_submit_college_suggestion():
    base_url = "http://127.0.0.1:8000"
    timeout = 30
    session = requests.Session()
    created_submission_id = None

    try:
        login_response = session.post(
            f"{base_url}/api/v1/auth/login",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
            },
            timeout=timeout,
        )
        assert login_response.status_code == 200, (
            f"Login failed with status {login_response.status_code}"
        )
        login_data = login_response.json()
        access_token = login_data.get("access_token")
        assert isinstance(access_token, str) and access_token, (
            "Login response did not contain an access_token"
        )

        auth_headers = {"Authorization": f"Bearer {access_token}"}
        submission_url = f"{base_url}/api/v1/college-submissions"

        unauthenticated_response = requests.post(
            submission_url,
            json={"proposed_name": f"Unauthenticated College {uuid.uuid4().hex}"},
            timeout=timeout,
        )
        assert unauthenticated_response.status_code == 401, (
            f"Expected unauthenticated request to return 401, got "
            f"{unauthenticated_response.status_code}"
        )

        empty_response = session.post(
            submission_url,
            headers=auth_headers,
            json={},
            timeout=timeout,
        )
        assert empty_response.status_code == 422, (
            f"Expected empty submission to return 422, got "
            f"{empty_response.status_code}"
        )

        proposed_name = f"Test College {uuid.uuid4().hex}"
        payload = {
            "proposed_name": proposed_name,
            "proposed_city": "Test City",
            "proposed_state_name": "Test State",
            "proposed_website": "https://example.com",
        }
        create_response = session.post(
            submission_url,
            headers=auth_headers,
            json=payload,
            timeout=timeout,
        )
        assert create_response.status_code == 201, (
            f"Expected valid submission to return 201, got "
            f"{create_response.status_code}: {create_response.text}"
        )

        create_data = create_response.json()
        if isinstance(create_data, dict):
            created_submission_id = create_data.get("id")

        submissions_response = session.get(
            f"{submission_url}/my",
            headers=auth_headers,
            timeout=timeout,
        )
        assert submissions_response.status_code == 200, (
            f"Expected personal submissions list to return 200, got "
            f"{submissions_response.status_code}"
        )
        submissions = submissions_response.json()
        assert isinstance(submissions, list), (
            "Personal submissions endpoint must return a plain JSON array"
        )

        matching_submissions = [
            item
            for item in submissions
            if isinstance(item, dict) and item.get("proposed_name") == proposed_name
        ]
        assert matching_submissions, (
            "The newly created submission was not recorded for the authenticated user"
        )
        if created_submission_id is None:
            created_submission_id = matching_submissions[0].get("id")

        assert matching_submissions[0].get("proposed_city") == payload["proposed_city"]
        assert (
            matching_submissions[0].get("proposed_state_name")
            == payload["proposed_state_name"]
        )
    except requests.RequestException as exc:
        raise AssertionError(f"HTTP request failed: {exc}") from exc
    finally:
        if created_submission_id is not None:
            try:
                delete_response = session.delete(
                    f"{base_url}/api/v1/college-submissions/{created_submission_id}",
                    headers=(
                        {"Authorization": f"Bearer {access_token}"}
                        if "access_token" in locals()
                        else {}
                    ),
                    timeout=timeout,
                )
                assert delete_response.status_code in (200, 204), (
                    f"Failed to clean up created submission; got "
                    f"{delete_response.status_code}"
                )
            except requests.RequestException as exc:
                raise AssertionError(f"Submission cleanup request failed: {exc}") from exc


if __name__ == "__main__":
    test_submit_college_suggestion()