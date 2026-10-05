"""Per-question subject/topic and numeric-answer grading.

Covers the four columns added to `test_questions` in revision `a7e4c1b93d02`
(`subject`, `topic`, `numeric_answer`, `tolerance`).

Why they exist:
  * `MockTest.subject` is one nullable String per *paper*, so a three-subject paper
    (JEE Main / NEET) has nowhere to record which section a question belongs to.
  * `test_questions.correct_answer` was a String(255) compared with `==`, so a
    numeric key could not be graded at all: "20.0" and "20" are the same answer
    but different strings, and there was no way to express a rounding margin.
"""

import os
import uuid
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import select, text

from app.database import SessionLocal, engine
from app.main import app
from app.models import MockTest, Role, TestQuestion, User

client = TestClient(app)
TEST_SCHEMA = os.environ["PADHAANEWALA_SCHEMA"]


def _unique(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:8]}@example.com"


def _register_user() -> dict:
    payload = {
        "name": "Test Student",
        "email": _unique("student"),
        "mobile": f"9{uuid.uuid4().int % 1_000_000_000:09d}",
        "password": "SecurePass123!",
        "age_band": "18_plus",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    return {**payload, **response.json()}


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _make_admin(email: str) -> None:
    with SessionLocal() as db:
        role = db.scalar(select(Role).where(Role.name == "admin"))
        if role is None:
            role = Role(name="admin", description="Seed role: admin")
            db.add(role)
            db.flush()
        user = db.scalar(select(User).where(User.email == email))
        user.roles.append(role)
        db.commit()


def _create_paper(questions: list[TestQuestion], **overrides) -> MockTest:
    """Persist a paper whose questions are exactly `questions`."""
    fields = {
        "name": f"Subject Test {uuid.uuid4().hex[:6]}",
        "slug": f"subject-test-{uuid.uuid4().hex[:8]}",
        "subject": None,
        "difficulty": "medium",
        "question_type": "mcq",
        "duration_minutes": 30,
        "total_marks": 0,
        "negative_marking": False,
        "negative_marks_value": 0,
        "attempts_allowed": 3,
        "result_visibility": "immediate",
        "test_type": "standard",
        "is_active": True,
    }
    fields.update(overrides)
    mock_test = MockTest(**fields)
    mock_test.questions = questions
    with SessionLocal() as db:
        db.add(mock_test)
        db.commit()
        db.refresh(mock_test)
        return mock_test


def _cleanup(mock_test_id: int) -> None:
    with SessionLocal() as db:
        mock_test = db.get(MockTest, mock_test_id)
        if mock_test:
            db.delete(mock_test)
            db.commit()


def _mcq(text: str, order: int, **kwargs) -> TestQuestion:
    return TestQuestion(
        question_text=text,
        question_type="mcq",
        options=["A", "B"],
        correct_answer="A",
        marks=2,
        negative_marks=1,
        sort_order=order,
        **kwargs,
    )


def _numeric(text: str, order: int, numeric_answer, **kwargs) -> TestQuestion:
    return TestQuestion(
        question_text=text,
        question_type="numeric",
        options=None,
        correct_answer=None,
        numeric_answer=numeric_answer,
        marks=4,
        negative_marks=2,
        sort_order=order,
        **kwargs,
    )


def _question_ids(paper: MockTest) -> dict[str, int]:
    with SessionLocal() as db:
        return {
            q.question_text: q.id
            for q in db.query(TestQuestion)
            .filter(TestQuestion.mock_test_id == paper.id)
            .all()
        }


def _submit(paper: MockTest, answers: list[dict]) -> dict:
    user = _register_user()
    response = client.post(
        f"/api/v1/mock-tests/{paper.slug}/submit",
        json={"answers": answers},
        headers=_auth_headers(user["access_token"]),
    )
    assert response.status_code == 200, response.text
    return response.json()


def _submit_one(paper: MockTest, text: str, given: str) -> dict:
    """Submit a single answer to the question whose text is `text`."""
    return _submit(
        paper, [{"question_id": _question_ids(paper)[text], "selected_answer": given}]
    )


# --------------------------------------------------------------------------
# The migration itself
# --------------------------------------------------------------------------


def test_columns_exist_in_the_database():
    """Guards a forgotten `alembic upgrade`.

    The model would import and every unit test of `_is_numeric_correct` would
    still pass, because they read attributes off the ORM object rather than the
    table. Only this assertion notices that the four columns were never created.

    The exact count is the point: it is what turns "someone added a column to the
    model" into "someone added a column to the model *and* a migration for it".
    Asserting only the columns named above would keep passing through a forgotten
    migration for any column added later.
    """
    with engine.connect() as conn:
        rows = conn.execute(
            text(
                "SELECT column_name, data_type, is_nullable FROM "
                "information_schema.columns "
                "WHERE table_schema = :schema AND table_name = 'test_questions'"
            ),
            {"schema": TEST_SCHEMA},
        ).all()
    columns = {name: (dtype, nullable) for name, dtype, nullable in rows}

    assert columns["subject"] == ("character varying", "YES")
    assert columns["topic"] == ("character varying", "YES")
    assert columns["numeric_answer"] == ("numeric", "YES")
    # NOT NULL: every question has a tolerance, and 0 means "exact".
    assert columns["tolerance"] == ("numeric", "NO")

    # The PDF-import columns (d7e1b4c9a205). `review_status` is NOT NULL because
    # a question with no review status is unpublishable by the `_PUBLISHABLE`
    # predicate -- the default "approved" is what keeps every pre-existing
    # question visible.
    assert columns["review_status"] == ("character varying", "NO")
    assert columns["source"] == ("character varying", "NO")
    # Nullable: only rows from a PDF import carry one, and it goes when the job
    # is discarded.
    assert columns["import_job_id"] == ("integer", "YES")

    assert len(columns) == 21, "expected 18 plus these 3"


def test_subject_and_topic_are_indexed():
    with engine.connect() as conn:
        indexed = {
            name
            for (name,) in conn.execute(
                text(
                    "SELECT indexname FROM pg_indexes "
                    "WHERE schemaname = :schema AND tablename = 'test_questions'"
                ),
                {"schema": TEST_SCHEMA},
            )
        }
    assert "ix_test_questions_subject" in indexed
    assert "ix_test_questions_topic" in indexed


def test_backfill_fills_null_subject_only_and_is_idempotent():
    """Mirrors the `op.execute` in revision `a7e4c1b93d02`.

    A question that predates the column inherits its paper's subject; one that
    was already curated for a mixed-section paper keeps it. Running the statement
    twice must not change anything, since the migration can be re-applied to a
    database that was seeded first.
    """
    backfill = text(
        """
        UPDATE test_questions AS q
           SET subject = m.subject
          FROM mock_tests AS m
         WHERE m.id = q.mock_test_id
           AND q.subject IS NULL
        """
    )
    paper = _create_paper(
        [
            _mcq("Inherits from the paper", 1),
            _mcq("Already set per question", 2, subject="Chemistry"),
        ],
        subject="Physics",
    )
    try:
        with engine.begin() as conn:
            conn.execute(backfill)
            conn.execute(backfill)

        with SessionLocal() as db:
            stored = {
                q.question_text: (q.subject, q.topic)
                for q in db.query(TestQuestion)
                .filter(TestQuestion.mock_test_id == paper.id)
                .all()
            }
        assert stored["Inherits from the paper"] == ("Physics", None)
        # The curated value survives: only NULLs are eligible.
        assert stored["Already set per question"] == ("Chemistry", None)
    finally:
        _cleanup(paper.id)


# --------------------------------------------------------------------------
# subject / topic on the read paths
# --------------------------------------------------------------------------


def test_subject_and_topic_are_exposed_to_test_takers():
    """A real paper labels its sections, so these are not answer-key material."""
    paper = _create_paper(
        [
            _mcq("Physics question", 1, subject="Physics", topic="Rotational Motion"),
            _mcq("Chemistry question", 2, subject="Chemistry", topic="Mole Concept"),
        ],
        subject=None,
    )
    try:
        bank = client.get(f"/api/v1/mock-tests/{paper.slug}/questions")
        assert bank.status_code == 200
        by_text = {q["question_text"]: q for q in bank.json()}
        assert by_text["Physics question"]["subject"] == "Physics"
        assert by_text["Physics question"]["topic"] == "Rotational Motion"
        assert by_text["Chemistry question"]["subject"] == "Chemistry"
        assert by_text["Chemistry question"]["topic"] == "Mole Concept"

        user = _register_user()
        headers = _auth_headers(user["access_token"])
        start = client.post(
            f"/api/v1/mock-tests/{paper.slug}/start", headers=headers
        )
        assert start.status_code == 200, start.text
        attempt_id = start.json()["attempt"]["id"]
        served = {q["question_text"]: q for q in start.json()["questions"]}
        assert served["Physics question"]["subject"] == "Physics"

        detail = client.get(
            f"/api/v1/mock-tests/{paper.slug}/attempts/{attempt_id}", headers=headers
        )
        assert detail.status_code == 200
        assert {q["subject"] for q in detail.json()["questions"]} == {
            "Physics",
            "Chemistry",
        }

        saved = client.put(
            f"/api/v1/mock-tests/{paper.slug}/attempts/{attempt_id}"
            f"/answers/{served['Physics question']['id']}",
            json={"selected_answer": "A"},
            headers=headers,
        )
        assert saved.status_code == 200
        assert saved.json()["subject"] == "Physics"
    finally:
        _cleanup(paper.id)


def test_null_question_subject_is_not_filled_from_the_paper_at_read_time():
    """A missing per-question subject must stay distinguishable from a set one.

    If the read path substituted `MockTest.subject`, the client could no longer
    tell "this paper is single-subject" from "this question was explicitly filed
    under Physics", and could not know which questions still need a subject.
    """
    paper = _create_paper(
        [_mcq("No subject of its own", 1)],
        subject="Mathematics",
    )
    try:
        admin = _register_user()
        _make_admin(admin["email"])
        detail = client.get(
            f"/api/v1/mock-tests/admin/all/{paper.slug}",
            headers=_auth_headers(admin["access_token"]),
        )
        assert detail.status_code == 200, detail.text
        assert detail.json()["questions"][0]["subject"] is None
        assert detail.json()["subject"] == "Mathematics"
    finally:
        _cleanup(paper.id)


# --------------------------------------------------------------------------
# numeric grading
# --------------------------------------------------------------------------


def test_numeric_exact_match_accepts_20_against_a_key_of_20_0():
    """The headline case: string equality would call this wrong."""
    paper = _create_paper(
        [_numeric("What is ten times two?", 1, Decimal("20.0000"))]
    )
    try:
        result = _submit_one(paper, "What is ten times two?", "20")
        question = result["questions"][0]
        assert question["is_correct"] is True
        assert float(question["marks_awarded"]) == 4
        assert result["attempt"]["correct_count"] == 1
    finally:
        _cleanup(paper.id)


def test_numeric_trailing_zeros_and_whitespace_are_equivalent():
    paper = _create_paper(
        [_numeric("Give pi to four places.", 1, Decimal("3.1416"))],
        attempts_allowed=10,
    )
    try:
        for given in ["  3.1416  ", "3.14160", "3.1416000"]:
            result = _submit_one(paper, "Give pi to four places.", given)
            assert result["questions"][0]["is_correct"] is True, given
    finally:
        _cleanup(paper.id)


def test_numeric_wrong_answer_is_counted_incorrect():
    paper = _create_paper([_numeric("What is ten times two?", 1, Decimal("20"))])
    try:
        result = _submit_one(paper, "What is ten times two?", "21")
        assert result["questions"][0]["is_correct"] is False
        assert result["attempt"]["correct_count"] == 0
        assert result["attempt"]["incorrect_count"] == 1
    finally:
        _cleanup(paper.id)


def test_tolerance_is_an_absolute_margin():
    paper = _create_paper(
        [
            _numeric(
                "Root two, to two places.",
                1,
                Decimal("1.4142"),
                tolerance=Decimal("0.005"),
            )
        ],
        attempts_allowed=10,
    )
    try:
        for given in ["1.4142", "1.41", "1.415"]:
            result = _submit_one(paper, "Root two, to two places.", given)
            assert result["questions"][0]["is_correct"] is True, given
        for given in ["1.42", "1.40", "2"]:
            result = _submit_one(paper, "Root two, to two places.", given)
            assert result["questions"][0]["is_correct"] is False, given
    finally:
        _cleanup(paper.id)


def test_tolerance_of_zero_is_exact():
    """The default must not quietly widen the key.

    1.41 is 0.0042 away from 1.4142, so it is wrong at tolerance 0 and correct at
    tolerance 0.005. That difference is the whole point of the column.
    """
    paper = _create_paper(
        [_numeric("Root two, to two places.", 1, Decimal("1.4142"))],
        attempts_allowed=10,
    )
    try:
        for given in ["1.4142", "1.41420", " 1.4142 "]:
            result = _submit_one(paper, "Root two, to two places.", given)
            assert result["questions"][0]["is_correct"] is True, given
        for given in ["1.41", "1.415", "1.4"]:
            result = _submit_one(paper, "Root two, to two places.", given)
            assert result["questions"][0]["is_correct"] is False, given
    finally:
        _cleanup(paper.id)


def test_numeric_accepts_thousands_separators():
    paper = _create_paper([_numeric("A population figure.", 1, Decimal("1500000"))])
    try:
        result = _submit_one(paper, "A population figure.", "1,500,000")
        assert result["questions"][0]["is_correct"] is True
    finally:
        _cleanup(paper.id)


def test_numeric_blank_is_unanswered_not_wrong():
    """A blank box is an omission. Negative-marking it would punish a timeout."""
    paper = _create_paper(
        [_numeric("Numerically, what is the value?", 1, Decimal("9.8"))],
        negative_marking=True,
    )
    try:
        result = _submit_one(paper, "Numerically, what is the value?", "   ")
        question = result["questions"][0]
        assert question["is_correct"] is None
        assert question["marks_awarded"] is None
        attempt = result["attempt"]
        assert attempt["correct_count"] == 0
        assert attempt["incorrect_count"] == 0
        assert attempt["unanswered_count"] == 1
        assert float(attempt["score"]) == 0
    finally:
        _cleanup(paper.id)


def test_numeric_garbage_is_wrong_not_ungradable():
    """Non-numeric input is a wrong number, not a question we cannot grade.

    Distinguishing these matters: `None` means "hold for manual marking", which
    would quietly excuse every student who typed prose into a number box.
    """
    paper = _create_paper(
        [_numeric("Numerically, what is the value?", 1, Decimal("9.8"))],
        negative_marking=True,
    )
    try:
        result = _submit_one(
            paper, "Numerically, what is the value?", "about ten"
        )
        question = result["questions"][0]
        assert question["is_correct"] is False
        assert float(question["marks_awarded"]) == -2
        assert result["attempt"]["incorrect_count"] == 1
    finally:
        _cleanup(paper.id)


def test_numeric_non_finite_input_is_wrong_and_does_not_500():
    """"nan" and "Infinity" parse as Decimal but cannot be compared.

    `Decimal("NaN")`, `Decimal("sNaN")` and `Decimal("Infinity")` all construct
    successfully, so the parser's `except InvalidOperation` never sees them and
    they slipped past `test_numeric_garbage_is_wrong_not_ungradable`. The failure
    came one line later, at `abs(value - key) <= tolerance`: ordering a NaN
    against a number raises InvalidOperation, which escaped the grader and turned
    a wrong answer into a 500 that failed the student's entire submission. This
    is driven through the HTTP endpoint so the status code itself is asserted.
    """
    paper = _create_paper(
        [_numeric("Numerically, what is the value?", 1, Decimal("9.8"))],
        negative_marking=True,
    )
    try:
        for submission in ("nan", "NaN", "sNaN", "-NaN", "Infinity", "-Infinity", "inf"):
            result = _submit_one(
                paper, "Numerically, what is the value?", submission
            )
            question = result["questions"][0]
            # A wrong answer, exactly like "about ten" -- not a crash, and not
            # held for manual marking.
            assert question["is_correct"] is False, submission
            assert float(question["marks_awarded"]) == -2, submission
            assert result["attempt"]["incorrect_count"] == 1, submission
    finally:
        _cleanup(paper.id)


def test_numeric_without_a_key_is_left_for_manual_marking():
    paper = _create_paper([_numeric("Published with no key yet.", 1, None)])
    try:
        result = _submit_one(paper, "Published with no key yet.", "42")
        question = result["questions"][0]
        assert question["is_correct"] is None
        assert question["marks_awarded"] is None
        # "42" is a real submission, so it is pending review rather than blank.
        assert result["attempt"]["unanswered_count"] == 0
        assert result["attempt"]["pending_review_count"] == 1
    finally:
        _cleanup(paper.id)


def test_mcq_grading_is_unchanged_by_the_numeric_key():
    """The numeric branch must not capture a question that happens to carry a
    numeric_answer alongside its letter key."""
    paper = _create_paper(
        [_mcq("Pick A.", 1, numeric_answer=Decimal("7"))]
    )
    try:
        assert _submit_one(paper, "Pick A.", "A")["questions"][0]["is_correct"] is True
        assert _submit_one(paper, "Pick A.", "B")["questions"][0]["is_correct"] is False
    finally:
        _cleanup(paper.id)


def test_essay_grading_is_unchanged_by_the_numeric_key():
    """A subjective question must stay ungradable even with a numeric key set."""
    paper = _create_paper(
        [
            TestQuestion(
                question_text="Reason it out.",
                question_type="essay",
                options=None,
                correct_answer="A model answer",
                numeric_answer=Decimal("5"),
                marks=4,
                negative_marks=2,
                sort_order=1,
            )
        ]
    )
    try:
        result = _submit_one(paper, "Reason it out.", "A model answer")
        question = result["questions"][0]
        assert question["is_correct"] is None
        assert question["marks_awarded"] is None
    finally:
        _cleanup(paper.id)


def test_mixed_three_subject_paper_grades_each_section():
    """A single paper carrying all three JEE Main sections, end to end."""
    paper = _create_paper(
        [
            _numeric("Physics: speed of a body.", 1, Decimal("20"), subject="Physics", topic="Kinematics"),
            _mcq("Chemistry: oxidation state of Cr.", 2, subject="Chemistry", topic="Redox"),
            _mcq("Maths: the value of 7!.", 3, subject="Mathematics", topic="Permutations"),
        ],
        subject=None,
    )
    try:
        qids = _question_ids(paper)
        result = _submit(
            paper,
            [
                {"question_id": qids["Physics: speed of a body."], "selected_answer": "20.0"},
                {"question_id": qids["Chemistry: oxidation state of Cr."], "selected_answer": "B"},
                {"question_id": qids["Maths: the value of 7!."], "selected_answer": "A"},
            ],
        )
        attempt = result["attempt"]
        assert attempt["correct_count"] == 2
        assert attempt["incorrect_count"] == 1
        assert attempt["unanswered_count"] == 0
        # numeric 4 marks, Chemistry 2, Maths 2.
        assert float(attempt["total_marks"]) == 8
        # 4 (physics, "20.0" against a key of 20) + 0 (chemistry) + 2 (maths).
        assert float(attempt["score"]) == 6

        served = {q["question_text"]: q for q in result["questions"]}
        assert served["Physics: speed of a body."]["subject"] == "Physics"
        assert served["Chemistry: oxidation state of Cr."]["topic"] == "Redox"
        assert float(served["Physics: speed of a body."]["numeric_answer"]) == 20.0
    finally:
        _cleanup(paper.id)


# --------------------------------------------------------------------------
# The numeric key must not leak before submission
# --------------------------------------------------------------------------


def test_numeric_answer_is_hidden_until_the_result_is_released():
    paper = _create_paper(
        [_numeric("Numerically, what is the value?", 1, Decimal("9.8"))],
        result_visibility="after_submission",
    )
    try:
        user = _register_user()
        headers = _auth_headers(user["access_token"])
        start = client.post(
            f"/api/v1/mock-tests/{paper.slug}/start", headers=headers
        )
        assert start.status_code == 200
        body = start.json()
        assert "numeric_answer" not in body["questions"][0]
        assert "correct_answer" not in body["questions"][0]

        attempt_id = body["attempt"]["id"]
        saved = client.put(
            f"/api/v1/mock-tests/{paper.slug}/attempts/{attempt_id}"
            f"/answers/{body['questions'][0]['id']}",
            json={"selected_answer": "9.8"},
            headers=headers,
        )
        assert saved.status_code == 200, saved.text
        # The key is withheld while the attempt is live, not just from the bank.
        assert "numeric_answer" not in saved.json()

        result = client.post(
            f"/api/v1/mock-tests/{paper.slug}/attempts/{attempt_id}/submit",
            headers=headers,
        )
        assert result.status_code == 200, result.text
        # result_visibility is not "immediate", so the key stays back even though
        # the paper was submitted. The student is told they are right, not by how.
        assert result.json()["questions"][0]["is_correct"] is True
        assert result.json()["questions"][0]["numeric_answer"] is None
    finally:
        _cleanup(paper.id)


def test_numeric_answer_is_shown_when_visibility_is_immediate():
    paper = _create_paper(
        [_numeric("Numerically, what is the value?", 1, Decimal("9.8"))],
        result_visibility="immediate",
    )
    try:
        result = _submit_one(paper, "Numerically, what is the value?", "9.8")
        assert float(result["questions"][0]["numeric_answer"]) == 9.8
    finally:
        _cleanup(paper.id)


def test_tolerance_is_published_with_the_key_so_the_verdict_is_reproducible():
    """A student told "correct" should be able to see why.

    `tolerance` sits on ResultQuestionResponse only. It says how much slack the
    key allowed, so a submission of 1.41 against a key of 1.4142 is explainable,
    and a client can re-derive the verdict the server reached instead of having
    to trust an exact-match check that would call the same answer wrong. It is
    withheld while the key is withheld, so publishing it costs no more than
    publishing `numeric_answer` does.
    """
    def make_question():
        # A fresh instance per paper: the same ORM object cannot belong to two
        # mock_tests, and re-using it silently re-parents the question.
        return _numeric(
            "Numerically, what is the square root of 2?",
            4,
            Decimal("1.4142"),
            tolerance=Decimal("0.005"),
        )

    released = _create_paper([make_question()], result_visibility="immediate")
    withheld = _create_paper([make_question()], result_visibility="after_submission")
    try:
        result = _submit_one(
            released, "Numerically, what is the square root of 2?", "1.41"
        )
        shown = result["questions"][0]
        assert shown["is_correct"] is True
        assert float(shown["numeric_answer"]) == 1.4142
        assert float(shown["tolerance"]) == 0.005

        result = _submit_one(
            withheld, "Numerically, what is the square root of 2?", "1.41"
        )
        hidden = result["questions"][0]
        assert hidden["is_correct"] is True
        assert hidden["numeric_answer"] is None
        assert hidden["tolerance"] is None
    finally:
        _cleanup(released.id)
        _cleanup(withheld.id)


def test_tolerance_defaults_to_zero_rather_than_null_in_a_released_result():
    """A NULL tolerance column means exact, and should read that way."""
    question = _numeric(
        "Numerically, what is the value?", 1, Decimal("9.8"), tolerance=None
    )
    paper = _create_paper([question], result_visibility="immediate")
    try:
        result = _submit_one(paper, "Numerically, what is the value?", "9.8")
        # Compared as a number: the column's scale decides the string form, and
        # what matters to a client is that the margin is zero, not how it prints.
        assert float(result["questions"][0]["tolerance"]) == 0
        result = _submit_one(paper, "Numerically, what is the value?", "9.81")
        assert result["questions"][0]["is_correct"] is False
    finally:
        _cleanup(paper.id)


def test_admin_detail_exposes_the_full_key():
    paper = _create_paper(
        [
            _numeric(
                "Numerically, what is the value?",
                1,
                Decimal("9.8"),
                subject="Physics",
                topic="Kinematics",
                tolerance=Decimal("0.05"),
            )
        ]
    )
    try:
        admin = _register_user()
        _make_admin(admin["email"])
        response = client.get(
            f"/api/v1/mock-tests/admin/all/{paper.slug}",
            headers=_auth_headers(admin["access_token"]),
        )
        assert response.status_code == 200, response.text
        question = response.json()["questions"][0]
        assert question["subject"] == "Physics"
        assert question["topic"] == "Kinematics"
        assert float(question["numeric_answer"]) == 9.8
        assert float(question["tolerance"]) == 0.05
    finally:
        _cleanup(paper.id)


def test_tolerance_defaults_to_zero_for_a_new_question():
    """Exact by default: 0 is what makes "20" and "20.0" the same answer."""
    paper = _create_paper([_numeric("Default tolerance.", 1, Decimal("5"))])
    try:
        with SessionLocal() as db:
            stored = db.get(TestQuestion, _question_ids(paper)["Default tolerance."])
            assert stored.tolerance == Decimal(0)
            assert stored.subject is None
            assert stored.topic is None
    finally:
        _cleanup(paper.id)
