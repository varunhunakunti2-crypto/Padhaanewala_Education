"""Pytest bootstrap.

Five safety measures are applied before the application is imported:

1. Rate limiting is disabled so auth tests are not throttled by Redis.
2. Email verification is not enforced at login, because registration creates
   users with `is_email_verified=False` and roughly fifteen tests across eight
   files register-then-login expecting tokens. The gate itself is still covered
   explicitly in `test_otp.py`, which re-enables it per-test via monkeypatch.
3. The `Host` header the suite presents is allowlisted, because
   `TrustedHostMiddleware` otherwise rejects TestClient's default
   `testserver` with a bodiless 400 before any route runs.
4. The suite runs inside a dedicated PostgreSQL **schema** rather than the
   default `public` schema. Previously it ran against the developer database and
   executed `TRUNCATE TABLE users CASCADE` on it, silently destroying real data.
5. Redis is stubbed. `GET /health` pings it and reports degraded when it does not
   answer, so without a stub the suite's outcome depends on whether a
   `redis:7-alpine` container happens to be up -- tests that assert `200` on
   `/health` would fail for a reason that has nothing to do with the code under
   test. `test_ratelimit_redis.py` installs its own counting and failing stubs
   to exercise the limiter's real behaviour.

`PADHAANEWALA_SCHEMA` is honoured by `app/database.py`, so the FastAPI app, the
seed scripts and Alembic all resolve tables inside the scratch schema.

Run with:

    $env:PADHAANEWALA_SCHEMA = "test_suite"
    python scripts/bootstrap_test_db.py   # migrate + seed, in the right order
    pytest

`.github/workflows/backend-tests.yml` runs exactly those two steps, so a green
local run and a green CI run test the same thing.
"""

import os
import sys

os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["EMAIL_VERIFICATION_REQUIRED"] = "false"
os.environ.setdefault("PADHAANEWALA_SCHEMA", "test_suite")

# `TrustedHostMiddleware` rejects a `Host` header outside
# `settings.allowed_host_list`, which derives to `['localhost']` while
# ALLOWED_HOSTS is empty. Starlette's TestClient defaults to base_url
# "http://testserver", so it sent `Host: testserver` and every request came back
# 400 with an empty body -- the whole suite failed at its first register() call.
# ALLOWED_HOSTS is the supported override for exactly this, so name the hosts the
# suite actually presents rather than patching the middleware or the client. The
# production guard that refuses to start without an explicit ALLOWED_HOSTS is
# untouched, and this only widens the list for the test process.
os.environ["ALLOWED_HOSTS"] = "testserver,localhost,127.0.0.1"

# Make the repo root importable regardless of the invocation directory.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from sqlalchemy import text

from app.database import engine
from app.roles import ALL_ROLES

TEST_SCHEMA = os.environ["PADHAANEWALA_SCHEMA"]


class _StubRedis:
    """A Redis that answers, so `/health` and the limiter are exercised offline.

    Only the commands the application actually issues are implemented. Anything
    else would be a silent lie, so `__getattr__` is deliberately absent: an
    unexpected command raises instead of returning a plausible-looking empty
    reply.
    """

    async def ping(self) -> bool:
        return True

    async def eval(self, script: str, numkeys: int, key: str, window: str) -> list[int]:
        return [1, int(window)]


@pytest.fixture(autouse=True, scope="session")
def _stub_redis():
    """Replace the Redis client for the whole suite.

    Patched on `app.services.redis_client` rather than on each call site,
    because `ratelimit.py` does `from ... import get_redis` and captured its own
    reference at import time; patching the defining module is the only target
    that reaches the health check. `test_ratelimit_redis.py` patches
    `app.middleware.ratelimit.get_redis` for the limiter, and the two patches
    are independent.
    """
    import app.services.redis_client as redis_client

    original = redis_client.get_redis
    redis_client.get_redis = lambda: _StubRedis()
    try:
        yield
    finally:
        redis_client.get_redis = original


