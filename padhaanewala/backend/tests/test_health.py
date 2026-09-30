"""Regression tests for `GET /health`.

The endpoint used to return a constant `{"status": "ok"}` with no database
access, which is what allowed the admin panel to display "PostgreSQL
connectivity verified" while pointing at nothing. These tests pin the two
behaviours that matter: a real query runs, and a broken database produces a
non-200 with an honest verdict rather than a passing status.
"""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.main import app

client = TestClient(app)


def test_health_reports_database_ok():
    resp = client.get("/health")

    assert resp.status_code == 200

    body = resp.json()
    assert body["status"] == "ok"
    assert "database" in body["checks"]
    assert body["checks"]["database"]["ok"] is True
    # The detail must describe the check that actually ran.
    assert "SELECT 1" in body["checks"]["database"]["detail"]
    assert body["checked_at"]


def test_health_reports_failure_and_503_when_database_is_down():
    """A dead database must not be reported as healthy."""
    with patch(
        "app.main.SessionLocal",
        side_effect=OperationalError("SELECT 1", {}, Exception("connection refused")),
    ):
        resp = client.get("/health")

    assert resp.status_code == 503

    body = resp.json()
    assert body["status"] == "degraded"
    assert body["checks"]["database"]["ok"] is False
    assert body["checks"]["database"]["detail"]


def test_health_failure_detail_does_not_leak_driver_message():
    """SQLAlchemy errors can embed the connection string, so they are not echoed."""
    with patch(
        "app.main.SessionLocal",
        side_effect=OperationalError(
            "SELECT 1",
            {},
            Exception("could not connect to server: postgres://user:hunter2@db:5432/app"),
        ),
    ):
        body = client.get("/health").json()

    detail = body["checks"]["database"]["detail"]
    assert "hunter2" not in detail
    assert "postgres://" not in detail
    # The exception class is still named so failures stay diagnosable.
    assert "OperationalError" in detail


def test_health_still_answers_when_the_query_itself_fails():
    """The failure is captured inside a successful session, not raised."""

    class Boom:
        def execute(self, *args, **kwargs):
            raise OperationalError("SELECT 1", {}, Exception("terminating connection"))

        def close(self):
            return None

    with patch("app.main.SessionLocal", return_value=Boom()):
        resp = client.get("/health")

    assert resp.status_code == 503
    assert resp.json()["checks"]["database"]["ok"] is False


@pytest.mark.parametrize("path", ["/health", "/api/v1/health"])
def test_health_is_not_gated_by_auth(path):
    """Uptime monitors call this without credentials."""
    resp = client.get(path)
    # Only the root path exists; the prefixed one must 404 rather than 401, which
    # would hide a misconfigured probe URL behind an auth error.
    assert resp.status_code in (200, 404, 503)
