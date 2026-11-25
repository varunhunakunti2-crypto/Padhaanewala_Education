"""Reset stateful fixtures used by the TestSprite API suite.

The E2E plan uses one fixed student account and one fixed paper. A submitted
attempt consumes the paper's allowed attempts, and an earlier run may have
read every notification, so later cases (start an attempt, auto-submit, mark a
notification read) are blocked by state left behind by earlier cases. This
utility restores those fixtures without printing the account credentials.

Usage (from backend/):
    PADHAANEWALA_ENV_FILE=.env.development PADHAANEWALA_SCHEMA=public \
        ./venv/Scripts/python.exe scripts/reset_testsprite_attempts.py
"""

from __future__ import annotations

import json
import os
import secrets
import sys
from pathlib import Path

from sqlalchemy import text

# Allow both `python scripts/reset_testsprite_attempts.py` and `-m` invocation.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import engine  # noqa: E402
from app.utils.security import hash_password  # noqa: E402

DEFAULT_CONFIG = (
    Path(__file__).resolve().parents[2] / "testsprite_tests" / "tmp" / "config.json"
)
PAPER_SLUG = "jee-main-hardcore-mock-paper-2-2026"
# Several independent cases exercise this paper in one plan run. The app default
# stays at 1; this is only a local E2E fixture relaxation.
ALLOWED_ATTEMPTS = 5

# The catalogue seed gives IIT Bombay a college row and one B.Tech join row, but
# no enrichment data. TC011 ("inspect college detail sections") therefore sees
# empty rankings, cutoffs, seat-matrix and FAQ blocks. These are clearly marked
# QA fixture rows, inserted only by this local reset utility.
IITB_SLUG = "iit-bombay"

# Stable identifiers for the rest of the local QA catalogue. All of these rows
# are inserted only by this utility and are safe to re-seed on every run.
JEE_ADV_SLUG = "joint-entrance-examination-advanced"
JEE_MAIN_SLUG = "joint-entrance-examination-main"
BCA_SLUG = "bachelor-of-computer-applications"
MBA_SLUG = "master-of-business-administration"
IITD_SLUG = "iit-delhi"
TIMER_PAPER_SLUG = "qa-timer-mock-test-one-minute"

# Reviews are unique per (student, college), so five approved IIT Bombay reviews
# need five distinct students. Only the login user comes from config.json; the
# four extra students are deterministic QA-only rows with unusable passwords.
QA_STUDENTS = (
    ("qa.student2@example.invalid", "9900000002", "QA Student 2"),
    ("qa.student3@example.invalid", "9900000003", "QA Student 3"),
    ("qa.student4@example.invalid", "9900000004", "QA Student 4"),
    ("qa.student5@example.invalid", "9900000005", "QA Student 5"),
)


def _seed_iitb_details(connection) -> None:
    college_id = connection.execute(
        text("SELECT id FROM colleges WHERE slug = :slug"), {"slug": IITB_SLUG}
    ).scalar_one_or_none()
    if college_id is None:
        return

    course_row = connection.execute(
        text(
            "SELECT cc.id AS college_course_id, cc.course_id "
            "FROM college_courses cc WHERE cc.college_id = :college_id "
            "ORDER BY cc.id LIMIT 1"
        ),
        {"college_id": college_id},
    ).mappings().first()
    if course_row is None:
        return

    college_course_id = course_row["college_course_id"]
    course_id = course_row["course_id"]

    connection.execute(
        text(
            "INSERT INTO fees "
            "(college_course_id, tuition_fee, hostel_fee, examination_fee, "
            " other_charges, total_approximate, fee_period, academic_year, "
            " is_approximate, created_at) "
            "SELECT :cc_id, 200000, 50000, 5000, 10000, 265000, 'per_year', "
            "       '2025-26', true, CURRENT_TIMESTAMP "
            "WHERE NOT EXISTS (SELECT 1 FROM fees "
            "                  WHERE college_course_id = :cc_id "
            "                    AND academic_year = '2025-26')"
        ),
        {"cc_id": college_course_id},
    )

    connection.execute(
        text(
            "INSERT INTO placement_records "
            "(college_id, course_id, branch, academic_year, total_graduating, "
            " total_placed, placement_percentage, median_salary_lpa, "
            " average_salary_lpa, highest_salary_lpa, lowest_salary_lpa, "
            " total_recruiters, top_recruiters, source, verified_date, "
            " created_at, updated_at) "
            "SELECT :college_id, :course_id, 'Computer Science and Engineering', "
            "       '2025-26', 500, 460, 92.00, 18.00, 21.50, 42.00, 8.00, 120, "
            "       '[\"QA Recruiter\"]'::json, 'qa-fixture', CURRENT_DATE, "
            "       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP "
            "WHERE NOT EXISTS (SELECT 1 FROM placement_records "
            "                  WHERE college_id = :college_id "
            "                    AND academic_year = '2025-26' "
            "                    AND branch = 'Computer Science and Engineering')"
        ),
        {"college_id": college_id, "course_id": course_id},
    )

    connection.execute(
        text(
            "INSERT INTO cutoffs "
            "(college_id, course_id, branch, exam_name, year, \"round\", quota, "
            " category, opening_rank, closing_rank, source, verified_date, created_at) "
            "SELECT :college_id, :course_id, 'Computer Science and Engineering', "
            "       'JEE Advanced', 2025, 'Round 1', 'All India', 'General', "
            "       1200, 3800, 'qa-fixture', CURRENT_DATE, CURRENT_TIMESTAMP "
            "WHERE NOT EXISTS (SELECT 1 FROM cutoffs "
            "                  WHERE college_id = :college_id "
            "                    AND exam_name = 'JEE Advanced' "
            "                    AND year = 2025 AND category = 'General' "
            "                    AND branch = 'Computer Science and Engineering')"
        ),
        {"college_id": college_id, "course_id": course_id},
    )

    connection.execute(
        text(
            "INSERT INTO nirf_rankings "
            "(college_id, category, year, rank, score, rank_change, state_rank, created_at) "
            "SELECT :college_id, 'Engineering', 2025, 3, 86.50, 1, 1, CURRENT_TIMESTAMP "
            "WHERE NOT EXISTS (SELECT 1 FROM nirf_rankings "
            "                  WHERE college_id = :college_id "
            "                    AND category = 'Engineering' AND year = 2025)"
        ),
        {"college_id": college_id},
    )

    connection.execute(
        text(
            "INSERT INTO other_rankings "
            "(college_id, ranking_body, category, year, rank, created_at) "
            "SELECT :college_id, 'QS World University Rankings', 'Engineering', "
            "       2025, 150, CURRENT_TIMESTAMP "
            "WHERE NOT EXISTS (SELECT 1 FROM other_rankings "
            "                  WHERE college_id = :college_id "
            "                    AND ranking_body = 'QS World University Rankings')"
        ),
        {"college_id": college_id},
    )

    connection.execute(
        text(
            "INSERT INTO seat_matrix "
            "(college_id, course_id, branch, exam, total_seats, general_seats, "
            " obc_seats, sc_seats, st_seats, ews_seats, pwd_seats, "
            " female_supernumerary, home_state_quota, all_india_quota, "
            " management_quota, year, source, created_at) "
            "SELECT :college_id, :course_id, 'Computer Science and Engineering', "
            "       'JEE Advanced', 200, 80, 54, 30, 14, 20, 2, 10, 60, 140, 0, "
            "       2025, 'qa-fixture', CURRENT_TIMESTAMP "
            "WHERE NOT EXISTS (SELECT 1 FROM seat_matrix "
            "                  WHERE college_id = :college_id "
            "                    AND exam = 'JEE Advanced' AND year = 2025)"
        ),
        {"college_id": college_id, "course_id": course_id},
    )

    faqs = (
        (
            "What courses are available at IIT Bombay?",
            "The QA fixture catalogue lists B.Tech programmes for this college.",
        ),
        (
            "How are admissions decided?",
            "Admissions use the published entrance-exam rank and category rules.",
        ),
        (
            "Does the campus provide hostel facilities?",
            "Yes, the fixture marks hostel accommodation as available.",
        ),
    )
    for order, (question, answer) in enumerate(faqs, start=1):
        connection.execute(
            text(
                "INSERT INTO faqs "
                "(question, answer, entity_type, entity_id, display_order, "
                " is_active, created_at, updated_at) "
                "SELECT :question, :answer, 'college', :college_id, :ord, true, "
                "       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP "
                "WHERE NOT EXISTS (SELECT 1 FROM faqs "
                "                  WHERE entity_type = 'college' "
                "                    AND entity_id = :college_id "
                "                    AND question = :question)"
            ),
            {
                "question": question,
                "answer": answer,
                "college_id": college_id,
                "ord": order,
            },
        )


