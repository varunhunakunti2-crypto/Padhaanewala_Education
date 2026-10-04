import uuid

import pytest
from fastapi.testclient import TestClient
import jwt

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
            "age_band": "18_plus",
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
    # 4.6 — GET no longer mutates the counter; the explicit view endpoint owns it.
    assert public.json()["view_count"] == 0
    assert client.post(f"/api/v1/blogs/{blog['slug']}/view").status_code == 204
    public = client.get(f"/api/v1/blogs/{blog['slug']}")
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

    # Reads are gated too: SEO rows carry draft metadata for every entity, so an
    # unauthenticated full-table dump is not acceptable.
    anon = client.get(f"/api/v1/seo/college/{_college_ref()}")
    assert anon.status_code == 401

    fetched = client.get(f"/api/v1/seo/college/{_college_ref()}", headers=headers)
    assert fetched.status_code == 200, fetched.text
    assert fetched.json()["meta_description"] == "Description"


def test_seo_read_forbidden_for_student(student):
    response = client.get(
        f"/api/v1/seo/college/{_college_ref()}",
        headers={"Authorization": f"Bearer {student['token']}"},
    )
    assert response.status_code == 403


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

    # `jwt.get_unverified_claims` was python-jose's way to read a token's payload
    # without checking the signature. PyJWT has no direct equivalent; decoding
    # with signature verification switched off is the same operation. Used only
    # to recover the subject the fixture just created, so the "unverified" part
    # is safe here.
    student_id = int(
        jwt.decode(student["token"], options={"verify_signature": False})["sub"]
    )
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
    # `POST /notifications` answers with a broadcast result, not a bare row: it
    # writes one row per recipient and a client cannot otherwise tell a targeted
    # send (1) from a fan-out (N). `user_id` is therefore read off
    # `recipients[0]`, and `created` is asserted to be 1 so a future change that
    # silently turns a targeted send into a broadcast fails here.
    body = created.json()
    assert body["created"] == 1, body
    assert len(body["recipients"]) == 1, body
    assert body["recipients"][0]["user_id"] == student_id

    mine = client.get("/api/v1/notifications/my", headers=headers)
    assert any(n["id"] == body["recipients"][0]["id"] for n in mine.json())

    count = client.get("/api/v1/notifications/my/unread-count", headers=headers)
    assert count.status_code == 200
    assert count.json() == 1

    mark_all = client.put("/api/v1/notifications/my/read-all", headers=headers)
    assert mark_all.status_code == 200

    zero = client.get("/api/v1/notifications/my/unread-count", headers=headers)
    assert zero.json() == 0


def test_admin_notification_log_names_the_recipient(admin_token, student):
    """The log must say who received a notification.

    An admin broadcast log that renders every row as an anonymous delivery is
    the same defect as the audit log's "by system": the record exists but the one
    field that makes it useful is dropped in transport.
    """
    student_id = int(
        jwt.decode(student["token"], options={"verify_signature": False})["sub"]
    )
    client.post(
        "/api/v1/notifications",
        json={"user_id": student_id, "type": "exam", "title": "JEE Main date"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    log = client.get(
        "/api/v1/notifications", headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert log.status_code == 200, log.text
    row = next(r for r in log.json() if r["title"] == "JEE Main date")
    assert row["username"], row
    assert row["user_id"] == student_id


def test_broadcast_reaches_every_active_student(admin_token, student):
    """Omitting `user_id` is a broadcast, not a validation error.

    The admin console's compose form is labelled "Send broadcast" and sends no
    `user_id`. While `NotificationCreate.user_id` was required, that button
    returned 422 on every press.
    """
    result = client.post(
        "/api/v1/notifications",
        json={"type": "scholarship", "title": "Scholarships open", "message": "Apply now."},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert result.status_code == 201, result.text
    assert result.json()["created"] >= 1

    mine = client.get(
        "/api/v1/notifications/my", headers={"Authorization": f"Bearer {student['token']}"}
    )
    assert any(n["title"] == "Scholarships open" for n in mine.json())


def test_notification_broadcast_is_audited(admin_token, student):
    """A mass write to student accounts must leave a trail (Phase 4.4)."""
    client.post(
        "/api/v1/notifications",
        json={"type": "general", "title": "Audited broadcast"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    log = client.get(
        "/api/v1/audit-logs",
        params={"action": "notification.broadcast"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert log.status_code == 200, log.text
    assert log.json(), "broadcast wrote no audit row"
    entry = log.json()[0]
    assert entry["username"], entry
    assert entry["new_value"]["title"] == "Audited broadcast"
    assert entry["new_value"]["audience"].startswith("all_active_students:")


def test_notification_read_all_admin_only(student):
    created = client.post(
        "/api/v1/notifications",
        json={"user_id": 1, "type": "test", "title": "x"},
        headers={"Authorization": f"Bearer {student['token']}"},
    )
    assert created.status_code == 403


def test_admin_can_list_notifications_across_accounts(student, admin_token):
    """`GET /notifications` is the admin console's read path.

    It did not exist. `NotificationsSection` called it, got a 404, and rendered
    "Could not reach the API" — a panel that looks like an outage rather than a
    missing route. `/my` is not a substitute because it is self-scoped, so an
    admin using it would see their own rows and read an empty list as "no
    notifications exist".
    """
    student_id = int(
        jwt.decode(student["token"], options={"verify_signature": False})["sub"]
    )
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    created = client.post(
        "/api/v1/notifications",
        json={"user_id": student_id, "type": "admission", "title": "For the student"},
        headers=admin_headers,
    )
    assert created.status_code == 201, created.text

    listing = client.get("/api/v1/notifications", headers=admin_headers)
    assert listing.status_code == 200, listing.text
    # `POST /notifications` answers with a broadcast result rather than a bare
    # row, so the new id comes off `recipients[0]` — see
    # `test_notification_flow` above, which asserts the shape in full.
    created_id = created.json()["recipients"][0]["id"]
    assert any(n["id"] == created_id for n in listing.json())
    # The whole point of the route: rows belonging to someone other than the
    # caller are visible.
    assert any(n["user_id"] == student_id for n in listing.json())

    # Capped, like every other list route in the API.
    over = client.get("/api/v1/notifications?limit=100000", headers=admin_headers)
    assert over.status_code == 422


def test_admin_notification_listing_is_not_reachable_by_students(student):
    headers = {"Authorization": f"Bearer {student['token']}"}
    assert client.get("/api/v1/notifications", headers=headers).status_code == 403
    assert client.get("/api/v1/notifications").status_code == 401


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
