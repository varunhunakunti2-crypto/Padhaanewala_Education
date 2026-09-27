"""Public row counts for the catalogue.

This exists because `/api/stats` used to ask the list endpoints for
`?limit=10000` and report `data.length`. That conflated two different things:
a page size and a population size. Once the list endpoints gained real upper
bounds on `limit` — which they needed, since `?limit=1000000` was a full table
dump — the admin dashboard would have kept returning HTTP 200 with counts
silently truncated at the page cap. Colleges sit at 341 rows today and the
stated target is 1000+, so this would have failed quietly and looked like data.

`COUNT(*)` is also strictly cheaper than transferring every row to measure it.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Blog,
    College,
    Course,
    Exam,
    MockTest,
    Scholarship,
)

router = APIRouter(prefix="/api/v1/stats", tags=["stats"])


@router.get("/catalog")
def catalog_stats(db: Session = Depends(get_db)) -> dict[str, int]:
    """Row counts, using the same visibility rule as each public list endpoint.

    The list endpoints hide inactive rows (`is_active`) and unpublished blogs
    (`status == "published"`), so counting all rows here would report a
    different, larger number than the pages actually contain.
    """
    return {
        "colleges": db.scalar(select(func.count()).select_from(College).where(College.is_active)) or 0,
        "courses": db.scalar(select(func.count()).select_from(Course).where(Course.is_active)) or 0,
        "exams": db.scalar(select(func.count()).select_from(Exam).where(Exam.is_active)) or 0,
        "scholarships": db.scalar(select(func.count()).select_from(Scholarship).where(Scholarship.is_active)) or 0,
        "blogs": db.scalar(select(func.count()).select_from(Blog).where(Blog.status == "published")) or 0,
        "mock_tests": db.scalar(select(func.count()).select_from(MockTest).where(MockTest.is_active)) or 0,
    }
