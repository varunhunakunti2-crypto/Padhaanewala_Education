import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import SessionLocal
from app.main import app
from app.models import College, CollegeCourse, Course, Role, User

client = TestClient(app)


def _unique(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:8]}@example.com"


def _unique_mobile() -> str:
    return f"9{uuid.uuid4().int % 1_000_000_000:09d}"


def _register_user() -> dict:
    payload = {
        "name": "Test Admin",
        "email": _unique("admin"),
        "mobile": _unique_mobile(),
        "password": "SecurePass123!",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    return {**payload, **response.json()}


def _make_admin(email: str) -> None:
    with SessionLocal() as db:
        role = db.scalar(select(Role).where(Role.name == "admin"))
        if role is None:
            role = Role(name="admin", description="Seed role: admin")
            db.add(role)
            db.flush()
        user = db.scalar(select(User).where(User.email == email))
        user.roles.append(role)
        db.commit()


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_college(name: str) -> College:
    college = College(
        college_id=f"C{uuid.uuid4().int % 1_000_000_000}",
        name=name,
        slug=f"test-college-{uuid.uuid4().hex[:8]}",
        college_type="university",
        ownership="private",
        is_active=True,
    )
    with SessionLocal() as db:
        db.add(college)
        db.commit()
        db.refresh(college)
        return college


def _cleanup_college(college_id: int) -> None:
    with SessionLocal() as db:
        from sqlalchemy import delete

        cc_ids = list(
            db.scalars(
                select(CollegeCourse.id).where(
                    CollegeCourse.college_id == college_id
                )
            ).all()
        )
        if cc_ids:
            from app.models import Fee

            db.execute(delete(Fee).where(Fee.college_course_id.in_(cc_ids)))
            db.execute(
                delete(CollegeCourse).where(CollegeCourse.college_id == college_id)
            )
        college = db.get(College, college_id)
        if college:
            db.delete(college)
        db.commit()


def _create_course(name: str) -> Course:
    course = Course(name=name, slug=f"course-{uuid.uuid4().hex[:8]}")
    with SessionLocal() as db:
        db.add(course)
        db.commit()
        db.refresh(course)
        return course


def _cleanup_course(course_id: int) -> None:
    with SessionLocal() as db:
        course = db.get(Course, course_id)
        if course:
            db.delete(course)
            db.commit()


def _link(college_id: int, course_id: int) -> CollegeCourse:
    cc = CollegeCourse(college_id=college_id, course_id=course_id)
    with SessionLocal() as db:
        db.add(cc)
        db.commit()
        db.refresh(cc)
        return cc


def _register_admin() -> dict:
    admin = _register_user()
    _make_admin(admin["email"])
    return admin


def test_exam_crud():
    admin = _register_admin()
    headers = _auth_headers(admin["access_token"])

    create = client.post(
        "/api/v1/exams",
        json={
            "name": f"Admission Exam {uuid.uuid4().hex[:6]}",
            "conducting_authority": "Test Authority",
            "exam_type": "national",
            "application_deadline": "2026-04-30",
        },
        headers=headers,
    )
    assert create.status_code == 201, create.text
    body = create.json()
    assert body["slug"]
    assert body["is_active"] is True

    update = client.put(
        f"/api/v1/exams/{body['slug']}",
        json={"exam_type": "state", "admit_card_date": "2026-05-10"},
        headers=headers,
    )
    assert update.status_code == 200, update.text
    assert update.json()["exam_type"] == "state"

    duplicate = client.post(
        "/api/v1/exams",
        json={
            "name": body["name"],
            "conducting_authority": "Other",
        },
        headers=headers,
    )
    assert duplicate.status_code == 400

    delete = client.delete(f"/api/v1/exams/{body['slug']}", headers=headers)
    assert delete.status_code == 204

    gone = client.get(f"/api/v1/exams/{body['slug']}")
    assert gone.status_code == 404


def test_scholarship_crud():
    admin = _register_admin()
    headers = _auth_headers(admin["access_token"])

    create = client.post(
        "/api/v1/scholarships",
        json={
            "name": f"Merit Scholarship {uuid.uuid4().hex[:6]}",
            "provider": "Test Foundation",
            "ownership": "private",
            "category": "merit",
            "amount": "100000",
        },
        headers=headers,
    )
    assert create.status_code == 201, create.text
    body = create.json()
    assert body["slug"]

    update = client.put(
        f"/api/v1/scholarships/{body['slug']}",
        json={"ownership": "government"},
        headers=headers,
    )
    assert update.status_code == 200, update.text
    assert update.json()["ownership"] == "government"

    delete = client.delete(f"/api/v1/scholarships/{body['slug']}", headers=headers)
    assert delete.status_code == 204
    assert client.get(f"/api/v1/scholarships/{body['slug']}").status_code == 404


def test_university_crud():
    admin = _register_admin()
    headers = _auth_headers(admin["access_token"])

    create = client.post(
        "/api/v1/universities",
        json={
            "name": f"Test University {uuid.uuid4().hex[:6]}",
            "type": "university",
            "is_deemed": False,
        },
        headers=headers,
    )
    assert create.status_code == 201, create.text
    body = create.json()
    assert body["slug"]
    assert body["is_active"] is True

    update = client.put(
        f"/api/v1/universities/{body['slug']}",
        json={"city": "Pune", "is_deemed": True},
        headers=headers,
    )
    assert update.status_code == 200, update.text
    assert update.json()["city"] == "Pune"
    assert update.json()["is_deemed"] is True

    delete = client.delete(f"/api/v1/universities/{body['slug']}", headers=headers)
    assert delete.status_code == 204
    assert client.get(f"/api/v1/universities/{body['slug']}").status_code == 404


def test_mock_test_admin_crud():
    admin = _register_admin()
    headers = _auth_headers(admin["access_token"])

    create = client.post(
        "/api/v1/mock-tests",
        json={
            "name": f"Mock Test {uuid.uuid4().hex[:6]}",
            "subject": "Physics",
            "difficulty": "hard",
            "duration_minutes": 45,
            "negative_marking": True,
            "negative_marks_value": 0.25,
        },
        headers=headers,
    )
    assert create.status_code == 201, create.text
    body = create.json()
    assert body["slug"]
    assert body["is_active"] is True
    assert body["question_count"] == 0

    update = client.put(
        f"/api/v1/mock-tests/{body['slug']}",
        json={"difficulty": "medium", "negative_marking": False},
        headers=headers,
    )
    assert update.status_code == 200, update.text
    assert update.json()["difficulty"] == "medium"
    assert update.json()["negative_marking"] is False

    delete = client.delete(f"/api/v1/mock-tests/{body['slug']}", headers=headers)
    assert delete.status_code == 204

    public = client.get(f"/api/v1/mock-tests/{body['slug']}")
    assert public.status_code == 404

    admin_list = client.get("/api/v1/mock-tests/admin/all", headers=headers).json()
    match = [t for t in admin_list if t["slug"] == body["slug"]]
    assert len(match) == 1
    assert match[0]["is_active"] is False


def test_enrichment_requires_admin():
    regular = _register_user()
    headers = _auth_headers(regular["access_token"])
    forbidden = client.post(
        "/api/v1/colleges/999/cutoffs",
        json={
            "exam_name": "JEE",
            "year": 2026,
            "category": "OPEN",
        },
        headers=headers,
    )
    assert forbidden.status_code == 403


def test_enrichment_crud():
    college = _create_college(f"Enrich College {uuid.uuid4().hex[:6]}")
    course = _create_course(f"Enrich Course {uuid.uuid4().hex[:6]}")
    cc = _link(college.id, course.id)
    try:
        admin = _register_admin()
        headers = _auth_headers(admin["access_token"])
        base = f"/api/v1/colleges/{college.slug}"

        cutoff = client.post(
            f"{base}/cutoffs",
            json={
                "course_id": course.id,
                "branch": "CSE",
                "exam_name": "JEE Main",
                "year": 2026,
                "round": "1",
                "category": "OPEN",
                "opening_rank": 100,
                "closing_rank": 500,
            },
            headers=headers,
        )
        assert cutoff.status_code == 201, cutoff.text
        cutoff_id = cutoff.json()["id"]
        assert cutoff.json()["college_name"] == college.name
        assert cutoff.json()["course_name"] == course.name

        cutoffs = client.get(f"{base}/cutoffs").json()
        assert len(cutoffs) == 1

        update = client.put(
            f"{base}/cutoffs/{cutoff_id}",
            json={"closing_rank": 550},
            headers=headers,
        )
        assert update.status_code == 200
        assert update.json()["closing_rank"] == 550

        fee = client.post(
            f"{base}/fees",
            json={
                "college_course_id": cc.id,
                "tuition_fee": 100000,
                "academic_year": "2026-27",
            },
            headers=headers,
        )
        assert fee.status_code == 201, fee.text
        assert fee.json()["course_name"] == course.name
        bad_fee = client.post(
            f"{base}/fees",
            json={
                "college_course_id": 999999999,
                "academic_year": "2026-27",
            },
            headers=headers,
        )
        assert bad_fee.status_code == 400

        placement = client.post(
            f"{base}/placements",
            json={
                "course_id": course.id,
                "academic_year": "2025-26",
                "total_placed": 80,
                "highest_salary_lpa": 40.5,
            },
            headers=headers,
        )
        assert placement.status_code == 201, placement.text
        assert placement.json()["course_name"] == course.name

        nirf = client.post(
            f"{base}/rankings/nirf",
            json={
                "category": "Engineering",
                "year": 2026,
                "rank": 12,
                "score": 62.5,
            },
            headers=headers,
        )
        assert nirf.status_code == 201, nirf.text
        nirf_id = nirf.json()["id"]

        other = client.post(
            f"{base}/rankings/other",
            json={
                "ranking_body": "NIRF",
                "category": "Overall",
                "year": 2025,
                "rank": 25,
            },
            headers=headers,
        )
        assert other.status_code == 201, other.text

        rankings = client.get(f"{base}/rankings").json()
        types = sorted(r["ranking_type"] for r in rankings)
        assert types == ["nirf", "other"]

        seat = client.post(
            f"{base}/seat-matrix",
            json={
                "course_id": course.id,
                "exam": "JEE Main",
                "total_seats": 120,
                "year": 2026,
            },
            headers=headers,
        )
        assert seat.status_code == 201, seat.text

        seat_delete = client.delete(
            f"{base}/seat-matrix/{seat.json()['id']}", headers=headers
        )
        assert seat_delete.status_code == 204
        other_delete = client.delete(
            f"{base}/rankings/other/{other.json()['id']}", headers=headers
        )
        assert other_delete.status_code == 204
        nirf_delete = client.delete(
            f"{base}/rankings/nirf/{nirf_id}", headers=headers
        )
        assert nirf_delete.status_code == 204
        fee_delete = client.delete(f"{base}/fees/{fee.json()['id']}", headers=headers)
        assert fee_delete.status_code == 204
        placement_delete = client.delete(
            f"{base}/placements/{placement.json()['id']}", headers=headers
        )
        assert placement_delete.status_code == 204
        cutoff_delete = client.delete(
            f"{base}/cutoffs/{cutoff_id}", headers=headers
        )
        assert cutoff_delete.status_code == 204

        assert client.get(f"{base}/cutoffs").json() == []
    finally:
        _cleanup_college(college.id)
        _cleanup_course(course.id)


def test_nested_read_filters():
    college = _create_college(f"Filter College {uuid.uuid4().hex[:6]}")
    course_a = _create_course(f"Filter Course A {uuid.uuid4().hex[:6]}")
    course_b = _create_course(f"Filter Course B {uuid.uuid4().hex[:6]}")
    cc_a = _link(college.id, course_a.id)
    cc_b = _link(college.id, course_b.id)
    try:
        admin = _register_admin()
        headers = _auth_headers(admin["access_token"])
        base = f"/api/v1/colleges/{college.slug}"

        client.post(
            f"{base}/cutoffs",
            json={
                "course_id": course_a.id,
                "exam_name": "JEE Main",
                "year": 2026,
                "category": "OPEN",
                "closing_rank": 500,
            },
            headers=headers,
        )
        client.post(
            f"{base}/cutoffs",
            json={
                "course_id": course_b.id,
                "exam_name": "JEE Advanced",
                "year": 2025,
                "category": "OBC",
                "closing_rank": 1200,
            },
            headers=headers,
        )

        all_c = client.get(f"{base}/cutoffs").json()
        assert len(all_c) == 2

        by_course = client.get(f"{base}/cutoffs", params={"course_id": course_a.id}).json()
        assert len(by_course) == 1
        assert by_course[0]["course_name"] == course_a.name

        by_exam = client.get(f"{base}/cutoffs", params={"exam_name": "JEE Advanced"}).json()
        assert len(by_exam) == 1

        by_year = client.get(f"{base}/cutoffs", params={"year": 2026}).json()
        assert len(by_year) == 1

        client.post(
            f"{base}/fees",
            json={"college_course_id": cc_a.id, "tuition_fee": 50000, "academic_year": "2025-26"},
            headers=headers,
        )
        client.post(
            f"{base}/fees",
            json={"college_course_id": cc_a.id, "tuition_fee": 60000, "academic_year": "2026-27"},
            headers=headers,
        )
        fees = client.get(f"{base}/fees").json()
        assert len(fees) == 2
        fees_filtered = client.get(f"{base}/fees", params={"academic_year": "2025-26"}).json()
        assert len(fees_filtered) == 1

        client.post(
            f"{base}/placements",
            json={"course_id": course_a.id, "academic_year": "2025-26", "total_placed": 70},
            headers=headers,
        )
        client.post(
            f"{base}/placements",
            json={"course_id": course_b.id, "academic_year": "2025-26", "total_placed": 50},
            headers=headers,
        )
        by_pl_course = client.get(
            f"{base}/placements", params={"course_id": course_a.id}
        ).json()
        assert len(by_pl_course) == 1

        client.post(
            f"{base}/rankings/nirf",
            json={"category": "Engineering", "year": 2026, "rank": 10},
            headers=headers,
        )
        client.post(
            f"{base}/rankings/other",
            json={"ranking_body": "Times", "category": "Overall", "year": 2025, "rank": 20},
            headers=headers,
        )
        nirf_only = client.get(f"{base}/rankings", params={"ranking_type": "nirf"}).json()
        assert all(r["ranking_type"] == "nirf" for r in nirf_only)
        other_only = client.get(f"{base}/rankings", params={"ranking_type": "other"}).json()
        assert all(r["ranking_type"] == "other" for r in other_only)

        client.post(
            f"{base}/seat-matrix",
            json={"course_id": course_a.id, "exam": "JEE Main", "total_seats": 100, "year": 2026},
            headers=headers,
        )
        client.post(
            f"{base}/seat-matrix",
            json={"course_id": course_b.id, "exam": "JEE Main", "total_seats": 80, "year": 2025},
            headers=headers,
        )
        by_sm_year = client.get(f"{base}/seat-matrix", params={"year": 2026}).json()
        assert len(by_sm_year) == 1
    finally:
        _cleanup_college(college.id)
        _cleanup_course(course_a.id)
        _cleanup_course(course_b.id)


def test_admission_crud():
    college = _create_college(f"Admit College {uuid.uuid4().hex[:6]}")
    course = _create_course(f"Admit Course {uuid.uuid4().hex[:6]}")
    cc = _link(college.id, course.id)
    try:
        admin = _register_admin()
        headers = _auth_headers(admin["access_token"])
        base = f"/api/v1/colleges/{college.slug}"

        create = client.post(
            f"{base}/admissions",
            json={
                "college_course_id": cc.id,
                "admission_information": "Online application via portal",
                "eligibility_details": "10+2 with 60% aggregate",
                "entrance_exam": "JEE Main",
                "application_start_date": "2026-01-01",
                "application_end_date": "2026-04-30",
            },
            headers=headers,
        )
        assert create.status_code == 201, create.text
        adm_id = create.json()["id"]
        assert create.json()["course_name"] == course.name

        bad = client.post(
            f"{base}/admissions",
            json={"college_course_id": 999999, "admission_information": "bad"},
            headers=headers,
        )
        assert bad.status_code == 400

        list_adm = client.get(f"{base}/admissions").json()
        assert len(list_adm) == 1

        by_cc = client.get(f"{base}/admissions", params={"college_course_id": cc.id}).json()
        assert len(by_cc) == 1

        update = client.put(
            f"{base}/admissions/{adm_id}",
            json={"entrance_exam": "JEE Advanced"},
            headers=headers,
        )
        assert update.status_code == 200
        assert update.json()["entrance_exam"] == "JEE Advanced"

        delete = client.delete(f"{base}/admissions/{adm_id}", headers=headers)
        assert delete.status_code == 204
        assert client.get(f"{base}/admissions").json() == []
    finally:
        _cleanup_college(college.id)
        _cleanup_course(course.id)


def test_global_catalog_endpoints():
    college = _create_college(f"Global College {uuid.uuid4().hex[:6]}")
    course = _create_course(f"Global Course {uuid.uuid4().hex[:6]}")
    cc = _link(college.id, course.id)
    try:
        admin = _register_admin()
        headers = _auth_headers(admin["access_token"])
        base = f"/api/v1/colleges/{college.slug}"

        client.post(
            f"{base}/cutoffs",
            json={"course_id": course.id, "exam_name": "JEE Main", "year": 2026, "category": "OPEN", "closing_rank": 400},
            headers=headers,
        )
        client.post(
            f"{base}/fees",
            json={"college_course_id": cc.id, "tuition_fee": 80000, "academic_year": "2026-27"},
            headers=headers,
        )
        client.post(
            f"{base}/placements",
            json={"course_id": course.id, "academic_year": "2025-26", "total_placed": 90},
            headers=headers,
        )
        client.post(
            f"{base}/rankings/nirf",
            json={"category": "Engineering", "year": 2026, "rank": 5},
            headers=headers,
        )
        client.post(
            f"{base}/seat-matrix",
            json={"course_id": course.id, "exam": "JEE Main", "total_seats": 200, "year": 2026},
            headers=headers,
        )
        client.post(
            f"{base}/admissions",
            json={"college_course_id": cc.id, "admission_information": "Rolling"},
            headers=headers,
        )

        g_cutoffs = client.get("/api/v1/cutoffs", params={"college_id": college.id}).json()
        assert len(g_cutoffs) == 1
        assert g_cutoffs[0]["college_name"] == college.name

        g_fees = client.get("/api/v1/fees", params={"college_id": college.id}).json()
        assert len(g_fees) == 1
        g_fees_course = client.get("/api/v1/fees", params={"course_id": course.id}).json()
        assert len(g_fees_course) == 1

        g_pl = client.get("/api/v1/placements", params={"college_id": college.id}).json()
        assert len(g_pl) == 1

        g_rank = client.get("/api/v1/rankings", params={"college_id": college.id}).json()
        assert len(g_rank) == 1

        g_seat = client.get("/api/v1/seat-matrix", params={"college_id": college.id}).json()
        assert len(g_seat) == 1

        g_adm = client.get("/api/v1/admissions", params={"college_id": college.id}).json()
        assert len(g_adm) == 1
        g_adm_course = client.get("/api/v1/admissions", params={"course_id": course.id}).json()
        assert len(g_adm_course) == 1
    finally:
        _cleanup_college(college.id)
        _cleanup_course(course.id)


def test_college_courses_filters():
    college = _create_college(f"CC Filter College {uuid.uuid4().hex[:6]}")
    course_a = _create_course(f"CC Filter A {uuid.uuid4().hex[:6]}")
    course_b = _create_course(f"CC Filter B {uuid.uuid4().hex[:6]}")
    cc_a = _link(college.id, course_a.id)
    cc_b = _link(college.id, course_b.id)
    cc_b_id = cc_b.id
    try:
        with SessionLocal() as db:
            cc_row = db.get(CollegeCourse, cc_b_id)
            cc_row.is_active = False
            db.commit()

        all_cc = client.get(f"/api/v1/colleges/{college.slug}/courses").json()
        assert len(all_cc) == 1
        assert all_cc[0]["course_name"] == course_a.name

        include_inactive = client.get(
            f"/api/v1/colleges/{college.slug}/courses",
            params={"include_inactive": "true"},
        ).json()
        assert len(include_inactive) == 2

        by_course = client.get(
            f"/api/v1/colleges/{college.slug}/courses",
            params={"course_id": course_b.id, "include_inactive": "true"},
        ).json()
        assert len(by_course) == 1

        search = client.get(
            f"/api/v1/colleges/{college.slug}/courses",
            params={"q": course_a.name[:8]},
        ).json()
        assert len(search) == 1
    finally:
        _cleanup_college(college.id)
        _cleanup_course(course_a.id)
        _cleanup_course(course_b.id)