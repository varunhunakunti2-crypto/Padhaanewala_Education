"""The seed script had no test at all, and it is load-bearing.

`scripts/seed_mock_tests.py` is the only way the canonical 75-question paper
reaches the database, and it is the first thing a new developer runs
(`bootstrap_test_db.py` wires it in). Nothing asserted what it produced, so the
guarantees in its own docstring were documentation rather than behaviour:

- it reads the file the frontend imports, rather than a copy that can drift;
- it validates *before* writing, so a bad paper cannot land half-loaded;
- it writes `sort_order` 1..N and leaves both randomisation flags off;
- running it twice changes nothing.

The pure helpers are tested directly because they do no I/O. `main()` is
exercised once, without `--refresh`: the destructive path deletes questions and
cascades into `test_answers`, so it is deliberately not run against the shared
paper.
"""

import importlib.util
import sys
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import func, select

BACKEND_ROOT = Path(__file__).resolve().parent.parent
SCRIPT_PATH = BACKEND_ROOT / "scripts" / "seed_mock_tests.py"

_spec = importlib.util.spec_from_file_location("_seed_mock_tests", SCRIPT_PATH)
seed = importlib.util.module_from_spec(_spec)
sys.modules["_seed_mock_tests"] = seed
_spec.loader.exec_module(seed)

from app.models import MockTest, TestQuestion  # noqa: E402
from app.question_types import QuestionType  # noqa: E402

CANONICAL_QUESTIONS = 75


@pytest.fixture(scope="module")
def papers():
    return seed.load_papers(seed.DEFAULT_SOURCE)


def _one_question(**overrides) -> dict:
    """A minimal question that passes `validate`, for the rejection tests."""
    question = {
        "ref": "q1",
        "text": "Which of these is the largest?",
        "type": QuestionType.MCQ.value,
        "options": ["1", "2", "3"],
        "correctIndex": 2,
    }
    question.update(overrides)
    return question


def _one_paper(**paper_overrides) -> dict:
    paper = {
        "slug": "test-paper",
        "title": "Test Paper",
        "questions": [_one_question()],
    }
    paper.update(paper_overrides)
    return paper


# --- the source file ---------------------------------------------------------


def test_source_of_truth_is_the_file_the_frontend_imports(papers):
    """If this path moves, the frontend and the database silently disagree."""
    assert seed.DEFAULT_SOURCE.name == "mockTests.json"
    assert seed.DEFAULT_SOURCE.parent.name == "data"
    assert seed.DEFAULT_SOURCE.exists()
    assert papers, "the canonical file contributed no papers to seed"


def test_canonical_paper_has_seventy_five_questions(papers):
    total = sum(len(paper["questions"]) for paper in papers)
    assert total == CANONICAL_QUESTIONS, (
        f"the frontend shows {total} questions; the seeded paper must match or "
        "the browser and the database serve different papers"
    )


def test_every_canonical_paper_passes_its_own_validation(papers):
    """The real content must clear the gate the script applies to it."""
    for paper in papers:
        seed.validate(paper)


# --- validation, which is what makes the seed all-or-nothing -----------------


def test_validate_rejects_an_unknown_question_type():
    with pytest.raises(SystemExit) as excinfo:
        seed.validate(_one_paper(questions=[_one_question(type="riddle")]))
    assert "question_type" in str(excinfo.value)


def test_validate_rejects_a_missing_ref():
    question = _one_question()
    del question["ref"]
    with pytest.raises(SystemExit) as excinfo:
        seed.validate(_one_paper(questions=[question]))
    assert "missing 'ref'" in str(excinfo.value)


def test_validate_rejects_a_duplicate_ref():
    with pytest.raises(SystemExit) as excinfo:
        seed.validate(
            _one_paper(questions=[_one_question(), _one_question(ref="q1")])
        )
    assert "duplicate ref" in str(excinfo.value)


def test_validate_rejects_an_mcq_with_no_options():
    question = _one_question()
    question["options"] = []
    with pytest.raises(SystemExit) as excinfo:
        seed.validate(_one_paper(questions=[question]))
    assert "no options" in str(excinfo.value)