def pytest_sessionstart(session):
    """Fail fast with actionable guidance if the test schema is not migrated."""
    with engine.connect() as conn:
        exists = conn.execute(
            text("SELECT to_regclass(:t)"), {"t": f"{TEST_SCHEMA}.users"}
        ).scalar()
        if exists is None:
            conn.rollback()
            conn.close()
            # Must be raised, not merely constructed, or the hook falls through
            # to _ensure_roles and dies with an opaque UndefinedTable traceback.
            raise pytest.UsageError(
                f"Schema {TEST_SCHEMA!r} has no tables. Prepare it first:\n"
                f"  $env:PADHAANEWALA_SCHEMA = '{TEST_SCHEMA}'\n"
                "  python -m alembic upgrade head\n"
                "  python scripts/seed_roles.py\n"
                "  python scripts/seed_colleges_courses.py\n"
            )
        _ensure_roles(conn)
        conn.commit()


def _ensure_roles(conn) -> None:
    """Guarantee the canonical role rows exist before any test runs.

    The RBAC suite depends on every canonical role being present, and registration
    is now fail-closed (R2.4), so a single missing row makes every test that
    registers a user fail with a confusing 503. Re-seeding here keeps the suite
    self-healing instead of order-dependent.
    """
    present = {name for (name,) in conn.execute(text("SELECT name FROM roles"))}
    missing = [name for name in ALL_ROLES if name not in present]
    if missing:
        for name in missing:
            conn.execute(
                text(
                    "INSERT INTO roles (name, description, created_at) "
                    "VALUES (:n, :d, now()) ON CONFLICT (name) DO NOTHING"
                ),
                {"n": name, "d": f"conftest auto-seed: {name}"},
            )
        print(f"[conftest] re-seeded missing roles: {', '.join(missing)}")


@pytest.fixture(autouse=True, scope="session")
def _clean_users():
    """Clear rows created by earlier runs so listing assertions are stable.

    Seeded catalog data (roles, states, colleges, courses, exams, papers,
    questions) is preserved because several tests assert against it.

    ## Why this is not `TRUNCATE ... CASCADE`

    `TRUNCATE ... CASCADE` walks the *declared* foreign-key graph, not the rows.
    Naming a table therefore truncates every table that could reach it through
    any chain of declared foreign keys, whether or not there is anything in those
    tables to delete. The seeded question bank has two such chains out of
    `users`:

    * ``test_attempts.mock_test_id -> mock_tests -> test_questions``
    * ``users.created_by <- question_import_jobs`` together with
      ``test_questions.import_job_id -> question_import_jobs``, added in
      ``d7e1b4c9a205``. This one is the awkward one: it does not pass through
      ``mock_tests``, so the papers survive while every question in them is
      emptied. That reads as a seeding bug rather than a fixture bug, and it is
      why this fixture needs a paragraph.

    So `users` is cleared with `DELETE` instead. A row-level delete follows only
    the rows actually present, and every foreign key into `users` is already
    `ON DELETE CASCADE` or `ON DELETE SET NULL`, so every user-owned row still
    goes without a hand-written list of twenty tables -- which is the property
    the original `CASCADE` was there to get, and the reason this is a `DELETE`
    and not an unrolled list of deletes.

    The cost is `RESTART IDENTITY` on the user tables: sequences are not reset.
    Nothing asserts on a user id, and a stable listing assertion is about which
    rows exist, not what they are numbered.

    `test_answers` and `test_attempts` are truncated rather than deleted only
    because they are the two tables whose ids *are* asserted on, and both must
    be named in one statement -- PostgreSQL refuses to truncate
    `test_attempts` alone while `test_answers` references it.

    `question_import_jobs` goes first so its drafts are left describing nothing.
    That FK is `ON DELETE SET NULL`, so the questions stay; they stay `pending`,
    so `_PUBLISHABLE` hides them from every student-facing read. That is the
    correct outcome for a question whose job no longer exists.
    """
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM question_import_jobs"))
        conn.execute(
            text("TRUNCATE TABLE test_answers, test_attempts RESTART IDENTITY")
        )
        conn.execute(text("DELETE FROM users"))
    yield
