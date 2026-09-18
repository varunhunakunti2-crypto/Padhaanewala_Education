import uuid

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Counsellor, Role, User

client = TestClient(app)


def _register(name: str, password: str = "SecurePass123!") -> dict:
    email = f"{name}.{uuid.uuid4().hex[:8]}@example.com"
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": name,
            "email": email,
            "mobile": f"9{uuid.uuid4().int % 1_000_000_000:09d}",
            "password": password,
        },
    )
    assert response.status_code == 201, response.text
    return {
        "email": email,
        "token": response.json()["access_token"],
        "headers": {"Authorization": f"Bearer {response.json()['access_token']}"},
    }


def _login(email: str) -> dict:
    login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "SecurePass123!"}
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _make_admin() -> dict:
    acc = _register("admin")
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == acc["email"]).first()
        admin = db.query(Role).filter(Role.name == "admin").first()
        assert admin is not None
        user.roles.append(admin)
        db.commit()
    return _login(acc["email"])


def _make_counsellor(name: str = "counsellor") -> tuple[dict, int]:
    acc = _register(name)
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == acc["email"]).first()
        role = db.query(Role).filter(Role.name == "counsellor").first()
        assert role is not None
        user.roles.append(role)
        counsellor = Counsellor(user_id=user.id, name=name, max_leads=100)
        db.add(counsellor)
        db.commit()
        db.refresh(counsellor)
        counsellor_id = counsellor.id
    return _login(acc["email"]), counsellor_id


def _submit_enquiry(payload: dict | None = None) -> int:
    body = payload or {
        "name": f"Lead {uuid.uuid4().hex[:6]}",
        "mobile": f"8{uuid.uuid4().int % 1_000_000_000:09d}",
        "city": "Bengaluru",
        "message": "Interested in B.Tech admission",
        "source": "website",
    }
    res = client.post("/api/v1/enquiries", json=body)
    assert res.status_code == 201, res.text
    return res.json()["id"]


# --- Consent ---