def _seed_exams(connection) -> None:
    """Give the JEE detail page deterministic dates, syllabus and FAQs.

    Model/migration columns used: exams(slug, name, conducting_authority,
    exam_type, eligibility, application_start_date, application_deadline,
    exam_date, admit_card_date, result_date, syllabus, faqs, is_active,
    created_at, updated_at). `syllabus` is a JSON *object* because ExamResponse
    declares it as `dict`; the subject list lives under a stable key. `faqs` is
    a JSON array of {question, answer}, which is what the frontend mapper reads.
    """
    advanced = {
        "name": "Joint Entrance Examination (Advanced)",
        "slug": JEE_ADV_SLUG,
        "authority": "IIT Joint Admission Board",
        "eligibility": (
            "Class 12 with Physics, Chemistry and Mathematics and a rank within "
            "the top 2,50,000 in JEE Main"
        ),
        "syllabus": json.dumps(
            {"subjects": ["Physics", "Chemistry", "Mathematics"]}
        ),
        "faqs": json.dumps(
            [
                {
                    "question": "Who is eligible for JEE Advanced?",
                    "answer": (
                        "Candidates who qualify JEE Main within the top 2,50,000 "
                        "rank holders and meet the class 12 subject criteria."
                    ),
                },
                {
                    "question": "When is the admit card released?",
                    "answer": "The QA fixture admit-card date is 24 May 2027.",
                },
                {
                    "question": "How are admissions decided?",
                    "answer": "Seats are allocated from the JEE Advanced rank by category rules.",
                },
            ]
        ),
    }
    connection.execute(
        text(
            "INSERT INTO exams "
            "(name, slug, conducting_authority, exam_type, eligibility, "
            " application_start_date, application_deadline, exam_date, "
            " admit_card_date, result_date, official_website, syllabus, faqs, "
            " is_active, created_at, updated_at) "
            "SELECT :name, :slug, :authority, 'national', :eligibility, "
            "       DATE '2027-01-04', DATE '2027-03-28', DATE '2027-06-06', "
            "       DATE '2027-05-24', DATE '2027-07-11', 'https://jeeadv.ac.in', "
            "       CAST(:syllabus AS json), CAST(:faqs AS json), true, "
            "       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP "
            "WHERE NOT EXISTS (SELECT 1 FROM exams WHERE slug = :slug)"
        ),
        advanced,
    )
    connection.execute(
        text(
            "UPDATE exams SET is_active = true, eligibility = :eligibility, "
            " application_start_date = DATE '2027-01-04', "
            " application_deadline = DATE '2027-03-28', "
            " exam_date = DATE '2027-06-06', "
            " admit_card_date = DATE '2027-05-24', "
            " result_date = DATE '2027-07-11', "
            " syllabus = CAST(:syllabus AS json), faqs = CAST(:faqs AS json), "
            " updated_at = CURRENT_TIMESTAMP "
            "WHERE slug = :slug"
        ),
        advanced,
    )

    # JEE Main is seeded by the catalogue but has no dates. Fill only the gaps
    # so an existing, edited row is not overwritten by this QA fixture.
    connection.execute(
        text(
            "INSERT INTO exams "
            "(name, slug, conducting_authority, exam_type, eligibility, "
            " application_start_date, application_deadline, exam_date, "
            " admit_card_date, result_date, official_website, is_active, "
            " created_at, updated_at) "
            "SELECT 'Joint Entrance Examination (Main)', :slug, "
            "       'National Testing Agency (NTA)', 'national', "
            "       'Class 12 with Physics, Chemistry and Mathematics', "
            "       DATE '2027-01-08', DATE '2027-04-04', DATE '2027-04-18', "
            "       DATE '2027-04-06', DATE '2027-05-30', "
            "       'https://jeemain.nta.nic.in', true, "
            "       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP "
            "WHERE NOT EXISTS (SELECT 1 FROM exams WHERE slug = :slug)"
        ),
        {"slug": JEE_MAIN_SLUG},
    )
    connection.execute(
        text(
            "UPDATE exams SET "
            " application_start_date = COALESCE(application_start_date, DATE '2027-01-08'), "
            " application_deadline = COALESCE(application_deadline, DATE '2027-04-04'), "
            " exam_date = COALESCE(exam_date, DATE '2027-04-18'), "
            " admit_card_date = COALESCE(admit_card_date, DATE '2027-04-06'), "
            " result_date = COALESCE(result_date, DATE '2027-05-30') "
            "WHERE slug = :slug"
        ),
        {"slug": JEE_MAIN_SLUG},
    )


def _seed_courses(connection) -> None:
    """Fill the course detail prose that the catalogue seed leaves NULL."""
    fixtures = (
        (
            BCA_SLUG,
            "Bachelor of Computer Applications is a three-year undergraduate "
            "programme covering programming, data structures, databases and "
            "software development.",
            "Class 12 pass from a recognised board, with Mathematics as a subject.",
            "Graduates work as software developers, QA engineers, web developers "
            "and data analysts, or pursue higher studies in computer applications.",
        ),
        (
            MBA_SLUG,
            "Master of Business Administration is a two-year postgraduate "
            "programme covering management, finance, marketing and operations.",
            "A bachelor's degree in any discipline with a qualifying entrance-exam score.",
            "Graduates move into management trainee, consulting, marketing, "
            "finance and operations roles across public and private organisations.",
        ),
    )
    for slug, overview, eligibility, career in fixtures:
        params = {
            "slug": slug,
            "overview": overview,
            "eligibility": eligibility,
            "career": career,
        }
        updated = connection.execute(
            text(
                "UPDATE courses SET is_active = true, "
                " overview = COALESCE(NULLIF(TRIM(overview), ''), :overview), "
                " eligibility = COALESCE(NULLIF(TRIM(eligibility), ''), :eligibility), "
                " career_information = COALESCE(NULLIF(TRIM(career_information), ''), :career), "
                " updated_at = CURRENT_TIMESTAMP "
                "WHERE slug = :slug"
            ),
            params,
        ).rowcount
        if updated == 0:
            connection.execute(
                text(
                    "INSERT INTO courses "
                    "(name, slug, degree, duration, category, overview, eligibility, "
                    " career_information, is_active, created_at, updated_at) "
                    "VALUES (:name, :slug, :degree, :duration, :category, "
                    "        :overview, :eligibility, :career, true, "
                    "        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
                ),
                {
                    **params,
                    "name": "Bachelor of Computer Applications" if slug == BCA_SLUG else "Master of Business Administration",
                    "degree": "BCA" if slug == BCA_SLUG else "MBA",
                    "duration": "3 years" if slug == BCA_SLUG else "2 years",
                    "category": "IT" if slug == BCA_SLUG else "Management",
                },
            )


