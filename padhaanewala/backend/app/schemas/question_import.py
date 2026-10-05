"""Schemas for the PDF -> draft questions review flow.

Three shapes, in the order an admin meets them:

* ``ImportResponse`` -- what ``POST /question-imports/pdf`` returns: the job, and
  the drafts if they already exist. The job is returned even when generation has
  not run yet, which is the point: the request answers immediately and the panel
  polls ``GET /question-imports/{id}``.
* ``ImportJobResponse`` -- the batch header plus counts, for the job list.
* ``DraftQuestionResponse`` -- one draft, with the review fields the panel needs
  to decide, and the answer key (this is admin-only; nothing here is ever sent to
  a student).
* ``ReviewRequest`` -- the verdict. One field, because "approved" and "rejected"
  are the only two answers and a request that could express a third would be a
  third state the backend has no column for.

Deliberately **not** here: the `correct_answer` is on `DraftQuestionResponse`
rather than on any student-facing shape, for the same reason
``ResultQuestionResponse`` gates it on ``result_visibility``. The key belongs to
the admin who is reviewing it and to the student who has finished.
"""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

#: Ceiling on `correct_answer`/option text, matching the service's validation so
#: a value the generator would have dropped is also a value the review editor
#: cannot save.
MAX_OPTION_LENGTH = 500

MAX_QUESTION_TEXT_LENGTH = 8000


class ImportJobResponse(BaseModel):
    """One upload and how far its review has got."""

    id: int
    mock_test_id: int
    mock_test_name: str | None = None
    #: Display label only. The upload filename is client-controlled and is never
    #: used to build a path.
    filename: str
    file_size: int
    page_count: int
    text_length: int
    #: `processing` | `ready` | `failed`. `processing` is a real state the panel
    #: renders as a spinner, not a missing value.
    status: str
    #: A sentence an admin can act on. Never contains the API key.
    error_message: str | None = None
    draft_count: int = 0
    approved_count: int = 0
    rejected_count: int = 0
    created_by: int | None = None
    created_at: datetime
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}

    @classmethod
    def build(cls, job: Any) -> "ImportJobResponse":
        return cls(
            id=job.id,
            mock_test_id=job.mock_test_id,
            mock_test_name=job.mock_test.name if job.mock_test else None,
            filename=job.filename,
            file_size=job.file_size,
            page_count=job.page_count,
            text_length=job.text_length,
            status=job.status,
            error_message=job.error_message,
            draft_count=job.draft_count,
            approved_count=job.approved_count,
            rejected_count=job.rejected_count,
            created_by=job.created_by,
            created_at=job.created_at,
            completed_at=job.completed_at,
        )


class DraftQuestionResponse(BaseModel):
    """One draft question, with its key, for the review panel.

    ``question_id`` is the ``test_questions`` id, so approving or rejecting is a
    write on a row that already exists rather than a second representation of the
    draft that has to be kept in step with it. That is deliberate: a draft stored
    only in the job and copied on approval would let an admin edit one and
    accidentally publish the other.
    """

    question_id: int
    import_job_id: int | None = None
    question_text: str
    options: list | None = None
    correct_answer: str | None = None
    subject: str | None = None
    topic: str | None = None
    difficulty: str
    explanation: str | None = None
    marks: Decimal
    negative_marks: Decimal
    #: `pending` | `approved` | `rejected`.
    review_status: str
    #: `manual` | `pdf_ai`. Always `pdf_ai` for a row in this response, but it is
    #: carried so the panel can render it without a second lookup.
    source: str
    sort_order: int
    is_active: bool = True

    model_config = {"from_attributes": True}

    @classmethod
    def build(cls, question: Any) -> "DraftQuestionResponse":
        """Read one `TestQuestion`.

        A classmethod rather than a bare `model_validate` because the field is
        named `question_id`, not `id` -- the panel addresses drafts by
        `job_id` + `question_id`, and naming the field after its own column
        would invite a client to send a paper id here.
        """
        return cls(
            question_id=question.id,
            import_job_id=question.import_job_id,
            question_text=question.question_text,
            options=question.options,
            correct_answer=question.correct_answer,
            subject=question.subject,
            topic=question.topic,
            difficulty=question.difficulty,
            explanation=question.explanation,
            marks=question.marks,
            negative_marks=question.negative_marks,
            review_status=question.review_status,
            source=question.source,
            sort_order=question.sort_order,
            is_active=question.is_active,
        )


class ImportResponse(BaseModel):
    """The upload result: the job, plus its drafts when they exist."""

    job: ImportJobResponse
    #: Empty while ``status == "processing"``. The panel polls until it is not.
    drafts: list[DraftQuestionResponse] = []
    #: Why drafts were dropped, aggregated by reason. Present so a run that
    #: produced 3 of 20 questions can say *why* rather than only how few.
    dropped_reasons: list[str] = []
    #: True when a new paper was created for this upload, so the panel can say so
    #: rather than implying the drafts were dropped into an existing paper.
    created_paper: bool = False


class DraftQuestionUpdate(BaseModel):
    """An admin correcting a draft before approving it.

    This is the whole point of the review step: the model is wrong often enough
    that editing before approval is the normal path, not an exception. It is a
    partial update, judged against the row's current state by
    ``_check_gradeable``, so correcting one field does not require resending the
    question.

    ``question_text`` keeps ``min_length=1`` because an empty question is never
    what an editor meant to save.
    """

    question_text: str | None = Field(
        default=None, min_length=1, max_length=MAX_QUESTION_TEXT_LENGTH
    )
    options: list[str] | None = None
    correct_answer: str | None = Field(default=None, max_length=255)
    subject: str | None = Field(default=None, max_length=100)
    topic: str | None = Field(default=None, max_length=255)
    difficulty: str | None = Field(default=None, max_length=20)
    explanation: str | None = None
    marks: Decimal | None = Field(
        default=None, ge=Decimal("0"), le=Decimal("9999.99")
    )
    negative_marks: Decimal | None = Field(
        default=None, ge=Decimal("0"), le=Decimal("9999.99")
    )


class ReviewRequest(BaseModel):
    """Approve or reject one draft.

    ``approved: bool`` rather than a status string, because there are exactly two
    answers and a free-form status would let a caller write a value the CHECK
    constraint rejects -- turning a clear 422 into a database error.
    """

    approved: bool = Field(..., description="true publishes, false rejects")


class BulkReviewRequest(BaseModel):
    """Approve or reject every draft in a job that is still pending."""

    approved: bool
    #: Only act on drafts older/newer than nothing by default; there is no
    #: filtering because a batch is small enough to review in one pass and a
    #: partial bulk action is how a paper ends up half-published by accident.
