"""add_refresh_tokens

Revision ID: c3f81a4d7e29
Revises: b4e91d7a2c58
Create Date: 2026-09-28 14:22:07.418822

Phase 3 (session security). Adds the `refresh_tokens` table that makes refresh
tokens revocable, which they previously were not at all: `POST /auth/refresh`
minted a new 30-day pair for any token that still verified, `POST /auth/logout`
echoed success without invalidating anything, and there was no record of a
token having been rotated away, so a replay was invisible.

`jti` is unique so one token cannot be confused with another; `(family, user_id)`
is indexed because reuse detection revokes a whole rotation chain, and that must
not be a table scan.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3f81a4d7e29'
# Re-parented onto the question-type migrations (a7e4c1b93d02 -> d5f2a8c71e63)
# that the remote advanced past b4e91d7a2c58, so the chain is linear again:
# b4e91d7a2c58 -> a7e4c1b93d02 -> d5f2a8c71e63 -> c3f81a4d7e29
down_revision: Union[str, Sequence[str], None] = 'd5f2a8c71e63'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('refresh_tokens',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('jti', sa.String(length=64), nullable=False),
    sa.Column('family', sa.String(length=64), nullable=False),
    sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('rotated_to_jti', sa.String(length=64), nullable=True),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('request_ip', sa.String(length=45), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('jti', name='uq_refresh_tokens_jti')
    )
    op.create_index(op.f('ix_refresh_tokens_expires_at'), 'refresh_tokens', ['expires_at'], unique=False)
    op.create_index(op.f('ix_refresh_tokens_family'), 'refresh_tokens', ['family'], unique=False)
    op.create_index(op.f('ix_refresh_tokens_jti'), 'refresh_tokens', ['jti'], unique=False)
    op.create_index(op.f('ix_refresh_tokens_revoked_at'), 'refresh_tokens', ['revoked_at'], unique=False)
    op.create_index(op.f('ix_refresh_tokens_user_id'), 'refresh_tokens', ['user_id'], unique=False)
    # Family-wide revocation on detected reuse: every live token in a chain is
    # revoked in one statement, so the chain lookup must not scan.
    op.create_index('ix_refresh_tokens_family_user', 'refresh_tokens', ['family', 'user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_refresh_tokens_family_user', table_name='refresh_tokens')
    op.drop_index(op.f('ix_refresh_tokens_user_id'), table_name='refresh_tokens')
    op.drop_index(op.f('ix_refresh_tokens_revoked_at'), table_name='refresh_tokens')
    op.drop_index(op.f('ix_refresh_tokens_jti'), table_name='refresh_tokens')
    op.drop_index(op.f('ix_refresh_tokens_family'), table_name='refresh_tokens')
    op.drop_index(op.f('ix_refresh_tokens_expires_at'), table_name='refresh_tokens')
    op.drop_table('refresh_tokens')
