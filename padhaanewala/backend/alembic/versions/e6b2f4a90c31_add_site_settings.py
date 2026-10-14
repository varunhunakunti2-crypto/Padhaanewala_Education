"""Platform-wide settings the admin console edits.

    Revision ID: e6b2f4a90c31
    Revises: d7e1b4c9a205
    Create Date: 2026-10-12 00:00:00.000000

Adds `site_settings`, a one-row table behind `GET`/`PUT /api/v1/settings`.

The console's Settings panel used to be inert: the inputs were seeded from
`frontend/lib/site.ts` and the Save button only raised a toast, so the fields
looked editable and persisted nothing. This table is what makes them real.

Two decisions are worth stating, because both are visible from outside:

* **The row is seeded here, not created on first read.** A handler that lazily
  inserted its default would turn a `GET` (a read, cacheable, retryable) into a
  write, which is a surprise in an admin-only route and a licence for a stray
  request to author the initial configuration.
* **`id` is constrained to 1.** "Singleton" is enforced by the database rather
  than by every caller remembering, so a second row cannot be inserted by a
  script or a psql session that has never read this docstring.

The seeded values are the ones `frontend/lib/site.ts` already publishes, so the
console opens on what the public site says instead of inventing a second answer.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e6b2f4a90c31"
down_revision: str | Sequence[str] | None = "d7e1b4c9a205"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "site_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "site_name", sa.String(length=120), nullable=False, server_default="padhaanewala"
        ),
        sa.Column(
            "support_email",
            sa.String(length=254),
            nullable=False,
            server_default="hello@padhaanewala.in",
        ),
        sa.Column(
            "contact_phone",
            sa.String(length=30),
            nullable=False,
            server_default="+91 98765 43210",
        ),
        sa.Column(
            "counselling_hours",
            sa.String(length=120),
            nullable=False,
            server_default="Mon\u2013Sat, 9 AM \u2013 8 PM IST",
        ),
        sa.Column(
            "default_timezone",
            sa.String(length=64),
            nullable=False,
            server_default="Asia/Kolkata",
        ),
        sa.Column(
            "number_formatting",
            sa.String(length=20),
            nullable=False,
            server_default="indian",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("id = 1", name="ck_site_settings_singleton"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Seed the singleton. Only `id` is named: every other column takes its
    # `server_default` above, so the starting values live in one place and this
    # statement cannot drift from the column definitions beside it.
    op.execute("INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING")


def downgrade() -> None:
    op.drop_table("site_settings")
