import requests


def test_browse_colleges_with_filters():
    base_url = "http://127.0.0.1:8000/api/v1/colleges"
    headers = {"Accept": "application/json"}

    def get_colleges(params=None):
        try:
            response = requests.get(
                base_url,
                params=params,
                headers=headers,
                timeout=30,
            )
        except requests.RequestException as exc:
            raise AssertionError(f"GET {base_url} failed: {exc}") from exc

        assert response.status_code == 200, (
            f"Expected HTTP 200, got {response.status_code}: {response.text}"
        )
        try:
            data = response.json()
        except ValueError as exc:
            raise AssertionError("Response was not valid JSON") from exc

        assert isinstance(data, list), "Expected the response to be a plain JSON array"
        return data

    default_rows = get_colleges()
    all_rows = get_colleges({"limit": 500, "offset": 0})

    limited_rows = get_colleges({"limit": 2, "offset": 0})
    assert len(limited_rows) <= 2, "limit=2 should return at most two rows"
    assert limited_rows == all_rows[:2], "limit=2 should return the first two rows"

    offset_rows = get_colleges({"limit": 2, "offset": 1})
    assert offset_rows == all_rows[1:3], "offset=1 should skip the first row"

    featured_rows = get_colleges({"featured": "true"})

    restrictive_rows = get_colleges({"state_id": 999999})
    assert restrictive_rows == [], "An unknown state_id should return an empty array"


if __name__ == "__main__":
    test_browse_colleges_with_filters()