"""PDF -> draft questions, and the review gate in front of them.

The emphasis is not on the happy path. Generation is stubbed in almost every test
below, because the thing worth pinning is what happens to a draft *around* the
model: who can see it, when it becomes real, and what a stale or wrong approval
would cost.

The load-bearing assertions, in order of how badly they would hurt if they broke:

* **A draft is invisible to students until approved** -- not from the paper
  listing, not from `POST /{ref}/start`, not from the question list, and not
  gradeable. This is the whole reason the feature is gated, and it is enforced in
  `_PUBLISHABLE` in `routers/mock_tests.py` rather than in the import router, so
  a route that forgets to ask for drafts still cannot serve one.
* **Approving is a field change, not an insert.** If it were a copy, an edit in
  the review panel and the approved row would be two rows that could disagree.
* **Editing an approved draft un-publishes it.** Otherwise a published paper's
  answer key can change after the review that was supposed to guard it.
* **`error_message` never carries the credential.** httpx's text for an auth
  failure includes the request URL and headers, so a naive `str(exc)` writes the
  API key into a table the admin UI renders.
* **A draft cannot be reached through another job's URL.** `{job_id}` and
  `{question_id}` are independent path segments.
"""

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import SessionLocal
from app.main import app
from app.models import (
    MockTest,
    QuestionImportJob,
    Role,
    TestAnswer,
    TestAttempt,
    TestQuestion,
    User,
)
from app.services import question_generation as qg

client = TestClient(app)

PDF_HEADER = b"%PDF-1.7\n"
#: Long enough to clear `PDF_IMPORT_MIN_TEXT_CHARS`, which is the floor that turns
#: "this is a scan" into a message an admin can act on.
PDF_BODY = b"%PDF-1.7\n" + (b"A photon of energy E is incident on a surface. " * 60)


def _unique(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:8]}@example.com"


def _unique_mobile() -> str:
    return f"9{uuid.uuid4().int % 1_000_000_000:09d}"


