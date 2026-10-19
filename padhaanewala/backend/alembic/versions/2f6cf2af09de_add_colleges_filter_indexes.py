"""add_colleges_filter_indexes

Revision ID: 2f6cf2af09de
Revises: c4d8e1a7f203
Create Date: 2026-10-20 00:37:41.878588

`colleges` carried indexes on identity and text-search keys only
(`college_id`, `name`, `slug`, plus the GIN/trigram pair from `459f3e0774ed`),
while every public read filters on the same few columns:

* `is_active` is applied unconditionally to the list, search, detail, courses,
  predictor, stats and analytics queries;
* `state_id` is the location filter on the list/search/predictor paths;
* `is_featured` backs the `?featured=true` filter on the list endpoint.

None of them had an index, so the planner could only sequential-scan `colleges`
or walk the low-selectivity `name` index and filter afterwards. The three
foreign keys are added for a second reason: `ON DELETE SET NULL` has to look the
referencing rows up by those columns whenever a state, district or university is
removed, and without an index that is a full scan of `colleges`. Almost every
other FK in the catalog tables is already indexed.

Deliberately *not* included:

* `city` and `college_type` are only ever matched with `ILIKE '%...%'` in
  `GET /colleges/search`, which a btree index cannot serve -- a trigram index is
  the right tool there, and `name` already has one.
* The composite `(is_active, college_type, state_id)` suggested by the
  optimization report is omitted: `college_type` is never used as an equality
  predicate, so a composite leading with it matches no query the code issues and
  would only duplicate the single-column indexes below.
"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2f6cf2af09de"
down_revision: str | Sequence[str] | None = "c4d8e1a7f203"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: `(index name, column)`, created in this order. The names are exactly what
#: SQLAlchemy emits for `index=True` on the model, so the model and the database
#: stay in agreement and `--autogenerate` reports no churn.
_INDEXES: tuple[tuple[str, str], ...] = (
    ("ix_colleges_state_id", "state_id"),
    ("ix_colleges_district_id", "district_id"),
    ("ix_colleges_university_id", "university_id"),
    ("ix_colleges_is_active", "is_active"),
    ("ix_colleges_is_featured", "is_featured"),
    ("ix_colleges_college_type", "college_type"),
    ("ix_colleges_ownership", "ownership"),
)


def upgrade() -> None:
    """Upgrade schema."""
    for name, column in _INDEXES:
        op.create_index(name, "colleges", [column], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    for name, _ in reversed(_INDEXES):
        op.drop_index(name, table_name="colleges")