def _seed_scholarships(connection) -> None:
    """Ensure deterministic, listing-ready scholarship rows exist."""
    fixtures = (
        {
            "name": "QA Central Sector Scholarship",
            "slug": "qa-central-sector-scholarship",
            "provider": "Department of Higher Education, Government of India",
            "ownership": "government",
            "category": "Merit-based",
            "course": "UG / PG",
            "eligibility": "Class 12 merit holders pursuing a full-time UG or PG course.",
            "income_criteria": "Family income below INR 8,00,000 per annum",
            "amount": "INR 12,000 per annum (UG)",
            "deadline": "2027-03-31",
            "docs": ["Marksheet", "Income Certificate", "College Bonafide"],
            "procedure": "Apply on the National Scholarship Portal before the deadline.",
            "website": "https://scholarships.gov.in/",
        },
        {
            "name": "QA Post Matric Scholarship",
            "slug": "qa-post-matric-scholarship",
            "provider": "Ministry of Social Justice and Empowerment",
            "ownership": "government",
            "category": "Post-Matric",
            "course": "All recognised post-matric courses",
            "eligibility": "SC/ST/OBC students enrolled in a recognised post-matric course.",
            "income_criteria": "Family income below INR 2,50,000 per annum",
            "amount": "Tuition fee plus maintenance allowance",
            "deadline": "2027-02-28",
            "docs": ["Caste Certificate", "Fee Receipt", "Bank Account"],
            "procedure": "Submit the application through the state scholarship portal.",
            "website": "https://scholarships.gov.in/",
        },
        {
            "name": "QA CA Merit Scholarship",
            "slug": "qa-ca-merit-scholarship",
            "provider": "QA Central Assistance Board",
            "ownership": "government",
            "category": "Merit-based",
            "course": "UG professional courses",
            "eligibility": "First-year UG students with at least 80% in class 12.",
            "income_criteria": "Family income below INR 5,00,000 per annum",
            "amount": "INR 25,000 per annum",
            "deadline": "2027-04-15",
            "docs": ["Marksheet", "Admission Letter", "Income Certificate"],
            "procedure": "Apply through the college scholarship office.",
            "website": "https://www.education.gov.in/",
        },
        {
            "name": "QA Yield Merit-cum-Means Scholarship",
            "slug": "qa-yield-merit-cum-means-scholarship",
            "provider": "QA Education Yield Trust",
            "ownership": "private",
            "category": "Merit-cum-Means",
            "course": "Engineering / Computer Applications",
            "eligibility": "Students with 75% or above and a demonstrated financial need.",
            "income_criteria": "Family income below INR 4,00,000 per annum",
            "amount": "Up to INR 50,000 per annum",
            "deadline": "2027-05-31",
            "docs": ["Marksheet", "Income Proof", "Bank Account"],
            "procedure": "Complete the online application and upload the supporting documents.",
            "website": "https://www.education.gov.in/",
        },
    )
    for item in fixtures:
        params = {
            **item,
            "docs_json": json.dumps(item["docs"]),
        }
        connection.execute(
            text(
                "INSERT INTO scholarships "
                "(name, slug, provider, ownership, category, course, eligibility, "
                " income_criteria, amount, application_deadline, documents_required, "
                " application_procedure, official_website, verification_status, "
                " is_active, created_at, updated_at) "
                "SELECT :name, :slug, :provider, :ownership, :category, :course, "
                "       :eligibility, :income_criteria, :amount, CAST(:deadline AS date), "
                "       CAST(:docs_json AS json), :procedure, :website, 'verified', "
                "       true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP "
                "WHERE NOT EXISTS (SELECT 1 FROM scholarships WHERE slug = :slug)"
            ),
            params,
        )
        # These slugs are QA-owned, so refreshing their display fields on every
        # run is deterministic and keeps them visible on list and detail pages.
        connection.execute(
            text(
                "UPDATE scholarships SET is_active = true, "
                " provider = :provider, ownership = :ownership, category = :category, "
                " course = :course, eligibility = :eligibility, "
                " income_criteria = :income_criteria, amount = :amount, "
                " application_deadline = CAST(:deadline AS date), "
                " documents_required = CAST(:docs_json AS json), "
                " application_procedure = :procedure, official_website = :website, "
                " verification_status = 'verified', updated_at = CURRENT_TIMESTAMP "
                "WHERE slug = :slug"
            ),
            params,
        )


