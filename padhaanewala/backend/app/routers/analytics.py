"""Admin analytics: live aggregates over the platform's own tables.

This is the endpoint the admin Analytics panel renders. It was added to replace
a placeholder screen that had no data source. The rule that screen now
documents is kept here: **every number is measured from the database**. There is
no fabricated traffic, no hardcoded funnel and no "recent activity" that is not
a real row in a real table.

What it can honestly report:

* catalogue size (same visibility rules as the public pages — see
  ``routers/stats.py``)
* account base, including role distribution (``users`` + ``user_roles``)
* the admission funnel as the CRM sees it (``enquiries`` by status and source)
* mock-test engagement (``test_attempts`` totals, completion and average
  percentage, most-attempted papers)
* published reviews (count, average rating) and saved colleges

What it deliberately does **not** report: page views, sessions, traffic,
devices or a visitor funnel. Nothing in this codebase tracks those events
(marketing-site routes record no page-view table), so inventing them here would
be the exact failure the placeholder screen was written to avoid.

Admin-only: the frontend gates the console on roles, but this route enforces
``ADMIN_ROLES`` server-side like every other CRM read.
"""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_role
from app.models import (
    Blog,
    College,
    Course,
    Enquiry,
    Exam,
    MockTest,
    Review,
    Role,
    SavedCollege,
    Scholarship,
    TestAttempt,
    User,
    user_roles,
)
from app.roles import ADMIN_ROLES
from app.schemas.analytics import (
    AnalyticsCatalogue,
    AnalyticsLeads,
    AnalyticsMockTests,
    AnalyticsOverview,
    AnalyticsReviews,
    AnalyticsUsers,
    DailySeriesPoint,
    NameCountItem,
    TopPaperItem,
)

router = APIRouter(prefix="/api/v1/admin/analytics", tags=["analytics"])

#: How many days the activity series spans, and the window for "recent".
SERIES_DAYS = 14


def _count_column(db: Session, column, days: int) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(column.table)
            .where(column >= func.now() - timedelta(days=days))
        )
        or 0
    )


def _bucket(db: Session, column, limit: int | None = None) -> list[NameCountItem]:
    """Group rows by ``column`` into ``{name, count}``, most frequent first."""
    query = (
        select(column, func.count().label("n"))
        .where(column.is_not(None))
        .group_by(column)
        .order_by(func.count().desc())
    )
    if limit is not None:
        query = query.limit(limit)
    return [
        NameCountItem(name=str(name), count=int(count))
        for name, count in db.execute(query).all()
    ]


def _day_counts(db: Session, column, days: int) -> dict[object, int]:
    """Count rows created per calendar day, keyed by ``DATE(created_at)``."""
    day_expr = func.date(column)
    rows = db.execute(
        select(day_expr.label("d"), func.count().label("n"))
        .where(column >= func.now() - timedelta(days=days))
        .group_by(day_expr)
    ).all()
    return {row.d: int(row.n) for row in rows}


def _catalogue(db: Session) -> AnalyticsCatalogue:
    # Same visibility rule as each public list endpoint and /api/v1/stats/catalog.
    return AnalyticsCatalogue(
        colleges=db.scalar(select(func.count()).select_from(College).where(College.is_active)) or 0,
        courses=db.scalar(select(func.count()).select_from(Course).where(Course.is_active)) or 0,
        exams=db.scalar(select(func.count()).select_from(Exam).where(Exam.is_active)) or 0,
        scholarships=db.scalar(select(func.count()).select_from(Scholarship).where(Scholarship.is_active)) or 0,
        blogs=db.scalar(select(func.count()).select_from(Blog).where(Blog.status == "published")) or 0,
        mock_tests=db.scalar(select(func.count()).select_from(MockTest).where(MockTest.is_active)) or 0,
    )


