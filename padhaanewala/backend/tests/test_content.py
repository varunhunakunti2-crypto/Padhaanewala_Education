import uuid

import pytest
from fastapi.testclient import TestClient
from jose import jwt

from app.database import SessionLocal
from app.main import app
from app.models import Role, User

client = TestClient(app)


def _unique(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:8]}@example.com"


def _unique_mobile() -> str:
    return f"9{uuid.uuid4().int % 1_000_000_000:09d}"


def _register(email: str) -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Test User",
            "email": email,
            "mobile": _unique_mobile(),
            "password": "SecurePass123!",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _token_for(email: str, role: str | None = None) -> tuple[str, dict]:
    body = _register(email)
    if role:
        with SessionLocal() as db:
            user = db.query(User).filter(User.email == email).first()
            role_row = db.query(Role).filter(Role.name == role).first()
            assert role_row is not None
            user.roles.append(role_row)
            db.commit()
    return body["access_token"], body


@pytest.fixture
def student():
    token, body = _token_for(_unique("student"))
    return {"token": token, "refresh": body["refresh_token"]}


@pytest.fixture
def admin_token():
    token, _ = _token_for(_unique("admin"), "admin")
    return token


def _college_ref() -> str:
    college = client.get("/api/v1/colleges").json()[0]
    return college["id"]


# ---------- Reviews ----------


def test_submit_review_requires_auth():
    response = client.post(
        "/api/v1/reviews",
        json={"college_id": _college_ref(), "rating": 4, "review_text": "Good"},
    )
    assert response.status_code == 401