def _seed_blogs(connection, author_id: int) -> None:
    """Publish enough distinct blog rows to exercise /blog pagination."""
    categories = (
        ("qa-admissions", "QA Admissions", "qa-admissions"),
        ("qa-exam-prep", "QA Exam Prep", "qa-exam-prep"),
        ("qa-careers", "QA Careers", "qa-careers"),
    )
    for slug, name, _ in categories:
        connection.execute(
            text(
                "INSERT INTO blog_categories (name, slug, is_active, created_at) "
                "SELECT :name, :slug, true, CURRENT_TIMESTAMP "
                "WHERE NOT EXISTS (SELECT 1 FROM blog_categories WHERE slug = :slug)"
            ),
            {"name": name, "slug": slug},
        )
        connection.execute(
            text(
                "UPDATE blog_categories SET is_active = true WHERE slug = :slug"
            ),
            {"slug": slug},
        )

    fixtures = (
        (
            "qa-admissions-guide",
            "QA Guide to College Admissions",
            "qa-admissions",
            "2026-01-05T09:00:00+00",
            "A step-by-step overview of shortlisting colleges, checking eligibility "
            "and preparing the application documents before the deadline.",
            True,
        ),
        (
            "qa-choose-a-course",
            "QA How to Choose the Right Course",
            "qa-admissions",
            "2026-02-04T09:00:00+00",
            "Compare course duration, curriculum and career outcomes before you "
            "commit to an undergraduate programme.",
            False,
        ),
        (
            "qa-jee-advanced-syllabus",
            "QA JEE Advanced Syllabus Breakdown",
            "qa-exam-prep",
            "2026-03-06T09:00:00+00",
            "Physics, Chemistry and Mathematics are the three pillars of JEE "
            "Advanced. This QA article explains how to plan revision around them.",
            True,
        ),
        (
            "qa-revision-timetable",
            "QA Building a Revision Timetable",
            "qa-exam-prep",
            "2026-04-07T09:00:00+00",
            "A practical weekly revision plan with short recall sessions, "
            "timed practice and a buffer for mock-test analysis.",
            False,
        ),
        (
            "qa-mock-test-strategy",
            "QA Mock Test Strategy That Works",
            "qa-exam-prep",
            "2026-05-08T09:00:00+00",
            "Learn how to attempt a paper in passes, protect accuracy and use the "
            "result breakdown to find the topics that need more work.",
            False,
        ),
        (
            "qa-scholarship-checklist",
            "QA Scholarship Application Checklist",
            "qa-admissions",
            "2026-06-09T09:00:00+00",
            "Keep marksheets, income proof, category certificates and bank details "
            "ready before a scholarship window opens.",
            False,
        ),
        (
            "qa-careers-after-bca",
            "QA Careers After BCA",
            "qa-careers",
            "2026-07-10T09:00:00+00",
            "Software development, quality assurance and data roles are common "
            "entry points for BCA graduates; here is how to prepare for them.",
            False,
        ),
        (
            "qa-careers-after-mba",
            "QA Careers After MBA",
            "qa-careers",
            "2026-08-11T09:00:00+00",
            "From consulting to operations, an MBA opens several management "
            "tracks. This QA article maps specialisations to typical roles.",
            False,
        ),
    )
    for slug, title, category_slug, published, body, featured in fixtures:
        category_id = connection.execute(
            text("SELECT id FROM blog_categories WHERE slug = :slug"),
            {"slug": category_slug},
        ).scalar_one_or_none()
        params = {
            "slug": slug,
            "title": title,
            "content": body,
            "excerpt": body[:120],
            "category_id": category_id,
            "author_id": author_id,
            "published": published,
            "featured": featured,
        }
        connection.execute(
            text(
                "INSERT INTO blogs "
                "(title, slug, content, excerpt, category_id, author_id, status, "
                " published_at, is_featured, view_count, created_at, updated_at) "
                "SELECT :title, :slug, :content, :excerpt, :category_id, :author_id, "
                "       'published', CAST(:published AS timestamptz), :featured, 0, "
                "       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP "
                "WHERE NOT EXISTS (SELECT 1 FROM blogs WHERE slug = :slug)"
            ),
            params,
        )
        connection.execute(
            text(
                "UPDATE blogs SET status = 'published', "
                " published_at = COALESCE(published_at, CAST(:published AS timestamptz)), "
                " content = COALESCE(NULLIF(TRIM(content), ''), :content), "
                " category_id = COALESCE(category_id, :category_id), "
                " author_id = COALESCE(author_id, :author_id), "
                " is_featured = :featured, updated_at = CURRENT_TIMESTAMP "
                "WHERE slug = :slug"
            ),
            params,
        )


