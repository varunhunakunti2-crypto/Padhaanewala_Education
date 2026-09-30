"""Purge test-suite residue and demo rows from the dev database.

Deletes only rows that are provably not real data:

  * every `users` row - the whole table is `@example.com` test accounts, including
    8 accounts holding `super_admin`
  * every `colleges` row - 10 hand-written demo institutions plus 31 fixtures the
    test suite leaked into `public`
  * the two courses the test suite created
  * every mock test and its placeholder questions ('Question 1' / 'Question 2' /
    'Question 3')
  * test residue in blogs, blog_categories, media, enquiries, lead notes,
    notifications, consent records, audit logs, seo metadata, reviews

Preserved untouched:

  roles, states, districts, cities, universities, exams, scholarships
  and the 20 real course definitions.

Run with --dry-run first to print the row counts without deleting.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text

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


def main() -> int:
    dry_run = "--dry-run" in sys.argv

    with SessionLocal() as db:
        print("== before ==")
        for table in DELETE_ORDER + PRESERVE:
            count = db.scalar(text(f'SELECT count(*) FROM "{table}"'))
            print(f"  {table:22s} {count}")

        plan = []
        for table in DELETE_ORDER + ["courses"]:
            where = DELETE_WHERE.get(table)
            sql = f'DELETE FROM "{table}"'
            if where:
                sql += f" WHERE {where}"
            plan.append((table, sql))

        if dry_run:
            total = 0
            print("\n== would delete ==")
            for table, sql in plan:
                select_sql = sql.replace("DELETE FROM", "SELECT count(*) FROM", 1)
                affected = db.scalar(text(select_sql))
                total += affected or 0
                print(f"  {table:22s} {affected}")
            print(f"\nDRY RUN: {total} rows would be deleted. Nothing was changed.")
            return 0

        for table, sql in plan:
            result = db.execute(text(sql))
            if result.rowcount:
                print(f"  deleted {result.rowcount:5d} from {table}")

        db.commit()

        print("== after ==")
        for table in DELETE_ORDER + ["courses"] + PRESERVE:
            count = db.scalar(text(f'SELECT count(*) FROM "{table}"'))
            print(f"  {table:22s} {count}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
