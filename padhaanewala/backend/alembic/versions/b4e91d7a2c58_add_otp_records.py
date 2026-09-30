"""add_otp_records

Revision ID: b4e91d7a2c58
Revises: f1a7c9e2d3b4
Create Date: 2026-09-27 10:12:44.907311

Phase 3 (Email, SMS, OTP). Adds the single `otp_records` table that backs the
mobile-verification OTP, the passwordless login OTP, and the email
verification / password-reset links.

`code_hash` stores a bcrypt digest rather than the secret, so this table cannot
become a store of usable OTPs if the database is ever exposed.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b4e91d7a2c58'
down_revision: Union[str, Sequence[str], None] = 'f1a7c9e2d3b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('otp_records',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('purpose', sa.String(length=30), nullable=False),
    sa.Column('identifier', sa.String(length=255), nullable=False),
    sa.Column('code_hash', sa.String(length=255), nullable=False),
    sa.Column('attempts', sa.Integer(), nullable=False),
    sa.Column('is_used', sa.Boolean(), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('consumed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('request_ip', sa.String(length=45), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_otp_records_expires_at'), 'otp_records', ['expires_at'], unique=False)
    op.create_index(op.f('ix_otp_records_identifier'), 'otp_records', ['identifier'], unique=False)
    op.create_index(op.f('ix_otp_records_purpose'), 'otp_records', ['purpose'], unique=False)
    op.create_index(op.f('ix_otp_records_user_id'), 'otp_records', ['user_id'], unique=False)
    # Serves both the "is this identifier rate limited?" count and the
    # "newest unconsumed row for this purpose+identifier" lookup, so verification
    # never has to scan the table.
    op.create_index('ix_otp_records_purpose_identifier', 'otp_records', ['purpose', 'identifier'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_otp_records_purpose_identifier', table_name='otp_records')
    op.drop_index(op.f('ix_otp_records_user_id'), table_name='otp_records')
    op.drop_index(op.f('ix_otp_records_purpose'), table_name='otp_records')
    op.drop_index(op.f('ix_otp_records_identifier'), table_name='otp_records')
    op.drop_index(op.f('ix_otp_records_expires_at'), table_name='otp_records')
    op.drop_table('otp_records')
