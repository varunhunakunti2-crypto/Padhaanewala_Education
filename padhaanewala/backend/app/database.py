import os
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

# Optional schema isolation. The test suite sets PADHAANEWALA_SCHEMA so that every
# component — the FastAPI app, the seed scripts and Alembic — resolves unqualified
# table names inside a scratch schema instead of `public`. `public` stays on the
# search_path so database-level extensions (pg_trgm) remain resolvable.
SCHEMA = os.environ.get("PADHAANEWALA_SCHEMA")

DATABASE_URL = settings.DATABASE_URL
if SCHEMA:
    _sep = "&" if "?" in DATABASE_URL else "?"
    DATABASE_URL = f"{DATABASE_URL}{_sep}options=-csearch_path%3D{SCHEMA},public"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    # These were 5/10, which is the SQLAlchemy default and far too small for a
    # process that also serves a Next.js server. `next build` prerendering the
    # catalogue issued ~4000 concurrent requests and exhausted the pool:
    #   sqlalchemy.exc.TimeoutError: QueuePool limit of size 5 overflow 10
    #   reached, connection timed out, timeout 30.00
    # with one request observed hanging for over 11 minutes. Sized for
    # production rather than a single script.
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_timeout=settings.DB_POOL_TIMEOUT_SECONDS,
    # Recycle below the typical 5-minute idle window imposed by proxies and
    # cloud load balancers so a reaped connection is never handed out.
    pool_recycle=280,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
