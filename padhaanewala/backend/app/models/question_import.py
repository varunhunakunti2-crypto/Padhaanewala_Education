"""The record of one PDF -> draft-questions job.

Why this is a table and not a log line
--------------------------------------
An AI draft is a *proposal*, and the proposal has to survive the request that
produced it. Without a row, "the model returned 14 questions for chapter 3" is
only ever in the terminal of whoever ran it, and the admin panel has nothing to
show an editor when they come back to review -- so the drafts would be
regenerated on every page load, differently each time, and could not be reviewed
at all.

So the drafts themselves are real `test_questions` rows (`source = "pdf_ai"`,
`review_status = "pending"`) and this table is the batch header they belong to:
which paper they are aimed at, which upload produced them, and how far the
review got.

## Why `review_status` lives on `test_questions` and not here

It has to be on the question. The question is what the grading engine, the
paper listing and the student's paper all read, and the rule the whole feature
rests on is one sentence: *a student never sees a question until an admin
approved it*. A status stored only on the batch could not be enforced by the
query that lists a paper's questions, which is the one place it has to hold.

`is_active` already existed and already gates the student-facing read
(`_active_questions`). It is deliberately **not** reused for this. `is_active=False`
means "removed, keep the history", and drafts must not be confusable with
retired questions: a rejected draft is deleted outright, while a soft-deleted
question may have students' answers attached to it. Two different meanings, two
different columns.

`pending` is the default for AI-sourced rows and is set explicitly by the import
route. Hand-authored questions are `approved` from the moment they are created,
so the existing authoring paths and the seeded papers are unaffected.

`rejected` is kept as a status rather than deleting the row, for the same reason
`graded_by` is `ON DELETE SET NULL`: a draft someone looked at and threw away is
worth knowing about when the same PDF is uploaded again. The question row is
invisible to every student-facing query in either state, so keeping it costs
nothing but a row.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

#: Every state a question's review can be in.
#:
#: `approved` is also the default for the whole table, so the 75 seeded questions
#: and every hand-authored one are approved without a backfill and without the
#: migration needing to touch a single existing row.
REVIEW_STATUSES: tuple[str, ...] = ("approved", "pending", "rejected")

#: Spelled out individually because they are compared in two modules that must
#: not drift: `routers/question_imports.py` writes them, and
#: `routers/mock_tests.py` filters on `REVIEW_STATUS_APPROVED` to decide what a
#: student may see. A typo in one copy of the literal would not be a syntax error
#: -- it would publish drafts, or hide every approved question.
REVIEW_STATUS_APPROVED = "approved"
REVIEW_STATUS_PENDING = "pending"
REVIEW_STATUS_REJECTED = "rejected"

_REVIEW_STATUS_CHECK = "review_status IN ({})".format(
    ", ".join(f"'{value}'" for value in REVIEW_STATUSES)
)

#: Where a question came from. `manual` is every question not produced by this
#: feature, including the seeded bank.
QUESTION_SOURCES: tuple[str, ...] = ("manual", "pdf_ai")

_SOURCE_CHECK = "source IN ({})".format(
    ", ".join(f"'{value}'" for value in QUESTION_SOURCES)
)


class QuestionImportJob(Base):
    """One admin upload, and the drafts it produced.

    The lifecycle is `processing` -> `ready` or `failed`, and it exists because
    generating from a large PDF is slow enough that a request which did it
    synchronously would hold a worker open for minutes. The upload route creates
    the row, answers immediately, and the generation runs in a background task;
    the admin panel polls this table.

    `failed` is a first-class state rather than an exception. "Gemini rejected the
    key" and "this PDF has no extractable text" are both things an admin needs to
    be told, and a job that vanishes on error tells them nothing except that the
    button did not work.
    """

    __tablename__ = "question_import_jobs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('processing', 'ready', 'failed')", name="ck_qij_status"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    #: The paper the drafts belong to. NOT NULL with CASCADE: a paper created for
    #: this upload and then deleted should not leave orphaned drafts pointing at
    #: nothing, and `mock_tests` is soft-deleted rather than removed, so in
    #: practice this cascade almost never fires.
    mock_test_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("mock_tests.id", ondelete="CASCADE"), index=True
    )
    #: The admin who uploaded. SET NULL, not CASCADE, for the reason
    #: `test_answers.graded_by` is: deleting a staff account must not delete the
    #: record of content they authored.
    created_by: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    #: Display label only. Never used to build a path or an identifier -- the
    #: upload filename is client-controlled and may contain `../`.
    filename: Mapped[str] = mapped_column(String(255))
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    #: Pages and characters actually read. Recorded because "the model returned
    #: 3 questions" is only interpretable next to "from 40 pages".
    page_count: Mapped[int] = mapped_column(Integer, default=0)
    text_length: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="processing", index=True)
    #: Set when `status == "failed"`. A sentence an admin can act on, not a
    #: stack trace: `tests/test_question_import.py` asserts it never contains the
    #: API key.
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    #: Counts, denormalised so the job list does not need a per-row aggregate.
    #: `draft_count` counts every draft the model produced, including ones that
    #: were already rejected; `approved_count` and `rejected_count` count current
    #: review state.
    draft_count: Mapped[int] = mapped_column(Integer, default=0)
    approved_count: Mapped[int] = mapped_column(Integer, default=0)
    rejected_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.now, onupdate=datetime.now
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    mock_test: Mapped["MockTest"] = relationship()
    creator: Mapped["User | None"] = relationship()
