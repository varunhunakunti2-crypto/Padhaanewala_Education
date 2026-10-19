"""The `colleges` filter indexes must exist in the database **and** the model.

`colleges` is the hottest public table, and every list/search/predictor read
filters on `is_active`, `state_id` or `is_featured`. Until revision
`2f6cf2af09de` none of those columns was indexed, so the planner had no choice
but to sequentially scan the table (or walk the low-selectivity `name` index and
filter). The three location foreign keys were unindexed too, which turns
`ON DELETE SET NULL` on a deleted state/district/university into a scan of
`colleges`.

The indexes are read from `pg_indexes` rather than from `Base.metadata` alone,
because the suite runs against a schema built by `alembic upgrade head`: a model
flag that no migration ever applied would be invisible in production, so
`pg_indexes` is the end-to-end answer. The second test guards the other half of
the pair -- without `index=True` on the column, `--autogenerate` would emit a
`drop_index` for a database that has the index, so the two must be asserted
together.
"""

from __future__ import annotations

import os

from sqlalchemy import text

from app.database import engine
from app.models import College

#: conftest sets this before `app.database` is imported, so it is the schema the
#: engine was actually built for.
TEST_SCHEMA = os.environ["PADHAANEWALA_SCHEMA"]

#: `index name -> column`, matching revision `2f6cf2af09de`.
_EXPECTED = {
    "ix_colleges_state_id": "state_id",
    "ix_colleges_district_id": "district_id",
    "ix_colleges_university_id": "university_id",
    "ix_colleges_is_active": "is_active",
    "ix_colleges_is_featured": "is_featured",
    "ix_colleges_college_type": "college_type",
    "ix_colleges_ownership": "ownership",
}


def test_college_filter_indexes_exist_in_the_database():
    with engine.connect() as conn:
        present = {
            name
            for (name,) in conn.execute(
                text(
                    "SELECT indexname FROM pg_indexes "
                    "WHERE schemaname = :schema AND tablename = 'colleges'"
                ),
                {"schema": TEST_SCHEMA},
            )
        }

    missing = sorted(set(_EXPECTED) - present)
    assert not missing, (
        f"colleges is missing filter indexes {missing} in {TEST_SCHEMA!r}; "
        "revision `2f6cf2af09de_add_colleges_filter_indexes` did not run"
    )


def test_the_model_declares_the_same_indexes():
    declared = {
        index.name: [column.name for column in index.columns]
        for index in College.__table__.indexes
    }

    for name, column in _EXPECTED.items():
        assert name in declared, (
            f"College does not declare {name}; the database index exists but "
            "`--autogenerate` would propose dropping it"
        )
        assert declared[name] == [column]
