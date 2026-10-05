"""Upload a question paper, get drafts, review them, publish them.

    POST   /api/v1/question-imports/pdf                          upload a PDF
    GET    /api/v1/question-imports                              the job list
    GET    /api/v1/question-imports/{id}                         one job + drafts
    PUT    /api/v1/question-imports/{id}/drafts/{qid}            correct a draft
    POST   /api/v1/question-imports/{id}/drafts/{qid}/review     approve or reject
    POST   /api/v1/question-imports/{id}/review-all              every pending draft
    DELETE /api/v1/question-imports/{id}                         discard the batch

Every route is `CONTENT_ROLES`, matching the rest of the question-authoring
surface. An `mcq` answer key is the entire basis of a student's mark, so writing
one is not a lower privilege than editing a college blurb.

## The invariant this router exists to hold

**A student never sees an unapproved draft.**

Three places enforce it, and all three are needed because each covers a path the
others do not:

1. Every draft is written ``review_status = "pending"``. There is no request
   parameter that could ask for it to be created approved.
2. `_active_questions` in ``routers/mock_tests.py`` -- the single predicate the
   paper listing, ``POST /{ref}/start`` and the autograder all read -- filters on
   ``review_status == "approved"`` alongside ``is_active``. So a draft is absent
   from the paper *and* from any attempt, and cannot be graded even if something
   managed to attach an attempt to it.
3. ``GET /mock-tests/{ref}/questions`` cannot read a draft, so a draft's text and
   key cannot leak through the student-facing route.

## Why generation is a background task

A 200-page paper is seconds to extract and tens of seconds to generate across
several model calls. In-request that holds a worker open long enough for a proxy
to answer 504 while the work finished anyway -- so the admin retries, and each
retry costs another full run.

So the upload reads the file, stores it beside the job, creates the job row,
answers immediately, and schedules generation. The row is the durable record:
``processing`` while it runs, then ``ready`` or ``failed`` with a sentence an
admin can act on. An editor who returns an hour later sees the same drafts that
will be published, rather than a fresh regeneration.

The honest limitation: a background task lives in the worker process, so a
restart mid-run leaves a row stuck at ``processing``. This is not a resumable
queue. That is why ``DELETE`` accepts a job in any state, and why it also
deletes the stored PDF.

## Why the PDF is stored at all

The background task needs the bytes, and the job row does not carry them. They
are written under ``MEDIA_ROOT/pdf-imports/{job_id}.pdf`` -- derived from the
primary key, never from the uploaded filename, which is client-controlled and may
contain ``../``.

It is stored rather than kept in memory or re-uploaded for exactly one reason: a
failed run can be retried, and a job whose input is gone can only ever be
discarded. ``DELETE`` removes the file with the row.

Note this is deliberately *not* the media route. ``app/media_store.py`` accepts
four raster types and serves them same-origin from this app's origin; a PDF is
neither, and exposing one there would put a document body on a route whose whole
security argument is about sniffing content types. Nothing serves this file back.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
)
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal, get_db
from app.dependencies import require_role
from app.media_store import media_root
from app.models import MockTest, QuestionImportJob, TestQuestion, User
from app.question_types import QuestionType
from app.roles import CONTENT_ROLES
from app.schemas.catalog import MockTestCreate
from app.schemas.question_import import (
    BulkReviewRequest,
    DraftQuestionResponse,
    DraftQuestionUpdate,
    ImportJobResponse,
    ImportResponse,
    ReviewRequest,
)
from app.services import question_generation as qg
from app.utils import audit

router = APIRouter(prefix="/api/v1/question-imports", tags=["question-imports"])

#: 64 KiB, as in `routers/media.py`. A question paper is tens of megabytes, and a
#: single `file.read()` would allocate the whole thing before the ceiling was
#: checked -- which is the ordering that turns "too large" into an OOM kill.
_UPLOAD_CHUNK = 64 * 1024

_DEFAULT_LIMIT = 20
_MAX_LIMIT = 50

_FILENAME_MAX = 255

#: The `%PDF-` header. Checked before parsing because `pypdf` on arbitrary bytes
#: raises a variety of errors, and "this is not a PDF" is a better answer than
#: whatever exception the parser happened to pick.
_PDF_MAGIC = b"%PDF-"

#: A PDF that is plausible but empty is rejected later by
#: `PDF_IMPORT_MIN_TEXT_CHARS`, with a message about scans. This only catches the
#: case where the bytes are not a PDF at all.

_PDF_SUBDIR = "pdf-imports"


def _source_pdf_path(job_id: int) -> Path:
    """Where a job's uploaded PDF lives, derived from the primary key.

    Not from the filename. `media_store` documents the same rule and the same
    reason: the name is client-controlled, so it cannot be a path component.
    Here the only input is a database integer, so there is nothing to sanitise.
    """
    return media_root() / _PDF_SUBDIR / f"{job_id}.pdf"


def _write_source_pdf(job_id: int, data: bytes) -> None:
    path = _source_pdf_path(job_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def _discard_source_pdf(job_id: int) -> None:
    """Remove a job's stored PDF. Best-effort: a missing file is not an error.

    The row is the record of what happened; a leftover file after a failed
    cleanup is a disk-usage question, not a correctness one, and raising here
    would turn "discard succeeded" into "discard reported a failure" because of
    it.
    """
    try:
        _source_pdf_path(job_id).unlink(missing_ok=True)
    except OSError:
        pass


def _find_job(db: Session, job_id: int) -> QuestionImportJob:
    job = db.get(QuestionImportJob, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Import job not found")
    return job


def _find_mock_test_admin(db: Session, ref: str) -> MockTest:
    """Resolve an id-or-slug paper reference, inactive papers included.

    Same lookup and same rule as `_find_mock_test_admin` in
    `routers/mock_tests.py`: an admin may add questions to a retired paper
    because they are re-publishing it, while the student-facing lookup refuses
    inactive papers outright. Spelled out rather than imported so this router
    does not reach into another router's privates -- but if either changes, the
    other has to, or the two will disagree about what "the paper" is.
    """
    cond = MockTest.id == int(ref) if ref.isdigit() else MockTest.slug == ref
    found = db.scalar(select(MockTest).where(cond))
    if found is None:
        raise HTTPException(status_code=404, detail="Mock test not found")
    return found


def _drafts_for_job(db: Session, job_id: int) -> list[TestQuestion]:
    """Every question belonging to a job, in paper order.

    Includes rejected ones. The panel shows what was thrown away as well as what
    is live, and the counts on the job describe the whole batch rather than
    whatever happens to still be pending.
    """
    return list(
        db.scalars(
            select(TestQuestion)
            .where(TestQuestion.import_job_id == job_id)
            .order_by(TestQuestion.sort_order, TestQuestion.id)
        ).all()
    )


def _recount_job(db: Session, job: QuestionImportJob) -> None:
    """Refresh the denormalised review counts from the rows.

    Recomputed rather than incremented: a counter maintained by arithmetic
    drifts the first time one write is retried, and then it is wrong for good.
    This runs on every review write, where one indexed GROUP BY is cheaper than
    being right by hand.

    The `flush()` is required, not tidiness. `SessionLocal` is built with
    `autoflush=False` (`app/database.py`), so a `SELECT` does not push pending
    writes first -- and without the flush this aggregates the *previous*
    verdicts. The symptom is quiet and wrong in the direction that matters: an
    admin approves a draft, the row says `approved`, and the job still reports
    zero approved, which reads as "my click did not save".
    """
    db.flush()
    counts = dict(
        db.execute(
            select(TestQuestion.review_status, func.count(TestQuestion.id))
            .where(TestQuestion.import_job_id == job.id)
            .group_by(TestQuestion.review_status)
        ).all()
    )
    job.draft_count = sum(counts.values())
    job.approved_count = int(counts.get("approved", 0))
    job.rejected_count = int(counts.get("rejected", 0))


def _next_sort_order(db: Session, mock_test_id: int) -> int:
    """One past the highest order in the paper, so drafts land last.

    Not `_next_question_sort_order` in `routers/mock_tests.py` -- same rule, same
    reason for not importing it.
    """
    highest = db.scalar(
        select(func.max(TestQuestion.sort_order)).where(
            TestQuestion.mock_test_id == mock_test_id
        )
    )
    return (highest or 0) + 1


def _paper_marks(db: Session, mock_test_id: int) -> Decimal:
    """The per-question marks to give a new draft.

    Taken from the paper's existing questions rather than from
    `mock_tests.total_marks`, which `routers/mock_tests.py` documents at length
    as not authoritative -- the same module derives the real total from the rows
    for exactly this reason. A paper with no questions yet falls back to 1, the
    only value that cannot make a mark zero.
    """
    average = db.scalar(
        select(func.avg(TestQuestion.marks)).where(TestQuestion.mock_test_id == mock_test_id)
    )
    if average is None:
        return Decimal(1)
    return Decimal(average).quantize(Decimal("0.01"))


def _generate(job_id: int, subject: str | None, per_chunk: int | None) -> None:
    """Run generation for one job and write its drafts. Runs as a task.

    Opens its own session: the request's session is closed the moment the
    response is sent, so a task that reused it would fail on a closed session
    after its first write.

    Every exit path here ends with the job in a state an admin can read. The bare
    ``except`` is not defensive padding -- it is the difference between "the
    provider returned something unexpected" and a row stuck at ``processing``
    forever with a spinner and no explanation. Only the exception *type* is
    surfaced, never its text: httpx's messages for an auth failure carry the
    request URL and headers, and `GenerationFailed` says so in its docstring.
    """
    db = SessionLocal()
    try:
        job = db.get(QuestionImportJob, job_id)
        # Discarded between the response and the task starting. Writing drafts
        # for a deleted job would re-attach them to the paper it no longer names.
        if job is None or job.status != "processing":
            return

        path = _source_pdf_path(job_id)
        try:
            data = path.read_bytes()
        except OSError:
            # The stored upload vanished -- a wiped MEDIA_ROOT, or a cleanup that
            # ran too eagerly. Retryable by re-uploading, so say that.
            raise qg.GenerationFailed(
                "The uploaded PDF is no longer on the server. Upload it again."
            ) from None

        result = qg.generate_drafts(
            data,
            per_chunk=per_chunk,
            subject=subject,
            max_drafts=settings.PDF_IMPORT_MAX_DRAFTS,
        )

        order = _next_sort_order(db, job.mock_test_id)
        marks = _paper_marks(db, job.mock_test_id)
        for draft in result.drafts:
            db.add(
                TestQuestion(
                    mock_test_id=job.mock_test_id,
                    question_text=draft.question_text,
                    question_type=QuestionType.MCQ.value,
                    options=list(draft.options),
                    correct_answer=draft.correct_answer,
                    subject=draft.subject,
                    topic=draft.topic,
                    difficulty=draft.difficulty,
                    explanation=draft.explanation,
                    marks=marks,
                    negative_marks=Decimal(0),
                    sort_order=order,
                    # The invariant, at the only place a row is created. No
                    # parameter on any route can reach this with another value.
                    review_status="pending",
                    source="pdf_ai",
                    import_job_id=job.id,
                )
            )
            order += 1

        job.page_count = result.pages_read
        job.text_length = result.text_length
        job.status = "ready"
        job.error_message = None
        job.completed_at = datetime.now(timezone.utc)
        _recount_job(db, job)
        db.commit()
    except qg.GenerationFailed as exc:
        db.rollback()
        _mark_failed(db, job_id, exc.message)
    except qg.GenerationUnavailable as exc:
        db.rollback()
        _mark_failed(db, job_id, str(exc))
    except Exception as exc:  # noqa: BLE001 - see the docstring
        db.rollback()
        _mark_failed(
            db, job_id, f"Generation failed unexpectedly ({type(exc).__name__})."
        )
    finally:
        db.close()


def _mark_failed(db: Session, job_id: int, message: str) -> None:
    """Put a job in `failed` with a reason, if it is still there to fail.

    Re-reads rather than reusing the caller's `job`, because the caller's
    session was rolled back and its instance is detached from the transaction
    that would persist the change.
    """
    job = db.get(QuestionImportJob, job_id)
    if job is None:
        return
    job.status = "failed"
    job.error_message = message[:2000]
    job.completed_at = datetime.now(timezone.utc)
    db.commit()


def _create_paper(
    db: Session, payload: MockTestCreate, request: Request, user: User
) -> MockTest:
    """Create the paper an import will fill, slugging it like the CRUD route.

    The slug rule is duplicated from `_slugify` in `routers/mock_tests.py` rather
    than imported, and the reason is worth stating because it is the kind of
    duplication that looks like a shortcut: a paper created here must collide
    with an existing one through the same `mock_tests.slug` unique index as one
    created through `POST /mock-tests`. Two definitions of slugify that drift
    produce a paper whose slug the other route would never match -- a paper that
    exists but can never be addressed.

    Unlike the CRUD route this does *not* reject a duplicate name outright. It
    suffixes instead: an admin re-importing the same paper should not have to
    invent a new title, and refusing would make the retry loop for a failed
    generation worse than useless.
    """
    slug = re.sub(r"[^a-z0-9]+", "-", payload.name.strip().lower()).strip("-")
    if not slug:
        slug = "imported-paper"
    base = slug
    suffix = 2
    while db.scalar(select(MockTest).where(MockTest.slug == slug)):
        slug = f"{base}-{suffix}"
        suffix += 1

    mock_test = MockTest(
        **payload.model_dump(exclude={"name"}),
        name=payload.name,
        slug=slug,
    )
    db.add(mock_test)
    db.flush()
    audit.record(
        db,
        request=request,
        action="create_mock_test_from_import",
        entity_type="mock_test",
        entity_id=mock_test.id,
        actor=user,
        new_value=payload.model_dump(),
    )
    return mock_test


def _read_upload(file: UploadFile) -> bytes:
    """Read an upload to `PDF_IMPORT_MAX_BYTES`, or raise 413.

    Streams in chunks and stops as soon as the ceiling is passed, so an oversized
    upload is rejected after reading `MAX + 64 KiB` rather than after holding
    the whole thing in memory. The rejection is a 413 because that is the answer:
    "the file is too large" is a client fix, not a server fault.
    """
    data = bytearray()
    while True:
        chunk = file.file.read(_UPLOAD_CHUNK)
        if not chunk:
            break
        data.extend(chunk)
        if len(data) > settings.PDF_IMPORT_MAX_BYTES:
            raise HTTPException(
                status_code=413,
                detail=(
                    "That PDF is larger than "
                    f"{settings.PDF_IMPORT_MAX_BYTES // (1024 * 1024)} MB. "
                    "Split it, or upload fewer pages per file."
                ),
            )
    return bytes(data)


@router.post(
    "/pdf",
    response_model=ImportResponse,
    status_code=202,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def import_pdf_questions(
    request: Request,
    background: BackgroundTasks,
    file: UploadFile = File(...),
    mock_test_id: int | None = Form(default=None),
    new_paper_name: str | None = Form(default=None),
    exam_id: int | None = Form(default=None),
    course_id: int | None = Form(default=None),
    subject: str | None = Form(default=None),
    difficulty: str = Form(default="medium"),
    duration_minutes: int = Form(default=60),
    attempts_allowed: int = Form(default=1),
    per_chunk: int | None = Form(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*CONTENT_ROLES)),
):
    """Upload a question paper; drafts appear in the review panel shortly after.

    Exactly one target is required: `mock_test_id` to add to a paper that exists,
    or `new_paper_name` to create one. Accepting neither would leave the drafts
    with nowhere to go, and accepting both would make "which one did you mean" a
    question the admin has to answer through trial and error -- so both is a 422
    here rather than a precedence rule.

    `per_chunk` is the one knob exposed, because it is the only one an admin can
    predict: pages per file x questions per chunk is the whole length of the
    paper. Left unset it uses `PDF_IMPORT_DEFAULT_DRAFTS_PER_CHUNK`.

    202, not 201. The job row exists and is durable, but the drafts do not yet,
    and answering 201 would claim a resource the client cannot see.
    """
    if not qg.generation_is_configured():
        # Before the file is read: there is no point accepting 20 MB only to
        # report that the server cannot generate anything with it.
        raise HTTPException(
            status_code=503,
            detail=(
                "PDF question import is not configured on this server "
                "(GEMINI_API_KEY is unset)."
            ),
        )

    if (mock_test_id is None) == (new_paper_name is None):
        raise HTTPException(
            status_code=422,
            detail=(
                "Give either mock_test_id (an existing paper) or new_paper_name "
                "(create one), not both and not neither."
            ),
        )

    filename = (file.filename or "upload.pdf").strip() or "upload.pdf"
    # Display label only -- it is never a path component. Truncated because the
    # column is String(255) and a long filename would otherwise fail on insert,
    # after the upload had been read and stored.
    filename = filename[:_FILENAME_MAX]

    data = _read_upload(file)
    if not data.startswith(_PDF_MAGIC):
        raise HTTPException(
            status_code=422,
            detail="That file is not a PDF (it does not start with %PDF-).",
        )

    created_paper = False
    if mock_test_id is not None:
        mock_test = _find_mock_test_admin(db, str(mock_test_id))
    else:
        paper_name = (new_paper_name or "").strip()
        if len(paper_name) < 2:
            raise HTTPException(
                status_code=422,
                detail="new_paper_name needs at least 2 characters.",
            )
        mock_test = _create_paper(
            db,
            MockTestCreate(
                name=paper_name[:255],
                exam_id=exam_id,
                course_id=course_id,
                subject=subject[:100] if subject else None,
                difficulty=difficulty[:20],
                duration_minutes=max(1, duration_minutes),
                attempts_allowed=max(0, attempts_allowed),
            ),
            request,
            user,
        )
        created_paper = True

    if subject:
        # Also apply to an existing paper, so an import can label the questions
        # it adds without a second edit. Set on the paper only when the paper
        # has none: overwriting an admin's existing label on every upload would
        # be a surprising way to add questions.
        if not mock_test.subject:
            mock_test.subject = subject[:100]

    job = QuestionImportJob(
        mock_test_id=mock_test.id,
        created_by=user.id,
        filename=filename,
        file_size=len(data),
        status="processing",
    )
    db.add(job)
    db.flush()
    _write_source_pdf(job.id, data)
    audit.record(
        db,
        request=request,
        action="create_question_import",
        entity_type="question_import_job",
        entity_id=job.id,
        actor=user,
        new_value={
            "mock_test_id": mock_test.id,
            "filename": filename,
            "file_size": len(data),
        },
    )
    db.commit()
    db.refresh(job)
    db.refresh(mock_test)

    background.add_task(_generate, job.id, subject, per_chunk)

    return ImportResponse(
        job=ImportJobResponse.build(job),
        drafts=[],
        dropped_reasons=[],
        created_paper=created_paper,
    )


@router.get(
    "",
    response_model=list[ImportJobResponse],
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def list_import_jobs(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*CONTENT_ROLES)),
):
    """Every import job, newest first.

    Not scoped to `user`. An import is a property of the paper, not of whoever
    happened to upload it: the second content admin to pick up a half-reviewed
    batch needs to find it, and "only the uploader can finish this" would leave
    batches stranded whenever the person who started them leaves. The creator is
    on the row for the audit trail.
    """
    jobs = db.scalars(
        select(QuestionImportJob)
        .order_by(QuestionImportJob.created_at.desc(), QuestionImportJob.id.desc())
        .limit(_DEFAULT_LIMIT)
    ).all()
    return [ImportJobResponse.build(job) for job in jobs]


@router.get(
    "/{job_id}",
    response_model=ImportResponse,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def get_import_job(
    job_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*CONTENT_ROLES)),
):
    """One job with its drafts. The panel polls this while `status` is `processing`.

    Polling rather than a push channel or a websocket is deliberate: it is a
    bounded, tens-of-seconds wait on an admin screen that is already open, and
    the state is a row that outlives the tab. A refresh mid-generation re-reads
    the same job; it does not start a second run.
    """
    job = _find_job(db, job_id)
    drafts = _drafts_for_job(db, job_id)
    return ImportResponse(
        job=ImportJobResponse.build(job),
        drafts=[
            DraftQuestionResponse.build(q) for q in drafts
        ],
        created_paper=False,
    )


def _find_draft(db: Session, job_id: int, question_id: int) -> TestQuestion:
    """Resolve a question *within* its job.

    Scoping to the job matters for the same reason `_find_question` in
    `routers/mock_tests.py` scopes to its paper: `{job_id}` and `{question_id}`
    address independent things, and without the check a draft could be edited or
    approved through a URL belonging to a different batch.
    """
    job = _find_job(db, job_id)
    question = db.get(TestQuestion, question_id)
    if question is None or question.import_job_id != job.id:
        raise HTTPException(status_code=404, detail="Draft question not found")
    return question


@router.put(
    "/{job_id}/drafts/{question_id}",
    response_model=DraftQuestionResponse,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def update_import_draft(
    job_id: int,
    question_id: int,
    payload: DraftQuestionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*CONTENT_ROLES)),
):
    """Correct a draft before approving it.

    This is the normal path, not an edge case. The model drafts questions from a
    scanned exam paper: it gets the wording roughly right, the options in the
    wrong order, and the key attached to the wrong one often enough that editing
    is what the review step is for.

    Validated against the *merged* state, for the reason `_check_gradeable` in
    `routers/mock_tests.py` exists: correcting `options` alone must not be able
    to strand `correct_answer` outside them. Reusing that function is what makes
    the two paths agree -- an approved draft is a question any other route could
    have created, and it has to have survived the same check.

    Editing an already-approved draft sends it back to `pending`. Silently
    keeping it live would mean a published paper whose key changed after review,
    which is the one thing a review step exists to prevent.
    """
    _find_job(db, job_id)
    question = _find_draft(db, job_id, question_id)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return DraftQuestionResponse.build(question)

    merged = {
        "question_type": QuestionType.MCQ.value,
        "options": data.get("options", question.options),
        "correct_answer": data.get("correct_answer", question.correct_answer),
    }
    if data.get("correct_answer") is None and "correct_answer" in data:
        # An explicit null clears the key rather than being ignored, and
        # _check_gradeable then refuses it. Spelled out because
        # `data.get("correct_answer", question.correct_answer)` would silently
        # fall back to the old key and let a clear-through as a no-op.
        raise HTTPException(
            status_code=422, detail="An mcq question needs a correct_answer"
        )
    _check_gradeable_mcq(merged)

    was_approved = question.review_status == "approved"
    old_value = {field: getattr(question, field) for field in data}
    for field, value in data.items():
        setattr(question, field, value)
    if was_approved:
        question.review_status = "pending"

    audit.record(
        db,
        request=request,
        action="update_question_import_draft",
        entity_type="test_question",
        entity_id=question.id,
        actor=user,
        old_value=old_value,
        new_value=data,
    )
    job = _find_job(db, job_id)
    _recount_job(db, job)
    db.commit()
    db.refresh(question)
    return DraftQuestionResponse.build(question)


def _check_gradeable_mcq(merged: dict) -> None:
    """The `mcq` half of `_check_gradeable`, for a draft being edited.

    Drafts are always `mcq` -- generation only produces single-choice questions
    -- so this is the whole rule: the key must be one of the options. Imported
    rather than called from `routers/mock_tests._check_gradeable` because that
    function takes the shape `TestQuestionCreate.model_dump()` produces and
    returns 422s worded for the authoring routes; this one says the same things
    for a review panel. Kept as a three-line check on purpose -- if the two ever
    disagree about what is gradeable, an approved draft could be ungradeable,
    and the autograder would then mark every submission of it wrong with nothing
    reporting why.
    """
    options = merged.get("options") or []
    correct = merged.get("correct_answer")
    if not options:
        raise HTTPException(
            status_code=422, detail="An mcq question needs at least one option"
        )
    if correct is None:
        raise HTTPException(
            status_code=422, detail="An mcq question needs a correct_answer"
        )
    if correct not in options:
        raise HTTPException(
            status_code=422,
            detail=f"correct_answer {correct!r} is not one of the options",
        )


@router.post(
    "/{job_id}/drafts/{question_id}/review",
    response_model=DraftQuestionResponse,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def review_import_draft(
    job_id: int,
    question_id: int,
    payload: ReviewRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*CONTENT_ROLES)),
):
    """Approve one draft into the paper, or reject it.

    Approval is a field change, not an insert: the draft has been a
    `test_questions` row since generation, so there is nothing to copy and no
    second copy that could drift from what was reviewed. Rejecting leaves the row
    in place and inactive rather than deleting it -- the panel needs to show what
    was thrown away, and a hard delete would make the counts on the job
    unreproducible.

    Re-approving an approved question is allowed and is a no-op, because the
    panel's approve button stays pressed while the cursor is still on it and a
    second click should not be an error.
    """
    job = _find_job(db, job_id)
    question = _find_draft(db, job_id, question_id)

    # Rejecting anything ungradeable at review time is the last line of defence:
    # generation validated it, but an edit since then may have invalidated it,
    # and an approved question the grader cannot score marks every student wrong.
    if payload.approved:
        _check_gradeable_mcq(
            {
                "options": question.options,
                "correct_answer": question.correct_answer,
            }
        )

    previous = question.review_status
    was_active = question.is_active
    question.review_status = "approved" if payload.approved else "rejected"
    # A rejected question is deactivated as well as flagged, so that even a
    # predicate which forgot the review_status filter still cannot serve it. The
    # flag carries the reason; is_active carries the exclusion.
    question.is_active = payload.approved

    audit.record(
        db,
        request=request,
        action="review_question_import_draft",
        entity_type="test_question",
        entity_id=question.id,
        actor=user,
        old_value={"review_status": previous, "is_active": was_active},
        new_value={
            "review_status": question.review_status,
            "is_active": question.is_active,
        },
    )
    _recount_job(db, job)
    db.commit()
    db.refresh(question)
    return DraftQuestionResponse.build(question)


@router.post(
    "/{job_id}/review-all",
    response_model=ImportJobResponse,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def review_all_import_drafts(
    job_id: int,
    payload: BulkReviewRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*CONTENT_ROLES)),
):
    """Approve or reject every draft in a job that is still pending.

    Only `pending` rows are touched. Re-applying a verdict would resurrect
    questions an admin rejected one at a time after reading them -- which is the
    reason this is a bulk action on the untouched ones and not a status setter.

    Ungradeable pending rows are skipped rather than failing the request: a
    batch of forty drafts with two that lost their key should publish thirty-eight
    and leave the other two pending for the panel to show as still needing work.
    Aborting the whole batch over two would make bulk approval useless on exactly
    the real papers where it is wanted.
    """
    job = _find_job(db, job_id)
    pending = db.scalars(
        select(TestQuestion).where(
            TestQuestion.import_job_id == job_id,
            TestQuestion.review_status == "pending",
        )
    ).all()

    changed = 0
    for question in pending:
        if payload.approved:
            try:
                _check_gradeable_mcq(
                    {
                        "options": question.options,
                        "correct_answer": question.correct_answer,
                    }
                )
            except HTTPException:
                continue
        question.review_status = "approved" if payload.approved else "rejected"
        question.is_active = payload.approved
        changed += 1

    audit.record(
        db,
        request=request,
        action="review_all_question_import_drafts",
        entity_type="question_import_job",
        entity_id=job.id,
        actor=user,
        new_value={"approved": payload.approved, "changed": changed},
    )
    _recount_job(db, job)
    db.commit()
    db.refresh(job)
    return ImportJobResponse.build(job)


@router.delete(
    "/{job_id}",
    status_code=204,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def discard_import_job(
    job_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*CONTENT_ROLES)),
):
    """Discard a batch and its drafts, whatever state it is in.

    Any state, deliberately. This is the route an admin uses to clear a job stuck
    at `processing` by a worker restart, and a route that refused to discard
    anything not in a terminal state would leave that job -- and the file it
    uploaded -- with no way out.

    Drafts go with the job. Leaving approved questions behind would be a different
    operation with a different name: those are live questions in a paper now, and
    removing them is `DELETE /mock-tests/{ref}/questions/{qid}`.
    """
    job = _find_job(db, job_id)
    draft_ids = [q.id for q in _drafts_for_job(db, job_id)]
    if draft_ids:
        db.query(TestQuestion).filter(TestQuestion.id.in_(draft_ids)).delete(
            synchronize_session=False
        )
    db.delete(job)
    audit.record(
        db,
        request=request,
        action="discard_question_import",
        entity_type="question_import_job",
        entity_id=job_id,
        actor=user,
        old_value={"drafts_removed": len(draft_ids)},
    )
    db.commit()
    _discard_source_pdf(job_id)
