"""Move the seeded support address to the new .com domain.

Revision ID: f4a1c6d8e902
Revises: a7d3c5e1f924
Create Date: 2026-11-22 00:00:00.000000

`e6b2f4a90c31` seeded the `site_settings` singleton with
`hello@padhaanewala.in`. The public site publishes `SITE.email` from the
frontend while this row is what the admin console shows, so leaving it behind
would keep two contact identities on the old domain after the move to
`padhaanewala.com`.

Only the untouched seed value is migrated: an address an admin has since set
is a deliberate choice and is left alone. The server default changes too, so a
fresh database cannot reintroduce the old address through raw SQL, and the ORM
default in `app/models/site_setting.py` changes alongside it.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f4a1c6d8e902"
down_revision: str | Sequence[str] | None = "a7d3c5e1f924"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_OLD = "hello@padhaanewala.in"
_NEW = "hello@padhaanewala.com"


def upgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE site_settings SET support_email = :new, updated_at = now() "
            "WHERE id = 1 AND support_email = :old"
        ).bindparams(new=_NEW, old=_OLD)
    )
    op.alter_column(
        "site_settings",
        "support_email",
        existing_type=sa.String(length=254),
        server_default=_NEW,
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "site_settings",
        "support_email",
        existing_type=sa.String(length=254),
        server_default=_OLD,
        existing_nullable=False,
    )
    op.execute(
        sa.text(
            "UPDATE site_settings SET support_email = :old, updated_at = now() "
            "WHERE id = 1 AND support_email = :new"
        ).bindparams(old=_OLD, new=_NEW)
    )
