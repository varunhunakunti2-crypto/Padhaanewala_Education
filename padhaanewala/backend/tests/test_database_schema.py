"""`search_path` must survive connection reuse, not just connection creation.

## The defect this file exists to prevent

`app/database.py` applies the configured schema with a `connect` event listener,
because passing `search_path` in the connection string is rejected by
transaction-mode poolers (PgBouncer) and is unreliable on managed hosts. That is
the right mechanism, but the statement has to be made **durable**.

It was not. psycopg2 opens an implicit transaction for any statement, so the
listener's `SET search_path` lived inside that transaction, and `QueuePool`
issues ROLLBACK whenever a connection is returned to the pool. The rollback
reverted the setting to the server default. The consequence:

* the **first** checkout of a connection saw the configured schema;
* every checkout **after** that one saw `"$user", public`.

With no schema configured the reverted value is still effectively `public`, so
this was invisible in a default deployment. With `PADHAANEWALA_SCHEMA` set —
the entire test suite, and any environment using schema isolation — unqualified
table names began resolving against the wrong schema as soon as the pool began
reusing connections.

## Why it presented as flaky, order-dependent test failures

The pool hands out whichever connection is idle, so which request got a
correctly-configured connection and which got a reverted one was a function of
arrival order. The visible symptom was never a connection error; it was
`Session.refresh()` raising `InvalidRequestError: Could not refresh instance`,
because the row had been written through one connection and the re-`SELECT` ran
on another that was looking in the wrong schema.

Reproduced deterministically by `test_concurrent_logins_never_exceed_the_limit`
followed by any test that registers a user: twenty concurrent logins grow the
pool, and the following request then refreshes against a reverted connection.

## What is asserted

A read on a **reused** pooled connection still resolves unqualified names in the
configured schema. The checks are read-only, so they leave no rows behind and do
not disturb the shared test schema.
"""

from __future__ import annotations

import os

from sqlalchemy import text

from app.database import engine

#: conftest sets this before `app.database` is imported, so it is the schema the
#: engine was actually built for — not merely the schema we wish it had.
EXPECTED_SCHEMA = os.environ["PADHAANEWALA_SCHEMA"]

#: Enough checkouts to walk past the first-use window that hid the defect. A
#: single reuse was not reliably reproducible when the pool happened to grow.
CHECKOUTS = 5


def _search_path(conn) -> str:
    return conn.execute(text("SHOW search_path")).scalar()


def test_pooled_connections_keep_the_configured_schema_after_reuse():
    """The core regression: a reused connection must not lose its schema.

    Each iteration closes the connection, which is what triggers the pool's
    ROLLBACK. Before the fix, iteration 1 passed and iteration 2 onwards
    reported the server default.
    """
    for attempt in range(1, CHECKOUTS + 1):
        with engine.connect() as conn:
            actual = _search_path(conn)
            assert actual == f"{EXPECTED_SCHEMA}, public", (
                f"checkout {attempt} resolved search_path {actual!r}; a pooled "
                "connection lost the configured schema. The `connect` listener's "
                "SET is being rolled back when the connection is returned to the "
                "pool."
            )


def test_a_rolled_back_transaction_does_not_poison_the_next_checkout():
    """Rollback is the specific trigger, so exercise it explicitly.

    The `connect` listener runs in the same implicit transaction as application
    work. Any checkout that ends in ROLLBACK — a read-only request, a failed
    request, a health probe — reverted the setting for that connection.
    """
    for attempt in range(1, CHECKOUTS + 1):
        conn = engine.connect()
        try:
            conn.execute(text("SELECT 1")).scalar()
            conn.rollback()
        finally:
            conn.close()

        with engine.connect() as reused:
            actual = _search_path(reused)
            assert actual == f"{EXPECTED_SCHEMA}, public", (
                f"checkout {attempt} after an explicit rollback resolved "
                f"search_path {actual!r}"
            )


def test_unqualified_table_names_resolve_to_the_test_schema_on_every_connection():
    """The observable consequence, rather than the setting itself.

    `SHOW search_path` could in principle be correct while resolution is not, so
    this resolves a bare table name the way a query would and reports which
    schema actually owns it. The owning namespace is read from the catalogue
    rather than from `regclass`'s textual output, because Postgres omits the
    schema qualifier from `regclass` whenever it is visible in `search_path` —
    which would make a correct connection look identical to a reverted one.
    """
    for attempt in range(1, CHECKOUTS + 1):
        with engine.connect() as conn:
            conn.execute(text("SELECT 1")).scalar()
            owner = conn.execute(
                text(
                    "SELECT n.nspname FROM pg_class c "
                    "JOIN pg_namespace n ON n.oid = c.relnamespace "
                    "WHERE c.oid = to_regclass('users')"
                )
            ).scalar()
            assert owner == EXPECTED_SCHEMA, (
                f"checkout {attempt} resolved bare `users` to schema {owner!r}, "
                f"not {EXPECTED_SCHEMA!r}"
            )