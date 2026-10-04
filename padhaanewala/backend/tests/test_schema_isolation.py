"""`search_path` must be session state, not transaction state.

The engine sets the search path in a `connect` event. psycopg2 opens an
implicit transaction for that statement, and the pool issues a ROLLBACK when a
connection is returned -- so on a connection whose only work was a request that
ended without committing, the SET was undone and the connection went back into
the pool pointed at `public`.

Nothing about that is visible from a single request. It surfaces as two
unrelated-looking failures:

  * `Could not refresh instance '<OtpRecord>'` -- the row was committed through
    one connection into `test_suite` and read back through another that had
    reverted to `public`, so the SELECT found no row;
  * test users appearing in `public.users` of the developer database.

Both only appear once the pool holds a connection that has rolled back, which
is why the suite passed until `test_ratelimit_redis_live.py` started running
against a real Redis: twenty concurrent logins expand the pool and leave
rollback-only connections behind it.
"""

import pytest
from sqlalchemy import text

from app.database import SCHEMA, engine


@pytest.mark.skipif(not SCHEMA, reason="no schema isolation configured")
def test_search_path_survives_a_rollback_on_a_pooled_connection():
    """A ROLLBACK must not silently retarget a pooled connection.

    This drives the raw DBAPI connection because that is the level the pool
    resets at -- going through a `Session` would hide the rollback behind
    SQLAlchemy's own transaction handling.
    """
    # Force a connection the listener has not already been through. A pooled
    # one may carry a search path some earlier request committed, which would
    # make this pass with or without the fix -- the whole defect is about the
    # connections that never committed.
    engine.pool.dispose()
    raw = engine.raw_connection()
    try:
        # The DBAPI connection itself, not the pool proxy: `raw.rollback()`
        # does not reach psycopg2, so rolling back through it would assert
        # nothing. Verified by mutation — with the listener's `commit()`
        # removed this test fails with `reverted to 'public'`.
        dbapi = getattr(raw, "driver_connection", None) or raw.connection
        with dbapi.cursor() as cursor:
            cursor.execute("select current_schema()")
            before = cursor.fetchone()[0]
            assert before == SCHEMA, f"connection started in {before!r}"

        # Exactly what the pool does on return, and what any request that ends
        # without a commit leaves behind.
        dbapi.rollback()

        with dbapi.cursor() as cursor:
            cursor.execute("select current_schema()")
            after = cursor.fetchone()[0]
        assert after == SCHEMA, (
            f"search_path reverted to {after!r} on rollback; the SET ran inside "
            "the transaction the pool just rolled back, so this connection will "
            "read and write the wrong schema"
        )
    finally:
        raw.close()
