"""Load the shared mock-test content into Postgres.

    python scripts/seed_mock_tests.py [--refresh]

Source of truth is `frontend/lib/data/mockTests.json`, the same file the
frontend imports. That file used to be a TypeScript array, which meant the
`test_questions` table could never be populated: the columns added in
`a7e4c1b93d02` (`subject`, `topic`, `numeric_answer`, `tolerance`) and the
`question_type` constraint added in `d5f2a8c71e63` had nothing to describe,
because there was no way to create a question -- no endpoint, no seed script,
and the dev database held zero rows.

Idempotent by default: a paper that already exists is left alone. Pass
`--refresh` to rebuild the questions of an existing paper. That is destructive
and says so, because deleting questions cascades to `test_answers` and
therefore voids the saved answers of every attempt taken on the paper.

Run `scripts/seed_exams.py` first; a paper whose exam is missing is still
loaded, just without the `exam_id` link.
"""

import argparse
import json
import os
import sys
from decimal import Decimal
from pathlib import Path

# Allow `python scripts/seed_mock_tests.py` from any working directory: the repo
# root (which contains the `app` package) is not on sys.path by default, because
# Python puts the *script's* directory there instead.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Exam, MockTest, TestQuestion
from app.question_types import QuestionType

BACKEND_ROOT = Path(__file__).resolve().parent.parent

#: `backend/scripts/` -> `padhaanewala/frontend/lib/data/mockTests.json`.
DEFAULT_SOURCE = BACKEND_ROOT.parent / "frontend" / "lib" / "data" / "mockTests.json"


def load_papers(path: Path) -> list[dict]:
    if not path.exists():
        raise SystemExit(
            f"source not found: {path}\n"
            "Override with MOCK_TESTS_JSON=/path/to/mockTests.json"
        )
    with path.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    papers = payload.get("papers")
    if not papers:
        raise SystemExit(f"{path} contains no papers")
    return papers


def validate(paper: dict) -> None:
    """Fail loudly on content the database would otherwise reject obscurely.

    The `question_type` CHECK constraint would catch a bad type, but it would
    only do so after the paper row and most of its questions were already
    written, leaving a half-loaded paper behind. Validating first makes the
    seed all-or-nothing.
    """
    slug = paper.get("slug", "<no slug>")
    seen: set[str] = set()

    for position, question in enumerate(paper.get("questions", []), start=1):
        where = f"{slug} Q{position}"
        ref = question.get("ref")
        if not ref:
            raise SystemExit(f"{where}: missing 'ref'")
        if ref in seen:
            raise SystemExit(f"{where}: duplicate ref {ref!r}")
        seen.add(ref)

        kind = question.get("type", QuestionType.MCQ.value)
        if kind not in {member.value for member in QuestionType}:
            raise SystemExit(
                f"{where}: question_type {kind!r} is not one of "
                f"{sorted(m.value for m in QuestionType)}"
            )

        if kind == QuestionType.MCQ.value:
            options = question.get("options") or []
            index = question.get("correctIndex", -1)
            if not options:
                raise SystemExit(f"{where}: mcq has no options")
            if not 0 <= index < len(options):
                raise SystemExit(
                    f"{where}: correctIndex {index} outside 0..{len(options) - 1}"
                )
        else:
            if question.get("numericAnswer") is None:
                raise SystemExit(f"{where}: {kind} has no numericAnswer")


def build_paper_fields(paper: dict, exam_id: int | None) -> dict:
    questions = paper["questions"]
    correct = Decimal(str(paper.get("marksPerCorrect", 3)))
    wrong = Decimal(str(paper.get("marksPerWrong", 1)))
    return {
        "name": paper["title"],
        "slug": paper["slug"],
        "exam_id": exam_id,
        # A three-subject paper has no single subject. NULL is the documented
        # signal for "mixed"; each question carries its own.
        "subject": paper.get("subject"),
        "difficulty": paper.get("difficulty", "medium"),
        "question_type": QuestionType.MCQ.value,
        "duration_minutes": int(paper.get("durationMinutes", 60)),
        "total_marks": correct * len(questions),
        "negative_marking": wrong > 0,
        "negative_marks_value": wrong,
        "attempts_allowed": int(paper.get("attemptsAllowed", 1)),
        # Both are False on purpose: `test_questions.sort_order` exists to serve
        # a paper exactly as printed, so shuffling would defeat the point.
        "question_randomization": False,
        "option_randomization": False,
        "instructions": paper.get("instructions"),
        "result_visibility": paper.get("resultVisibility", "immediate"),
        "test_type": paper.get("testType", "standard"),
        "is_active": True,
    }