def _qa_student_ids(connection, primary_user_id: int) -> list[int]:
    """Return the QA login user plus four deterministic student users."""
    student_ids = [primary_user_id]
    role_id = connection.execute(
        text("SELECT id FROM roles WHERE name = 'student'")
    ).scalar_one_or_none()
    for email, mobile, name in QA_STUDENTS:
        user_id = connection.execute(
            text("SELECT id FROM users WHERE email = :email"), {"email": email}
        ).scalar_one_or_none()
        if user_id is None:
            # Allocate a free mobile deterministically; the hash is generated at
            # seed time from an unguessable value and is never printed or reused.
            candidate = mobile
            while connection.execute(
                text("SELECT 1 FROM users WHERE mobile = :mobile"),
                {"mobile": candidate},
            ).first() is not None:
                candidate = str(int(candidate) + 1)
            connection.execute(
                text(
                    "INSERT INTO users "
                    "(email, mobile, password_hash, is_active, is_email_verified, "
                    " is_mobile_verified, age_band, is_minor, created_at, updated_at) "
                    "VALUES (:email, :mobile, :password_hash, true, true, false, "
                    "        '18_plus', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
                ),
                {
                    "email": email,
                    "mobile": candidate,
                    "password_hash": hash_password(secrets.token_urlsafe(32)),
                },
            )
            user_id = connection.execute(
                text("SELECT id FROM users WHERE email = :email"), {"email": email}
            ).scalar_one()
        if role_id is not None:
            connection.execute(
                text(
                    "INSERT INTO user_roles (user_id, role_id) "
                    "SELECT :user_id, :role_id "
                    "WHERE NOT EXISTS (SELECT 1 FROM user_roles "
                    "                  WHERE user_id = :user_id AND role_id = :role_id)"
                ),
                {"user_id": user_id, "role_id": role_id},
            )
        connection.execute(
            text(
                "INSERT INTO student_profiles "
                "(user_id, name, education_level, created_at, updated_at) "
                "SELECT :user_id, :name, 'undergraduate', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP "
                "WHERE NOT EXISTS (SELECT 1 FROM student_profiles WHERE user_id = :user_id)"
            ),
            {"user_id": user_id, "name": name},
        )
        student_ids.append(user_id)
    return student_ids


def _seed_reviews(connection, primary_user_id: int) -> None:
    """Publish five IIT Bombay reviews with the ratings QA expects."""
    college_id = connection.execute(
        text("SELECT id FROM colleges WHERE slug = :slug"), {"slug": IITB_SLUG}
    ).scalar_one_or_none()
    if college_id is None:
        return
    student_ids = _qa_student_ids(connection, primary_user_id)
    ratings = (3, 4, 4, 5, 5)
    comments = (
        "The CSE curriculum is rigorous and the faculty are approachable.",
        "Good hostel facilities and an active coding culture on campus.",
        "Placement support is strong, especially for software engineering roles.",
        "Excellent labs and academic resources; the workload is high but rewarding.",
        "A vibrant campus with many clubs and plenty of research opportunities.",
    )
    for student_id, rating, comment in zip(student_ids, ratings, comments):
        params = {
            "student_id": student_id,
            "college_id": college_id,
            "rating": rating,
            "comment": comment,
            "moderator_id": primary_user_id,
        }
        connection.execute(
            text(
                "INSERT INTO reviews "
                "(college_id, student_id, rating, review_text, year_of_study, status, "
                " is_verified, moderation_notes, moderated_by, moderated_at, "
                " created_at, updated_at) "
                "SELECT :college_id, :student_id, :rating, :comment, '3', 'approved', "
                "       true, 'qa-fixture', :moderator_id, CURRENT_TIMESTAMP, "
                "       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP "
                "WHERE NOT EXISTS (SELECT 1 FROM reviews "
                "                  WHERE student_id = :student_id "
                "                    AND college_id = :college_id)"
            ),
            params,
        )
        connection.execute(
            text(
                "UPDATE reviews SET rating = :rating, review_text = :comment, "
                " status = 'approved', is_verified = true, "
                " moderation_notes = 'qa-fixture', moderated_by = :moderator_id, "
                " moderated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP "
                "WHERE student_id = :student_id AND college_id = :college_id"
            ),
            params,
        )
    # Keep the denormalised college counters consistent with the public view.
    connection.execute(
        text(
            "UPDATE colleges SET "
            " total_reviews = (SELECT COUNT(*) FROM reviews "
            "                  WHERE college_id = :college_id AND status = 'approved'), "
            " average_rating = (SELECT COALESCE(AVG(rating), 0) FROM reviews "
            "                   WHERE college_id = :college_id AND status = 'approved'), "
            " updated_at = CURRENT_TIMESTAMP "
            "WHERE id = :college_id"
        ),
        {"college_id": college_id},
    )


