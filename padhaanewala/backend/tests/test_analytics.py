"""Contract for the admin analytics endpoint.

The Analytics panel is the first admin screen whose entire payload comes from a
single aggregation endpoint, so it gets a boundary test of its own rather than
a row in the generic sweep:

* unauthenticated callers are refused (401)
* a plain student is refused (403) — same server-side rule as every CRM read
* an admin sees a well-formed overview: every section present, a full
  ``SERIES_DAYS``-long series, non-negative counts, and self-consistent
  breakdowns (the lead status buckets must sum to the total, because every
  enquiry has exactly one status).
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Role, User

client = TestClient(app)

PASSWORD = "SecurePass123!"

OVERVIEW_PATH = "/api/v1/admin/analytics/overview"


def _unique(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:8]}@example.com"


def _unique_mobile() -> str:
    return f"9{uuid.uuid4().int % 1_000_000_000:09d}"


def _assign_roles(email: str, role_names: list[str]) -> None:
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).first()
        assert user is not None
        roles = []
        for name in role_names:
            role = db.query(Role).filter(Role.name == name).first()
            if role is None:
                role = Role(name=name, description=f"test:{name}")
                db.add(role)
                db.flush()
            roles.append(role)
        user.roles = roles
        db.commit()


def _register(prefix: str) -> dict:
    payload = {
        "name": "Analytics Test",
        "email": _unique(prefix),
        "mobile": _unique_mobile(),
        "password": PASSWORD,
        "age_band": "18_plus",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    return payload


def _login(email: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
def student():
    return _register("student")


@pytest.fixture
def admin_account():
    account = _register("admin")
    _assign_roles(account["email"], ["admin", "super_admin"])
    return account


def test_overview_requires_authentication():
    assert client.get(OVERVIEW_PATH).status_code == 401


def test_student_is_forbidden(student):
    response = client.get(OVERVIEW_PATH, headers=_login(student["email"]))
    assert response.status_code == 403, response.text


def test_admin_can_read_overview(admin_account):
    response = client.get(OVERVIEW_PATH, headers=_login(admin_account["email"]))
    assert response.status_code == 200, response.text


def test_admin_overview_shape(admin_account):
    response = client.get(OVERVIEW_PATH, headers=_login(admin_account["email"]))
    assert response.status_code == 200
    body = response.json()

    assert body["generated_at"]
    assert body["generated_at"].endswith(("Z", "+00:00"))
    assert body["users"]["total"] >= 1
    assert body["users"]["new_30d"] >= 0
    for role in body["users"]["by_role"]:
        assert role["count"] >= 0

    leads = body["leads"]
    assert leads["total"] == sum(item["count"] for item in leads["by_status"]), (
        "lead status buckets must sum to the total, because every enquiry has one status"
    )
    assert leads["new_7d"] >= 0
    assert leads["new_30d"] >= leads["new_7d"]

    tests = body["mock_tests"]
    assert tests["attempts_completed"] <= tests["attempts_total"]
    assert tests["attempts_30d"] >= 0
    assert tests["average_percentage"] is None or 0 <= tests["average_percentage"] <= 100
    for paper in tests["top_papers"]:
        assert paper["name"]
        assert paper["attempts"] > 0  # ranked list only contains papers attempted

    assert body["reviews"]["total"] >= 0
    assert body["reviews"]["average_rating"] is None or 0 <= body["reviews"]["average_rating"] <= 5
    assert body["saved_colleges"] >= 0

    for key in ("colleges", "courses", "exams", "scholarships", "blogs", "mock_tests"):
        assert body["catalogue"][key] >= 0

    series = body["series"]
    assert len(series) == 14
    assert series[0]["date"] < series[-1]["date"]
    for point in series:
        assert point["leads"] >= 0
        assert point["registrations"] >= 0
        assert point["attempts"] >= 0
        assert point["reviews"] >= 0
    assert sum(p["leads"] for p in series) <= leads["total"], (
        "the series cannot show more leads than exist"
    )