"""add test attempts and answers

Revision ID: f1a7c9e2d3b4
Revises: 68d5258b08f1
Create Date: 2026-09-16 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a7c9e2d3b4'
down_revision: Union[str, Sequence[str], None] = '68d5258b08f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('test_attempts',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('mock_test_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=20), nullable=False),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('score', sa.Numeric(precision=8, scale=2), nullable=True),
    sa.Column('total_marks', sa.Numeric(precision=8, scale=2), nullable=True),
    sa.Column('correct_count', sa.Integer(), nullable=True),
    sa.Column('incorrect_count', sa.Integer(), nullable=True),
    sa.Column('unanswered_count', sa.Integer(), nullable=True),
    sa.Column('percentage', sa.Numeric(precision=5, scale=2), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['mock_test_id'], ['mock_tests.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_test_attempts_mock_test_id'), 'test_attempts', ['mock_test_id'], unique=False)
    op.create_index(op.f('ix_test_attempts_status'), 'test_attempts', ['status'], unique=False)
    op.create_index(op.f('ix_test_attempts_user_id'), 'test_attempts', ['user_id'], unique=False)
    op.create_table('test_answers',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('attempt_id', sa.Integer(), nullable=False),
    sa.Column('question_id', sa.Integer(), nullable=False),
    sa.Column('selected_answer', sa.String(length=255), nullable=True),
    sa.Column('is_correct', sa.Boolean(), nullable=True),
    sa.Column('marks_awarded', sa.Numeric(precision=6, scale=2), nullable=True),
    sa.Column('answered_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['attempt_id'], ['test_attempts.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['question_id'], ['test_questions.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('attempt_id', 'question_id', name='uq_test_answers_attempt_question')
    )
    op.create_index(op.f('ix_test_answers_attempt_id'), 'test_answers', ['attempt_id'], unique=False)
    op.create_index(op.f('ix_test_answers_question_id'), 'test_answers', ['question_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_test_answers_question_id'), table_name='test_answers')
    op.drop_index(op.f('ix_test_answers_attempt_id'), table_name='test_answers')
    op.drop_table('test_answers')
    op.drop_index(op.f('ix_test_attempts_user_id'), table_name='test_attempts')
    op.drop_index(op.f('ix_test_attempts_status'), table_name='test_attempts')
    op.drop_index(op.f('ix_test_attempts_mock_test_id'), table_name='test_attempts')
    op.drop_table('test_attempts')