def test_review_lifecycle_moderation(student, admin_token):
    college_id = _college_ref()
    headers = {"Authorization": f"Bearer {student['token']}"}
    create = client.post(
        "/api/v1/reviews",
        json={
            "college_id": college_id,
            "rating": 5,
            "review_text": "Excellent faculty",
            "year_of_study": "2024",
        },
        headers=headers,
    )
    assert create.status_code == 201, create.text
    review = create.json()
    assert review["status"] == "submitted"

    pending = client.get("/api/v1/reviews/moderation", headers={"Authorization": f"Bearer {admin_token}"})
    assert pending.status_code == 200
    assert any(r["id"] == review["id"] for r in pending.json())

    approve = client.post(
        f"/api/v1/reviews/{review['id']}/moderate",
        json={"status": "approved"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert approve.status_code == 200
    assert approve.json()["status"] == "approved"
    assert approve.json()["is_verified"] is True


def test_duplicate_review_blocked(student):
    college_id = _college_ref()
    headers = {"Authorization": f"Bearer {student['token']}"}
    payload = {"college_id": college_id, "rating": 3, "review_text": "Okay"}
    assert client.post("/api/v1/reviews", json=payload, headers=headers).status_code == 201
    assert client.post("/api/v1/reviews", json=payload, headers=headers).status_code == 409


def test_public_only_sees_approved(student, admin_token):
    college_id = _college_ref()
    headers = {"Authorization": f"Bearer {student['token']}"}
    create = client.post(
        "/api/v1/reviews",
        json={"college_id": college_id, "rating": 1, "review_text": "Pending"},
        headers=headers,
    )
    review_id = create.json()["id"]
    public = client.get(f"/api/v1/reviews/college/{college_id}")
    assert all(r["id"] != review_id for r in public.json())
    moderate = client.post(
        f"/api/v1/reviews/{review_id}/moderate",
        json={"status": "rejected", "moderation_notes": "spam"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert moderate.status_code == 200
    assert moderate.json()["status"] == "rejected"


# ---------- Blogs & Categories ----------


def test_blog_lifecycle(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    cat = client.post(
        "/api/v1/blog-categories",
        json={"name": f"Admissions {uuid.uuid4().hex[:4]}"},
        headers=headers,
    )
    assert cat.status_code == 201
    category_id = cat.json()["id"]

    title = f"Top colleges {uuid.uuid4().hex[:4]}"
    created = client.post(
        "/api/v1/blogs",
        json={
            "title": title,
            "content": "Full article content here",
            "category_id": category_id,
            "status": "published",
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    blog = created.json()
    assert blog["status"] == "published"
    assert blog["published_at"] is not None

    public = client.get(f"/api/v1/blogs/{blog['slug']}")
    assert public.status_code == 200
    assert public.json()["view_count"] == 1

    listing = client.get("/api/v1/blogs")
    assert any(b["id"] == blog["id"] for b in listing.json())


def test_create_blog_requires_admin(student):
    response = client.post(
        "/api/v1/blogs",
        json={"title": "No", "content": "x"},
        headers={"Authorization": f"Bearer {student['token']}"},
    )
    assert response.status_code == 403


# ---------- FAQs ----------


def test_faq_crud(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    created = client.post(
        "/api/v1/faqs",
        json={
            "question": "What is the fee?",
            "answer": "Contact us",
            "entity_type": "college",
            "entity_id": _college_ref(),
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    faq = created.json()

    listing = client.get(f"/api/v1/faqs?entity_type=college&entity_id={faq['entity_id']}")
    assert any(f["id"] == faq["id"] for f in listing.json())

    updated = client.put(
        f"/api/v1/faqs/{faq['id']}",
        json={"answer": "Updated answer"},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["answer"] == "Updated answer"

    deleted = client.delete(f"/api/v1/faqs/{faq['id']}", headers=headers)
    assert deleted.status_code == 204


# ---------- Media ----------


def test_media_crud(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    created = client.post(
        "/api/v1/media",
        json={
            "url": "https://example.com/img.jpg",
            "file_name": "img.jpg",
            "file_type": "image/jpeg",
            "file_size": 1024,
            "entity_type": "college",
            "entity_id": _college_ref(),
            "image_type": "campus",
        },
        headers=headers,
    )
    assert created.status_code == 201, created.text
    media = created.json()

    listing = client.get(f"/api/v1/media?entity_type=college&entity_id={media['entity_id']}")
    assert any(m["id"] == media["id"] for m in listing.json())

    updated = client.put(
        f"/api/v1/media/{media['id']}",
        json={"alt_text": "Campus building"},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["alt_text"] == "Campus building"


# ---------- SEO metadata ----------


def test_seo_upsert_and_get(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    upsert = client.put(
        f"/api/v1/seo/college/{_college_ref()}",
        json={"meta_title": "Best College", "meta_description": "Description"},
        headers=headers,
    )
    assert upsert.status_code == 200, upsert.text
    assert upsert.json()["meta_title"] == "Best College"

    fetched = client.get(f"/api/v1/seo/college/{_college_ref()}")
    assert fetched.status_code == 200
    assert fetched.json()["meta_description"] == "Description"


def test_seo_write_requires_role(student):
    response = client.put(
        f"/api/v1/seo/college/{_college_ref()}",
        json={"meta_title": "Nope"},
        headers={"Authorization": f"Bearer {student['token']}"},
    )
    assert response.status_code == 403


# ---------- Notifications ----------


def test_notification_flow(student, admin_token):
    headers = {"Authorization": f"Bearer {student['token']}"}

    empty = client.get("/api/v1/notifications/my", headers=headers)
    assert empty.status_code == 200
    assert empty.json() == []

    student_id = int(jwt.get_unverified_claims(student["token"])["sub"])
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    created = client.post(
        "/api/v1/notifications",
        json={
            "user_id": student_id,
            "type": "admission",
            "title": "Admission updates",
        },
        headers=admin_headers,
    )
    assert created.status_code == 201, created.text
    assert created.json()["user_id"] == student_id

    mine = client.get("/api/v1/notifications/my", headers=headers)
    assert any(n["id"] == created.json()["id"] for n in mine.json())

    count = client.get("/api/v1/notifications/my/unread-count", headers=headers)
    assert count.status_code == 200
    assert count.json() == 1

    mark_all = client.put("/api/v1/notifications/my/read-all", headers=headers)
    assert mark_all.status_code == 200

    zero = client.get("/api/v1/notifications/my/unread-count", headers=headers)
    assert zero.json() == 0


def test_notification_read_all_admin_only(student):
    created = client.post(
        "/api/v1/notifications",
        json={"user_id": 1, "type": "test", "title": "x"},
        headers={"Authorization": f"Bearer {student['token']}"},
    )
    assert created.status_code == 403


# ---------- Audit logs ----------


def test_audit_logs_listing(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    created = client.post(
        "/api/v1/blogs",
        json={
            "title": f"Audit {uuid.uuid4().hex[:6]}",
            "content": "content",
        },
        headers=headers,
    )
    blog_slug = created.json()["slug"]
    client.put(
        f"/api/v1/blogs/{blog_slug}",
        json={"status": "draft"},
        headers=headers,
    )

    response = client.get(
        "/api/v1/audit-logs",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    actions = {entry["action"] for entry in response.json()}
    assert "update_blog" in actions


def test_audit_logs_requires_admin(student):
    response = client.get(
        "/api/v1/audit-logs",
        headers={"Authorization": f"Bearer {student['token']}"},
    )
    assert response.status_code == 403


# ---------- Banners ----------


def test_banner_crud(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    created = client.post(
        "/api/v1/banners",
        json={"title": "Admission Open", "image_url": "https://example.com/b.png"},
        headers=headers,
    )
    assert created.status_code == 201, created.text
    banner = created.json()

    listing = client.get("/api/v1/banners")
    assert any(b["id"] == banner["id"] for b in listing.json())

    updated = client.put(
        f"/api/v1/banners/{banner['id']}",
        json={"position": "college_top"},
        headers=headers,
    )
    assert updated.status_code == 200
    assert updated.json()["position"] == "college_top"

    deleted = client.delete(f"/api/v1/banners/{banner['id']}", headers=headers)
    assert deleted.status_code == 204