def test_validate_rejects_a_correct_index_outside_the_options():
    question = _one_question(correctIndex=9)
    with pytest.raises(SystemExit) as excinfo:
        seed.validate(_one_paper(questions=[question]))
    assert "outside 0.." in str(excinfo.value)


def test_validate_rejects_a_missing_correct_index():
    question = _one_question()
    del question["correctIndex"]
    with pytest.raises(SystemExit) as excinfo:
        seed.validate(_one_paper(questions=[question]))
    assert "outside 0.." in str(excinfo.value)


def test_validate_accepts_many_options():
    """The key is an option value, so there is no letter ceiling any more."""
    question = _one_question(
        options=[f"opt-{n}" for n in range(40)],
        correctIndex=39,
    )
    seed.validate(_one_paper(questions=[question]))


def test_validate_rejects_a_numeric_question_with_no_numeric_answer():
    question = _one_question(
        type=QuestionType.NUMERIC.value, options=None, numericAnswer=None
    )
    with pytest.raises(SystemExit) as excinfo:
        seed.validate(_one_paper(questions=[question]))
    assert "numericAnswer" in str(excinfo.value)


def test_validation_names_the_offending_question():
    """A message that cannot locate the row is as bad as no validation."""
    with pytest.raises(SystemExit) as excinfo:
        seed.validate(
            _one_paper(
                slug="biology-2024",
                questions=[_one_question(), _one_question(type="riddle")],
            )
        )
    message = str(excinfo.value)
    assert "biology-2024 Q2" in message


# --- what gets written -------------------------------------------------------


def test_sort_order_is_contiguous_and_one_based(papers):
    """`sort_order` exists to serve the paper as printed; a gap breaks that."""
    for paper in papers:
        orders = [q.sort_order for q in seed.build_questions(paper)]
        assert orders == list(range(1, len(orders) + 1)), (
            f"{paper['slug']} sort_order is not 1..N: {orders[:5]}..."
        )


def test_a_question_is_never_graded_against_both_a_letter_and_a_number(papers):
    """Only one of these is ever set, per the seed's own comment."""
    for paper in papers:
        for position, question in enumerate(paper["questions"], start=1):
            built = seed.build_questions(paper)[position - 1]
            if question.get("type", QuestionType.MCQ.value) == QuestionType.MCQ.value:
                assert built.correct_answer is not None, f"{paper['slug']} Q{position}"
                assert built.numeric_answer is None, f"{paper['slug']} Q{position}"
            else:
                assert built.numeric_answer is not None, f"{paper['slug']} Q{position}"
                assert built.correct_answer is None, f"{paper['slug']} Q{position}"


def test_both_randomisation_flags_are_off(papers):
    """Shuffling would defeat the only reason `sort_order` exists."""
    fields = seed.build_paper_fields(papers[0], exam_id=None)
    assert fields["question_randomization"] is False
    assert fields["option_randomization"] is False


def test_total_marks_is_the_per_question_marks_times_the_count(papers):
    paper = papers[0]
    fields = seed.build_paper_fields(paper, exam_id=None)
    assert fields["total_marks"] == Decimal(
        str(paper.get("marksPerCorrect", 3))
    ) * len(paper["questions"])


def test_negative_marking_is_on_only_when_a_penalty_exists():
    penalised = seed.build_paper_fields(_one_paper(marksPerWrong=1), exam_id=None)
    assert penalised["negative_marking"] is True
    unpenalised = seed.build_paper_fields(_one_paper(marksPerWrong=0), exam_id=None)
    assert unpenalised["negative_marking"] is False


def test_a_three_subject_paper_leaves_the_paper_subject_null(papers):
    """NULL is the documented signal for "mixed"; each question carries its own."""
    for paper in papers:
        subjects = {q.get("subject") for q in paper["questions"]}
        if len(subjects) > 1:
            assert seed.build_paper_fields(paper, exam_id=None)["subject"] is None
            return
    pytest.skip("no multi-subject paper in the canonical file")


# --- the seeded data must clear the contracts the API now enforces -----------


