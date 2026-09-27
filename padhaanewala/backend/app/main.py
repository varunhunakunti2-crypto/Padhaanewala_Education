import logging
import time
from datetime import datetime, timezone

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.database import SessionLocal
from app.middleware.logging import (
    ErrorHandlingMiddleware,
    RequestContextMiddleware,
)
from app.middleware.ratelimit import RateLimitMiddleware
from app.routers import (
audit,
    auth,
    banners,
    blogs,
    colleges,
    consent,
    courses,
    enquiries,
    enrichment,
    exams,
    faqs,
    leads,
    locations,
    media,
    mock_tests,
    notifications,
    predictor,
    reviews,
    roles,
    saved_colleges,
    scholarships,
    seo,
    universities,
    users,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)

app = FastAPI(
    title="Padhaanewala API",
    version="0.3.0",
    description="Padhaanewala Education Technology Platform - Backend API",
)

app.add_middleware(ErrorHandlingMiddleware)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(roles.router)
app.include_router(locations.router)
app.include_router(universities.router)
app.include_router(colleges.router)
app.include_router(courses.router)
app.include_router(consent.router)
app.include_router(enquiries.router)
app.include_router(leads.router)
app.include_router(enrichment.router)
app.include_router(enrichment.catalog_router)
app.include_router(scholarships.router)
app.include_router(exams.router)
app.include_router(mock_tests.router)
app.include_router(reviews.router)
app.include_router(blogs.router)
app.include_router(faqs.router)
app.include_router(media.router)
app.include_router(seo.router)
app.include_router(notifications.router)
app.include_router(audit.router)
app.include_router(banners.router)
app.include_router(saved_colleges.router)
app.include_router(predictor.router)


@app.get("/health", tags=["health"])
async def health_check(response: Response) -> dict[str, object]:
    """Report real dependency health instead of a hardcoded "ok".

    This used to return a constant ``{"status": "ok"}`` regardless of whether the
    database was reachable, which is what allowed the admin panel to display
    "PostgreSQL connectivity verified" while pointing at nothing. A trivial
    ``SELECT 1`` proves the connection, the credentials and the pool are all
    usable; it is cheap and does not touch application tables.

    The endpoint answers 503 when a dependency is down so that load balancers and
    uptime monitors can act on it, while still returning a body explaining which
    check failed. Driver error text is reduced to the exception class name because
    SQLAlchemy messages can embed the connection string and credentials.
    """
    checks: dict[str, dict[str, object]] = {}
    healthy = True

    started = time.perf_counter()
    try:
        db = SessionLocal()
        try:
            db.execute(text("SELECT 1"))
        finally:
            db.close()
        elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
        checks["database"] = {
            "ok": True,
            "detail": f"PostgreSQL answered SELECT 1 in {elapsed_ms} ms",
        }
    except SQLAlchemyError as exc:
        healthy = False
        checks["database"] = {
            "ok": False,
            "detail": f"PostgreSQL query failed ({type(exc).__name__})",
        }

    if not healthy:
        response.status_code = 503

    return {
        "status": "ok" if healthy else "degraded",
        "checks": checks,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }