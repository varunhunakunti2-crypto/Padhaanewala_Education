from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from app.models.mock_test import SELECTED_ANSWER_MAX_LENGTH
from app.question_types import QuestionType


class StateResponse(BaseModel):
    id: int
    name: str
    code: str
    is_union_territory: bool

    model_config = {"from_attributes": True}


class DistrictResponse(BaseModel):
    id: int
    name: str
    code: str
    state_id: int

    model_config = {"from_attributes": True}


class CityResponse(BaseModel):
    id: int
    name: str
    district_id: int
    is_metropolitan: bool

    model_config = {"from_attributes": True}


class UniversityResponse(BaseModel):
    id: int
    name: str
    slug: str
    state_id: int | None
    city: str | None
    type: str
    is_deemed: bool
    website: str | None
    is_active: bool = True

    model_config = {"from_attributes": True}


class CollegeCourseResponse(BaseModel):
    id: int
    course_id: int
    course_name: str | None = None
    annual_fee: Decimal | None
    total_fee: Decimal | None
    intake_seats: int | None
    admission_mode: str | None
    entrance_exam: str | None

    model_config = {"from_attributes": True}


class CollegeListItemResponse(BaseModel):
    id: int
    college_id: str
    name: str
    slug: str
    college_type: str | None
    ownership: str | None
    city: str | None
    state: str | None = None
    university_name: str | None = None
    has_hostel: bool | None
    total_reviews: int
    average_rating: Decimal
    is_featured: bool

    model_config = {"from_attributes": True}


class CollegeDetailResponse(CollegeListItemResponse):
    official_name: str | None
    address: str | None
    pincode: str | None
    lat: Decimal | None
    lng: Decimal | None
    website: str | None
    email: str | None
    phone: str | None
    established_year: int | None
    accreditation_naac: str | None
    accreditation_nba: bool | None
    overview: str | None
    facilities: dict | None
    state_id: int | None
    district_id: int | None
    university_id: int | None
    courses: list[CollegeCourseResponse] = []

    model_config = {"from_attributes": True}


class CourseResponse(BaseModel):
    id: int
    name: str
    slug: str
    degree: str | None
    duration: str | None
    category: str | None

    model_config = {"from_attributes": True}


class CourseCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    degree: str | None = Field(default=None, max_length=100)
    duration: str | None = Field(default=None, max_length=50)
    category: str | None = Field(default=None, max_length=100)
    overview: str | None = None
    eligibility: str | None = None
    career_information: str | None = None
    is_active: bool = True


class CourseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    degree: str | None = Field(default=None, max_length=100)
    duration: str | None = Field(default=None, max_length=50)
    category: str | None = Field(default=None, max_length=100)
    overview: str | None = None
    eligibility: str | None = None
    career_information: str | None = None
    is_active: bool | None = None


class SearchResult(BaseModel):
    colleges: list[CollegeListItemResponse] = []
    courses: list[CourseResponse] = []


class CollegeCourseCreate(BaseModel):
    course_id: int
    annual_fee: Decimal | None = None
    total_fee: Decimal | None = None
    intake_seats: int | None = None
    admission_mode: str | None = None
    entrance_exam: str | None = None


class CollegeCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    official_name: str | None = None
    college_type: str | None = None
    ownership: str | None = None
    university_id: int | None = None
    state_id: int | None = None
    district_id: int | None = None
    city: str | None = None
    address: str | None = None
    pincode: str | None = None
    lat: Decimal | None = None
    lng: Decimal | None = None
    website: str | None = None
    email: str | None = None
    phone: str | None = None
    established_year: int | None = None
    accreditation_naac: str | None = None
    # Was missing from both request schemas while the column and the response
    # model both existed, so the admin form's NBA control sent a key that
    # Pydantic dropped: the PUT answered 200 and the value never changed.
    accreditation_nba: bool | None = None
    overview: str | None = None
    facilities: dict[str, Any] | None = None
    has_hostel: bool | None = None
    courses: list[CollegeCourseCreate] = []


