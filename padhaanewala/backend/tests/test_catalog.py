import uuid

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Role, User

client = TestClient(app)


def _make_admin_token() -> str:
    email = f"admin.{uuid.uuid4().hex[:8]}@example.com"
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Test Admin",
            "email": email,
            "mobile": f"9{uuid.uuid4().int % 1_000_000_000:09d}",
            "password": "SecurePass123!",
        },
    )
    assert response.status_code == 201
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).first()
        admin = db.query(Role).filter(Role.name == "admin").first()
        assert admin is not None
        user.roles.append(admin)
        db.commit()
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "SecurePass123!"},
    )
    assert login.status_code == 200
    return login.json()["access_token"]


def test_list_states():
    response = client.get("/api/v1/locations/states")
    assert response.status_code == 200
    states = response.json()
    assert len(states) >= 30
    codes = {s["code"] for s in states}
    assert {"MH", "KA", "TN", "DL", "UP"} <= codes
    karnataka = next(s for s in states if s["code"] == "KA")
    assert karnataka["is_union_territory"] is False


def test_list_districts():
    states = client.get("/api/v1/locations/states").json()
    ka = next(s for s in states if s["code"] == "KA")
    response = client.get(f"/api/v1/locations/states/{ka['id']}/districts")
    assert response.status_code == 200
    districts = response.json()
    assert len(districts) >= 25
    assert any(d["name"] == "Bengaluru Urban" for d in districts)


def test_list_districts_not_found():
    response = client.get("/api/v1/locations/states/999999/districts")
    assert response.status_code == 404


def test_list_cities():
    states = client.get("/api/v1/locations/states").json()
    ka = next(s for s in states if s["code"] == "KA")
    districts = client.get(
        f"/api/v1/locations/states/{ka['id']}/districts"
    ).json()
    bengaluru = next(d for d in districts if d["name"] == "Bengaluru Urban")
    response = client.get(
        f"/api/v1/locations/districts/{bengaluru['id']}/cities"
    )
    assert response.status_code == 200
    assert any(c["name"] == "Bengaluru" for c in response.json())


def test_list_universities():
    response = client.get("/api/v1/universities")
    assert response.status_code == 200
    universities = response.json()
    assert len(universities) >= 50
    assert any(u["name"] == "Bangalore University" for u in universities)


def test_get_university():
    universities = client.get("/api/v1/universities").json()
    first = universities[0]
    response = client.get(f"/api/v1/universities/{first['id']}")
    assert response.status_code == 200
    assert response.json()["name"] == first["name"]


def test_get_university_not_found():
    response = client.get("/api/v1/universities/999999")
    assert response.status_code == 404


def test_list_colleges():
    response = client.get("/api/v1/colleges")
    assert response.status_code == 200
    colleges = response.json()
    assert len(colleges) >= 10
    assert all(c["name"] for c in colleges)


def test_list_colleges_filter_state():
    states = client.get("/api/v1/locations/states").json()
    ka = next(s for s in states if s["code"] == "KA")
    response = client.get(f"/api/v1/colleges?state_id={ka['id']}")
    assert response.status_code == 200
    assert all(c["state"] == "Karnataka" for c in response.json())


def test_get_college_detail():
    colleges = client.get("/api/v1/colleges").json()
    response = client.get(f"/api/v1/colleges/{colleges[0]['id']}")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == colleges[0]["name"]
    assert body["courses"] is not None


def test_get_college_not_found():
    response = client.get("/api/v1/colleges/999999")
    assert response.status_code == 404


def test_search_colleges():
    response = client.get("/api/v1/colleges/search", params={"q": "Bengaluru"})
    assert response.status_code == 200
    result = response.json()
    assert len(result["colleges"]) >= 1


def test_search_courses():
    response = client.get(
        "/api/v1/colleges/search", params={"q": "Bachelor of Technology"}
    )
    assert response.status_code == 200
    result = response.json()
    assert len(result["courses"]) >= 1


def test_get_college_courses():
    colleges = client.get("/api/v1/colleges").json()
    response = client.get(f"/api/v1/colleges/{colleges[0]['id']}/courses")
    assert response.status_code == 200
    assert len(response.json()) >= 1


def test_create_college_requires_admin():
    response = client.post("/api/v1/colleges", json={"name": "Test College"})
    assert response.status_code in (401, 403)


def test_admin_create_and_update_college():
    token = _make_admin_token()
    headers = {"Authorization": f"Bearer {token}"}

    create = client.post(
        "/api/v1/colleges",
        json={"name": "Test Engineering College", "city": "Chennai"},
        headers=headers,
    )
    assert create.status_code == 201
    body = create.json()
    assert body["college_id"].startswith("COLLEGE")
    college_ref = body["id"]

    update = client.put(
        f"/api/v1/colleges/{college_ref}",
        json={"overview": "Updated overview", "has_hostel": True},
        headers=headers,
    )
    assert update.status_code == 200
    assert update.json()["overview"] == "Updated overview"
    assert update.json()["has_hostel"] is True


def test_college_detail_by_slug():
    colleges = client.get("/api/v1/colleges").json()
    slug = colleges[0]["slug"]
    response = client.get(f"/api/v1/colleges/{slug}")
    assert response.status_code == 200
    assert response.json()["slug"] == slug


def test_list_scholarships():
    response = client.get("/api/v1/scholarships")
    assert response.status_code == 200
    scholarships = response.json()
    assert len(scholarships) >= 5
    assert any(s["ownership"] == "government" for s in scholarships)


def test_scholarship_filter_state():
    states = client.get("/api/v1/locations/states").json()
    ka = next(s for s in states if s["code"] == "KA")
    response = client.get(f"/api/v1/scholarships?state_id={ka['id']}")
    assert response.status_code == 200
    assert all(s["state_name"] == "Karnataka" for s in response.json())


def test_get_scholarship():
    scholarships = client.get("/api/v1/scholarships").json()
    response = client.get(f"/api/v1/scholarships/{scholarships[0]['id']}")
    assert response.status_code == 200
    assert response.json()["name"] == scholarships[0]["name"]


def test_list_exams():
    response = client.get("/api/v1/exams")
    assert response.status_code == 200
    exams = response.json()
    assert len(exams) >= 5
    assert any(e["exam_type"] == "national" for e in exams)


def test_get_exam():
    exams = client.get("/api/v1/exams").json()
    response = client.get(f"/api/v1/exams/{exams[0]['id']}")
    assert response.status_code == 200
    assert response.json()["name"] == exams[0]["name"]


def test_get_exam_not_found():
    response = client.get("/api/v1/exams/999999")
    assert response.status_code == 404