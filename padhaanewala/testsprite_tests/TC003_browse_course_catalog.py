import requests


def test_browse_course_catalog():
    base_url = "http://127.0.0.1:8000".rstrip("/")
    endpoint = f"{base_url}/api/v1/courses"
    headers = {"Accept": "application/json"}
    timeout = 30

    def get_json(params=None):
        try:
            response = requests.get(
                endpoint,
                params=params,
                headers=headers,
                timeout=timeout,
            )
        except requests.RequestException as exc:
            raise AssertionError(f"Course catalog request failed: {exc}") from exc

        assert response.status_code == 200, (
            f"Expected HTTP 200, received {response.status_code}: {response.text}"
        )
        try:
            return response.json()
        except ValueError as exc:
            raise AssertionError("Course catalog response was not valid JSON") from exc

    def get_courses(payload):
        if isinstance(payload, list):
            return payload

        assert isinstance(payload, dict), (
            f"Expected a list or object response, got {type(payload).__name__}"
        )

        for key in ("courses", "items", "results", "data"):
            value = payload.get(key)
            if isinstance(value, list):
                return value
            if isinstance(value, dict):
                nested = get_courses(value)
                if nested is not None:
                    return nested

        raise AssertionError(
            "Course catalog response does not contain a recognizable course list"
        )

    baseline = get_json()
    baseline_courses = get_courses(baseline)

    if baseline_courses:
        course = baseline_courses[0]
        assert isinstance(course, dict), "Expected each course item to be an object"

        course_name = next(
            (
                course[key]
                for key in ("name", "title", "course_name")
                if isinstance(course.get(key), str) and course[key].strip()
            ),
            None,
        )
        assert course_name, "A catalog course must include a searchable name"

        search_params = {"search": course_name}
        filter_key = next(
            (
                key
                for key in ("category", "level", "stream", "degree_type")
                if course.get(key) is not None
                and isinstance(course[key], (str, int, float))
                and str(course[key]).strip()
            ),
            None,
        )
        if filter_key:
            search_params[filter_key] = course[filter_key]

        matching_payload = get_json(search_params)
        matching_courses = get_courses(matching_payload)
        assert matching_courses, "A valid course search and filter returned no courses"

        identity_keys = ("id", "course_id", "ref", "slug", "name", "title", "course_name")
        course_identity = {
            (key, str(course[key]))
            for key in identity_keys
            if course.get(key) is not None
        }
        assert course_identity, "The matching course has no identifiable fields"
        assert any(
            any((key, str(result.get(key))) in course_identity for key in identity_keys)
            for result in matching_courses
            if isinstance(result, dict)
        ), "The search results did not include the course used to construct the query"

        for result in matching_courses:
            assert isinstance(result, dict), "Expected each matching course to be an object"
            assert any(
                isinstance(result.get(key), str)
                and course_name.casefold() in result[key].casefold()
                for key in ("name", "title", "course_name")
            ), "A returned course did not match the search term"


if __name__ == "__main__":
    test_browse_course_catalog()
