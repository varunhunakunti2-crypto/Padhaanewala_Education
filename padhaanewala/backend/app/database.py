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
    pool_size=5,
    max_overflow=10,
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
