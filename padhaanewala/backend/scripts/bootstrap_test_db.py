"""Build a ready-to-test database in one command.

Wraps the migrate + seed ritual that `tests/conftest.py` documents, so CI and
developers run byte-for-byte the same setup and a newly added seed script cannot
be silently forgotten in one of the two places.

    python scripts/bootstrap_test_db.py

Everything is scoped to `$PADHAANEWALA_SCHEMA` (default `test_suite`), so the
surrounding database is never touched. The scripts are individually idempotent,
so re-running this on an already-bootstrapped schema is a no-op.

Set `PADHAANEWALA_SCHEMA` before invoking, or export `DATABASE_URL` to point at
a different server.
"""

import os
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent

# Order matters:
#   roles       - registration is fail-closed on a missing role (R2.4)
#   locations   - states + districts, and the parents of everything below
#   universities- needs the state rows from `locations`
#   colleges    - needs states/districts/universities and creates the courses
#   scholarships- needs states
#   exams       - standalone
SEED_SCRIPTS = (
    "seed_roles.py",
    "seed_locations.py",
    "seed_universities.py",
    "seed_colleges_courses.py",
    "seed_scholarships.py",
    "seed_exams.py",
)


def _run(*argv: str) -> None:
    print(f"\n$ {' '.join(argv)}", flush=True)
    # `check=True` turns a failing step into an immediate, named failure rather
    # than 200 tests failing on missing fixture data.
    subprocess.run(argv, cwd=BACKEND_ROOT, check=True)


def main() -> None:
    schema = os.environ.setdefault("PADHAANEWALA_SCHEMA", "test_suite")
    # The seed scripts are spawned as subprocesses and read this from the
    # environment, so it has to be exported here rather than just set above.
    os.environ["PADHAANEWALA_SCHEMA"] = schema

    # conftest disables rate limiting for the same reason: the auth tests
    # hammer /auth/login and would otherwise be throttled (or need Redis).
    os.environ["RATE_LIMIT_ENABLED"] = "false"

    database_url = os.environ.get("DATABASE_URL", "<config default>")
    print(f"Bootstrapping schema {schema!r} against {database_url}")

    _run(sys.executable, "-m", "alembic", "upgrade", "head")
    for script in SEED_SCRIPTS:
        _run(sys.executable, str(Path("scripts") / script))

    print(f"\nSchema {schema!r} is ready. Run: pytest")


if __name__ == "__main__":
    main()
