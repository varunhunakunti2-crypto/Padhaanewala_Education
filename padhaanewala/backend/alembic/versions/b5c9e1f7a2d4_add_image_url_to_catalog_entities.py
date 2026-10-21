"""Admin-uploaded images for colleges, courses, scholarships and exams.

    Revision ID: b5c9e1f7a2d4
    Revises: a3f8d21c9b47
    Create Date: 2026-10-21 00:00:00.000000

Every "image" these four entities showed was a gradient derived on the client
from the row id (`g${id % 8}` in `frontend/lib/mappers.ts`, resolved against
`BANNER_GRADIENTS` in `frontend/lib/utils.ts`). Nothing was stored, so there was
nothing an admin could edit — a college card, a scholarship strip and an exam
hero were all decoration the database had never heard of.

This adds a nullable `image_url` to each of the four tables. Nullable rather
than defaulted because every existing row has no image, and the frontend's
gradient fallback is what should render for them; a NOT NULL column would need
a backfill of invented values.

`String(500)` matches `BANNER_GRADIENTS`' sibling column on `banners.image_url`
and the `IMAGE_URL_MAX` constant the request schemas validate against. The
column holds either a same-origin media path (`/media/files/12`) written by
`POST /media/upload` or an absolute `http(s)` URL typed by hand; the schema is
what refuses `javascript:`/`data:` and protocol-relative values, not this
migration.

No data migration: an image is an operator decision, not something derivable.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b5c9e1f7a2d4"
down_revision: str | Sequence[str] | None = "a3f8d21c9b47"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: (table, column) — added in one migration because they are one feature; a
#: partial apply would leave, say, scholarships without the image the admin
#: panel now offers.
_COLUMNS = [
    ("colleges", "image_url"),
    ("courses", "image_url"),
    ("scholarships", "image_url"),
    ("exams", "image_url"),
]


def upgrade() -> None:
    for table, column in _COLUMNS:
        op.add_column(
            table,
            sa.Column(column, sa.String(length=500), nullable=True),
        )


def downgrade() -> None:
    for table, column in _COLUMNS:
        op.drop_column(table, column)