def build_questions(paper: dict) -> list[TestQuestion]:
    correct = Decimal(str(paper.get("marksPerCorrect", 3)))
    wrong = Decimal(str(paper.get("marksPerWrong", 1)))
    built: list[TestQuestion] = []

    for order, question in enumerate(paper["questions"], start=1):
        kind = question.get("type", QuestionType.MCQ.value)
        is_mcq = kind == QuestionType.MCQ.value

        built.append(
            TestQuestion(
                question_text=question["text"],
                question_type=kind,
                options=question.get("options") or None,
                # `correct_answer` must be one of this question's own option
                # values, because that is what the autograder compares verbatim
                # and what the authoring endpoint's `_check_gradeable`
                # validates. The source JSON expresses the key as a 0-based
                # `correctIndex`, so it is resolved against `options` here.
                # Writing an option *letter* instead stored "B" against options
                # like ['2 V', '3 V'], so no submission could ever match: 0 of
                # 60 seeded MCQs were gradable.
                correct_answer=(
                    (question.get("options") or [])[question["correctIndex"]]
                    if is_mcq
                    else None
                ),
                numeric_answer=(
                    None if is_mcq else Decimal(str(question["numericAnswer"]))
                ),
                tolerance=Decimal(str(question.get("tolerance", 0))),
                subject=question.get("subject"),
                topic=question.get("topic"),
                marks=correct,
                negative_marks=wrong,
                difficulty=paper.get("difficulty", "medium"),
                explanation=question.get("explanation"),
                sort_order=order,
                is_active=True,
            )
        )
    return built


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="rebuild questions of an existing paper (cascades to its attempts' answers)",
    )
    parser.add_argument(
        "--source",
        default=os.environ.get("MOCK_TESTS_JSON", str(DEFAULT_SOURCE)),
        help="path to mockTests.json",
    )
    args = parser.parse_args()

    papers = load_papers(Path(args.source))
    for paper in papers:
        validate(paper)

    with SessionLocal() as db:
        created_papers = 0
        created_questions = 0
        skipped: list[str] = []

        for paper in papers:
            existing = db.scalar(select(MockTest).where(MockTest.slug == paper["slug"]))
            if existing is not None and not args.refresh:
                skipped.append(paper["slug"])
                continue

            exam_id = None
            ref = paper.get("examRef")
            if ref:
                exam = db.scalar(select(Exam).where(Exam.slug == ref))
                if exam is None:
                    print(f"  ! {paper['slug']}: no exam with slug {ref!r}; leaving exam_id NULL")
                else:
                    exam_id = exam.id

            fields = build_paper_fields(paper, exam_id)

            if existing is None:
                mock_test = MockTest(**fields)
                db.add(mock_test)
                db.flush()
                created_papers += 1
                print(f"  + {paper['slug']} ({len(paper['questions'])} questions)")
            else:
                if not args.refresh:
                    continue
                # Replace the questions, keep the paper row so its id, and any
                # attempt pointing at it, survive. test_answers is lost -- which
                # is why --refresh has to be asked for explicitly.
                db.query(TestQuestion).filter(
                    TestQuestion.mock_test_id == existing.id
                ).delete(synchronize_session=False)
                for key, value in fields.items():
                    setattr(existing, key, value)
                mock_test = existing
                print(f"  ~ {paper['slug']} (questions rebuilt)")

            questions = build_questions(paper)
            for question in questions:
                question.mock_test_id = mock_test.id
                db.add(question)
            created_questions += len(questions)

        db.commit()

    print(
        f"\nSeeded {created_papers} new paper(s), {created_questions} questions"
        + (f"; left alone: {', '.join(skipped)} (use --refresh)" if skipped else "")
    )


if __name__ == "__main__":
    main()