class CollegeUpdate(BaseModel):
    name: str | None = None
    official_name: str | None = None
    college_type: str | None = None
    ownership: str | None = None
    university_id: int | None = None
    state_id: int | None = None
    district_id: int | None = None
    city: str | None = None
    address: str | None = None
    pincode: str | None = None
    lat: Decimal | None = None
    lng: Decimal | None = None
    website: str | None = None
    email: str | None = None
    phone: str | None = None
    established_year: int | None = None
    accreditation_naac: str | None = None
    accreditation_nba: bool | None = None
    overview: str | None = None
    facilities: dict[str, Any] | None = None
    has_hostel: bool | None = None
    is_active: bool | None = None
    is_featured: bool | None = None


class ScholarshipResponse(BaseModel):
    id: int
    name: str
    slug: str
    provider: str
    ownership: str
    eligibility: str | None
    state_id: int | None
    state_name: str | None = None
    course: str | None
    category: str | None
    income_criteria: str | None
    amount: str | None
    application_deadline: date | None
    documents_required: list | None
    application_procedure: str | None
    official_website: str | None
    verification_status: str
    last_verified_date: date | None
    next_verification_date: date | None
    is_active: bool

    model_config = {"from_attributes": True}


class ExamResponse(BaseModel):
    id: int
    name: str
    slug: str
    conducting_authority: str
    exam_type: str
    eligibility: str | None
    application_start_date: date | None
    application_deadline: date | None
    exam_date: date | None
    admit_card_date: date | None
    result_date: date | None
    official_website: str | None
    official_notification: str | None
    syllabus: dict | None
    faqs: list | None
    is_active: bool

    model_config = {"from_attributes": True}


class MockTestResponse(BaseModel):
    id: int
    name: str
    slug: str
    exam_id: int | None
    exam_name: str | None = None
    course_id: int | None
    course_name: str | None = None
    subject: str | None
    difficulty: str
    question_type: str
    duration_minutes: int
    total_marks: Decimal
    negative_marking: bool
    negative_marks_value: Decimal
    attempts_allowed: int
    question_randomization: bool
    option_randomization: bool
    instructions: str | None
    result_visibility: str
    test_type: str
    question_count: int = 0
    is_active: bool

    model_config = {"from_attributes": True}


class TestQuestionResponse(BaseModel):
    id: int
    question_text: str
    question_type: str
    options: list | None
    marks: Decimal
    negative_marks: Decimal
    difficulty: str
    sort_order: int
    # Safe to expose to a test-taker: a real paper labels its sections, and the
    # student is told which subject/topic they are being examined on.
    subject: str | None = None
    topic: str | None = None

    model_config = {"from_attributes": True}


class AttemptQuestionResponse(TestQuestionResponse):
    selected_answer: str | None = None


class ResultQuestionResponse(AttemptQuestionResponse):
    is_correct: bool | None = None
    marks_awarded: Decimal | None = None
    correct_answer: str | None = None
    explanation: str | None = None
    # The numeric half of the answer key. Gated by result_visibility at the router,
    # exactly like correct_answer -- publishing it unconditionally would hand the
    # key to anyone mid-attempt.
    numeric_answer: Decimal | None = None
    # How much slack the key allowed. Without it a student who submitted 1.41
    # against a key of 1.4142 sees a green tick and no way to reproduce it, and
    # the client cannot re-derive the verdict the server reached. Gated the same
    # way, so it appears only once the key does.
    tolerance: Decimal | None = None
    # The grader's note, on the only question type where the key cannot speak
    # for itself. Always safe to publish: it is written by a member of staff
    # for the person reading the result, and withholding it would leave a mark
    # nobody can argue with.
    grader_feedback: str | None = None


