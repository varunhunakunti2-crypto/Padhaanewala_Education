"""Cross-paper question bank, for the admin editor.

Why this is a separate router
-----------------------------
Question *writes* already exist and are deliberately nested under their paper:
``POST``/``PUT``/``DELETE /mock-tests/{ref}/questions[/{id}]`` in
``routers/mock_tests.py``. Scoping a write to the paper is the guard that stops a
question being edited through some other paper's URL, so that shape stays.

What was missing is the read. An editor cannot manage a bank they cannot browse:
every question was reachable only by already knowing which paper it was in and
fetching that paper's admin detail. So this module adds the two list-shaped reads
and nothing else --

* ``GET /api/v1/questions``       -- the bank, filterable, across every paper
* ``GET /api/v1/questions/facets`` -- the filter values, computed not hardcoded

No migration accompanies this. ``test_questions.mock_test_id`` is ``NOT NULL``,
so a question still belongs to exactly one paper and reuse across papers is not
supported; the ``paper_name``/``paper_slug`` on each row exist so the editor can
see that, not to imply it away.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_role
from app.models import MockTest, TestQuestion
from app.question_types import ALL_QUESTION_TYPES
from app.roles import CONTENT_ROLES
from app.schemas.catalog import (
    AdminQuestionFacets,
    AdminQuestionListItem,
    AdminQuestionPaper,
)

router = APIRouter(prefix="/api/v1/questions", tags=["questions"])

#: Hard ceiling on `limit`. The other list routes cap at 100 and
#: `tests/test_list_endpoint_pagination_caps.py` holds them to it; a bank page
#: carries a full question stem per row, so it is the same cap for a stronger
#: reason. The admin UI pages rather than asking for everything.
MAX_LIMIT = 100

DEFAULT_LIMIT = 50

#: Difficulty is free text on both tables (`String(20)`, default "medium"), so it
#: is filtered by exact match rather than validated against a vocabulary. The
#: facets endpoint reports what is actually in use, which is how the UI builds
#: the dropdown without hardcoding a list that can drift.
_TEXT_MAX = 255


def _paper_ref(db: Session, ref: str) -> int:
    """Resolve an id-or-slug paper reference to an id, or 404.

    Accepts the same two forms as ``{mock_test_ref}`` on the nested write routes,
    so a value the editor already holds from the paper list works here unchanged.
    """
    if ref.isdigit():
        found = db.get(MockTest, int(ref))
    else:
        found = db.scalar(select(MockTest).where(MockTest.slug == ref))
    if found is None:
        raise HTTPException(status_code=404, detail="Mock test not found")
    return found.id


@router.get(
    "",
    response_model=list[AdminQuestionListItem],
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def list_bank_questions(
    paper: str | None = Query(
        None,
        max_length=_TEXT_MAX,
        description="Paper id or slug. Omit to search every paper.",
    ),
    subject: str | None = Query(None, max_length=100),
    topic: str | None = Query(None, max_length=_TEXT_MAX),
    difficulty: str | None = Query(None, max_length=20),
    question_type: str | None = Query(
        None, description="One of mcq | numeric | essay."
    ),
    is_active: bool | None = Query(
        None,
        description=(
            "Omit for both. `true` is what a paper currently serves; `false` is "
            "the soft-deleted inventory, which the editor still needs to see."
        ),
    ),
    q: str | None = Query(
        None, max_length=_TEXT_MAX, description="Substring of the question text."
    ),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> list[AdminQuestionListItem]:
    """Questions across every paper, for the admin bank view.

    `question_type` is validated against `ALL_QUESTION_TYPES` and answered with a
    422 rather than silently returning an empty list. A typo in a filter that
    looks like "no questions match" is the kind of wrong answer an editor acts
    on -- they would conclude the question is gone.
    """
    if question_type is not None and question_type not in ALL_QUESTION_TYPES:
        raise HTTPException(
            status_code=422,
            detail=(
                f"question_type must be one of {', '.join(ALL_QUESTION_TYPES)}"
            ),
        )

    query = select(TestQuestion, MockTest).join(
        MockTest, MockTest.id == TestQuestion.mock_test_id
    )

    if paper is not None:
        query = query.where(TestQuestion.mock_test_id == _paper_ref(db, paper))
    if subject:
        query = query.where(TestQuestion.subject == subject)
    if topic:
        query = query.where(TestQuestion.topic == topic)
    if difficulty:
        query = query.where(TestQuestion.difficulty == difficulty)
    if question_type:
        query = query.where(TestQuestion.question_type == question_type)
    if is_active is not None:
        query = query.where(TestQuestion.is_active.is_(is_active))
    if q:
        term = f"%{q.strip()}%"
        query = query.where(TestQuestion.question_text.ilike(term))

    rows = db.execute(
        query.order_by(MockTest.name, TestQuestion.sort_order, TestQuestion.id)
        .limit(limit)
        .offset(offset)
    ).all()

    return [
        AdminQuestionListItem(
            id=question.id,
            question_text=question.question_text,
            question_type=question.question_type,
            options=question.options,
            correct_answer=question.correct_answer,
            marks=question.marks,
            negative_marks=question.negative_marks,
            difficulty=question.difficulty,
            explanation=question.explanation,
            sort_order=question.sort_order,
            is_active=question.is_active,
            subject=question.subject,
            topic=question.topic,
            numeric_answer=question.numeric_answer,
            tolerance=question.tolerance,
            mock_test_id=paper_row.id,
            paper_name=paper_row.name,
            paper_slug=paper_row.slug,
        )
        for question, paper_row in rows
    ]


def _distinct(db: Session, column) -> list[str]:
    """Distinct non-null, non-blank values of `column`, alphabetically.

    The blank filter is not cosmetic: a large seeded bank picks up empty-string
    topics, and a dropdown offering "" reads as a broken control rather than as
    "some questions have no topic".
    """
    return [
        value
        for value in db.scalars(
            select(column)
            .where(column.is_not(None), column != "")
            .distinct()
            .order_by(column)
        ).all()
    ]


@router.get(
    "/facets",
    response_model=AdminQuestionFacets,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def question_facets(
    db: Session = Depends(get_db),
) -> AdminQuestionFacets:
    """What is actually in the bank, for the filter dropdowns.

    Computed from the rows rather than declared, because subjects and topics are
    authored content.

    **Papers are listed whether or not they hold questions.** This list is also
    the set of destinations a newly authored question can be saved to, and a
    paper with zero questions is the normal state of a paper that was just
    created. Restricting the list to papers that already hold a question -- the
    obvious inner join, and what this originally did -- therefore made the first
    question of a new paper impossible to author: the paper was not offered, so
    there was nowhere to save the question, so it stayed empty, so it was never
    offered. An empty paper is a legitimate filter target too, showing 0.

    Retired papers are omitted. `MockTest.is_active` is the publish flag, and a
    withdrawn paper is not somewhere new content should be authored.
    """
    question_counts = (
        select(
            TestQuestion.mock_test_id.label("mock_test_id"),
            func.count(TestQuestion.id).label("question_count"),
        )
        .group_by(TestQuestion.mock_test_id)
        .subquery()
    )
    papers = db.execute(
        select(MockTest, func.coalesce(question_counts.c.question_count, 0))
        .outerjoin(question_counts, question_counts.c.mock_test_id == MockTest.id)
        .where(MockTest.is_active.is_(True))
        .order_by(MockTest.name)
    ).all()

    return AdminQuestionFacets(
        subjects=_distinct(db, TestQuestion.subject),
        topics=_distinct(db, TestQuestion.topic),
        difficulties=_distinct(db, TestQuestion.difficulty),
        question_types=_distinct(db, TestQuestion.question_type),
        papers=[
            AdminQuestionPaper(
                mock_test_id=row.id,
                name=row.name,
                slug=row.slug,
                question_count=count,
            )
            for row, count in papers
        ],
    )
