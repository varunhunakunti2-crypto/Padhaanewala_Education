"""add_placement_nirf_cutoff_seat_matrix

Revision ID: 68d5258b08f1
Revises: 8cc76261fbc7
Create Date: 2026-09-11 02:22:39.244945

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '68d5258b08f1'
down_revision: Union[str, Sequence[str], None] = '8cc76261fbc7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('cutoffs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('college_id', sa.Integer(), nullable=True),
    sa.Column('course_id', sa.Integer(), nullable=True),
    sa.Column('branch', sa.String(length=100), nullable=True),
    sa.Column('exam_name', sa.String(length=50), nullable=False),
    sa.Column('year', sa.Integer(), nullable=False),
    sa.Column('round', sa.String(length=30), nullable=True),
    sa.Column('quota', sa.String(length=30), nullable=True),
    sa.Column('category', sa.String(length=30), nullable=False),
    sa.Column('opening_rank', sa.Integer(), nullable=True),
    sa.Column('closing_rank', sa.Integer(), nullable=True),
    sa.Column('opening_score', sa.Numeric(precision=6, scale=2), nullable=True),
    sa.Column('closing_score', sa.Numeric(precision=6, scale=2), nullable=True),
    sa.Column('source', sa.String(length=50), nullable=True),
    sa.Column('source_url', sa.String(length=255), nullable=True),
    sa.Column('verified_date', sa.Date(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['college_id'], ['colleges.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('college_id', 'course_id', 'branch', 'exam_name', 'year', 'round', 'quota', 'category', name='uq_cutoff_identity')
    )
    op.create_index(op.f('ix_cutoffs_category'), 'cutoffs', ['category'], unique=False)
    op.create_index(op.f('ix_cutoffs_college_id'), 'cutoffs', ['college_id'], unique=False)
    op.create_index(op.f('ix_cutoffs_course_id'), 'cutoffs', ['course_id'], unique=False)
    op.create_index(op.f('ix_cutoffs_exam_name'), 'cutoffs', ['exam_name'], unique=False)
    op.create_index(op.f('ix_cutoffs_year'), 'cutoffs', ['year'], unique=False)
    op.create_table('nirf_rankings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('college_id', sa.Integer(), nullable=True),
    sa.Column('category', sa.String(length=50), nullable=False),
    sa.Column('year', sa.Integer(), nullable=False),
    sa.Column('rank', sa.Integer(), nullable=False),
    sa.Column('score', sa.Numeric(precision=5, scale=2), nullable=True),
    sa.Column('rank_change', sa.Integer(), nullable=True),
    sa.Column('state_rank', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['college_id'], ['colleges.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('college_id', 'category', 'year', name='uq_nirf_college_category_year')
    )
    op.create_index(op.f('ix_nirf_rankings_category'), 'nirf_rankings', ['category'], unique=False)
    op.create_index(op.f('ix_nirf_rankings_college_id'), 'nirf_rankings', ['college_id'], unique=False)
    op.create_index(op.f('ix_nirf_rankings_year'), 'nirf_rankings', ['year'], unique=False)
    op.create_table('other_rankings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('college_id', sa.Integer(), nullable=True),
    sa.Column('ranking_body', sa.String(length=100), nullable=False),
    sa.Column('category', sa.String(length=50), nullable=True),
    sa.Column('year', sa.Integer(), nullable=True),
    sa.Column('rank', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['college_id'], ['colleges.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_other_rankings_college_id'), 'other_rankings', ['college_id'], unique=False)
    op.create_index(op.f('ix_other_rankings_ranking_body'), 'other_rankings', ['ranking_body'], unique=False)
    op.create_table('placement_records',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('college_id', sa.Integer(), nullable=True),
    sa.Column('course_id', sa.Integer(), nullable=True),
    sa.Column('branch', sa.String(length=100), nullable=True),
    sa.Column('academic_year', sa.String(length=20), nullable=False),
    sa.Column('total_graduating', sa.Integer(), nullable=True),
    sa.Column('total_placed', sa.Integer(), nullable=True),
    sa.Column('placement_percentage', sa.Numeric(precision=5, scale=2), nullable=True),
    sa.Column('students_higher_studies', sa.Integer(), nullable=True),
    sa.Column('median_salary_lpa', sa.Numeric(precision=6, scale=2), nullable=True),
    sa.Column('average_salary_lpa', sa.Numeric(precision=6, scale=2), nullable=True),
    sa.Column('highest_salary_lpa', sa.Numeric(precision=6, scale=2), nullable=True),
    sa.Column('lowest_salary_lpa', sa.Numeric(precision=6, scale=2), nullable=True),
    sa.Column('total_recruiters', sa.Integer(), nullable=True),
    sa.Column('top_recruiters', sa.JSON(), nullable=True),
    sa.Column('source', sa.String(length=50), nullable=True),
    sa.Column('source_url', sa.String(length=255), nullable=True),
    sa.Column('verified_date', sa.Date(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['college_id'], ['colleges.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_placement_records_academic_year'), 'placement_records', ['academic_year'], unique=False)
    op.create_index(op.f('ix_placement_records_college_id'), 'placement_records', ['college_id'], unique=False)
    op.create_table('seat_matrix',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('college_id', sa.Integer(), nullable=True),
    sa.Column('course_id', sa.Integer(), nullable=True),
    sa.Column('branch', sa.String(length=100), nullable=True),
    sa.Column('exam', sa.String(length=50), nullable=True),
    sa.Column('total_seats', sa.Integer(), nullable=True),
    sa.Column('general_seats', sa.Integer(), nullable=True),
    sa.Column('obc_seats', sa.Integer(), nullable=True),
    sa.Column('sc_seats', sa.Integer(), nullable=True),
    sa.Column('st_seats', sa.Integer(), nullable=True),
    sa.Column('ews_seats', sa.Integer(), nullable=True),
    sa.Column('pwd_seats', sa.Integer(), nullable=True),
    sa.Column('female_supernumerary', sa.Integer(), nullable=True),
    sa.Column('home_state_quota', sa.Integer(), nullable=True),
    sa.Column('all_india_quota', sa.Integer(), nullable=True),
    sa.Column('management_quota', sa.Integer(), nullable=True),
    sa.Column('year', sa.Integer(), nullable=False),
    sa.Column('source', sa.String(length=50), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['college_id'], ['colleges.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_seat_matrix_college_id'), 'seat_matrix', ['college_id'], unique=False)
    op.create_index(op.f('ix_seat_matrix_course_id'), 'seat_matrix', ['course_id'], unique=False)
    op.create_index(op.f('ix_seat_matrix_exam'), 'seat_matrix', ['exam'], unique=False)
    op.create_index(op.f('ix_seat_matrix_year'), 'seat_matrix', ['year'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_seat_matrix_year'), table_name='seat_matrix')
    op.drop_index(op.f('ix_seat_matrix_exam'), table_name='seat_matrix')
    op.drop_index(op.f('ix_seat_matrix_course_id'), table_name='seat_matrix')
    op.drop_index(op.f('ix_seat_matrix_college_id'), table_name='seat_matrix')
    op.drop_table('seat_matrix')
    op.drop_index(op.f('ix_placement_records_college_id'), table_name='placement_records')
    op.drop_index(op.f('ix_placement_records_academic_year'), table_name='placement_records')
    op.drop_table('placement_records')
    op.drop_index(op.f('ix_other_rankings_ranking_body'), table_name='other_rankings')
    op.drop_index(op.f('ix_other_rankings_college_id'), table_name='other_rankings')
    op.drop_table('other_rankings')
    op.drop_index(op.f('ix_nirf_rankings_year'), table_name='nirf_rankings')
    op.drop_index(op.f('ix_nirf_rankings_college_id'), table_name='nirf_rankings')
    op.drop_index(op.f('ix_nirf_rankings_category'), table_name='nirf_rankings')
    op.drop_table('nirf_rankings')
    op.drop_index(op.f('ix_cutoffs_year'), table_name='cutoffs')
    op.drop_index(op.f('ix_cutoffs_exam_name'), table_name='cutoffs')
    op.drop_index(op.f('ix_cutoffs_course_id'), table_name='cutoffs')
    op.drop_index(op.f('ix_cutoffs_college_id'), table_name='cutoffs')
    op.drop_index(op.f('ix_cutoffs_category'), table_name='cutoffs')
    op.drop_table('cutoffs')