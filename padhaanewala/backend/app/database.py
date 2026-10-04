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
# connection string, for two independent reasons:
#
#   1. A connection pooler in transaction mode (PgBouncer) accepts only a
#      whitelist of startup parameters, so passing it in the URL fails outright:
#        ERROR: unsupported startup parameter in options: search_path.
#   2. Some managed Postgres hosts hand the application role a session whose
#      `search_path` does not include `public`, so every unqualified query fails
#      with `relation "colleges" does not exist` even though the table is there.
#
# A `connect` event runs inside the established session, so the setting is
# applied per connection regardless of what the host or a pooler did to the
# connection string. This works identically on local Postgres, Docker, and
# Render's managed instance.
#
# Note that under a transaction-mode pooler the `SET` below is session state and
# may be discarded when the connection is returned to the pool -- which is one
# reason to prefer a direct connection over a pooled one for a single-instance
# deployment.

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
    statement = (
        f'SET search_path TO "{SCHEMA}", public' if SCHEMA else "SET search_path TO public"
    )

    # AUTOCOMMIT is load-bearing, not a convenience. psycopg2 opens an implicit
    # transaction for any statement, and `QueuePool` issues ROLLBACK when a
    # connection is returned. A plain `SET` therefore lives inside that implicit
    # transaction, and the rollback silently reverts `search_path` to the server
    # default. Only the *first* checkout of a given connection ever saw the
    # configured schema; from the second checkout onward that connection resolved
    # unqualified table names against `public`.
    #
    # With no schema configured the reverted value is still effectively `public`,
    # which is why this stayed invisible outside the test suite. With
    # PADHAANEWALA_SCHEMA set, schema isolation stopped holding as soon as the
    # pool began reusing connections — reads and writes started landing in the
    # wrong schema, and because the pool hands out whichever connection is idle,
    # the breakage looked like nondeterministic, order-dependent test failures
    # rather than the configuration fault it was.
    previous_autocommit = dbapi_connection.autocommit
    dbapi_connection.autocommit = True
    try:
        with dbapi_connection.cursor() as cursor:
            cursor.execute(statement)
    finally:
        dbapi_connection.autocommit = previous_autocommit


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
