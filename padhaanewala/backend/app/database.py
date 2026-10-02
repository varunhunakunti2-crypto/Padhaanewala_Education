import os
from typing import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

# Optional schema isolation. The test suite sets PADHAANEWALA_SCHEMA so that every
# component — the FastAPI app, the seed scripts and Alembic — resolves unqualified
# table names inside a scratch schema instead of `public`. `public` stays on the
# search_path so database-level extensions (pg_trgm) remain resolvable.
SCHEMA = os.environ.get("PADHAANEWALA_SCHEMA")

# `search_path` is applied on connect instead of being passed through the
# connection string. Neon hands out sessions with an empty `search_path` for
# `neondb_owner`, which made every unqualified query fail with
# `relation "colleges" does not exist` even though the table was present, and the
# PgBouncer pooler rejects the parameter outright:
#   ERROR: unsupported startup parameter in options: search_path.
# A `connect` event runs inside the established session, so it works on local
# Postgres, Docker and managed hosts alike.

engine = create_engine(
    settings.DATABASE_URL,
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


@event.listens_for(engine, "connect")
def _set_search_path(dbapi_connection, connection_record) -> None:
    with dbapi_connection.cursor() as cursor:
        cursor.execute(
            f'SET search_path TO "{SCHEMA}", public' if SCHEMA else "SET search_path TO public"
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
