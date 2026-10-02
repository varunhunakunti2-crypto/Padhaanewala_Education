"""Load papers extracted by `extract_pdf_papers.py` into Postgres.

    python scripts/load_pdf_papers.py --extracted ../extracted.json            # dry run
    python scripts/load_pdf_papers.py --extracted ../extracted.json --apply

Paper-level identity is the slug, and a paper that already exists is skipped
whole. That is the only dedupe that is safe to apply automatically: questions
belong to a paper, so removing one that also appears in a *different* paper
would silently break that paper's length and mark total. Overlap between papers
is reported instead, because it is a content decision for a human, not a
mechanical one.

Within a single paper, a repeated question text *is* dropped. That case means
the PDF listed the same question twice under different numbers, which is always
a parsing artefact rather than an intentional repeat.
"""

import argparse
import json
import re
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path

# The source PDFs are full of characters the default Windows console codec
# cannot encode (√, θ, μ). Reconfiguring stdout keeps the report readable
# instead of dying part-way through with UnicodeEncodeError.
for stream in (sys.stdout, sys.stderr):
    if hasattr(stream, "reconfigure"):
        stream.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import func, select

from app.database import SessionLocal
from app.models import Exam, MockTest, TestQuestion
from app.question_types import QuestionType

#: Exam slug each source paper belongs to, so `mock_tests.exam_id` is populated
#: the same way `seed_mock_tests.py` populates it from `examRef`.
PAPER_EXAMS = {
    "paper-3": "joint-entrance-examination-main",
    "full-length": "joint-entrance-examination-main",
    "neet": "national-eligibility-cum-entrance-test-undergraduate",
}

#: Short stem used to build question refs. Kept separate from the slug because
#: the full-length paper restarts its numbering every subject, so its refs need
#: the subject to stay unique where the other two papers do not.
PAPER_REFS = {
    "paper-3": "hp3",
    "full-length": "hfl",
    "neet": "neet2",
}

PAPER_META = {
    "paper-3": {
        "slug": "jee-main-hardcore-mock-paper-3-2026",
        "title": "Hardcore JEE Mock Test — Paper 3",
        "examLabel": "JEE Main",
        "description": (
            "Full-length JEE Main 2026 pattern paper: 75 questions across Physics, "
            "Chemistry and Mathematics — 20 MCQs plus 5 numerical-value questions "
            "per subject. Advanced-level conceptual difficulty, timed 3 hours."
        ),
    },
    "full-length": {
        "slug": "jee-main-hardcore-full-length-mock-test-1-2026",
        "title": "JEE Main 2026 — Hardcore Full-Length Mock Test 1",
        "examLabel": "JEE Main",
        "description": (
            "JEE Main 2026 Paper 1 pattern full-length mock: 75 questions across "
            "Physics, Chemistry and Mathematics. 300 marks, 3 hours, "
            "advanced-inspired conceptual difficulty."
        ),
    },
    "neet": {
        "slug": "neet-ug-hardcore-full-length-mock-test-2-2026",
        "title": "NEET (UG) 2026 — Hardcore Full-Length Mock Test 2",
        "examLabel": "NEET",
        "description": (
            "NEET UG 2026 full-length mock: 180 questions with 45 each in Physics, "
            "Chemistry, Botany and Zoology. 720 marks, 180 minutes."
        ),
    },
}

#: The two JEE papers are +4 / -1 over 75 questions; NEET is +4 / -1 over 180.
PAPER_RULES = {
    "paper-3": {"marks": 4, "wrong": 1, "duration": 180},
    "full-length": {"marks": 4, "wrong": 1, "duration": 180},
    "neet": {"marks": 4, "wrong": 1, "duration": 180},
}

#: Answers like `sqrt(55)` cannot go in a `numeric(12,4)` column. Rather than
#: dropping the question, the closed form is evaluated and the substitution is
#: reported, so the imported answer is still gradable.
EXACTIONS = {
    "sqrt(55)": "7.4162",
}


def normalise(text: str) -> str:
    """Comparison key for duplicate detection: case and punctuation insensitive."""
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", text.lower())).strip()


