
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


def test_save_college_to_student_account():
    base_url = "http://127.0.0.1:8000".rstrip("/")
    session = requests.Session()
    created_college_id = None

    try:
        unauthenticated_response = session.post(
            f"{base_url}/api/v1/saved-colleges",
            params={"college_id": 1},
            timeout=30,
        )
        assert unauthenticated_response.status_code == 401, (
            f"Expected 401 for unauthenticated save, got "
            f"{unauthenticated_response.status_code}"
        )

        login_response = session.post(
            f"{base_url}/api/v1/auth/login",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
            },
            timeout=30,
        )
        assert login_response.status_code == 200, (
            f"Login failed with status {login_response.status_code}"
        )
        login_data = login_response.json()
        access_token = login_data.get("access_token")
        assert access_token, "Login response did not contain an access_token"
        session.headers.update({"Authorization": f"Bearer {access_token}"})

        colleges_response = session.get(
            f"{base_url}/api/v1/colleges",
            timeout=30,
        )
        assert colleges_response.status_code == 200, (
            f"Could not retrieve colleges: {colleges_response.status_code}"
        )

        colleges_data = colleges_response.json()
        college_ids = []

        def collect_college_ids(value):
            if isinstance(value, list):
                for item in value:
                    collect_college_ids(item)
            elif isinstance(value, dict):
                college_id = value.get("id")
                if isinstance(college_id, int) and not isinstance(college_id, bool):
                    college_ids.append(college_id)
                else:
                    for nested_value in value.values():
                        collect_college_ids(nested_value)

        collect_college_ids(colleges_data)
        college_ids = list(dict.fromkeys(college_ids))
        assert college_ids, "No colleges with integer IDs were returned"

        saved_response = session.get(
            f"{base_url}/api/v1/saved-colleges",
            timeout=30,
        )
        assert saved_response.status_code == 200, (
            f"Could not retrieve saved colleges: {saved_response.status_code}"
        )
        saved_data = saved_response.json()
        saved_ids = set()

        def collect_saved_ids(value):
            if isinstance(value, list):
                for item in value:
                    collect_saved_ids(item)
            elif isinstance(value, dict):
                college_id = value.get("college_id")
                if isinstance(college_id, int) and not isinstance(college_id, bool):
                    saved_ids.add(college_id)

                college = value.get("college")
                if isinstance(college, dict):
                    nested_id = college.get("id")
                    if isinstance(nested_id, int) and not isinstance(nested_id, bool):
                        saved_ids.add(nested_id)

                if not any(
                    key in value for key in ("college_id", "college")
                ):
                    record_id = value.get("id")
                    if isinstance(record_id, int) and not isinstance(record_id, bool):
                        saved_ids.add(record_id)

                for nested_value in value.values():
                    if isinstance(nested_value, (list, dict)):
                        collect_saved_ids(nested_value)

        collect_saved_ids(saved_data)
        unsaved_college_ids = [
            college_id for college_id in college_ids if college_id not in saved_ids
        ]
        assert unsaved_college_ids, "No unsaved college is available for this test"
        college_id = unsaved_college_ids[0]

        invalid_id_response = session.post(
            f"{base_url}/api/v1/saved-colleges",
            params={"college_id": "not-an-integer"},
            timeout=30,
        )
        assert invalid_id_response.status_code == 422, (
            f"Expected 422 for a non-integer college ID, got "
            f"{invalid_id_response.status_code}"
        )

        nonexistent_id = max(college_ids) + 1_000_000
        nonexistent_response = session.post(
            f"{base_url}/api/v1/saved-colleges",
            params={"college_id": nonexistent_id},
            timeout=30,
        )
        assert nonexistent_response.status_code == 404, (
            f"Expected 404 for a nonexistent college ID, got "
            f"{nonexistent_response.status_code}"
        )

        save_response = session.post(
            f"{base_url}/api/v1/saved-colleges",
            params={"college_id": college_id},
            timeout=30,
        )
        assert save_response.status_code == 201, (
            f"Expected 201 when saving a valid college, got "
            f"{save_response.status_code}"
        )
        created_college_id = college_id

        duplicate_response = session.post(
            f"{base_url}/api/v1/saved-colleges",
            params={"college_id": college_id},
            timeout=30,
        )
        assert duplicate_response.status_code == 409, (
            f"Expected 409 when saving a duplicate college, got "
            f"{duplicate_response.status_code}"
        )

        verification_response = session.get(
            f"{base_url}/api/v1/saved-colleges",
            timeout=30,
        )
        assert verification_response.status_code == 200, (
            f"Could not verify saved colleges: {verification_response.status_code}"
        )
        verification_data = verification_response.json()
        verified_saved_ids = set()
        collect_saved_ids(verification_data)
        verified_saved_ids.update(saved_ids)
        assert college_id in verified_saved_ids, (
            "The saved college was not present in the current user's saved colleges"
        )

    except requests.RequestException as exc:
        raise AssertionError(f"HTTP request failed: {exc}") from exc
    finally:
        if created_college_id is not None:
            try:
                delete_response = session.delete(
                    f"{base_url}/api/v1/saved-colleges/{created_college_id}",
                    timeout=30,
                )
                assert delete_response.status_code == 204, (
                    f"Expected 204 when deleting the saved college, got "
                    f"{delete_response.status_code}"
                )
            except requests.RequestException as exc:
                raise AssertionError(f"Cleanup request failed: {exc}") from exc
        session.close()


if __name__ == "__main__":
    test_save_college_to_student_account()