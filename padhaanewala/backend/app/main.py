import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import settings
from app.database import SessionLocal
from app.middleware.logging import (
    ErrorHandlingMiddleware,
    RequestContextMiddleware,
)
from app.middleware.ratelimit import RateLimitMiddleware
from app.services.redis_client import close_redis, redis_is_reachable
from app.routers import (
audit,
    auth,
    banners,
    blogs,
    colleges,
    compliance,
    consent,
    courses,
    counsellors,
    enquiries,
    enrichment,
    exams,
    faqs,
    leads,
    locations,
    media,
    mock_tests,
    questions,
    notifications,
    predictor,
    reviews,
    roles,
    saved_colleges,
    scholarships,
    seo,
    stats,
    universities,
    users,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)

logger = logging.getLogger("padhaanewala.app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start with no required warmup, shut the Redis pool down cleanly.

    The client itself is created lazily on first use, so a process whose
    traffic never touches a throttled route opens no connection at all. What
    the lifespan owns is teardown: without `close_redis` the async connection
    pool's sockets are only reclaimed by the garbage collector, which on a
    reload or a test session means one leaked pool per restart.
    """
    yield
    await close_redis()

_IS_PRODUCTION = settings.APP_ENV == "production"

# The interactive API docs are a complete, clickable map of every route,
# request schema, response model and enum in a 129-endpoint API. In production
# that is free reconnaissance for anyone who asks, and it cannot be protected
# with credentials because Swagger UI has to load the spec before it can send
# an Authorization header. `APP_ENV=development` keeps it for local work.
_DOCS_PATH = None if _IS_PRODUCTION else "/docs"
_REDOC_PATH = None if _IS_PRODUCTION else "/redoc"
_OPENAPI_PATH = None if _IS_PRODUCTION else "/openapi.json"

app = FastAPI(
    title="Padhaanewala API",
    version="0.3.0",
    description="Padhaanewala Education Technology Platform - Backend API",
    docs_url=_DOCS_PATH,
    redoc_url=_REDOC_PATH,
    openapi_url=_OPENAPI_PATH,
    lifespan=lifespan,
)

# Starlette applies middleware in reverse registration order, so the list
# below reads bottom-up as the runtime request path:
#   CORSMiddleware -> RateLimit -> RequestContext -> ErrorHandling -> TrustedHost
# CORS stays outermost so even a rejected Host still gets correct CORS
# headers; TrustedHost is innermost so it guards the routes themselves.
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_host_list)
app.add_middleware(ErrorHandlingMiddleware)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    # Pinned rather than "*". A credentialed CORS policy that also accepts a
    # wildcard origin lets any site on the internet read authenticated
    # responses from a logged-in visitor's browser.
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    max_age=600,
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(roles.router)
app.include_router(locations.router)
app.include_router(universities.router)
app.include_router(colleges.router)
app.include_router(compliance.router)
app.include_router(courses.router)
app.include_router(consent.router)
app.include_router(enquiries.router)
app.include_router(leads.router)
app.include_router(counsellors.router)
app.include_router(enrichment.router)
app.include_router(enrichment.catalog_router)
app.include_router(scholarships.router)
app.include_router(exams.router)
app.include_router(mock_tests.router)
app.include_router(questions.router)
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
app.include_router(stats.router)


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

    Redis is checked for the same reason the database is: the rate limiter is the
    only thing throttling `/api/v1/auth`, and it now fails *closed* there, so a
    dead Redis turns login into 503 for every caller. That is the correct
    security posture but it is still an outage, and a health check that cannot see
    it is the reason the outage is discovered from support tickets instead of from
    the probe. A Redis failure degrades the verdict without raising, so this
    endpoint still returns a body explaining which check failed.
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

    started = time.perf_counter()
    redis_ok = await redis_is_reachable()
    elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
    checks["redis"] = {
        "ok": redis_ok,
        "detail": (
            f"Redis answered PING in {elapsed_ms} ms"
            if redis_ok
            else "Redis did not answer PING; throttled routes will fail closed"
        ),
    }
    if not redis_ok:
        healthy = False

    if not healthy:
        response.status_code = 503

    return {
        "status": "ok" if healthy else "degraded",
        "checks": checks,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }