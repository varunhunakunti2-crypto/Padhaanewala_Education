import uuid

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Counsellor, Notification, Role, User

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


def _make_counsellor(name: str = "counsellor", max_leads: int = 100) -> tuple[dict, int]:
    acc = _register(name)
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == acc["email"]).first()
        role = db.query(Role).filter(Role.name == "counsellor").first()
        assert role is not None
        user.roles.append(role)
        counsellor = Counsellor(user_id=user.id, name=name, max_leads=max_leads)
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
    assert isinstance(out["fee"], float)
    assert isinstance(out["nested"]["expires_at"], str)
    assert isinstance(out["listed"][0], str)
    # Redaction still wins over coercion.
    assert out["email"] == "[redacted]"
    assert out["count"] == 3 and out["flag"] is True


# --- Enquiry -> lead hand-off (Phase 25) ---


def _park_all_counsellors() -> None:
    """Deactivate every counsellor left behind by earlier tests.

    The suite truncates `users` (and therefore `counsellors`) once per session,
    not once per test, so any test that asserts *which* counsellor a new enquiry
    lands on has to own the roster first. Without this, a counsellor created by
    an unrelated test would silently take the assignment.
    """
    with SessionLocal() as db:
        for existing in db.query(Counsellor).all():
            existing.is_active = False
        db.commit()


def _make_counsellor_with_user(name: str, max_leads: int = 100) -> tuple[dict, int, int]:
    """`(_headers, counsellor_id, user_id)`, so tests can read an inbox."""
    headers, counsellor_id = _make_counsellor(name, max_leads=max_leads)
    with SessionLocal() as db:
        user_id = (
            db.query(Counsellor).filter(Counsellor.id == counsellor_id).one().user_id
        )
    return headers, counsellor_id, user_id


def _inbox(user_id: int) -> list[dict]:
    with SessionLocal() as db:
        return [
            {"type": n.type, "title": n.title, "data": n.data}
            for n in db.query(Notification)
            .filter(Notification.user_id == user_id)
            .order_by(Notification.id.desc())
            .all()
        ]


def _admin_user_id(admin_headers: dict) -> int:
    me = client.get("/api/v1/users/me", headers=admin_headers)
    assert me.status_code == 200, me.text
    return me.json()["id"]


def test_new_enquiry_is_assigned_and_announced():
    """The Phase 25 gate: an enquiry becomes a lead somebody owns."""
    _park_all_counsellors()
    admin_headers = _make_admin()
    admin_id = _admin_user_id(admin_headers)
    _counsellor_headers, counsellor_id, counsellor_user_id = _make_counsellor_with_user(
        "handoff-counsellor"
    )

    lead_id = _submit_enquiry()

    detail = client.get(f"/api/v1/leads/{lead_id}", headers=admin_headers)
    assert detail.status_code == 200
    assert detail.json()["assigned_counsellor"] == "handoff-counsellor"

    admin_alerts = [
        n
        for n in _inbox(admin_id)
        if n["type"] == "new_lead" and (n["data"] or {}).get("enquiry_id") == lead_id
    ]
    assert admin_alerts, "the admin who owns the queue was never told about the lead"

    assigned_alerts = [
        n
        for n in _inbox(counsellor_user_id)
        if n["type"] == "lead_assigned" and (n["data"] or {}).get("enquiry_id") == lead_id
    ]
    assert assigned_alerts, "the counsellor the lead was assigned to was never told"

    # The auto-assignment must be a real one the CRM can see, not a notification
    # claiming something the list endpoint disagrees with.
    roster = client.get("/api/v1/counsellors", headers=admin_headers)
    assert roster.status_code == 200
    entry = next(c for c in roster.json() if c["id"] == counsellor_id)
    assert entry["active_leads"] == 1


def test_round_robin_prefers_the_least_loaded_counsellor():
    _park_all_counsellors()
    admin_headers = _make_admin()
    _headers_busy, busy_id, _ = _make_counsellor_with_user("busy-counsellor")
    _headers_idle, idle_id, _ = _make_counsellor_with_user("idle-counsellor")

    # Load only the first counsellor. The second is created later, so a naive
    # "first by id" balancer would keep handing work to the busy one.
    first = _submit_enquiry()
    assigned = client.get(f"/api/v1/leads/{first}", headers=admin_headers).json()
    assert assigned["assigned_counsellor"] == "busy-counsellor"

    second = _submit_enquiry()
    detail = client.get(f"/api/v1/leads/{second}", headers=admin_headers).json()
    assert detail["assigned_counsellor"] == "idle-counsellor"

    loads = {c["id"]: c["active_leads"] for c in client.get(
        "/api/v1/counsellors", headers=admin_headers
    ).json()}
    assert loads[busy_id] == 1
    assert loads[idle_id] == 1


def test_closed_lead_frees_round_robin_capacity():
    _park_all_counsellors()
    admin_headers = _make_admin()
    _headers_one, _id_one, _ = _make_counsellor_with_user("capped-counsellor", max_leads=1)

    first = _submit_enquiry()
    assert client.get(f"/api/v1/leads/{first}", headers=admin_headers).json()[
        "assigned_counsellor"
    ] == "capped-counsellor"

    # Capacity is now used up, so the next enquiry has nowhere to go but the
    # admins. Spec §39: "overflow to admin".
    overflowed = _submit_enquiry()
    assert (
        client.get(f"/api/v1/leads/{overflowed}", headers=admin_headers).json()[
            "assigned_counsellor"
        ]
        is None
    )

    # Winning the first lead must release the slot, otherwise a counsellor who
    # converts their work is permanently the least-preferred target.
    won = client.patch(
        f"/api/v1/leads/{first}/status", json={"status": "won"}, headers=admin_headers
    )
    assert won.status_code == 200

    third = _submit_enquiry()
    assert client.get(f"/api/v1/leads/{third}", headers=admin_headers).json()[
        "assigned_counsellor"
    ] == "capped-counsellor"


def test_overflow_lead_still_reaches_the_admin():
    """A lead nobody can take must not be a lead nobody heard about."""
    _park_all_counsellors()
    admin_headers = _make_admin()
    admin_id = _admin_user_id(admin_headers)
    _make_counsellor_with_user("full-counsellor", max_leads=1)

    first = _submit_enquiry()
    second = _submit_enquiry()

    alerts = [
        n
        for n in _inbox(admin_id)
        if n["type"] == "new_lead" and (n["data"] or {}).get("enquiry_id") in {first, second}
    ]
    assert len(alerts) == 2, "an unassignable lead was captured silently"


def test_counsellor_roster_is_admin_only():
    _park_all_counsellors()
    _make_counsellor_with_user("roster-counsellor")
    acc = _register("student")
    counsellor_headers, _cid, _uid = _make_counsellor_with_user("roster-peer")

    assert client.get("/api/v1/counsellors").status_code == 401
    assert client.get("/api/v1/counsellors", headers=acc["headers"]).status_code == 403
    # A counsellor can work assigned leads but has no business listing the team
    # they could be measured against, and cannot hand work over anyway.
    assert client.get("/api/v1/counsellors", headers=counsellor_headers).status_code == 403


def test_counsellor_roster_hides_inactive_by_default():
    _park_all_counsellors()
    admin_headers = _make_admin()
    _headers, _cid, _uid = _make_counsellor_with_user("roster-active")

    active = client.get("/api/v1/counsellors", headers=admin_headers)
    assert active.status_code == 200
    assert [c["name"] for c in active.json()] == ["roster-active"]

    everything = client.get(
        "/api/v1/counsellors", params={"include_inactive": True}, headers=admin_headers
    )
    assert everything.status_code == 200
    names = {c["name"] for c in everything.json()}
    assert "roster-active" in names
    assert len(names) > 1, "deactivated counsellors should still be listed on request"
    assert any(not c["is_active"] for c in everything.json())


def test_reassigning_a_lead_to_its_current_owner_is_not_a_capacity_check():
    """A counsellor who is exactly full must still be able to re-save their own lead."""
    _park_all_counsellors()
    admin_headers = _make_admin()
    _headers, _cid, _uid = _make_counsellor_with_user("exactly-full", max_leads=1)

    lead_id = _submit_enquiry()
    detail = client.get(f"/api/v1/leads/{lead_id}", headers=admin_headers).json()
    assert detail["assigned_counsellor"] == "exactly-full"

    with SessionLocal() as db:
        counsellor = db.query(Counsellor).filter(Counsellor.name == "exactly-full").one()
        counsellor_id = counsellor.id

    # The lead is their only one, so they are at max_leads. Re-sending the same
    # assignment must succeed: the lead being moved is not a *new* claim on
    # capacity, and refusing it would break the "save" button on a full
    # counsellor's own workspace.
    same = client.patch(
        f"/api/v1/leads/{lead_id}/assign",
        json={"counsellor_id": counsellor_id},
        headers=admin_headers,
    )
    assert same.status_code == 200, same.text
    assert same.json()["assigned_counsellor"] == "exactly-full"

    # But somebody else's lead is a genuine new claim, and must still be refused.
    other = _submit_enquiry()
    refused = client.patch(
        f"/api/v1/leads/{other}/assign",
        json={"counsellor_id": counsellor_id},
        headers=admin_headers,
    )
    assert refused.status_code == 409, refused.text


def test_a_max_length_name_still_produces_a_notification():
    """`enquiries.name` is VARCHAR(255) and the title prefix pushes past
    `notifications.title`'s own 255 — a long name must not lose the alert."""
    _park_all_counsellors()
    admin_headers = _make_admin()
    admin_id = _admin_user_id(admin_headers)
    long_name = "N" * 255

    lead_id = _submit_enquiry({"name": long_name, "mobile": f"3{uuid.uuid4().int % 1_000_000_000:09d}"})

    alerts = [
        n
        for n in _inbox(admin_id)
        if n["type"] == "new_lead" and (n["data"] or {}).get("enquiry_id") == lead_id
    ]
    assert alerts, "a 255-character name silently swallowed the alert"
    assert len(alerts[0]["title"]) <= 255


def test_admin_enquiry_list_filters_and_is_gated():
    _park_all_counsellors()
    admin_headers = _make_admin()
    marker = f"Filterable{uuid.uuid4().hex[:6]}"
    lead_id = _submit_enquiry({"name": marker, "mobile": f"4{uuid.uuid4().int % 1_000_000_000:09d}"})

    listing = client.get("/api/v1/enquiries", headers=admin_headers)
    assert listing.status_code == 200
    assert any(e["id"] == lead_id for e in listing.json())

    by_search = client.get(
        "/api/v1/enquiries", params={"search": marker}, headers=admin_headers
    )
    assert [e["id"] for e in by_search.json()] == [lead_id]

    by_status = client.get(
        "/api/v1/enquiries", params={"status": "won"}, headers=admin_headers
    )
    assert all(e["status"] == "won" for e in by_status.json())
    assert lead_id not in [e["id"] for e in by_status.json()]

    acc = _register("student")
    assert client.get("/api/v1/enquiries", headers=acc["headers"]).status_code == 403
    assert client.get("/api/v1/enquiries").status_code == 401