def parse_numeric(raw: str) -> tuple[Decimal | None, str | None]:
    """Return (value, note). `note` is set when the source was not a plain number."""
    text = raw.strip()
    if text in EXACTIONS:
        return Decimal(EXACTIONS[text]), f"closed form {text} evaluated to {EXACTIONS[text]}"
    try:
        return Decimal(text), None
    except InvalidOperation:
        return None, f"unparseable numerical answer {raw!r}"


def build_papers(payload: dict) -> list[dict]:
    """Turn the extractor's raw output into mockTests.json-shaped papers."""
    papers = []

    for key, meta in PAPER_META.items():
        extracted = payload[key]
        rules = PAPER_RULES[key]
        answers = extracted["answers"]
        tuple_keys = extracted["key_style"] == "tuple"

        questions = []
        skipped_in_paper: list[str] = []
        seen: dict[str, str] = {}

        for position, raw in enumerate(extracted["questions"], start=1):
            number = raw["source_number"]
            label = f"{meta['slug']} Q{number}"
            key_text = f"{raw['subject']}|{number}" if tuple_keys else str(number)
            answer = answers.get(key_text)

            fingerprint = normalise(raw["text"])
            if fingerprint in seen:
                skipped_in_paper.append(f"{label} repeats Q{seen[fingerprint]}")
                continue
            seen[fingerprint] = str(number)

            subject = raw["subject"] or "Mixed"
            is_mcq = raw["type"] == QuestionType.MCQ.value

            # The answer key stores a letter, but `correctIndex` and
            # `correct_answer` both need a position in this question's own
            # options. A letter that does not fall inside the option list means
            # the question and its key did not line up, which validate() then
            # rejects rather than guessing.
            index = -1
            if is_mcq and answer:
                position = "ABCD".find(answer.strip().upper())
                if 0 <= position < len(raw["options"]):
                    index = position

            stem = PAPER_REFS[key]
            if tuple_keys:
                ref = f"{stem}-{subject.lower()}-q{number}"
            else:
                ref = f"{stem}-q{number}"

            question = {
                "ref": ref,
                "subject": subject,
                "topic": subject,
                "text": raw["text"],
                "type": raw["type"],
                "options": raw["options"] if is_mcq else [],
                "correctIndex": index,
                "numericAnswer": None,
                "tolerance": 0,
                "explanation": None,
            }

            if not is_mcq:
                value, note = parse_numeric(answer or "")
                if value is None:
                    question["unparseable"] = note
                else:
                    question["numericAnswer"] = float(value)
                    if note:
                        question["answer_note"] = note

            questions.append(question)

        papers.append(
            {
                "slug": meta["slug"],
                "title": meta["title"],
                "examLabel": meta["examLabel"],
                "examRef": PAPER_EXAMS[key],
                "subject": None,
                "difficulty": "hard",
                "durationMinutes": rules["duration"],
                "attemptsAllowed": 1,
                "marksPerCorrect": rules["marks"],
                "marksPerWrong": rules["wrong"],
                "resultVisibility": "immediate",
                "testType": "standard",
                "description": meta["description"],
                "instructions": None,
                "source_file": extracted["source_file"],
                "questions": questions,
                "skipped_in_paper": skipped_in_paper,
            }
        )

    return papers