class TestAttemptResponse(BaseModel):
    id: int
    mock_test_id: int
    mock_test_name: str | None = None
    status: str
    started_at: datetime
    expires_at: datetime
    submitted_at: datetime | None = None
    score: Decimal | None = None
    total_marks: Decimal | None = None
    correct_count: int | None = None
    incorrect_count: int | None = None
    # Questions left blank. Does not include answers awaiting manual marking --
    # see pending_review_count.
    unanswered_count: int | None = None
    # Answers submitted but not auto-gradable (essay, keyless MCQ, keyless
    # numeric). NULL for attempts graded before this field existed.
    pending_review_count: int | None = None
    percentage: Decimal | None = None
    time_remaining_seconds: int = 0

    model_config = {"from_attributes": True}

    @classmethod
    def build(cls, attempt: Any) -> "TestAttemptResponse":
        return cls(
            id=attempt.id,
            mock_test_id=attempt.mock_test_id,
            mock_test_name=attempt.mock_test.name if attempt.mock_test else None,
            status=attempt.status,
            started_at=attempt.started_at,
            expires_at=attempt.expires_at,
            submitted_at=attempt.submitted_at,
            score=attempt.score,
            total_marks=attempt.total_marks,
            correct_count=attempt.correct_count,
            incorrect_count=attempt.incorrect_count,
            unanswered_count=attempt.unanswered_count,
            pending_review_count=attempt.pending_review_count,
            percentage=attempt.percentage,
            time_remaining_seconds=attempt.time_remaining_seconds,
        )


class StartAttemptResponse(BaseModel):
    attempt: TestAttemptResponse
    questions: list[AttemptQuestionResponse]


class SaveAnswerRequest(BaseModel):
    selected_answer: str | None = Field(
        default=None, max_length=SELECTED_ANSWER_MAX_LENGTH
    )


class AnswerSubmission(BaseModel):
    question_id: int
    selected_answer: str | None = Field(
        default=None, max_length=SELECTED_ANSWER_MAX_LENGTH
    )


class SubmitAttemptRequest(BaseModel):
    answers: list[AnswerSubmission] = []


class AttemptDetailResponse(BaseModel):
    attempt: TestAttemptResponse
    questions: list[AttemptQuestionResponse]


class TestResultResponse(BaseModel):
    attempt: TestAttemptResponse
    questions: list[ResultQuestionResponse]


#: Longest grader note the API accepts. The column is unbounded `TEXT`, so the
#: bound has to live here -- where an over-long note is a 422 -- rather than in
#: the table, where it would be a 500 on an otherwise valid grade.
GRADER_FEEDBACK_MAX_LENGTH = 2000


class GradeAnswerRequest(BaseModel):
    """A manual verdict on one answer.

    `marks_awarded` is required rather than derived from `is_correct`, because
    partial credit is the entire reason a human marks an essay: a rubric that
    awards 3 of 5 cannot be expressed as correct/incorrect. `is_correct` is
    optional and, when omitted, is inferred as "awarded something" -- a question
    with no negative marking has exactly two meaningful verdicts, and making the
    caller repeat the marks as a boolean would be a second thing to get wrong.
    """

    marks_awarded: Decimal = Field(..., ge=0)
    is_correct: bool | None = None
    grader_feedback: str | None = Field(
        default=None, max_length=GRADER_FEEDBACK_MAX_LENGTH
    )


class ReviewableAnswerResponse(BaseModel):
    """One answer awaiting (or holding) a human verdict, for the grading queue."""

    question_id: int
    question_text: str
    question_type: str
    selected_answer: str | None = None
    #: The ceiling the grade is checked against -- the grader cannot award more
    #: than the question is worth, so it is shown next to the box.
    marks: Decimal
    answered_at: datetime | None = None
    is_correct: bool | None = None
    marks_awarded: Decimal | None = None
    grader_feedback: str | None = None
    graded_at: datetime | None = None
    graded_by: int | None = None


class AttemptReviewResponse(BaseModel):
    """An attempt plus the answers a member of staff has to look at."""

    attempt: TestAttemptResponse
    student_name: str | None = None
    student_email: str | None = None
    submitted_at: datetime | None = None
    answers: list[ReviewableAnswerResponse] = []


class GradedAnswerResponse(BaseModel):
    """The graded answer together with the attempt's new totals.

    The tallies come back with the verdict because they are the point of the
    exercise: an isolated "3.0 saved" tells a grader nothing about whether the
    attempt has finished being marked, while `pending_review_count` hitting zero
    does.
    """

    question_id: int
    is_correct: bool | None = None
    marks_awarded: Decimal | None = None
    grader_feedback: str | None = None
    graded_by: int | None = None
    graded_at: datetime | None = None
    attempt: TestAttemptResponse


