"""Group the rows of one notification send under a shared batch id.

    Revision ID: a7d3c5e1f924
    Revises: b5c9e1f7a2d4
    Create Date: 2026-10-26 00:00:00.000000

`notifications.user_id` is NOT NULL, so "send to everyone" is stored as one row
per recipient. That is the only shape the table can hold, but it made the send
itself invisible: a 500-student broadcast appeared in the admin log as 500
unrelated rows, and there was no unit to edit or retract. Editing the wording of
an announcement therefore meant 500 requests, and the console had no control for
even one.

A nullable `batch_id` groups the rows written by a single request. It is
nullable, not backfilled: rows written before this migration genuinely belong to
no known send, and guessing a grouping from `(title, type, created_at)` would
merge two announcements that happened to share a second. The admin panel edits
those legacy rows individually via `PUT /notifications/{id}`.

`String(36)` because the router writes `uuid4().hex` (32 characters); the extra
four leave room for a hyphenated UUID if the format ever changes. Indexed
because the batch routes filter on it and the log loads a whole send at once.

No data migration.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7d3c5e1f924"
down_revision: str | Sequence[str] | None = "b5c9e1f7a2d4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "notifications",
        sa.Column("batch_id", sa.String(length=36), nullable=True),
    )
    op.create_index(
        "ix_notifications_batch_id", "notifications", ["batch_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_batch_id", table_name="notifications")
    op.drop_column("notifications", "batch_id")