def test_every_seeded_mcq_key_is_one_of_its_own_options(papers):
    """The same rule `POST /questions` enforces; a seed that broke it would
    produce a paper the authoring endpoint could never recreate.

    The seed used to write an option *letter* while storing the option *values*,
    so `correct_answer` was "B" against options like ['2 V', '3 V'] and the
    autograder's verbatim comparison could never match: 0 of 60 seeded MCQs
    were gradable.
    """
    offenders = []
    for paper in papers:
        for position, question in enumerate(paper["questions"], start=1):
            if question.get("type", QuestionType.MCQ.value) != QuestionType.MCQ.value:
                continue
            built = seed.build_questions(paper)[position - 1]
            if built.correct_answer not in (built.options or []):
                offenders.append(
                    f"{paper['slug']} Q{position}: key {built.correct_answer!r} "
                    f"not in options {built.options}"
                )
    assert not offenders, f"{len(offenders)} seeded mcqs are ungradable: {offenders[:3]}"


def test_every_seeded_tolerance_is_non_negative(papers):
    for paper in papers:
        for question in seed.build_questions(paper):
            assert question.tolerance is not None
            assert Decimal(question.tolerance) >= 0


def test_seeded_values_fit_the_columns_they_land_in(papers):
    """Guards against a 500 from an over-long key, not just a bad seed."""
    columns = TestQuestion.__table__.c
    key_width = columns.correct_answer.type.length
    marks = columns.marks.type
    whole_digits = marks.precision - marks.scale
    ceiling = Decimal(10) ** whole_digits
    for paper in papers:
        for position, question in enumerate(paper["questions"], start=1):
            built = seed.build_questions(paper)[position - 1]
            if built.correct_answer is not None:
                assert len(built.correct_answer) <= key_width
            for value in (built.marks, built.negative_marks):
                if value is not None:
                    assert abs(Decimal(value)) < ceiling, (
                        f"{paper['slug']} Q{position}: marks overflow "
                        f"Numeric({marks.precision},{marks.scale})"
                    )


# --- the database state it produced -----------------------------------------


def test_the_seeded_paper_exists_in_the_database():
    """Guards the test below: without this row `main()` would *create* a paper
    and leak it into every later run."""
    with seed.SessionLocal() as db:
        paper = db.scalar(
            select(MockTest).where(MockTest.slug == seed.load_papers(seed.DEFAULT_SOURCE)[0]["slug"])
        )
        assert paper is not None, "run scripts/bootstrap_test_db.py before the suite"


def test_running_the_seed_again_changes_nothing(capsys):
    """Idempotent by default is the whole reason a second run is safe."""
    from app.database import SessionLocal

    slug = seed.load_papers(seed.DEFAULT_SOURCE)[0]["slug"]
    with SessionLocal() as db:
        paper_id = db.scalar(select(MockTest.id).where(MockTest.slug == slug))
        before = db.scalar(
            select(func.count()).select_from(TestQuestion).where(TestQuestion.mock_test_id == paper_id)
        )

    sys.argv = ["seed_mock_tests.py"]
    seed.main()
    capsys.readouterr()

    with SessionLocal() as db:
        after = db.scalar(
            select(func.count()).select_from(TestQuestion).where(TestQuestion.mock_test_id == paper_id)
        )
        papers_after = db.scalar(
            select(func.count()).select_from(MockTest).where(MockTest.slug == slug)
        )

    assert after == before, f"a second run duplicated questions: {before} -> {after}"
    assert papers_after == 1, "a second run created a duplicate paper"


def test_seeded_rows_match_the_frontend_file(papers):
    """The reconciliation the frontend does by hand, asserted in the database."""
    from app.database import SessionLocal

    paper = papers[0]
    with SessionLocal() as db:
        row = db.scalar(select(MockTest).where(MockTest.slug == paper["slug"]))
        questions = (
            db.scalars(
                select(TestQuestion)
                .where(TestQuestion.mock_test_id == row.id)
                .order_by(TestQuestion.sort_order)
            )
            .unique()
            .all()
        )

    assert len(questions) == len(paper["questions"])
    for source, stored in zip(paper["questions"], questions):
        assert stored.question_text == source["text"]
        assert stored.question_type == source.get("type", QuestionType.MCQ.value)
        assert stored.sort_order == paper["questions"].index(source) + 1
        assert stored.is_active is True
