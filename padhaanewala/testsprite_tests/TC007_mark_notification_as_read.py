
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


def test_mark_notification_as_read():
    base_url = "http://127.0.0.1:8000/api/v1"
    username = TEST_EMAIL
    password = TEST_PASSWORD
    unread_notification_id = 4
    other_user_notification_id = 5
    unknown_notification_id = 999999999
    session = requests.Session()
    session.headers.update({"Accept": "application/json"})

    try:
        login_response = session.post(
            f"{base_url}/auth/login",
            json={"email": username, "password": password},
            timeout=30,
        )
        assert login_response.status_code == 200, (
            f"Login failed with status {login_response.status_code}"
        )
        login_data = login_response.json()
        assert isinstance(login_data, dict), "Login response must be a JSON object"
        access_token = login_data.get("access_token")
        assert access_token, "Login response did not include an access_token"

        session.headers.update({"Authorization": f"Bearer {access_token}"})

        mark_read_response = session.put(
            f"{base_url}/notifications/{unread_notification_id}/read",
            timeout=30,
        )
        assert mark_read_response.status_code == 200, (
            f"Mark-read request failed with status {mark_read_response.status_code}"
        )
        mark_read_data = mark_read_response.json()
        assert isinstance(mark_read_data, dict), "Mark-read response must be a JSON object"
        assert mark_read_data.get("is_read") is True, (
            "Mark-read response should report is_read as true"
        )

        notifications_response = session.get(
            f"{base_url}/notifications/my",
            timeout=30,
        )
        assert notifications_response.status_code == 200, (
            f"Fetching notifications failed with status {notifications_response.status_code}"
        )
        notifications = notifications_response.json()
        assert isinstance(notifications, list), (
            "GET /notifications/my should return a plain JSON array"
        )
        updated_notification = next(
            (
                notification
                for notification in notifications
                if isinstance(notification, dict)
                and notification.get("id") == unread_notification_id
            ),
            None,
        )
        assert updated_notification is not None, (
            "The caller's notification was not found in the notifications list"
        )
        assert updated_notification.get("is_read") is True, (
            "The caller's notification should be read after the update"
        )

        unknown_response = session.put(
            f"{base_url}/notifications/{unknown_notification_id}/read",
            timeout=30,
        )
        assert unknown_response.status_code == 404, (
            f"Unknown notification should return 404, got {unknown_response.status_code}"
        )

        other_user_response = session.put(
            f"{base_url}/notifications/{other_user_notification_id}/read",
            timeout=30,
        )
        assert other_user_response.status_code == 404, (
            "Updating another user's notification should return 404, "
            f"got {other_user_response.status_code}"
        )
    except requests.RequestException as exc:
        raise AssertionError("A request to the notification API failed") from exc


if __name__ == "__main__":
    test_mark_notification_as_read()