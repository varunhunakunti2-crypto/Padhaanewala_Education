import os

os.environ["RATE_LIMIT_ENABLED"] = "false"

import pytest
from sqlalchemy import text

from app.database import engine


@pytest.fixture(autouse=True, scope="session")
def _clean_users():
    """Isolate each pytest session: drop any users (and their dependents)
    left behind by previous test runs so pagination/listing assertions are stable."""
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE users CASCADE"))
    yield