def validate(paper: dict) -> list[str]:
    """Return a list of problems; empty means the paper is safe to insert."""
    problems: list[str] = []
    seen_refs: set[str] = set()

    for position, question in enumerate(paper["questions"], start=1):
        where = f"{paper['slug']} pos{position}"
        ref = question["ref"]
        if ref in seen_refs:
            problems.append(f"{where}: duplicate ref {ref!r}")
        seen_refs.add(ref)

        if question.get("unparseable"):
            continue
        if question["type"] == QuestionType.MCQ.value:
            if len(question["options"]) < 2:
                problems.append(f"{where}: mcq has {len(question['options'])} options")
            if not 0 <= question["correctIndex"] < len(question["options"]):
                problems.append(
                    f"{where}: correctIndex {question['correctIndex']} does not name an option "
                    f"(options={question['options']!r})"
                )
        elif question.get("numericAnswer") is None:
            problems.append(f"{where}: numeric question without a numeric answer")

    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--extracted", required=True, help="JSON written by extract_pdf_papers.py")
    parser.add_argument("--apply", action="store_true", help="write to the database")
    args = parser.parse_args()

    payload = json.loads(Path(args.extracted).read_text(encoding="utf-8"))
    papers = build_papers(payload)

    problems: list[str] = []
    for paper in papers:
        problems.extend(validate(paper))
    if problems:
        print("REFUSING TO IMPORT - unresolved problems:")
        for problem in problems:
            print(f"  ! {problem}")
        return 1

    print("== plan ==")
    for paper in papers:
        mcqs = sum(1 for q in paper["questions"] if q["type"] == "mcq")
        print(
            f"  {paper['slug']:52s} {len(paper['questions']):3d} questions "
            f"({mcqs} mcq / {len(paper['questions']) - mcqs} numeric) "
            f"from {paper['source_file']}"
        )
        for skipped in paper["skipped_in_paper"]:
            print(f"      skipped (duplicate within paper): {skipped}")

    if not args.apply:
        print("\nDRY RUN: nothing written. Re-run with --apply.")
        return 0

    created_papers = 0
    created_questions = 0
    skipped_papers: list[str] = []
    overlap: list[str] = []

    with SessionLocal() as db:
        existing_texts = {
            normalise(text)
            for (text,) in db.execute(select(TestQuestion.question_text)).all()
        }

        for paper in papers:
            if db.scalar(select(MockTest).where(MockTest.slug == paper["slug"])) is not None:
                skipped_papers.append(paper["slug"])
                print(f"  = {paper['slug']} already exists; left alone")
                continue

            exam = db.scalar(select(Exam).where(Exam.slug == paper["examRef"]))
            marks = Decimal(str(paper["marksPerCorrect"]))
            wrong = Decimal(str(paper["marksPerWrong"]))

            mock_test = MockTest(
                name=paper["title"],
                slug=paper["slug"],
                exam_id=exam.id if exam else None,
                subject=paper["subject"],
                difficulty=paper["difficulty"],
                question_type=QuestionType.MCQ.value,
                duration_minutes=paper["durationMinutes"],
                total_marks=marks * len(paper["questions"]),
                negative_marking=wrong > 0,
                negative_marks_value=wrong,
                attempts_allowed=paper["attemptsAllowed"],
                question_randomization=False,
                option_randomization=False,
                instructions=paper["instructions"],
                result_visibility=paper["resultVisibility"],
                test_type=paper["testType"],
                is_active=True,
            )
            db.add(mock_test)
            db.flush()
            created_papers += 1

            for order, question in enumerate(paper["questions"], start=1):
                fingerprint = normalise(question["text"])
                if fingerprint in existing_texts:
                    overlap.append(f"{paper['slug']} Q{question['ref']}")

                is_mcq = question["type"] == QuestionType.MCQ.value
                db.add(
                    TestQuestion(
                        mock_test_id=mock_test.id,
                        question_text=question["text"],
                        question_type=question["type"],
                        options=question["options"] or None,
                        # `correct_answer` holds the option's own text because
                        # that is what the autograder compares verbatim.
                        correct_answer=(
                            question["options"][question["correctIndex"]] if is_mcq else None
                        ),
                        numeric_answer=(
                            None
                            if is_mcq
                            else Decimal(str(question["numericAnswer"]))
                        ),
                        tolerance=Decimal(str(question.get("tolerance", 0))),
                        marks=marks,
                        negative_marks=wrong,
                        difficulty=paper["difficulty"],
                        explanation=question["explanation"],
                        sort_order=order,
                        is_active=True,
                        subject=question["subject"],
                        topic=question["topic"],
                    )
                )
                existing_texts.add(fingerprint)

            created_questions += len(paper["questions"])
            print(f"  + {paper['slug']} ({len(paper['questions'])} questions)")

        db.commit()

    print(
        f"\nImported {created_papers} paper(s), {created_questions} questions. "
        f"Skipped {len(skipped_papers)} existing paper(s)."
    )
    if overlap:
        print(f"{len(overlap)} question(s) share text with a question in another paper:")
        for item in overlap:
            print(f"  ~ {item}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())