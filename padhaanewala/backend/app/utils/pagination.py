"""Shared `limit`/`offset` query parameters for list endpoints.

A list route without a bound is not "flexible" — it is an unauthenticated way to
download the whole table, and every extra route that hand-rolls its own
`Query(50, le=200)` is one more place the policy can drift. These helpers are
used as FastAPI parameter defaults, so the cap appears in OpenAPI and is
enforced before the handler runs.

The default of 100 is deliberately below the 500 hard cap: ordinary screens get
a page, and a caller that genuinely needs more has to ask for it explicitly and
can still be refused above the cap.
"""

from fastapi import Query

DEFAULT_LIMIT = 100
MAX_LIMIT = 500


def list_limit(default: int = DEFAULT_LIMIT) -> int:
    """Bounded page size for a list endpoint."""
    return Query(default, ge=1, le=MAX_LIMIT)


def list_offset() -> int:
    """Non-negative page start for a list endpoint."""
    return Query(0, ge=0)
