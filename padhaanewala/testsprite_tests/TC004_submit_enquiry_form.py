import requests


def test_submit_enquiry_form():
    base_url = "http://127.0.0.1:8000".rstrip("/")
    endpoint = f"{base_url}/api/v1/enquiries"
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    created_enquiry_id = None

    valid_payload = {
        "name": "Test Enquiry",
        "email": "test.enquiry@example.com",
        "mobile": "9876543210",
        "message": "I would like more information about admissions.",
        "age_band": "18_plus",
    }

    def post_payload(payload):
        try:
            return requests.post(
                endpoint,
                json=payload,
                headers=headers,
                timeout=30,
            )
        except requests.RequestException as exc:
            raise AssertionError(f"Enquiry request failed: {exc}") from exc

    def assert_validation_error(response):
        assert response.status_code == 422, (
            f"Expected HTTP 422, got {response.status_code}: {response.text}"
        )
        try:
            body = response.json()
        except ValueError as exc:
            raise AssertionError("Validation response was not valid JSON") from exc
        assert isinstance(body, dict), "Validation response must be a JSON object"
        assert isinstance(body.get("detail"), list), (
            "Validation response must contain a detail array"
        )

    try:
        response = post_payload(valid_payload)
        assert response.status_code == 201, (
            f"Expected HTTP 201, got {response.status_code}: {response.text}"
        )
        try:
            body = response.json()
        except ValueError as exc:
            raise AssertionError("Successful response was not valid JSON") from exc

        assert isinstance(body, dict), "Successful response must be a JSON object"
        enquiry = body.get("data", body.get("enquiry", body))
        assert isinstance(enquiry, dict), "Response must contain enquiry data"
        assert enquiry.get("name") == valid_payload["name"], (
            "Created enquiry must include the submitted name"
        )

        created_enquiry_id = (
            enquiry.get("id")
            or enquiry.get("enquiry_id")
            or body.get("id")
            or body.get("enquiry_id")
        )

        invalid_email_payload = {
            **valid_payload,
            "email": "not-a-valid-email",
        }
        assert_validation_error(post_payload(invalid_email_payload))

        missing_required_fields_payload = {}
        assert_validation_error(post_payload(missing_required_fields_payload))

        unknown_field_payload = {
            **valid_payload,
            "unexpected_field": "should be rejected",
        }
        assert_validation_error(post_payload(unknown_field_payload))
    finally:
        if created_enquiry_id is not None:
            try:
                requests.delete(
                    f"{endpoint}/{created_enquiry_id}",
                    headers=headers,
                    timeout=30,
                )
            except requests.RequestException:
                pass


if __name__ == "__main__":
    test_submit_enquiry_form()