def _register_user() -> dict:
    payload = {
        "name": "Test User",
        "email": _unique("import"),
        "mobile": _unique_mobile(),
        "password": "SecurePass123!",
        "age_band": "18_plus",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    return {**payload, **response.json()}


def _grant(email: str, role_name: str) -> None:
    with SessionLocal() as db:
        role = db.scalar(select(Role).where(Role.name == role_name))
        if role is None:
            role = Role(name=role_name, description=f"Seed role: {role_name}")
            db.add(role)
            db.flush()
        user = db.scalar(select(User).where(User.email == email))
        user.roles.append(role)
        db.commit()


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _draft(
    mock_test_id: int,
    *,
    job_id: int | None = None,
    question_text: str = "What is the value of E?",
    options: list | None = None,
    correct_answer: str = "E = 2 eV",
    review_status: str = "pending",
    sort_order: int = 1,
) -> TestQuestion:
    """Insert a draft the way `_generate` would, without running generation."""
    with SessionLocal() as db:
        question = TestQuestion(
            mock_test_id=mock_test_id,
            question_text=question_text,
            question_type="mcq",
            options=options if options is not None else ["E = 1 eV", "E = 2 eV", "E = 3 eV"],
            correct_answer=correct_answer,
            marks=2,
            negative_marks=0,
            difficulty="medium",
            sort_order=sort_order,
            review_status=review_status,
            source="pdf_ai",
            import_job_id=job_id,
        )
        db.add(question)
        db.commit()
        db.refresh(question)
        return question


def _job(mock_test_id: int, *, status: str = "ready") -> QuestionImportJob:
    with SessionLocal() as db:
        job = QuestionImportJob(
            mock_test_id=mock_test_id,
            created_by=None,
            filename="paper.pdf",
            file_size=len(PDF_BODY),
            status=status,
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job


def _store_pdf(job_id: int) -> None:
    """Put the job's uploaded PDF where `_generate` expects to re-read it.

    Not optional: the router stores the bytes rather than keeping them in the job
    row, precisely so a failed run can be retried. So a test that drives
    `_generate` directly has to lay the file down, or it exercises the
    "the upload vanished" branch instead of the one it means to.
    """
    from app.routers.question_imports import _source_pdf_path

    path = _source_pdf_path(job_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(PDF_BODY)


def _paper(*, questions: int = 0) -> MockTest:
    with SessionLocal() as db:
        mock_test = MockTest(
            name=f"Import Target {uuid.uuid4().hex[:6]}",
            slug=f"import-target-{uuid.uuid4().hex[:8]}",
            subject="Physics",
            difficulty="medium",
            question_type="mcq",
            duration_minutes=30,
            total_marks=0,
            negative_marking=False,
            negative_marks_value=1,
            attempts_allowed=3,
            result_visibility="immediate",
            test_type="standard",
            is_active=True,
        )
        for i in range(1, questions + 1):
            mock_test.questions.append(
                TestQuestion(
                    question_text=f"Existing question {i}",
                    question_type="mcq",
                    options=["3", "4", "5", "6"],
                    correct_answer="4",
                    marks=2,
                    negative_marks=0,
                    difficulty="medium",
                    sort_order=i,
                )
            )
        db.add(mock_test)
        db.commit()
        db.refresh(mock_test)
        return mock_test


def _cleanup(*mock_test_ids: int) -> None:
    with SessionLocal() as db:
        for mock_test_id in mock_test_ids:
            mock_test = db.get(MockTest, mock_test_id)
            if mock_test is not None:
                db.delete(mock_test)
                db.commit()


@pytest.fixture
def admin_headers() -> dict:
    user = _register_user()
    _grant(user["email"], "admin")
    return _headers(user["access_token"])


@pytest.fixture
def student_headers() -> dict:
    return _headers(_register_user()["access_token"])


@pytest.fixture
def configured(monkeypatch):
    """Make generation 'configured' and replace the provider with a stub.

    `generate_drafts` is stubbed at the service boundary rather than at httpx so
    these tests do not depend on the prompt, the response schema, or the network.
    `tests/test_question_generation.py` covers the provider call itself.
    """
    monkeypatch.setattr(qg, "generation_is_configured", lambda: True)
    monkeypatch.setattr(
        qg,
        "generate_drafts",
        lambda data, **kwargs: qg.GenerationResult(
            drafts=[
                qg.DraftQuestion(
                    question_text="What is the value of E?",
                    options=["E = 1 eV", "E = 2 eV", "E = 3 eV"],
                    correct_answer="E = 2 eV",
                    subject="Physics",
                    topic="Photoelectric effect",
                    difficulty="medium",
                    explanation="Work function is 2 eV.",
                    source_page=3,
                ),
                qg.DraftQuestion(
                    question_text="What is the threshold wavelength?",
                    options=["310 nm", "620 nm", "1240 nm"],
                    correct_answer="620 nm",
                    subject=None,
                    topic=None,
                    difficulty="easy",
                    explanation=None,
                    source_page=4,
                ),
            ],
            dropped=["draft 3: no options"],
            pages_read=12,
            text_length=len(PDF_BODY),
        ),
    )


# --- the gate ----------------------------------------------------------------


def test_a_draft_is_absent_from_the_paper_listing(admin_headers, student_headers):
    paper = _paper()
    try:
        job = _job(paper.id)
        _draft(paper.id, job_id=job.id)

        listing = client.get("/api/v1/mock-tests", headers=student_headers).json()
        entry = next(r for r in listing if r["id"] == paper.id)
        # Zero, not one: a pending draft must not even be counted in the total
        # the API advertises, or the client renders a question count the student
        # will never be served.
        assert entry["question_count"] == 0
        assert Decimal(entry["total_marks"]) == 0
    finally:
        _cleanup(paper.id)


def test_a_draft_cannot_be_read_through_the_student_question_route(
    admin_headers, student_headers
):
    paper = _paper()
    try:
        job = _job(paper.id)
        draft = _draft(paper.id, job_id=job.id)

        response = client.get(
            f"/api/v1/mock-tests/{paper.slug}/questions", headers=student_headers
        )
        assert response.status_code == 200
        assert draft.id not in [q["id"] for q in response.json()]
    finally:
        _cleanup(paper.id)


def test_a_draft_cannot_be_started_or_answered(admin_headers, student_headers):
    """The start refuses a paper whose every question is still a draft.

    Without the guard the student got a clean 200 and a blank paper, submitted
    it, and was graded against nothing -- which also burns one of
    `attempts_allowed`, so the failure was not even harmless.
    """
    paper = _paper()
    try:
        job = _job(paper.id)
        draft = _draft(paper.id, job_id=job.id)

        started = client.post(
            f"/api/v1/mock-tests/{paper.slug}/start", headers=student_headers
        )
        assert started.status_code == 400
        assert "question" in started.json()["detail"].lower()
        # Nothing written: the guard fires before the attempt row, so the
        # attempt limit is not silently consumed by a refused start.
        with SessionLocal() as db:
            assert db.scalar(select(TestAttempt).where(TestAttempt.mock_test_id == paper.id)) is None

        # And the draft is not answerable even through a hand-built attempt.
        attempt = _attempt(paper, student_headers)
        saved = client.put(
            f"/api/v1/mock-tests/{paper.slug}/attempts/{attempt}/answers/{draft.id}",
            json={"selected_answer": "E = 2 eV"},
            headers=student_headers,
        )
        assert saved.status_code == 404
        assert db_answer_count() == 0
    finally:
        _cleanup(paper.id)


def test_approving_a_draft_publishes_it_and_it_grades(admin_headers, student_headers):
    paper = _paper()
    try:
        job = _job(paper.id)
        draft = _draft(paper.id, job_id=job.id)

        response = client.post(
            f"/api/v1/question-imports/{job.id}/drafts/{draft.id}/review",
            json={"approved": True},
            headers=admin_headers,
        )
        assert response.status_code == 200
        assert response.json()["review_status"] == "approved"

        served = client.get(
            f"/api/v1/mock-tests/{paper.slug}/questions", headers=student_headers
        ).json()
        assert [q["id"] for q in served] == [draft.id]
        assert "correct_answer" not in served[0], "the key must not reach a student"

        attempt = _attempt(paper, student_headers)
        saved = client.put(
            f"/api/v1/mock-tests/{paper.slug}/attempts/{attempt}/answers/{draft.id}",
            json={"selected_answer": "E = 2 eV"},
            headers=student_headers,
        )
        assert saved.status_code in (200, 201), saved.text
        submitted = client.post(
            f"/api/v1/mock-tests/{paper.slug}/attempts/{attempt}/submit",
            headers=student_headers,
        )
        assert submitted.status_code == 200, submitted.text
        result = submitted.json()
        # The totals live on `attempt`, not on the result envelope: a result is an
        # attempt plus its questions, and the questions are the part whose shape
        # depends on `result_visibility`.
        assert Decimal(result["attempt"]["total_marks"]) == 2
        assert Decimal(result["attempt"]["score"]) == 2
        assert result["attempt"]["correct_count"] == 1
    finally:
        _cleanup(paper.id)


def test_a_rejected_draft_is_inactive_as_well_as_flagged(admin_headers, student_headers):
    """Two columns, not one.

    `review_status` says why; `is_active` is the exclusion. If a predicate ever
    forgets the review filter, the rejection still holds -- which is the point of
    writing both.
    """
    paper = _paper()
    try:
        job = _job(paper.id)
        draft = _draft(paper.id, job_id=job.id)

        response = client.post(
            f"/api/v1/question-imports/{job.id}/drafts/{draft.id}/review",
            json={"approved": False},
            headers=admin_headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["review_status"] == "rejected"
        assert body["is_active"] is False

        with SessionLocal() as db:
            stored = db.get(TestQuestion, draft.id)
            assert stored.is_active is False

        served = client.get(
            f"/api/v1/mock-tests/{paper.slug}/questions", headers=student_headers
        ).json()
        assert served == []
    finally:
        _cleanup(paper.id)


def test_editing_an_approved_draft_sends_it_back_to_pending(admin_headers):
    """Otherwise a published paper's answer key can change after review."""
    paper = _paper()
    try:
        job = _job(paper.id)
        draft = _draft(paper.id, job_id=job.id, review_status="approved")
        with SessionLocal() as db:
            stored = db.get(TestQuestion, draft.id)
            stored.is_active = True
            db.commit()

        response = client.put(
            f"/api/v1/question-imports/{job.id}/drafts/{draft.id}",
            json={"question_text": "Corrected wording of the question?"},
            headers=admin_headers,
        )
        assert response.status_code == 200
        assert response.json()["review_status"] == "pending"

        with SessionLocal() as db:
            assert db.get(TestQuestion, draft.id).is_active is True
    finally:
        _cleanup(paper.id)


def test_an_explicit_null_correct_answer_is_refused_not_ignored(admin_headers):
    """`{field: value}` style fallbacks turn a clear into a silent no-op.

    `data.get("correct_answer", question.correct_answer)` would keep the old key
    and answer 200, so the admin believes they cleared it and the autograder
    still grades against it.
    """
    paper = _paper()
    try:
        job = _job(paper.id)
        draft = _draft(paper.id, job_id=job.id)

        response = client.put(
            f"/api/v1/question-imports/{job.id}/drafts/{draft.id}",
            json={"correct_answer": None},
            headers=admin_headers,
        )
        assert response.status_code == 422
        assert "correct_answer" in response.json()["detail"]
    finally:
        _cleanup(paper.id)


def test_narrowing_options_cannot_strand_the_key(admin_headers):
    paper = _paper()
    try:
        job = _job(paper.id)
        draft = _draft(paper.id, job_id=job.id)

        response = client.put(
            f"/api/v1/question-imports/{job.id}/drafts/{draft.id}",
            json={"options": ["E = 9 eV", "E = 8 eV"]},
            headers=admin_headers,
        )
        assert response.status_code == 422
        assert "not one of the options" in response.json()["detail"]
    finally:
        _cleanup(paper.id)


def test_bulk_approval_skips_the_rows_it_cannot_publish(admin_headers):
    """Forty drafts with two broken ones should publish thirty-eight.

    Aborting the batch would make bulk approval useless on exactly the real
    papers where it is wanted.
    """
    paper = _paper()
    try:
        job = _job(paper.id)
        good_one = _draft(paper.id, job_id=job.id, sort_order=1)
        good_two = _draft(
            paper.id,
            job_id=job.id,
            question_text="A second question?",
            options=["a", "b", "c"],
            correct_answer="b",
            sort_order=2,
        )
        # Same options, key not among them: generation could not have produced
        # this, but an edit since then could have.
        broken = _draft(
            paper.id,
            job_id=job.id,
            question_text="A third question?",
            options=["a", "b", "c"],
            correct_answer="zzz",
            sort_order=3,
        )

        response = client.post(
            f"/api/v1/question-imports/{job.id}/review-all",
            json={"approved": True},
            headers=admin_headers,
        )
        assert response.status_code == 200
        assert response.json()["approved_count"] == 2

        with SessionLocal() as db:
            assert db.get(TestQuestion, good_one.id).review_status == "approved"
            assert db.get(TestQuestion, good_two.id).review_status == "approved"
            assert db.get(TestQuestion, broken.id).review_status == "pending"
    finally:
        _cleanup(paper.id)


def test_bulk_review_only_touches_pending_rows(admin_headers):
    """Re-applying a verdict would resurrect one-at-a-time rejections."""
    paper = _paper()
    try:
        job = _job(paper.id)
        approved = _draft(paper.id, job_id=job.id, review_status="approved", sort_order=1)
        rejected = _draft(
            paper.id,
            job_id=job.id,
            question_text="Rejected earlier?",
            options=["a", "b", "c"],
            correct_answer="a",
            review_status="rejected",
            sort_order=2,
        )
        pending = _draft(
            paper.id,
            job_id=job.id,
            question_text="Still to decide?",
            options=["a", "b", "c"],
            correct_answer="c",
            sort_order=3,
        )

        client.post(
            f"/api/v1/question-imports/{job.id}/review-all",
            json={"approved": True},
            headers=admin_headers,
        )

        with SessionLocal() as db:
            assert db.get(TestQuestion, approved.id).review_status == "approved"
            assert db.get(TestQuestion, rejected.id).review_status == "rejected"
            assert db.get(TestQuestion, pending.id).review_status == "approved"
    finally:
        _cleanup(paper.id)


def test_the_counts_on_the_job_track_its_drafts(admin_headers):
    paper = _paper()
    try:
        job = _job(paper.id)
        first = _draft(paper.id, job_id=job.id, sort_order=1)
        second = _draft(
            paper.id,
            job_id=job.id,
            question_text="Another question?",
            options=["a", "b", "c"],
            correct_answer="a",
            sort_order=2,
        )

        client.post(
            f"/api/v1/question-imports/{job.id}/drafts/{first.id}/review",
            json={"approved": True},
            headers=admin_headers,
        )
        body = client.get(
            f"/api/v1/question-imports/{job.id}", headers=admin_headers
        ).json()["job"]
        assert (body["draft_count"], body["approved_count"], body["rejected_count"]) == (
            2,
            1,
            0,
        )

        client.post(
            f"/api/v1/question-imports/{job.id}/drafts/{second.id}/review",
            json={"approved": False},
            headers=admin_headers,
        )
        body = client.get(
            f"/api/v1/question-imports/{job.id}", headers=admin_headers
        ).json()["job"]
        assert (body["draft_count"], body["approved_count"], body["rejected_count"]) == (
            2,
            1,
            1,
        )
    finally:
        _cleanup(paper.id)


# --- containment -------------------------------------------------------------


def test_a_draft_cannot_be_reached_through_another_jobs_url(admin_headers):
    """`{job_id}` and `{question_id}` are independent path segments."""
    paper = _paper()
    other = _paper()
    try:
        mine = _job(paper.id)
        theirs = _job(other.id)
        their_draft = _draft(other.id, job_id=theirs.id)

        response = client.post(
            f"/api/v1/question-imports/{mine.id}/drafts/{their_draft.id}/review",
            json={"approved": True},
            headers=admin_headers,
        )
        assert response.status_code == 404

        with SessionLocal() as db:
            assert db.get(TestQuestion, their_draft.id).review_status == "pending"
    finally:
        _cleanup(paper.id, other.id)


def test_the_review_routes_are_content_roles_only(student_headers):
    paper = _paper()
    try:
        job = _job(paper.id)
        draft = _draft(paper.id, job_id=job.id)

        assert (
            client.get("/api/v1/question-imports", headers=student_headers).status_code
            == 403
        )
        assert (
            client.get(
                f"/api/v1/question-imports/{job.id}", headers=student_headers
            ).status_code
            == 403
        )
        assert (
            client.post(
                f"/api/v1/question-imports/{job.id}/drafts/{draft.id}/review",
                json={"approved": True},
                headers=student_headers,
            ).status_code
            == 403
        )
        assert (
            client.put(
                f"/api/v1/question-imports/{job.id}/drafts/{draft.id}",
                json={"question_text": "x"},
                headers=student_headers,
            ).status_code
            == 403
        )
        assert (
            client.delete(
                f"/api/v1/question-imports/{job.id}", headers=student_headers
            ).status_code
            == 403
        )
    finally:
        _cleanup(paper.id)


def test_the_upload_route_is_content_roles_only(student_headers):
    response = client.post(
        "/api/v1/question-imports/pdf",
        files={"file": ("paper.pdf", PDF_BODY, "application/pdf")},
        data={"new_paper_name": "Sneaky Paper"},
        headers=student_headers,
    )
    assert response.status_code == 403


# --- the upload --------------------------------------------------------------


def test_an_upload_into_a_new_paper_creates_it_and_schedules_generation(
    admin_headers, configured, monkeypatch
):
    monkeypatch.setattr(
        "app.routers.question_imports._generate", lambda *args: None
    )
    response = client.post(
        "/api/v1/question-imports/pdf",
        files={"file": ("physics-paper.pdf", PDF_BODY, "application/pdf")},
        data={"new_paper_name": "Physics Grand Test 2026", "subject": "Physics"},
        headers=admin_headers,
    )
    assert response.status_code == 202, response.text
    body = response.json()
    assert body["created_paper"] is True
    assert body["job"]["status"] == "processing"
    assert body["drafts"] == []
    assert body["job"]["mock_test_name"] == "Physics Grand Test 2026"

    with SessionLocal() as db:
        paper = db.get(MockTest, body["job"]["mock_test_id"])
        assert paper is not None
        assert paper.subject == "Physics"
        assert paper.slug == "physics-grand-test-2026"
        # Answering before generation has run is the whole point of 202: the row
        # is durable, the drafts are not there yet.
        assert db.scalar(
            select(TestQuestion).where(TestQuestion.mock_test_id == paper.id)
        ) is None
        _cleanup(paper.id)


def test_generation_writes_pending_drafts_with_the_papers_marks(
    admin_headers, configured
):
    """`_generate` is called synchronously here; the router schedules it."""
    from app.routers.question_imports import _generate

    paper = _paper(questions=2)
    try:
        job = _job(paper.id, status="processing")
        _store_pdf(job.id)
        _generate(job.id, "Physics", None)

        with SessionLocal() as db:
            drafts = (
                db.scalars(
                    select(TestQuestion)
                    .where(TestQuestion.import_job_id == job.id)
                    .order_by(TestQuestion.sort_order)
                )
                .all()
            )
            assert len(drafts) == 2
            for draft in drafts:
                assert draft.review_status == "pending"
                assert draft.source == "pdf_ai"
                assert draft.question_type == "mcq"
                assert draft.correct_answer in draft.options
                # Inherited from the paper's existing questions, not from
                # `mock_tests.total_marks`, which is not authoritative.
                assert draft.marks == Decimal(2)

            refreshed = db.get(QuestionImportJob, job.id)
            assert refreshed.status == "ready"
            assert refreshed.draft_count == 2
            assert refreshed.page_count == 12
            assert refreshed.completed_at is not None

        # Still invisible: generation completed and the paper is unchanged.
        listing = client.get("/api/v1/mock-tests").json()
        entry = next(r for r in listing if r["id"] == paper.id)
        assert entry["question_count"] == 2
    finally:
        _cleanup(paper.id)


def test_a_generation_failure_is_recorded_with_a_readable_reason(
    admin_headers, monkeypatch
):
    """The job must never be left spinning, and the reason must be actionable."""

    def explode(data, **kwargs):
        raise qg.GenerationFailed(
            "That PDF has almost no extractable text (12 characters). It looks "
            "like a scan -- upload a version with a text layer."
        )

    monkeypatch.setattr(qg, "generation_is_configured", lambda: True)
    monkeypatch.setattr(qg, "generate_drafts", explode)

    from app.routers.question_imports import _generate

    paper = _paper()
    try:
        job = _job(paper.id, status="processing")
        _store_pdf(job.id)
        _generate(job.id, None, None)

        with SessionLocal() as db:
            refreshed = db.get(QuestionImportJob, job.id)
            assert refreshed.status == "failed"
            assert "scan" in refreshed.error_message
            assert refreshed.completed_at is not None
    finally:
        _cleanup(paper.id)


def test_an_unexpected_generation_error_does_not_leak_its_text(monkeypatch):
    """httpx's auth-failure text carries the request URL and headers.

    `str(exc)` into `error_message` would put the credential in a table the admin
    panel renders, and in any audit or support screenshot of it.
    """

    def explode(data, **kwargs):
        raise RuntimeError(
            "401 Unauthorized for url: https://generativelanguage.example/v1beta"
            "/models?key=SECRET-KEY-VALUE"
        )

    monkeypatch.setattr(qg, "generation_is_configured", lambda: True)
    monkeypatch.setattr(qg, "generate_drafts", explode)

    from app.routers.question_imports import _generate

    paper = _paper()
    try:
        job = _job(paper.id, status="processing")
        _store_pdf(job.id)
        _generate(job.id, None, None)

        with SessionLocal() as db:
            refreshed = db.get(QuestionImportJob, job.id)
            assert refreshed.status == "failed"
            assert "SECRET-KEY-VALUE" not in refreshed.error_message
            assert "RuntimeError" in refreshed.error_message
    finally:
        _cleanup(paper.id)


def test_a_missing_stored_pdf_says_to_upload_again(admin_headers, monkeypatch):
    monkeypatch.setattr(qg, "generation_is_configured", lambda: True)

    from app.routers.question_imports import _generate

    paper = _paper()
    try:
        job = _job(paper.id, status="processing")
        _generate(job.id, None, None)

        with SessionLocal() as db:
            refreshed = db.get(QuestionImportJob, job.id)
            assert refreshed.status == "failed"
            assert "Upload it again" in refreshed.error_message
    finally:
        _cleanup(paper.id)


# --- upload validation -------------------------------------------------------


def test_a_non_pdf_upload_is_refused(admin_headers, configured):
    response = client.post(
        "/api/v1/question-imports/pdf",
        files={"file": ("notes.txt", b"just some text", "text/plain")},
        data={"new_paper_name": "From a text file"},
        headers=admin_headers,
    )
    assert response.status_code == 422
    assert "%PDF-" in response.json()["detail"]


def test_neither_target_is_refused(admin_headers, configured):
    """Nowhere for the drafts to go is a 422, not a job that fails later."""
    response = client.post(
        "/api/v1/question-imports/pdf",
        files={"file": ("paper.pdf", PDF_BODY, "application/pdf")},
        data={"subject": "Physics"},
        headers=admin_headers,
    )
    assert response.status_code == 422
    assert "mock_test_id" in response.json()["detail"]


def test_both_targets_are_refused(admin_headers, configured):
    """'Which one did you mean' should not be answered by trial and error."""
    paper = _paper()
    try:
        response = client.post(
            "/api/v1/question-imports/pdf",
            files={"file": ("paper.pdf", PDF_BODY, "application/pdf")},
            data={
                "mock_test_id": str(paper.id),
                "new_paper_name": "Ambiguous",
            },
            headers=admin_headers,
        )
        assert response.status_code == 422
        assert "not both" in response.json()["detail"]
    finally:
        _cleanup(paper.id)


def test_an_oversized_upload_is_refused_before_it_is_stored(
    admin_headers, configured, monkeypatch
):
    """413, and the ceiling is checked while streaming rather than after.

    A single `file.read()` would allocate the whole upload before comparing, so
    the limit would turn "too large" into an OOM kill -- which reads as a server
    fault and invites a retry that does the same thing.
    """
    monkeypatch.setattr(
        "app.routers.question_imports.settings.PDF_IMPORT_MAX_BYTES", 1024
    )
    response = client.post(
        "/api/v1/question-imports/pdf",
        files={"file": ("paper.pdf", PDF_BODY, "application/pdf")},
        data={"new_paper_name": "Too Big"},
        headers=admin_headers,
    )
    assert response.status_code == 413
    assert "larger than" in response.json()["detail"]


def test_an_unconfigured_server_refuses_the_upload_before_reading_it(
    admin_headers, monkeypatch
):
    """There is no point accepting 20 MB to report that nothing can be done."""
    monkeypatch.setattr(qg, "generation_is_configured", lambda: False)
    response = client.post(
        "/api/v1/question-imports/pdf",
        files={"file": ("paper.pdf", PDF_BODY, "application/pdf")},
        data={"new_paper_name": "Never Runs"},
        headers=admin_headers,
    )
    assert response.status_code == 503
    assert "GEMINI_API_KEY" in response.json()["detail"]


def test_a_repeated_paper_name_gets_a_suffixed_slug(admin_headers, configured, monkeypatch):
    """An admin re-importing the same paper should not have to invent a title.

    `create_mock_test` refuses a duplicate name outright; refusing here would
    make the retry loop for a failed generation worse than useless.
    """
    monkeypatch.setattr("app.routers.question_imports._generate", lambda *args: None)
    created = []
    try:
        for _ in range(2):
            response = client.post(
                "/api/v1/question-imports/pdf",
                files={"file": ("paper.pdf", PDF_BODY, "application/pdf")},
                data={"new_paper_name": "Repeated Grand Test"},
                headers=admin_headers,
            )
            assert response.status_code == 202, response.text
            created.append(response.json()["job"]["mock_test_id"])

        with SessionLocal() as db:
            slugs = [
                db.get(MockTest, mock_test_id).slug for mock_test_id in created
            ]
        assert slugs == ["repeated-grand-test", "repeated-grand-test-2"]
    finally:
        _cleanup(*created)


def test_the_uploaded_filename_is_a_label_and_never_a_path(admin_headers, configured, monkeypatch):
    """A client-supplied name must not be able to steer where the bytes land."""
    from app.media_store import media_root
    from app.routers.question_imports import _PDF_SUBDIR, _source_pdf_path

    monkeypatch.setattr("app.routers.question_imports._generate", lambda *args: None)
    hostile = "../../../../etc/passwd.pdf"
    response = client.post(
        "/api/v1/question-imports/pdf",
        files={"file": (hostile, PDF_BODY, "application/pdf")},
        data={"new_paper_name": "Traversal Attempt"},
        headers=admin_headers,
    )
    assert response.status_code == 202, response.text
    job_id = response.json()["job"]["id"]
    mock_test_id = response.json()["job"]["mock_test_id"]
    try:
        with SessionLocal() as db:
            job = db.get(QuestionImportJob, job_id)
            # Stored truncated but intact, as a display label.
            assert job.filename.endswith("passwd.pdf")
            assert ".." in job.filename or job.filename == hostile[:255]

        expected = media_root() / _PDF_SUBDIR / f"{job_id}.pdf"
        assert expected.is_file()
        # The path is derived from the primary key alone: no client string in it.
        assert str(expected).endswith(f"{job_id}.pdf")
        assert _source_pdf_path(job_id).parent.name == _PDF_SUBDIR
    finally:
        _cleanup(mock_test_id)


def test_a_long_filename_is_truncated_to_the_column(admin_headers, configured, monkeypatch):
    """Otherwise a valid upload fails on insert, after the bytes were stored."""
    monkeypatch.setattr("app.routers.question_imports._generate", lambda *args: None)
    response = client.post(
        "/api/v1/question-imports/pdf",
        files={"file": ("a" * 400 + ".pdf", PDF_BODY, "application/pdf")},
        data={"new_paper_name": "Long Filename"},
        headers=admin_headers,
    )
    assert response.status_code == 202, response.text
    mock_test_id = response.json()["job"]["mock_test_id"]
    try:
        with SessionLocal() as db:
            job = db.get(QuestionImportJob, response.json()["job"]["id"])
            assert len(job.filename) == 255
    finally:
        _cleanup(mock_test_id)


# --- discard -----------------------------------------------------------------


def test_discarding_a_job_removes_its_drafts_and_its_pdf(admin_headers, configured):
    from app.routers.question_imports import _generate, _source_pdf_path

    paper = _paper()
    try:
        job = _job(paper.id, status="processing")
        _generate(job.id, None, None)
        with SessionLocal() as db:
            db.get(QuestionImportJob, job.id).status = "processing"
            db.commit()
        _source_pdf_path(job.id).parent.mkdir(parents=True, exist_ok=True)
        _source_pdf_path(job.id).write_bytes(PDF_BODY)

        assert client.delete(
            f"/api/v1/question-imports/{job.id}", headers=admin_headers
        ).status_code == 204

        with SessionLocal() as db:
            assert db.get(QuestionImportJob, job.id) is None
            assert (
                db.scalar(
                    select(TestQuestion).where(TestQuestion.import_job_id == job.id)
                )
                is None
            )
        assert not _source_pdf_path(job.id).exists()
    finally:
        _cleanup(paper.id)


def test_a_job_stuck_processing_can_still_be_discarded(admin_headers):
    """The worker-restart case: refusing non-terminal states would strand it."""
    paper = _paper()
    try:
        job = _job(paper.id, status="processing")
        _draft(paper.id, job_id=job.id)
        assert client.delete(
            f"/api/v1/question-imports/{job.id}", headers=admin_headers
        ).status_code == 204
    finally:
        _cleanup(paper.id)


def test_discarding_does_not_remove_questions_from_another_job(admin_headers):
    paper = _paper()
    try:
        keep = _job(paper.id)
        drop = _job(paper.id)
        kept = _draft(paper.id, job_id=keep.id)
        dropped = _draft(
            paper.id,
            job_id=drop.id,
            question_text="Belongs to the discarded job?",
            options=["a", "b", "c"],
            correct_answer="a",
            sort_order=2,
        )

        client.delete(f"/api/v1/question-imports/{drop.id}", headers=admin_headers)

        with SessionLocal() as db:
            assert db.get(TestQuestion, kept.id) is not None
            assert db.get(TestQuestion, dropped.id) is None
    finally:
        _cleanup(paper.id)


# --- the list ----------------------------------------------------------------


def test_the_job_list_is_not_scoped_to_the_uploader(admin_headers):
    """A batch started by one content admin must be findable by the next.

    'Only the uploader can finish this' leaves drafts stranded whenever that
    person leaves, and the drafts are invisible to students the whole time.
    """
    other = _register_user()
    _grant(other["email"], "admin")
    paper = _paper()
    try:
        job = _job(paper.id)
        response = client.get(
            "/api/v1/question-imports", headers=_headers(other["access_token"])
        )
        assert response.status_code == 200
        assert job.id in [row["id"] for row in response.json()]
    finally:
        _cleanup(paper.id)


def test_the_job_list_carries_the_paper_name(admin_headers):
    """The panel lists batches, and a batch without its paper is not actionable."""
    paper = _paper()
    try:
        job = _job(paper.id)
        row = next(
            r
            for r in client.get(
                "/api/v1/question-imports", headers=admin_headers
            ).json()
            if r["id"] == job.id
        )
        assert row["mock_test_name"] == paper.name
        assert row["filename"] == "paper.pdf"
    finally:
        _cleanup(paper.id)


def test_the_review_panel_gets_the_key_because_it_is_admin_only(admin_headers):
    """No student-facing shape carries `correct_answer`.

    The panel has to show the key to judge it -- that is the whole review. So the
    answer is role gating on this route, not a redacted field.
    """
    paper = _paper()
    try:
        job = _job(paper.id)
        draft = _draft(paper.id, job_id=job.id)
        drafts = client.get(
            f"/api/v1/question-imports/{job.id}", headers=admin_headers
        ).json()["drafts"]
        assert drafts[0]["correct_answer"] == "E = 2 eV"
        assert drafts[0]["question_id"] == draft.id
    finally:
        _cleanup(paper.id)


# --- helpers -----------------------------------------------------------------


def _attempt(paper: MockTest, student_headers: dict) -> int:
    """Start an attempt, bypassing the 'paper has no questions' guard.

    The guard is asserted separately; here the point is to reach the answer and
    grading paths with a draft in play, which means building the attempt row the
    way `start_mock_test` would once at least one question is approved.
    """
    student_token = student_headers["Authorization"].split()[1]
    with SessionLocal() as db:
        from app.utils.security import decode_token

        # The token subject is the user id as a *string* (`create_access_token`
        # stringifies it), so `int(...)` rather than passing it to `db.get`,
        # which would look the user up by the string "42" and find nobody.
        payload = decode_token(student_token)
        user = db.get(User, int(payload["sub"]))
        attempt = TestAttempt(
            mock_test_id=paper.id,
            user_id=user.id,
            status="in_progress",
            # `expires_at` is NOT NULL: `start_mock_test` always sets it, and the
            # deadline is what the auto-submit path reads.
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
        return attempt.id


def db_answer_count() -> int:
    with SessionLocal() as db:
        return len(db.scalars(select(TestAnswer)).all())