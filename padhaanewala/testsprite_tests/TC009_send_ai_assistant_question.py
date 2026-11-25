import requests


def test_send_ai_assistant_question():
    url = "http://localhost:3000/api/ai"
    headers = {"Content-Type": "application/json"}

    try:
        response = requests.post(
            url,
            headers=headers,
            json={"message": "Which colleges are best in Karnataka for engineering?"},
            timeout=30,
        )
    except requests.RequestException as exc:
        raise AssertionError(f"AI assistant request failed: {exc}") from exc

    assert response.status_code == 200, (
        f"Expected HTTP 200, received {response.status_code}: {response.text}"
    )
    try:
        data = response.json()
    except ValueError as exc:
        raise AssertionError("AI assistant response was not valid JSON") from exc

    assert isinstance(data, dict), "AI assistant response must be a JSON object"
    assert isinstance(data.get("reply"), str), "Response must contain a string field named 'reply'"
    assert data["reply"].strip(), "Assistant reply must not be empty"

    try:
        empty_response = requests.post(
            url,
            headers=headers,
            json={"message": ""},
            timeout=30,
        )
    except requests.RequestException as exc:
        raise AssertionError(f"Empty-message request failed: {exc}") from exc

    assert empty_response.status_code == 200, (
        f"Expected HTTP 200 for an empty message, received "
        f"{empty_response.status_code}: {empty_response.text}"
    )
    try:
        empty_data = empty_response.json()
    except ValueError as exc:
        raise AssertionError("Empty-message response was not valid JSON") from exc

    assert isinstance(empty_data, dict), "Empty-message response must be a JSON object"
    assert isinstance(empty_data.get("reply"), str), (
        "Empty-message response must contain a string field named 'reply'"
    )
    empty_reply = empty_data["reply"].strip()
    assert empty_reply, "Empty-message response must contain a friendly reply"
    assert any(
        phrase in empty_reply.lower()
        for phrase in ("type", "ask", "question", "message")
    ), "Empty-message reply should prompt the user to type a question"


if __name__ == "__main__":
    test_send_ai_assistant_question()