class AdminQuestionResponse(BaseModel):
    id: int
    question_text: str
    question_type: str
    options: list | None
    correct_answer: str | None = None
    marks: Decimal
    negative_marks: Decimal
    difficulty: str
    explanation: str | None = None
    sort_order: int
    is_active: bool
    subject: str | None = None
    topic: str | None = None
    numeric_answer: Decimal | None = None
    tolerance: Decimal = Decimal(0)

    model_config = {"from_attributes": True}


class AdminQuestionListItem(AdminQuestionResponse):
    """A question as the cross-paper bank sees it.

    Adds the owning paper to ``AdminQuestionResponse``. Every question row
    belongs to exactly one ``mock_tests`` row -- the FK is ``NOT NULL`` -- so a
    bank listing that spans papers has to say which paper each row came from.
    Without that, "can I reuse this question in another paper?" is a question
    the editor cannot answer from what is on screen.

    ``paper_name``/``paper_slug`` are denormalised onto the row rather than
    exposed as a nested object because the editor's write path is
    ``/mock-tests/{ref}/questions``: it needs the slug on every row it might
    open, and a nested object would only save one request per row.
    """

    mock_test_id: int
    paper_name: str
    paper_slug: str

    model_config = {"from_attributes": True}


class AdminQuestionPaper(BaseModel):
    """A paper as a filter option, with the question count the editor will see."""

    mock_test_id: int
    name: str
    slug: str
    #: Counting inactive questions too, so this matches
    #: ``MockTestAdminDetailResponse.question_count`` rather than the number the
    #: student-facing paper reports.
    question_count: int = 0

    model_config = {"from_attributes": True}


class AdminQuestionFacets(BaseModel):
    """Distinct values present in the bank, for the filter dropdowns.

    Computed by the server rather than hardcoded in the admin UI. Subjects and
    topics are *content*, not configuration: a hardcoded list has to be updated
    by hand every time a paper is authored, and until somebody remembers, the
    dropdown offers a subject that matches nothing and looks broken. A
    ``GROUP BY`` is a few lines and cannot go stale.
    """

    subjects: list[str]
    topics: list[str]
    difficulties: list[str]
    question_types: list[str]
    #: Papers holding at least one question, so "add a question" knows where a
    #: new row can go and the paper filter never offers an empty target.
    papers: list[AdminQuestionPaper]


class MockTestAdminDetailResponse(MockTestResponse):
    attempt_count: int = 0
    questions: list[AdminQuestionResponse] = []


class TestQuestionCreate(BaseModel):
    """Body for ``POST /{mock_test_ref}/questions``.

    Every bound here mirrors a column, and that is not decoration: an oversized
    value would otherwise reach Postgres and come back as a 500 failing the whole
    request, which is exactly the failure mode the ``selected_answer`` bound
    already had. ``Numeric(6, 2)`` holds five integer digits, ``Numeric(8, 4)``
    holds four, and so on.

    The cross-field grading rules are deliberately *not* here. They live in the
    router, because a partial update has to be judged against the question's
    existing state and a schema cannot see it.
    """

    question_text: str = Field(min_length=1)
    question_type: QuestionType = QuestionType.MCQ
    options: list[str] | None = None
    correct_answer: str | None = Field(default=None, max_length=255)
    subject: str | None = Field(default=None, max_length=100)
    topic: str | None = Field(default=None, max_length=255)
    numeric_answer: Decimal | None = Field(
        default=None, ge=Decimal("-99999999.9999"), le=Decimal("99999999.9999")
    )
    # Absolute margin, so it cannot be negative.
    tolerance: Decimal = Field(
        default=Decimal("0"), ge=Decimal("0"), le=Decimal("9999.9999")
    )
    marks: Decimal = Field(
        default=Decimal("1"), ge=Decimal("0"), le=Decimal("9999.99")
    )
    negative_marks: Decimal = Field(
        default=Decimal("0"), ge=Decimal("0"), le=Decimal("9999.99")
    )
    difficulty: str = Field(default="medium", max_length=20)
    explanation: str | None = None
    #: Optional. Left unset, the router appends after the highest existing order.
    sort_order: int | None = None


