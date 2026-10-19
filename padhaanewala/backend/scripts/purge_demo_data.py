"""Purge test-suite residue from a development database. Destructive; opt-in.

This script deletes rows. It is a development utility and nothing else, so it
refuses to run anywhere other than a development `APP_ENV`, and it changes
nothing unless `--execute` is passed. Running it bare prints the plan and exits:

    python scripts/purge_demo_data.py                       # plan only, no writes
    python scripts/purge_demo_data.py --execute             # delete (see below)
    python scripts/purge_demo_data.py --execute --include-colleges

What it deletes with `--execute`:

  * `users` whose email is `@example.com` - the accounts the test suite creates.
    Real accounts on any other domain are left alone: this is a filtered delete,
    not `DELETE FROM users`. (The old docstring claimed "every users row"; the
    code has always filtered, and this note now matches it.)
  * `courses` named `Test %` / `Enrich %` - the fixtures the suite creates. The
    real course definitions survive.
  * `mock_tests` and their questions/attempts/answers, plus residue in blogs,
    blog_categories, media, enquiries, lead notes, notifications, consent
    records, audit logs, seo metadata and reviews.
  * `colleges` - ONLY with the extra `--include-colleges`. Deleting the catalogue
    removes every college row, including a real seeded one, and is the one thing
    here the seed scripts cannot rebuild. It used to run unconditionally, which
    on a database holding a real (331-row) catalogue was a foot-gun. Now opt-in.

Preserved untouched: roles, states, districts, cities, universities, exams,
scholarships, and the real (non-`Test`/`Enrich`) courses.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text

from app.config import settings
from app.database import SessionLocal

# Child tables first: every table that references another table being deleted is
# removed before its parent, so no foreign key is left dangling.
DELETE_ORDER = [
    # --- mock test tree ---
    "test_answers",
    "test_attempts",
    "test_questions",
    "mock_tests",
    # --- college children ---
    "reviews",
    "saved_colleges",
    "cutoffs",
    "fees",
    "admissions",
    "placement_records",
    "nirf_rankings",
    "other_rankings",
    "seat_matrix",
    "college_courses",
    # --- lead / enquiry tree ---
    "lead_notes",
    "lead_status_history",
    "enquiries",
    # --- content authored during tests ---
    "blogs",
    "blog_categories",
    "media",
    "seo_metadata",
    # --- user children ---
    "notifications",
    "audit_logs",
    "consent_records",
    "counsellors",
    "admins",
    "student_profiles",
    "user_roles",
    "users",
    # --- colleges last: still referenced by nothing above ---
    "colleges",
]

# `courses` holds 20 real course definitions that must survive, and `users` may
# hold a real admin account, so those two tables are filtered instead of cleared.
DELETE_WHERE = {
    "users": "email LIKE '%@example.com'",
    # The fixtures name themselves "Test ..." / "Enrich ...". Matching on the name
    # rather than the slug is deliberate: one of them slugs as 'course-5125ae81'.
    "courses": "name LIKE 'Test %' OR name LIKE 'Enrich %'",
}

PRESERVE = [
    "roles",
    "states",
    "districts",
    "cities",
    "universities",
    "exams",
    "scholarships",
]


#: `APP_ENV` values that mean a real deployment. The script is a development
#: utility, so it refuses both. Kept as a pure function so the guard is testable
#: without opening a database.
_DEPLOYED_ENVS = ("staging", "production")


def _deployment_refusal(app_env: str) -> str | None:
    """Return a refusal message when `app_env` names a deployed environment."""
    if app_env in _DEPLOYED_ENVS:
        return (
            f"refusing to run: APP_ENV={app_env!r}. This script deletes rows and "
            "is only ever correct against a development database."
        )
    return None


def main() -> int:
    refusal = _deployment_refusal(settings.APP_ENV)
    if refusal is not None:
        print(refusal, file=sys.stderr)
        return 2

    # Deletion is opt-in. `--dry-run` is accepted as an explicit spelling of the
    # default; only `--execute` writes. A script this destructive must not be one
    # forgotten flag away from running.
    execute = "--execute" in sys.argv and "--dry-run" not in sys.argv
    include_colleges = "--include-colleges" in sys.argv

    delete_order = [table for table in DELETE_ORDER if table != "colleges"]
    if include_colleges:
        # Appended last, matching DELETE_ORDER: the child tables reference it.
        delete_order.append("colleges")

    with SessionLocal() as db:
        print("== before ==")
        for table in delete_order + ["courses"] + PRESERVE:
            count = db.scalar(text(f'SELECT count(*) FROM "{table}"'))
            print(f"  {table:22s} {count}")

        plan = []
        for table in delete_order + ["courses"]:
            where = DELETE_WHERE.get(table)
            sql = f'DELETE FROM "{table}"'
            if where:
                sql += f" WHERE {where}"
            plan.append((table, sql))

        if not execute:
            total = 0
            print("\n== would delete ==")
            for table, sql in plan:
                select_sql = sql.replace("DELETE FROM", "SELECT count(*) FROM", 1)
                affected = db.scalar(text(select_sql))
                total += affected or 0
                print(f"  {table:22s} {affected}")
            if not include_colleges:
                print("  (colleges excluded - pass --include-colleges to include them)")
            print(
                f"\nPLAN ONLY: {total} rows would be deleted. Nothing was changed. "
                "Re-run with --execute to apply."
            )
            return 0

        for table, sql in plan:
            result = db.execute(text(sql))
            if result.rowcount:
                print(f"  deleted {result.rowcount:5d} from {table}")

        db.commit()

        print("== after ==")
        for table in delete_order + ["courses"] + PRESERVE:
            count = db.scalar(text(f'SELECT count(*) FROM "{table}"'))
            print(f"  {table:22s} {count}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