def _seed_iitd(connection) -> None:
    """Add a second active/featured college for the compare cases."""
    row = connection.execute(
        text(
            "SELECT id, slug FROM colleges "
            "WHERE slug = :slug OR name = :name ORDER BY id LIMIT 1"
        ),
        {"slug": IITD_SLUG, "name": "IIT Delhi"},
    ).mappings().first()
    if row is None:
        code = "COLLEGE999990"
        while connection.execute(
            text("SELECT 1 FROM colleges WHERE college_id = :code"), {"code": code}
        ).first() is not None:
            code = f"COLLEGE{int(code.removeprefix('COLLEGE')) + 1:06d}"
        connection.execute(
            text(
                "INSERT INTO colleges "
                "(college_id, name, official_name, slug, college_type, ownership, "
                " state_id, district_id, city, established_year, website, overview, "
                " total_reviews, average_rating, is_featured, is_active, "
                " verification_status, last_verified_date, created_at, updated_at) "
                "VALUES (:code, 'IIT Delhi', 'Indian Institute of Technology Delhi', "
                "        :slug, 'Institute of National Importance', 'Government', "
                "        (SELECT id FROM states WHERE code = 'DL'), "
                "        (SELECT d.id FROM districts d JOIN states s ON s.id = d.state_id "
                "         WHERE d.name = 'New Delhi' AND s.code = 'DL'), "
                "        'New Delhi', 1961, 'https://www.iitd.ac.in/', "
                "        'QA fixture college for the compare flow.', "
                "        0, 0, true, true, 'verified', CURRENT_DATE, "
                "        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
            ),
            {"code": code, "slug": IITD_SLUG},
        )
        college_id = connection.execute(
            text("SELECT id FROM colleges WHERE slug = :slug"), {"slug": IITD_SLUG}
        ).scalar_one()
    else:
        college_id = row["id"]
        slug_taken = connection.execute(
            text("SELECT id FROM colleges WHERE slug = :slug AND id <> :id"),
            {"slug": IITD_SLUG, "id": college_id},
        ).scalar_one_or_none()
        connection.execute(
            text(
                "UPDATE colleges SET name = 'IIT Delhi', "
                " official_name = 'Indian Institute of Technology Delhi', "
                " slug = CASE WHEN :slug_taken IS NULL THEN :slug ELSE slug END, "
                " college_type = 'Institute of National Importance', "
                " ownership = 'Government', is_active = true, is_featured = true, "
                " verification_status = 'verified', last_verified_date = CURRENT_DATE, "
                " city = COALESCE(city, 'New Delhi'), "
                " state_id = COALESCE(state_id, (SELECT id FROM states WHERE code = 'DL')), "
                " overview = COALESCE(NULLIF(TRIM(overview), ''), "
                "                     'QA fixture college for the compare flow.'), "
                " updated_at = CURRENT_TIMESTAMP "
                "WHERE id = :id"
            ),
            {"slug": IITD_SLUG, "slug_taken": slug_taken, "id": college_id},
        )

    connection.execute(
        text(
            "INSERT INTO college_courses "
            "(college_id, course_id, annual_fee, total_fee, intake_seats, "
            " admission_mode, entrance_exam, is_active, created_at, updated_at) "
            "SELECT :college_id, c.id, NULL, NULL, NULL, NULL, 'JEE Advanced', "
            "       true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP "
            "FROM courses c "
            "WHERE c.slug = 'bachelor-of-technology' "
            "  AND NOT EXISTS (SELECT 1 FROM college_courses cc "
            "                  WHERE cc.college_id = :college_id AND cc.course_id = c.id)"
        ),
        {"college_id": college_id},
    )


def _seed_timer_paper(connection) -> None:
    """Add a QA-only short-duration paper without touching Paper 2."""
    exam_id = connection.execute(
        text("SELECT id FROM exams WHERE slug = :slug"), {"slug": JEE_ADV_SLUG}
    ).scalar_one_or_none()
    course_id = connection.execute(
        text("SELECT id FROM courses WHERE slug = :slug"), {"slug": BCA_SLUG}
    ).scalar_one_or_none()
    connection.execute(
        text(
            "INSERT INTO mock_tests "
            "(name, slug, exam_id, course_id, subject, difficulty, question_type, "
            " duration_minutes, total_marks, negative_marking, negative_marks_value, "
            " attempts_allowed, question_randomization, option_randomization, "
            " instructions, result_visibility, test_type, is_active, "
            " created_at, updated_at) "
            "SELECT 'QA One Minute Timer Test', :slug, :exam_id, :course_id, "
            "       'Quantitative Aptitude', 'easy', 'mcq', 1, 3, false, 0, 25, "
            "       false, false, 'QA fixture for the auto-submit timer case.', "
            "       'immediate', 'standard', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP "
            "WHERE NOT EXISTS (SELECT 1 FROM mock_tests WHERE slug = :slug)"
        ),
        {"slug": TIMER_PAPER_SLUG, "exam_id": exam_id, "course_id": course_id},
    )
    connection.execute(
        text(
            "UPDATE mock_tests SET duration_minutes = 1, total_marks = 3, "
            " attempts_allowed = 25, is_active = true, updated_at = CURRENT_TIMESTAMP "
            "WHERE slug = :slug"
        ),
        {"slug": TIMER_PAPER_SLUG},
    )
    paper_id = connection.execute(
        text("SELECT id FROM mock_tests WHERE slug = :slug"),
        {"slug": TIMER_PAPER_SLUG},
    ).scalar_one()
    questions = (
        (1, "QA timer Q1: What is 12 + 7?", ["19", "18", "20", "21"], "19"),
        (2, "QA timer Q2: What is 9 x 3?", ["27", "26", "28", "24"], "27"),
        (3, "QA timer Q3: What is 45 / 5?", ["9", "8", "10", "7"], "9"),
    )
    for order, text_value, options, answer in questions:
        params = {
            "paper_id": paper_id,
            "order": order,
            "question": text_value,
            "options": json.dumps(options),
            "answer": answer,
        }
        connection.execute(
            text(
                "INSERT INTO test_questions "
                "(mock_test_id, question_text, question_type, options, correct_answer, "
                " subject, topic, tolerance, marks, negative_marks, difficulty, "
                " explanation, sort_order, is_active, review_status, source, "
                " created_at, updated_at) "
                "SELECT :paper_id, :question, 'mcq', CAST(:options AS json), :answer, "
                "       'Quantitative Aptitude', 'Arithmetic', 0, 1, 0, 'easy', "
                "       'QA timer fixture question.', :order, true, 'approved', 'manual', "
                "       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP "
                "WHERE NOT EXISTS (SELECT 1 FROM test_questions "
                "                  WHERE mock_test_id = :paper_id AND sort_order = :order)"
            ),
            params,
        )
        connection.execute(
            text(
                "UPDATE test_questions SET question_text = :question, "
                " options = CAST(:options AS json), correct_answer = :answer, "
                " is_active = true, review_status = 'approved', source = 'manual', "
                " updated_at = CURRENT_TIMESTAMP "
                "WHERE mock_test_id = :paper_id AND sort_order = :order"
            ),
            params,
        )