class TestQuestionUpdate(BaseModel):
    """Body for ``PUT /{mock_test_ref}/questions/{question_id}``.

    Every field optional and judged only when present, so a caller can correct
    one field without resending the question. ``question_text`` keeps
    ``min_length`` because an empty question is never what the caller meant.
    """

    question_text: str | None = Field(default=None, min_length=1)
    question_type: QuestionType | None = None
    options: list[str] | None = None
    correct_answer: str | None = Field(default=None, max_length=255)
    subject: str | None = Field(default=None, max_length=100)
    topic: str | None = Field(default=None, max_length=255)
    numeric_answer: Decimal | None = Field(
        default=None, ge=Decimal("-99999999.9999"), le=Decimal("99999999.9999")
    )
    tolerance: Decimal | None = Field(
        default=None, ge=Decimal("0"), le=Decimal("9999.9999")
    )
    marks: Decimal | None = Field(default=None, ge=Decimal("0"), le=Decimal("9999.99"))
    negative_marks: Decimal | None = Field(
        default=None, ge=Decimal("0"), le=Decimal("9999.99")
    )
    difficulty: str | None = Field(default=None, max_length=20)
    explanation: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class ExamCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    conducting_authority: str = Field(min_length=2, max_length=255)
    exam_type: str = Field(default="national", max_length=50)
    eligibility: str | None = None
    application_start_date: date | None = None
    application_deadline: date | None = None
    exam_date: date | None = None
    admit_card_date: date | None = None
    result_date: date | None = None
    official_website: str | None = None
    official_notification: str | None = None
    syllabus: dict | None = None
    faqs: list | None = None
    is_active: bool = True


class ExamUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    conducting_authority: str | None = Field(default=None, min_length=2, max_length=255)
    exam_type: str | None = Field(default=None, max_length=50)
    eligibility: str | None = None
    application_start_date: date | None = None
    application_deadline: date | None = None
    exam_date: date | None = None
    admit_card_date: date | None = None
    result_date: date | None = None
    official_website: str | None = None
    official_notification: str | None = None
    syllabus: dict | None = None
    faqs: list | None = None
    is_active: bool | None = None


class UniversityCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    state_id: int | None = None
    city: str | None = Field(default=None, max_length=100)
    type: str = Field(default="university", max_length=50)
    is_deemed: bool = False
    website: str | None = None
    is_active: bool = True


class UniversityUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    state_id: int | None = None
    city: str | None = Field(default=None, max_length=100)
    type: str | None = Field(default=None, max_length=50)
    is_deemed: bool | None = None
    website: str | None = None
    is_active: bool | None = None


class ScholarshipCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    provider: str = Field(min_length=2, max_length=255)
    ownership: str = Field(default="government", max_length=20)
    eligibility: str | None = None
    state_id: int | None = None
    course: str | None = Field(default=None, max_length=255)
    category: str | None = Field(default=None, max_length=100)
    income_criteria: str | None = Field(default=None, max_length=255)
    amount: str | None = Field(default=None, max_length=255)
    application_deadline: date | None = None
    documents_required: list | None = None
    application_procedure: str | None = None
    official_website: str | None = None
    verification_status: str = Field(default="unverified", max_length=20)
    last_verified_date: date | None = None
    next_verification_date: date | None = None
    is_active: bool = True


class ScholarshipUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    provider: str | None = Field(default=None, min_length=2, max_length=255)
    ownership: str | None = Field(default=None, max_length=20)
    eligibility: str | None = None
    state_id: int | None = None
    course: str | None = Field(default=None, max_length=255)
    category: str | None = Field(default=None, max_length=100)
    income_criteria: str | None = Field(default=None, max_length=255)
    amount: str | None = Field(default=None, max_length=255)
    application_deadline: date | None = None
    documents_required: list | None = None
    application_procedure: str | None = None
    official_website: str | None = None
    verification_status: str | None = Field(default=None, max_length=20)
    last_verified_date: date | None = None
    next_verification_date: date | None = None
    is_active: bool | None = None


class MockTestCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    exam_id: int | None = None
    course_id: int | None = None
    subject: str | None = Field(default=None, max_length=100)
    difficulty: str = Field(default="medium", max_length=20)
    question_type: QuestionType = QuestionType.MCQ
    duration_minutes: int = Field(default=60, ge=1)
    total_marks: Decimal = Field(default=Decimal("0"))
    negative_marking: bool = False
    negative_marks_value: Decimal = Field(default=Decimal("0"))
    attempts_allowed: int = Field(default=1, ge=0)
    question_randomization: bool = False
    option_randomization: bool = False
    instructions: str | None = None
    result_visibility: str = Field(default="immediate", max_length=20)
    test_type: str = Field(default="standard", max_length=20)
    is_active: bool = True


class MockTestUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    exam_id: int | None = None
    course_id: int | None = None
    subject: str | None = Field(default=None, max_length=100)
    difficulty: str | None = Field(default=None, max_length=20)
    question_type: QuestionType | None = None
    duration_minutes: int | None = Field(default=None, ge=1)
    total_marks: Decimal | None = None
    negative_marking: bool | None = None
    negative_marks_value: Decimal | None = None
    attempts_allowed: int | None = Field(default=None, ge=0)
    question_randomization: bool | None = None
    option_randomization: bool | None = None
    instructions: str | None = None
    result_visibility: str | None = Field(default=None, max_length=20)
    test_type: str | None = Field(default=None, max_length=20)
    is_active: bool | None = None


class EnquiryCreate(BaseModel):
    # `extra="forbid"` turns a client-supplied `ip_address` (or any other
    # unmodelled field) into a 422 instead of silently ignoring it — the field's
    # absences is the point, see the `ip_address` comment below.
    model_config = {"extra": "forbid"}

    name: str = Field(min_length=2, max_length=255)
    mobile: str = Field(min_length=10, max_length=20)
    email: str | None = Field(default=None, max_length=255)
    course_id: int | None = None
    college_id: int | None = None
    state_id: int | None = None
    city: str | None = Field(default=None, max_length=100)
    qualification: str | None = Field(default=None, max_length=100)
    message: str | None = Field(default=None, max_length=2000)
    source: str | None = Field(default=None, max_length=50)
    source_url: str | None = Field(default=None, max_length=255)
    utm_source: str | None = Field(default=None, max_length=100)
    utm_medium: str | None = Field(default=None, max_length=100)
    utm_campaign: str | None = Field(default=None, max_length=100)
    utm_content: str | None = Field(default=None, max_length=100)
    device_type: str | None = Field(default=None, max_length=20)
    # Phase 9.1 — required, no default. This endpoint is unauthenticated, so the
    # account age gate cannot reach it, and it is the widest collector of minors'
    # personal data on the site. "Optional, defaulting to adult" would be the same
    # decorative gate the account-side one avoids.
    age_band: Literal["under_18", "18_plus"]
    # Required by the validator below when `age_band` is `under_18`. The callback
    # has to be placed to an adult, and the row has to record whose authority it
    # was placed under.
    guardian_contact: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def require_guardian_for_minors(self) -> "EnquiryCreate":
        if self.age_band == "under_18" and not (self.guardian_contact or "").strip():
            raise ValueError(
                "A parent or guardian's phone number or email is required when the "
                "student is under 18"
            )
        return self

    # `ip_address` is deliberately absent (4.1): this is an unauthenticated
    # endpoint, so a caller-supplied value is a lie about provenance and is
    # rejected rather than silently dropped. The server derives it from the
    # connection. The field also functionally rejects spoofed CRMs records.


class EnquiryResponse(BaseModel):
    id: int
    name: str
    mobile: str
    email: str | None
    course_id: int | None
    college_id: int | None
    state_id: int | None
    city: str | None
    message: str | None
    status: str
    follow_up_date: date | None
    created_at: datetime

    model_config = {"from_attributes": True}