def _users(db: Session) -> AnalyticsUsers:
    by_role = [
        NameCountItem(name=name, count=int(count))
        for name, count in db.execute(
            select(Role.name, func.count(User.id).label("n"))
            .select_from(User)
            .join(user_roles, user_roles.c.user_id == User.id)
            .join(Role, Role.id == user_roles.c.role_id)
            .group_by(Role.name)
            .order_by(func.count(User.id).desc())
        ).all()
    ]
    return AnalyticsUsers(
        total=db.scalar(select(func.count()).select_from(User)) or 0,
        active=db.scalar(select(func.count()).select_from(User).where(User.is_active)) or 0,
        new_30d=_count_column(db, User.created_at, 30),
        by_role=by_role,
    )


def _leads(db: Session) -> AnalyticsLeads:
    return AnalyticsLeads(
        total=db.scalar(select(func.count()).select_from(Enquiry)) or 0,
        new_7d=_count_column(db, Enquiry.created_at, 7),
        new_30d=_count_column(db, Enquiry.created_at, 30),
        by_status=_bucket(db, Enquiry.status),
        by_source=_bucket(db, Enquiry.source, limit=10),
    )


def _mock_tests(db: Session) -> AnalyticsMockTests:
    average = db.scalar(
        select(func.avg(TestAttempt.percentage)).where(
            TestAttempt.status == "submitted",
            TestAttempt.percentage.is_not(None),
        )
    )
    top = [
        TopPaperItem(name=name, slug=slug, attempts=int(count))
        for name, slug, count in db.execute(
            select(MockTest.name, MockTest.slug, func.count(TestAttempt.id).label("n"))
            .join(TestAttempt, TestAttempt.mock_test_id == MockTest.id)
            .group_by(MockTest.id)
            .order_by(func.count(TestAttempt.id).desc())
            .limit(5)
        ).all()
    ]
    return AnalyticsMockTests(
        papers=db.scalar(select(func.count()).select_from(MockTest).where(MockTest.is_active)) or 0,
        attempts_total=db.scalar(select(func.count()).select_from(TestAttempt)) or 0,
        attempts_completed=db.scalar(
            select(func.count()).select_from(TestAttempt).where(TestAttempt.status == "submitted")
        )
        or 0,
        average_percentage=round(float(average), 2) if average is not None else None,
        attempts_30d=_count_column(db, TestAttempt.created_at, 30),
        top_papers=top,
    )


def _reviews(db: Session) -> AnalyticsReviews:
    approved = Review.status == "approved"
    average = db.scalar(
        select(func.avg(Review.rating)).where(approved)
    )
    return AnalyticsReviews(
        total=db.scalar(select(func.count()).select_from(Review).where(approved)) or 0,
        average_rating=round(float(average), 2) if average is not None else None,
        new_30d=db.scalar(
            select(func.count())
            .select_from(Review)
            .where(approved, Review.created_at >= func.now() - timedelta(days=30))
        )
        or 0,
    )


def _series(db: Session, days: int = SERIES_DAYS) -> list[DailySeriesPoint]:
    """One point per day for the last ``days`` days, oldest first.

    ``today`` comes from the database rather than the client clock so the series
    and the ``>= now() - INTERVAL`` filters stay on the same calendar.
    """
    today = db.scalar(select(func.current_date()))
    leads = _day_counts(db, Enquiry.created_at, days)
    registrations = _day_counts(db, User.created_at, days)
    attempts = _day_counts(db, TestAttempt.created_at, days)
    reviews = _day_counts(db, Review.created_at, days)

    points: list[DailySeriesPoint] = []
    for offset in range(days - 1, -1, -1):
        day = today - timedelta(days=offset)
        points.append(
            DailySeriesPoint(
                date=day,
                leads=leads.get(day, 0),
                registrations=registrations.get(day, 0),
                attempts=attempts.get(day, 0),
                reviews=reviews.get(day, 0),
            )
        )
    return points


@router.get("/overview", response_model=AnalyticsOverview)
def analytics_overview(
    user: User = Depends(require_role(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> AnalyticsOverview:
    """Live platform analytics for the admin console."""
    return AnalyticsOverview(
        generated_at=datetime.now(UTC),
        catalogue=_catalogue(db),
        users=_users(db),
        leads=_leads(db),
        mock_tests=_mock_tests(db),
        reviews=_reviews(db),
        saved_colleges=db.scalar(select(func.count()).select_from(SavedCollege)) or 0,
        series=_series(db),
    )