import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import StudentProfile, User

client = TestClient(app)


def _create_authenticated_student():
    email = f"student.{uuid.uuid4().hex[:8]}@example.com"
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Test Student",
            "email": email,
            "mobile": f"9{uuid.uuid4().int % 1_000_000_000:09d}",
            "password": "Password123!",
        },
    )
    assert reg.status_code == 201
    
    # Ensure student profile exists
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        prof = db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
        if not prof:
            prof = StudentProfile(user_id=user.id, target_exam="jee-main")
            db.add(prof)
            db.commit()

    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_1_get_courses():
    res = client.get("/api/v1/courses")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)


def test_2_get_courses_category_engineering():
    res = client.get("/api/v1/courses?category=Engineering")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)


def test_3_get_courses_degree_bachelor():
    res = client.get("/api/v1/courses?degree=Bachelor")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)


def test_4_get_courses_categories():
    res = client.get("/api/v1/courses/categories")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)


def test_5_get_courses_slug():
    courses = client.get("/api/v1/courses").json()
    if courses:
        slug = courses[0]["slug"]
        res = client.get(f"/api/v1/courses/{slug}")
        assert res.status_code == 200
        assert res.json()["slug"] == slug
    else:
        # test with non-existent slug expecting 404
        res = client.get("/api/v1/courses/non-existent-course-slug")
        assert res.status_code == 404


def test_6_get_predictor_exams():
    res = client.get("/api/v1/predictor/exams")
    assert res.status_code == 200
    exams = res.json()
    assert isinstance(exams, list)
    assert len(exams) > 0


def test_7_post_predictor_valid():
    res = client.post(
        "/api/v1/predictor",
        json={
            "exam": "jee-main",
            "category": "General",
            "rank": 5000,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert "results" in data


def test_8_post_predictor_bad_input():
    # Bad exam
    res = client.post(
        "/api/v1/predictor",
        json={
            "exam": "invalid-exam-xyz",
            "category": "General",
            "rank": 5000,
        },
    )
    assert res.status_code == 400

    # Invalid rank (gt=0 requirement)
    res2 = client.post(
        "/api/v1/predictor",
        json={
            "exam": "jee-main",
            "category": "General",
            "rank": -10,
        },
    )
    assert res2.status_code == 422


def test_9_to_14_saved_colleges_flow():
    headers = _create_authenticated_student()

    # 9 GET /saved-colleges (empty)
    res9 = client.get("/api/v1/saved-colleges", headers=headers)
    assert res9.status_code == 200
    assert res9.json() == []

    # Get a college id to save
    colleges = client.get("/api/v1/colleges").json()
    assert len(colleges) > 0, "Colleges list must not be empty to test saved colleges"
    target_college_id = colleges[0]["id"]

    # 10 POST /saved-colleges (save)
    res10 = client.post(
        f"/api/v1/saved-colleges?college_id={target_college_id}",
        headers=headers,
    )
    assert res10.status_code == 201
    saved_item = res10.json()
    assert saved_item["college_id"] == target_college_id

    # 11 POST /saved-colleges (duplicate)
    res11 = client.post(
        f"/api/v1/saved-colleges?college_id={target_college_id}",
        headers=headers,
    )
    assert res11.status_code == 409
    assert res11.json()["detail"] == "College already saved"

    # 12 GET /saved-colleges (1 item)
    res12 = client.get("/api/v1/saved-colleges", headers=headers)
    assert res12.status_code == 200
    items = res12.json()
    assert len(items) == 1
    assert items[0]["college_id"] == target_college_id

    # 13 DELETE /saved-colleges/{id}
    res13 = client.delete(
        f"/api/v1/saved-colleges/{target_college_id}",
        headers=headers,
    )
    assert res13.status_code == 204

    # 14 GET /saved-colleges (after unsave)
    res14 = client.get("/api/v1/saved-colleges", headers=headers)
    assert res14.status_code == 200
    assert res14.json() == []


def test_15_get_saved_colleges_no_auth():
    res15 = client.get("/api/v1/saved-colleges")
    assert res15.status_code == 401
