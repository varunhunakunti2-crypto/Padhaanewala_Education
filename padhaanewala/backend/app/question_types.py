"""Canonical question-type vocabulary.

This module is the single source of truth for ``question_type`` values. Rules:

* Values come from here or from the DB, never from an inline literal.
  ``question.question_type == "numeric"`` in the router is a bug; use
  ``QuestionType.NUMERIC``.
* Values are lowercase, matching the CHECK constraints on ``mock_tests`` and
  ``test_questions``.

Why this exists
---------------
``question_type`` used to be free text. Nothing stopped a question being saved
as ``"Numerical"`` or ``"MCQ"``, and the autograder decides purely by exact
string match (``app/routers/mock_tests.py``): a value it does not recognise
falls through both branches and returns ``None``, which the grader treats as
*ungradable* -- no verdict, no marks, no negative marking, counted as
unanswered. So a typo silently withheld a student's marks instead of raising an
error at authoring time.

Enforcement is deliberately split, because the two tables are populated in two
different ways:

* ``mock_tests`` is written by the API, so Pydantic validation on
  ``MockTestCreate``/``MockTestUpdate`` is enough to keep it clean.
* ``test_questions`` has no create endpoint and no seed script -- rows are
  inserted by hand or by an ad-hoc script. There is no Pydantic layer in that
  path at all, so the DB CHECK constraint is the *only* thing that can catch a
  typo. That is the one place here where a constraint earns its keep.

Adding a type: add it to :class:`QuestionType`, then extend both CHECK
constraints via a migration.
"""

from enum import StrEnum


class QuestionType(StrEnum):
    """Every question type the autograder recognises.

    ``ESSAY`` is the escape hatch that keeps manual review reachable: it is
    never auto-graded, so a descriptive question is scored ``None`` rather than
    being silently marked wrong. It is also the value the existing test suite
    and any hand-authored question already use.
    """

    MCQ = "mcq"
    NUMERIC = "numeric"
    #: Never auto-graded. Routed to manual review, which is the only way an
    #: essay or descriptive question can be marked at all.
    ESSAY = "essay"


#: Every recognised type, in grading order (most specific first).
ALL_QUESTION_TYPES: tuple[str, ...] = tuple(qt.value for qt in QuestionType)

#: Types the autograder can decide on its own. Anything outside this set is
#: routed to manual review by returning ``None``.
AUTO_GRADED_QUESTION_TYPES: frozenset[str] = frozenset(
    {QuestionType.MCQ.value, QuestionType.NUMERIC.value}
)


def is_known(value: str) -> bool:
    """True when ``value`` is a question type this codebase recognises."""
    return value in ALL_QUESTION_TYPES
