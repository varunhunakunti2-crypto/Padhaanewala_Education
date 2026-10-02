"""Rebuild frontend/lib/data/mockTests.json from the database.

The frontend runner reads its questions from that JSON, not from the API
(frontend/lib/data/mockTests.ts builds QUESTION_BANK out of it). A paper that
exists only as a database row therefore renders as a card that opens to an
empty runner: getTestQuestions finds no `questionIds` and no subject pool.

This exports every paper, so the repo carries the question bank and a fresh
checkout can serve mock tests with no database at all.

Idempotent: it regenerates the file wholesale from current DB state.

    venv/Scripts/python.exe scripts/export_mock_tests_json.py
    venv/Scripts/python.exe scripts/export_mock_tests_json.py --dry-run
"""

import argparse
import json
import sys
from pathlib import Path

import psycopg2

# `backend/scripts/` -> `padhaanewala/frontend/lib/data/mockTests.json`.
BACKEND_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_TARGET = BACKEND_ROOT.parent / "frontend" / "lib" / "data" / "mockTests.json"

#: Preserved verbatim so the exported file keeps its schema hint and warning.
NOTE = (
    "Questions are served from this file, not from /mock-tests/{slug}/questions. "
    "A paper listed here runs offline; one that exists only as a database row "
    "shows a card that opens to an empty test. Keep the two in step by running "
    "scripts/export_mock_tests_json.py after any paper is added or edited."
)


def connect(dsn: str | None):
    if dsn:
        return psycopg2.connect(dsn)
    return psycopg2.connect(
        host="localhost",
        port=5432,
        user="padhaanewala",
        password="dev_password_123",
        dbname="padhaanewala_dev",
    )


def fetch(c):
    """Return every paper with its questions, in printed order."""
    cur = c.cursor()

    cur.execute(
        """
        SELECT m.slug, m.name, m.subject, m.difficulty, m.duration_minutes,
               m.attempts_allowed, m.negative_marks_value, m.result_visibility,
               m.test_type, e.slug, e.name
        FROM mock_tests m
        LEFT JOIN exams e ON e.id = m.exam_id
        WHERE m.is_active
        ORDER BY m.id
        """
    )
    papers = [
        {
            "slug": r[0],
            "title": r[1],
            "subject": r[2],
            "difficulty": r[3],
            "durationMinutes": r[4],
            "attemptsAllowed": r[5],
            "marksPerWrong": float(r[6]) if r[6] is not None else 1.0,
            "resultVisibility": r[7],
            "testType": r[8],
            "examRef": r[9],
            "examLabel": exam_label(r[9], r[10]),
            "questions": [],
        }
        for r in cur.fetchall()
    ]

    by_slug = {p["slug"]: p for p in papers}

    cur.execute(
        """
        SELECT m.slug, tq.question_text, tq.question_type, tq.options,
               tq.correct_answer, tq.numeric_answer, tq.tolerance,
               tq.subject, tq.topic, tq.explanation, tq.marks,
               tq.negative_marks
        FROM test_questions tq
        JOIN mock_tests m ON m.id = tq.mock_test_id
        WHERE tq.is_active AND m.is_active
        ORDER BY m.id, tq.sort_order
        """
    )

    problems = []
    for (slug, text, qtype, options, correct, numeric, tol,
         subject, topic, explanation, marks, neg) in cur.fetchall():
        paper = by_slug.get(slug)
        if paper is None:
            problems.append(f"{slug}: question with no paper")
            continue

        options = list(options or [])
        kind = qtype or "mcq"
        entry = {
            "ref": f"{paper['slug']}-q{len(paper['questions']) + 1}",
            "subject": subject or "",
            "topic": topic or subject or "",
            "text": text,
            "type": kind,
            "options": options,
            # -1 for numeric questions, per MockTestQuestion.correctIndex
            # (frontend/lib/types.ts:233). The runner compares `selected ===
            # correctIndex`, so null here would never match and would silently
            # mark every numeric answer wrong.
            "correctIndex": -1,
            "numericAnswer": float(numeric) if numeric is not None else None,
            "tolerance": float(tol) if tol is not None else 0,
            "explanation": explanation or "",
        }

        if kind == "mcq":
            # The DB stores the answer as the option *value* (commit 9c5b19c),
            # so it has to be resolved back to an index here.
            if correct not in options:
                problems.append(f"{slug} {entry['ref']}: answer {correct!r} not in options")
            elif options.count(correct) > 1:
                problems.append(f"{slug} {entry['ref']}: duplicate option {correct!r}")
            else:
                entry["correctIndex"] = options.index(correct)
        elif numeric is None:
            problems.append(f"{slug} {entry['ref']}: {kind} without numeric_answer")

        paper["questions"].append(entry)
        paper["marksPerCorrect"] = float(marks) if marks is not None else 4.0

    c.close()
    return papers, problems


def exam_label(exam_slug: str | None, exam_name: str | None) -> str:
    """'joint-entrance-examination-main' -> 'JEE Main'.

    The API already sends this string verbatim to the card badge, so the label
    is derived from the same source of truth rather than hand-maintained.
    Keyed on the slug, not the name: the name is the long formal title and is
    what gets stored on every row.
    """
    if not exam_slug:
        return "General"
    overrides = {
        "joint-entrance-examination-main": "JEE Main",
        "national-eligibility-cum-entrance-test-undergraduate": "NEET (UG)",
    }
    return overrides.get(exam_slug, exam_name or "General")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--dsn", help="libpq DSN; defaults to the local dev database")
    p.add_argument("--out", default=str(DEFAULT_TARGET), help="target JSON path")
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="report what would be written without touching the file",
    )
    args = p.parse_args()

    conn = connect(args.dsn)
    papers, problems = fetch(conn)

    for line in problems:
        print(f"  PROBLEM {line}")

    total = sum(len(p["questions"]) for p in papers)
    print(f"\n{len(papers)} papers, {total} questions")
    for p_ in papers:
        print(f"  {p_['slug']:48} {len(p_['questions'])} questions")

    if problems:
        raise SystemExit("\nrefusing to write: unresolved answers above")

    payload = {"$schema": "padhaanewala/mock-tests/v1", "note": NOTE, "papers": papers}
    body = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"

    if args.dry_run:
        print(f"\ndry run, would write {len(body):,} bytes to {args.out}")
        return

    out = Path(args.out)
    out.write_text(body, encoding="utf-8")
    print(f"\nwrote {len(body):,} bytes to {out}")


if __name__ == "__main__":
    main()