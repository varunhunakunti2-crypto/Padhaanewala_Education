"""Store the AI provider configuration the super-admin console edits.

    Revision ID: b2f8c4d9e731
    Revises: a7d3c5e1f924
    Create Date: 2026-11-05 00:00:00.000000

Before this table, the student assistant and the PDF question importer read
``OPENAI_*`` / ``GEMINI_*`` from the environment at import time. Rotating a key
therefore meant editing deployment configuration and restarting a process --
something only whoever controls the host can do, and not something the admin
console could help with.

``ai_settings`` is a one-row table rather than columns on ``site_settings`` for
one reason that matters more than convenience: ``site_settings`` is published
and writable by the ``admin`` role, and an API key is neither. A separate table
with a super-admin-only router means the existing settings contract cannot be
the path that writes a credential.

The key columns are ciphertext (``Text``, nullable). A deployment that already
has keys in its environment starts with both columns ``NULL`` and keeps working
through the resolver's DB-then-environment fallback; the console shows those
keys as coming from the environment.

The provider wiring columns (``chat_base_url``, ``chat_model``,
``gemini_model``) are nullable for the same reason. ``NULL`` means "use the
environment, then the built-in default", so an installation that already sets
``OPENAI_MODEL`` does not start ignoring it the moment this migration runs.

The row is seeded here, not lazily on first read, and ``id`` is constrained to
1, matching ``site_settings``.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2f8c4d9e731"
down_revision: str | Sequence[str] | None = "a7d3c5e1f924"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ai_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        # Every configuration column is nullable and carries no server
        # default: NULL means "fall through to the environment". Pinning a
        # value here would override an existing deployment's OPENAI_MODEL /
        # GEMINI_MODEL on upgrade, which is the regression this table must
        # not introduce.
        sa.Column("chat_base_url", sa.String(length=500), nullable=True),
        sa.Column("chat_model", sa.String(length=120), nullable=True),
        # Ciphertext, not plaintext. See `app/services/secret_box.py`; the
        # column name says so on purpose so nobody "helpfully" renders it.
        sa.Column("chat_api_key_encrypted", sa.Text(), nullable=True),
        sa.Column("gemini_model", sa.String(length=120), nullable=True),
        sa.Column("gemini_api_key_encrypted", sa.Text(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.CheckConstraint("id = 1", name="ck_ai_settings_singleton"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Seed the singleton. Only `id` is named: every other column takes its
    # `server_default`, so the starting values live in one place.
    op.execute("INSERT INTO ai_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING")


def downgrade() -> None:
    op.drop_table("ai_settings")
