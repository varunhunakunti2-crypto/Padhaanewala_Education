"""Pytest bootstrap.

Two safety measures are applied before the application is imported:

1. Rate limiting is disabled so auth tests are not throttled by Redis.
2. The suite runs inside a dedicated PostgreSQL **schema** rather than the
   default `public` schema. Previously it ran against the developer database and
   executed `TRUNCATE TABLE users CASCADE` on it, silently destroying real data.

`PADHAANEWALA_SCHEMA` is honoured by `app/database.py`, so the FastAPI app, the
seed scripts and Alembic all resolve tables inside the scratch schema.

Run with:

    $env:PADHAANEWALA_SCHEMA = "test_suite"
    python -m alembic upgrade head
    python scripts/seed_roles.py
    python scripts/seed_colleges_courses.py
    pytest -v
"""

import os
import sys

os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ.setdefault("PADHAANEWALA_SCHEMA", "test_suite")

# Make the repo root importable regardless of the invocation directory.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from sqlalchemy import text

from app.database import engine

TEST_SCHEMA = os.environ["PADHAANEWALA_SCHEMA"]


def pytest_sessionstart(session):
    """Fail fast with actionable guidance if the test schema is not migrated."""
    with engine.connect() as conn:
        exists = conn.execute(
            text("SELECT to_regclass(:t)"), {"t": f"{TEST_SCHEMA}.users"}
        ).scalar()
    if exists is None:
        pytest.UsageError(
            f"Schema {TEST_SCHEMA!r} has no tables. Prepare it first:\n"
            f"  $env:PADHAANEWALA_SCHEMA = '{TEST_SCHEMA}'\n"
            f"  python -m alembic upgrade head\n"
            f"  python scripts/seed_roles.py\n"
            f"  python scripts/seed_colleges_courses.py\n"
        )


@pytest.fixture(autouse=True, scope="session")
def _clean_users():
    """Clear rows created by earlier runs so listing assertions are stable.

    Seeded catalog data (roles, states, colleges, courses, exams, ...) is
    preserved because several tests assert against it.
    """
    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE TABLE users, enquiries, consent_records, reviews, "
                "test_answers, test_attempts, notifications, saved_colleges, "
                "lead_notes, lead_status_history RESTART IDENTITY CASCADE"
            )
        )
    yield
