import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
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
    enquiries,
    exams,
    faqs,
    locations,
    media,
    mock_tests,
    notifications,
    reviews,
    roles,
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
app.include_router(enquiries.router)
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


@app.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    return {"status": "ok"}