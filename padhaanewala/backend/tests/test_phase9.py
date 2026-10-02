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
            "age_band": "18_plus",
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
    # Phase 9.1: `EnquiryCreate.age_band` is required with no default, so a
    # caller-supplied payload has to carry it as well. Merged in here rather than
    # repeated at each call site, so a test states the one thing it is about and
    # inherits the rest — and a caller can still override it, which is what lets
    # the minor-without-a-guardian case be expressed at all.
    body = {
        "age_band": "18_plus",
        **(
            payload
            or {
                "name": f"Lead {uuid.uuid4().hex[:6]}",
                "mobile": f"8{uuid.uuid4().int % 1_000_000_000:09d}",
                "city": "Bengaluru",
                "message": "Interested in B.Tech admission",
                "source": "website",
            }
        ),
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


# --- Data-subject requests (DPDP s.11) ---
#
# This whole block is missing-and-should-not-be. `create_data_request` audits
# `{"due_at": row.due_at}` — a `datetime` — into a JSON column, so every call
# raised `TypeError` at flush time and answered 500. The suite was green because
# nothing here exercised the endpoint: the 90-day DPDP Rules 2025 workflow, which
# is the single most legally load-bearing thing Phase 9 builds, had no test at
# all. It was found by driving the deployed container, not by pytest.


def test_create_data_request_succeeds_and_is_listed():
    acc = _register("dsr")

    created = client.post(
        "/api/v1/compliance/requests",
        json={"request_type": "access", "details": "Please send me a copy of my data"},
        headers=acc["headers"],
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["request_type"] == "access"
    assert body["status"] in {"pending", "open", "received"}

    listed = client.get("/api/v1/compliance/requests", headers=acc["headers"])
    assert listed.status_code == 200
    assert any(r["id"] == body["id"] for r in listed.json())

    single = client.get(
        f"/api/v1/compliance/requests/{body['id']}", headers=acc["headers"]
    )
    assert single.status_code == 200


def test_data_request_deadline_is_set_at_intake():
    """The 90-day SLA must be a stored column, not derived on read.

    Deriving it on read would move the deadline every time the row was looked at,
    so a request could never breach and the sweep would never fire.
    """
    acc = _register("dsr")
    created = client.post(
        "/api/v1/compliance/requests",
        json={"request_type": "erasure", "details": "delete my data"},
        headers=acc["headers"],
    )
    assert created.status_code == 201, created.text
    due = created.json()["due_at"]
    assert due, "due_at must be persisted, not computed per read"


def test_data_request_rejects_an_unknown_type():
    acc = _register("dsr")
    bad = client.post(
        "/api/v1/compliance/requests",
        json={"request_type": "definitely-not-a-real-type"},
        headers=acc["headers"],
    )
    assert bad.status_code == 422, bad.text


def test_data_request_requires_auth():
    anon = client.post(
        "/api/v1/compliance/requests", json={"request_type": "access"}
    )
    assert anon.status_code in (401, 403), anon.status_code
    assert client.get("/api/v1/compliance/requests").status_code in (401, 403)


def test_data_request_is_scoped_to_the_requester():
    """One student's DSR list must not contain another's."""
    mine = _register("dsr_mine")
    theirs = _register("dsr_theirs")

    client.post(
        "/api/v1/compliance/requests",
        json={"request_type": "access", "details": "mine"},
        headers=theirs["headers"],
    )
    listed = client.get("/api/v1/compliance/requests", headers=mine["headers"]).json()
    assert all(r.get("details") != "mine" for r in listed), (
        "a data-subject request leaked into another user's list"
    )


def test_audit_payload_never_carries_a_non_json_value():
    """The defect, pinned at the choke point rather than at one caller.

    `old_value`/`new_value` are JSON columns and PostgreSQL serialises them with
    `json.dumps`. Anything else raises at *flush* time — which is the caller's
    `db.commit()`, so no `try/except` around the audit call can contain it.
    """
    from datetime import datetime, timezone
    from decimal import Decimal

    from app.utils.audit import redact

    payload = {
        "due_at": datetime(2026, 12, 31, tzinfo=timezone.utc),
        "fee": Decimal("125000.50"),
        "nested": {"expires_at": datetime(2027, 1, 1, tzinfo=timezone.utc)},
        "listed": [datetime(2027, 1, 2, tzinfo=timezone.utc)],
        "email": "student@example.com",
        "count": 3,
        "flag": True,
    }
    out = redact(payload)

    # Must survive json.dumps, which is what the column does at flush.
    import json

    json.dumps(out)

    assert isinstance(out["due_at"], str)
    assert isinstance(out["fee"], str)
    assert isinstance(out["nested"]["expires_at"], str)
    assert isinstance(out["listed"][0], str)
    # Redaction still wins over coercion.
    assert out["email"] == "[redacted]"
    assert out["count"] == 3 and out["flag"] is True
