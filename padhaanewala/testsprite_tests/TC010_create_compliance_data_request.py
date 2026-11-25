
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


def test_create_compliance_data_request():
    base_url = "http://127.0.0.1:8000"
    login_url = f"{base_url}/api/v1/auth/login"
    requests_url = f"{base_url}/api/v1/compliance/requests"
    username = TEST_EMAIL
    password = TEST_PASSWORD
    timeout = 30
    session = requests.Session()

    try:
        login_response = session.post(
            login_url,
            json={"email": username, "password": password},
            headers={"Content-Type": "application/json"},
            timeout=timeout,
        )
        assert login_response.status_code == 200, (
            f"Login failed with status {login_response.status_code}"
        )
        login_data = login_response.json()
        assert isinstance(login_data, dict) and login_data.get("access_token"), (
            "Login response did not contain an access_token"
        )

        token = login_data["access_token"]
        auth_headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        unauthenticated_response = session.post(
            requests_url,
            json={
                "request_type": "access",
                "details": "Unauthenticated compliance request test",
            },
            headers={"Content-Type": "application/json"},
            timeout=timeout,
        )
        assert unauthenticated_response.status_code == 401, (
            "Unauthenticated compliance request should be denied"
        )

        missing_details_response = session.post(
            requests_url,
            json={"request_type": "access"},
            headers=auth_headers,
            timeout=timeout,
        )
        assert missing_details_response.status_code == 422, (
            "A request without required details should return 422"
        )

        invalid_type_response = session.post(
            requests_url,
            json={
                "request_type": "unsupported",
                "details": "Compliance request with an unsupported type",
            },
            headers=auth_headers,
            timeout=timeout,
        )
        assert invalid_type_response.status_code == 422, (
            "An unsupported request_type should return 422"
        )
        invalid_type_body = invalid_type_response.json()
        assert isinstance(invalid_type_body, dict) and "detail" in invalid_type_body, (
            "The invalid request_type response should include detail"
        )

        # Unique details make the case safe to rerun: a previous pass leaves an
        # open request behind, and an identical one would correctly hit the
        # duplicate guard (409) before this run can assert 201.
        payload = {
            "request_type": "access",
            "subject": "TC010 compliance request",
            "details": f"Please provide a copy of my personal data. [{uuid.uuid4()}]",
        }
        create_response = session.post(
            requests_url,
            json=payload,
            headers=auth_headers,
            timeout=timeout,
        )
        assert create_response.status_code == 201, (
            f"Valid compliance request should return 201, got {create_response.status_code}"
        )

        created_data = create_response.json()
        assert isinstance(created_data, dict), "Create response should be a JSON object"
        assert created_data.get("id") is not None, "Create response should include an id"
        assert created_data.get("request_type") == "access", (
            "Created request should have request_type 'access'"
        )
        request_id = created_data["id"]

        list_response = session.get(
            requests_url,
            headers=auth_headers,
            timeout=timeout,
        )
        assert list_response.status_code == 200, (
            f"Listing compliance requests failed with status {list_response.status_code}"
        )
        listed_requests = list_response.json()
        assert isinstance(listed_requests, list), (
            "GET compliance requests should return a plain JSON array"
        )
        assert any(
            isinstance(item, dict) and str(item.get("id")) == str(request_id)
            for item in listed_requests
        ), "The newly created request was not present in the requests list"

        duplicate_response = session.post(
            requests_url,
            json=payload,
            headers=auth_headers,
            timeout=timeout,
        )
        assert duplicate_response.status_code == 409, (
            f"An identical open request should return 409, got {duplicate_response.status_code}"
        )

    except requests.RequestException as exc:
        raise AssertionError(f"HTTP request failed: {type(exc).__name__}") from exc
    finally:
        session.close()


if __name__ == "__main__":
    test_create_compliance_data_request()