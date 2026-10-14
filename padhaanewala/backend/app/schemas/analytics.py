"""Response models for the admin analytics endpoint.

Every number in this API is a live aggregate over the platform's own tables —
users, enquiries, mock-test attempts, approved reviews and saved colleges.
Nothing here can be fabricated, because there is nothing hardcoded to report.

The public catalogue counts deliberately mirror ``routers/stats.py`` visibility
rules (``is_active``, published blogs) so the admin console's analytics and the
public site describe the same rows.
"""

from datetime import date, datetime

from pydantic import BaseModel


class NameCountItem(BaseModel):
    """One row of a grouped breakdown, e.g. leads by status."""

    name: str
    count: int


class DailySeriesPoint(BaseModel):
    """Activity on one calendar day; each bucket counts real rows."""

    date: date
    leads: int
    registrations: int
    attempts: int
    reviews: int


class AnalyticsCatalogue(BaseModel):
    """Live catalogue size, using the same visibility rules as the public pages."""

    colleges: int
    courses: int
    exams: int
    scholarships: int
    blogs: int
    mock_tests: int


class AnalyticsUsers(BaseModel):
    total: int
    active: int
    new_30d: int
    by_role: list[NameCountItem]


class AnalyticsLeads(BaseModel):
    total: int
    new_7d: int
    new_30d: int
    by_status: list[NameCountItem]
    by_source: list[NameCountItem]


class TopPaperItem(BaseModel):
    """A mock-test paper ranked by number of attempts."""

    name: str
    slug: str
    attempts: int


class AnalyticsMockTests(BaseModel):
    papers: int
    attempts_total: int
    attempts_completed: int
    average_percentage: float | None
    attempts_30d: int
    top_papers: list[TopPaperItem]


class AnalyticsReviews(BaseModel):
    total: int
    average_rating: float | None
    new_30d: int


class AnalyticsOverview(BaseModel):
    """Everything the admin Analytics panel renders, from one request.

    ``saved_colleges`` counts bookmarks, which is the closest this platform
    comes to an "interest" signal without a traffic-tracking layer.
    """

    generated_at: datetime
    catalogue: AnalyticsCatalogue
    users: AnalyticsUsers
    leads: AnalyticsLeads
    mock_tests: AnalyticsMockTests
    reviews: AnalyticsReviews
    saved_colleges: int
    series: list[DailySeriesPoint]