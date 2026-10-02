"""stop_cascading_historical_enrichment_rows

Revision ID: b4e8f2a71d09
Revises: c7d4e9a1b308
Create Date: 2026-10-02 21:40:00.000000

Delete a college and PostgreSQL destroyed every historical row that merely
*referenced* it: cutoffs, NIRF ranks, other-ranking bodies, placement records
and seat matrices. Those are published facts about real exam years, not owned
children of the college row, so correcting a college's name or deleting a
duplicate entry silently deleted a decade of rank history with no way back.
There was an audit trail, but an audit trail of a deletion is not a backup.

Every one of these eight columns is nullable, which means CASCADE was never the
only coherent option: a NULL college_id is already a valid state (imported rows
awaiting a match). ON DELETE SET NULL moves a row into that existing state
instead of destroying it. Enquiry.college_id already worked this way; this
brings the enrichment tables in line.

Two consequences worth stating rather than discovering:

- Orphaned rows stay orphaned. A row detached here is invisible to the
  college-scoped serializers and is recovered by re-linking, not by the delete.
  That is the intended trade: recoverable beats gone.
- `uq_cutoff_identity_coalesce` collapses NULL to 0, so detaching a cutoff can
  collide with an already-unattributed cutoff of the same identity and raise
  IntegrityError. The delete then fails loudly and nothing is lost, which is
  the correct failure direction for a unique index that exists to stop
  duplicate rows skewing the predictor.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b4e8f2a71d09"
down_revision: Union[str, Sequence[str], None] = "c7d4e9a1b308"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (constraint, table, column, referenced table)
_FKS = (
    ("cutoffs_college_id_fkey", "cutoffs", "college_id", "colleges"),
    ("cutoffs_course_id_fkey", "cutoffs", "course_id", "courses"),
    ("nirf_rankings_college_id_fkey", "nirf_rankings", "college_id", "colleges"),
    ("other_rankings_college_id_fkey", "other_rankings", "college_id", "colleges"),
    (
        "placement_records_college_id_fkey",
        "placement_records",
        "college_id",
        "colleges",
    ),
    ("placement_records_course_id_fkey", "placement_records", "course_id", "courses"),
    ("seat_matrix_college_id_fkey", "seat_matrix", "college_id", "colleges"),
    ("seat_matrix_course_id_fkey", "seat_matrix", "course_id", "courses"),
)


def _redefine(on_delete: str) -> None:
    for constraint, table, column, parent in _FKS:
        op.drop_constraint(constraint, table, type_="foreignkey")
        op.create_foreign_key(
            constraint, table, parent, [column], ["id"], ondelete=on_delete
        )


def upgrade() -> None:
    """Stop a college/course delete from destroying historical rows."""
    _redefine("SET NULL")


def downgrade() -> None:
    """Restore the destructive cascade.

    Rows already detached by `upgrade` are left as NULLs, which is what the
    columns allow. Re-running this on a database that has lost rows to the
    original cascade cannot bring them back.
    """
    _redefine("CASCADE")