def test_consent_record_and_list():
    acc = _register("student")
    res = client.post(
        "/api/v1/consent",
        json={
            "consent_type": "marketing",
            "consent_version": "v1",
            "consent_text": "I agree to receive marketing communications.",
            "granted": True,
        },
        headers=acc["headers"],
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["consent_type"] == "marketing"
    assert body["granted"] is True

    listing = client.get("/api/v1/consent", headers=acc["headers"])
    assert listing.status_code == 200
    assert any(c["id"] == body["id"] for c in listing.json())


def test_consent_unknown_type_rejected():
    acc = _register("student")
    res = client.post(
        "/api/v1/consent",
        json={
            "consent_type": "not-a-real-type",
            "consent_text": "x",
            "granted": True,
        },
        headers=acc["headers"],
    )
    assert res.status_code == 422


def test_consent_revoke_update():
    acc = _register("student")
    created = client.post(
        "/api/v1/consent",
        json={
            "consent_type": "analytics",
            "consent_text": "I agree to analytics tracking.",
            "granted": True,
        },
        headers=acc["headers"],
    ).json()

    revoke = client.patch(
        f"/api/v1/consent/{created['id']}",
        json={"granted": False},
        headers=acc["headers"],
    )
    assert revoke.status_code == 200
    assert revoke.json()["granted"] is False

    other = _register("other")
    not_found = client.patch(
        f"/api/v1/consent/{created['id']}",
        json={"granted": True},
        headers=other["headers"],
    )
    assert not_found.status_code == 404


def test_consent_requires_auth():
    assert client.get("/api/v1/consent").status_code == 401
    res = client.post(
        "/api/v1/consent",
        json={"consent_type": "marketing", "consent_text": "x", "granted": True},
    )
    assert res.status_code == 401


# --- Leads ---


def test_lead_full_lifecycle():
    admin_headers = _make_admin()
    counsellor_headers, counsellor_id = _make_counsellor()
    lead_id = _submit_enquiry()

    listing = client.get("/api/v1/leads", headers=admin_headers)
    assert listing.status_code == 200
    assert any(l["id"] == lead_id for l in listing.json())

    assign = client.patch(
        f"/api/v1/leads/{lead_id}/assign",
        json={"counsellor_id": counsellor_id},
        headers=admin_headers,
    )
    assert assign.status_code == 200
    assert assign.json()["assigned_counsellor"] == "counsellor"

    note = client.post(
        f"/api/v1/leads/{lead_id}/notes",
        json={"note": "Called student, interested in KCET counselling."},
        headers=counsellor_headers,
    )
    assert note.status_code == 201, note.text

    status_change = client.patch(
        f"/api/v1/leads/{lead_id}/status",
        json={"status": "contacted"},
        headers=counsellor_headers,
    )
    assert status_change.status_code == 200
    assert status_change.json()["status"] == "contacted"
    assert len(status_change.json()["status_history"]) == 1
    assert status_change.json()["status_history"][0]["new_status"] == "contacted"

    follow_up = client.patch(
        f"/api/v1/leads/{lead_id}/follow-up",
        json={"follow_up_date": "2026-09-25"},
        headers=counsellor_headers,
    )
    assert follow_up.status_code == 200
    assert follow_up.json()["follow_up_date"] == "2026-09-25"

    detail = client.get(f"/api/v1/leads/{lead_id}", headers=counsellor_headers)
    assert detail.status_code == 200
    assert len(detail.json()["notes"]) == 1
    assert len(detail.json()["status_history"]) == 1


def test_counsellor_scoped_to_assigned_leads():
    admin_headers = _make_admin()
    first_headers, first_id = _make_counsellor("counsellor-a")
    second_headers, second_id = _make_counsellor("counsellor-b")

    lead_a = _submit_enquiry({"name": f"ScopedA{uuid.uuid4().hex[:6]}", "mobile": f"7{uuid.uuid4().int % 1_000_000_000:09d}"})
    lead_b = _submit_enquiry({"name": f"ScopedB{uuid.uuid4().hex[:6]}", "mobile": f"6{uuid.uuid4().int % 1_000_000_000:09d}"})

    client.patch(f"/api/v1/leads/{lead_a}/assign", json={"counsellor_id": first_id}, headers=admin_headers)
    client.patch(f"/api/v1/leads/{lead_b}/assign", json={"counsellor_id": second_id}, headers=admin_headers)

    mine = client.get("/api/v1/leads", headers=first_headers)
    assert mine.status_code == 200
    ids = [l["id"] for l in mine.json()]
    assert lead_a in ids
    assert lead_b not in ids

    # Counsellor B cannot see Counsellor A's lead detail
    assert client.get(f"/api/v1/leads/{lead_a}", headers=second_headers).status_code == 404


def test_lead_filters_and_invalid_status():
    admin_headers = _make_admin()
    lead_id = _submit_enquiry({"name": f"Filtered{uuid.uuid4().hex[:6]}", "mobile": f"5{uuid.uuid4().int % 1_000_000_000:09d}", "source": "google"})

    by_status = client.get("/api/v1/leads", params={"status": "new"}, headers=admin_headers)
    assert by_status.status_code == 200
    assert any(l["id"] == lead_id for l in by_status.json())

    invalid = client.patch(
        f"/api/v1/leads/{lead_id}/status",
        json={"status": "not-a-status"},
        headers=admin_headers,
    )
    assert invalid.status_code == 422

    closed = client.patch(
        f"/api/v1/leads/{lead_id}/status",
        json={"status": "closed"},
        headers=admin_headers,
    )
    assert closed.status_code == 200
    assert closed.json()["status"] == "closed"

    not_new = client.get("/api/v1/leads", params={"status": "new"}, headers=admin_headers)
    assert not any(l["id"] == lead_id for l in not_new.json())


def test_leads_forbidden_for_students():
    acc = _register("student")
    assert client.get("/api/v1/leads", headers=acc["headers"]).status_code == 403
    assert client.patch("/api/v1/leads/1/assign", json={"counsellor_id": None}, headers=acc["headers"]).status_code == 403
    assert client.get("/api/v1/leads/1", headers=acc["headers"]).status_code == 403