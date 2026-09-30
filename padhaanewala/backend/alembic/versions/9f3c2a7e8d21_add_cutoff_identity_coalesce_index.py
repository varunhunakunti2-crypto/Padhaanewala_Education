"""add_cutoff_identity_coalesce_index

Revision ID: 9f3c2a7e8d21
Revises: c3f81a4d7e29
Create Date: 2026-09-28 23:10:00.000000

Phase 4 data integrity. The `uq_cutoff_identity` unique constraint covers eight
columns of which four are nullable (`college_id`, `course_id`, `branch`,
`round`, `quota` — five, counting quota), and PostgreSQL treats NULLs as
*distinct*. The constraint therefore never fires in exactly the case that
matters: a duplicate cutoff row whose nullable columns are NULL slips straight
through, which then skews the predictor's average-closing-rank calculation.

The replacement is a *functional* unique index that collapses NULL to a
sentinel so duplicates with NULLs collide the same way duplicates with values
do. Sentinels are unreachable in practice: ids start at 1 (so 0 is never a real
id) and the text columns are either NULL or meaningful strings, never the empty
string. The legacy constraint stays for downgrade compatibility; the index is
what actually enforces identity.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9f3c2a7e8d21"
down_revision: Union[str, Sequence[str], None] = "c3f81a4d7e29"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_INDEX = "uq_cutoff_identity_coalesce"


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        f"""
        CREATE UNIQUE INDEX {_INDEX}
            ON cutoffs (
                COALESCE(college_id, 0),
                COALESCE(course_id, 0),
                COALESCE(branch, ''),
                exam_name,
                year,
                COALESCE("round", ''),
                COALESCE(quota, ''),
                category
            )
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(_INDEX, table_name="cutoffs")