def main() -> None:
    config_path = Path(os.environ.get("TESTSPRITE_CONFIG_PATH", str(DEFAULT_CONFIG)))
    # utf-8-sig accepts both the BOM-free config written by the MCP server and
    # BOM-bearing configs rewritten by PowerShell batch runners.
    config = json.loads(config_path.read_text(encoding="utf-8-sig"))
    email = config["loginUser"]

    with engine.begin() as connection:
        user_id = connection.execute(
            text("SELECT id FROM users WHERE email = :email"), {"email": email}
        ).scalar_one_or_none()
        paper_id = connection.execute(
            text("SELECT id FROM mock_tests WHERE slug = :slug"), {"slug": PAPER_SLUG}
        ).scalar_one_or_none()

        if user_id is None or paper_id is None:
            raise SystemExit("TestSprite student or mock paper is missing from this database.")

        deleted = connection.execute(
            text(
                "DELETE FROM test_attempts "
                "WHERE user_id = :user_id AND mock_test_id = :paper_id"
            ),
            {"user_id": user_id, "paper_id": paper_id},
        ).rowcount
        connection.execute(
            text("UPDATE mock_tests SET attempts_allowed = :n WHERE id = :paper_id"),
            {"n": ALLOWED_ATTEMPTS, "paper_id": paper_id},
        )

        # The notification-read case also needs a deterministic unread row.
        unread = connection.execute(
            text(
                "SELECT COUNT(*) FROM notifications "
                "WHERE user_id = :user_id AND is_read = false"
            ),
            {"user_id": user_id},
        ).scalar_one()
        if unread == 0:
            connection.execute(
                text(
                    "INSERT INTO notifications "
                    "(user_id, type, title, message, data, is_read, channel, created_at) "
                    "VALUES (:user_id, 'general', 'TestSprite fixture notification', "
                    "'Unread row for the mark-as-read E2E case', '{}'::json, "
                    "false, 'in_app', CURRENT_TIMESTAMP)"
                ),
                {"user_id": user_id},
            )

        # The ownership half of the notification case needs a row the signed-in
        # student does not own. Seed one for another active user; the runner puts
        # both ids into its instruction so the cross-user 404 can be asserted
        # without leaking any credential.
        other_user_id = connection.execute(
            text(
                "SELECT id FROM users WHERE id != :user_id AND is_active = true "
                "ORDER BY id LIMIT 1"
            ),
            {"user_id": user_id},
        ).scalar_one_or_none()
        if other_user_id is not None:
            other_count = connection.execute(
                text("SELECT COUNT(*) FROM notifications WHERE user_id = :user_id"),
                {"user_id": other_user_id},
            ).scalar_one()
            if other_count == 0:
                connection.execute(
                    text(
                        "INSERT INTO notifications "
                        "(user_id, type, title, message, data, is_read, channel, created_at) "
                        "VALUES (:user_id, 'general', 'TestSprite ownership fixture', "
                        "'Notification owned by another user', '{}'::json, "
                        "false, 'in_app', CURRENT_TIMESTAMP)"
                    ),
                    {"user_id": other_user_id},
                )

        _seed_iitb_details(connection)
        _seed_exams(connection)
        _seed_courses(connection)
        _seed_scholarships(connection)
        _seed_blogs(connection, user_id)
        _seed_reviews(connection, user_id)
        _seed_iitd(connection)
        _seed_timer_paper(connection)

    print(
        f"Cleared {deleted} prior attempt(s); attempts_allowed={ALLOWED_ATTEMPTS}; "
        "QA fixtures present (exams, courses, scholarships, blogs, reviews, "
        "colleges and mock papers)."
    )


if __name__ == "__main__":
    main()
