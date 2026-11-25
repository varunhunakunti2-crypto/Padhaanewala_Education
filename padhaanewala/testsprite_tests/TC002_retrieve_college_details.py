import requests


def test_retrieve_college_details():
    base_url = "http://127.0.0.1:8000/api/v1"
    timeout = 30

    def extract_colleges(payload):
        if isinstance(payload, list):
            return payload
        if not isinstance(payload, dict):
            return []

        for key in ("items", "colleges", "results"):
            value = payload.get(key)
            if isinstance(value, list):
                return value

        data = payload.get("data")
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            for key in ("items", "colleges", "results"):
                value = data.get(key)
                if isinstance(value, list):
                    return value
        return []

    def extract_detail(payload):
        if not isinstance(payload, dict):
            return None
        data = payload.get("data")
        if isinstance(data, dict):
            return data
        for key in ("college", "item", "result"):
            value = payload.get(key)
            if isinstance(value, dict):
                return value
        return payload

    try:
        listing_response = requests.get(
            f"{base_url}/colleges",
            timeout=timeout,
            headers={"Accept": "application/json"},
        )
    except requests.RequestException as exc:
        raise AssertionError(f"Could not retrieve the college catalogue: {exc}") from exc

    assert listing_response.status_code == 200, (
        f"Expected catalogue status 200, got {listing_response.status_code}: "
        f"{listing_response.text}"
    )
    listing_payload = listing_response.json()
    colleges = extract_colleges(listing_payload)
    assert colleges, "Expected the deterministic college catalogue to contain at least one college"

    college = colleges[0]
    assert isinstance(college, dict), "Expected a college catalogue entry to be an object"

    college_ref = next(
        (
            college[key]
            for key in ("college_ref", "slug", "id", "college_id")
            if college.get(key) is not None and str(college[key]).strip()
        ),
        None,
    )
    assert college_ref is not None, "College catalogue entry has no usable reference"

    try:
        detail_response = requests.get(
            f"{base_url}/colleges/{college_ref}",
            timeout=timeout,
            headers={"Accept": "application/json"},
        )
    except requests.RequestException as exc:
        raise AssertionError(f"Could not retrieve college details: {exc}") from exc

    assert detail_response.status_code == 200, (
        f"Expected college detail status 200, got {detail_response.status_code}: "
        f"{detail_response.text}"
    )
    detail = extract_detail(detail_response.json())
    assert isinstance(detail, dict), "Expected college details to be a JSON object"
    assert detail, "Expected college detail data to be non-empty"

    expected_name = next(
        (
            college[key]
            for key in ("name", "college_name", "title")
            if college.get(key) is not None
        ),
        None,
    )
    actual_name = next(
        (
            detail[key]
            for key in ("name", "college_name", "title")
            if detail.get(key) is not None
        ),
        None,
    )
    if expected_name is not None:
        assert actual_name == expected_name, (
            f"Detail name {actual_name!r} does not match catalogue name {expected_name!r}"
        )

    for key in ("college_ref", "slug", "id", "college_id"):
        if key in college and key in detail:
            assert str(detail[key]) == str(college[key]), (
                f"Detail reference field {key!r} does not match the catalogue entry"
            )

    unknown_ref = "tc002-college-reference-that-does-not-exist"
    try:
        not_found_response = requests.get(
            f"{base_url}/colleges/{unknown_ref}",
            timeout=timeout,
            headers={"Accept": "application/json"},
        )
    except requests.RequestException as exc:
        raise AssertionError(f"Could not request an unknown college reference: {exc}") from exc

    assert not_found_response.status_code == 404, (
        f"Expected unknown college reference status 404, "
        f"got {not_found_response.status_code}: {not_found_response.text}"
    )


if __name__ == "__main__":
    test_retrieve_college_details()