"""add_search_indexes

Revision ID: 459f3e0774ed
Revises: 926c62eec261
Create Date: 2026-09-11 01:54:18.834839

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '459f3e0774ed'
down_revision: Union[str, Sequence[str], None] = '926c62eec261'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_colleges_name_gin
        ON colleges USING gin (to_tsvector('english', name))
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_colleges_name_trgm
        ON colleges USING gin (name gin_trgm_ops)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_courses_name_gin
        ON courses USING gin (to_tsvector('english', name))
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_courses_name_trgm
        ON courses USING gin (name gin_trgm_ops)
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP INDEX IF EXISTS ix_courses_name_trgm")
    op.execute("DROP INDEX IF EXISTS ix_courses_name_gin")
    op.execute("DROP INDEX IF EXISTS ix_colleges_name_trgm")
    op.execute("DROP INDEX IF EXISTS ix_colleges_name_gin")
