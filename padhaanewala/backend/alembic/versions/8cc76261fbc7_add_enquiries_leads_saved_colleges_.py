"""add_enquiries_leads_saved_colleges_consent

Revision ID: 8cc76261fbc7
Revises: 2ce8d337ae09
Create Date: 2026-09-11 02:18:11.312298

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8cc76261fbc7'
down_revision: Union[str, Sequence[str], None] = '2ce8d337ae09'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('consent_records',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('consent_type', sa.String(length=50), nullable=False),
    sa.Column('consent_version', sa.String(length=20), nullable=True),
    sa.Column('consent_text', sa.Text(), nullable=False),
    sa.Column('granted', sa.Boolean(), nullable=False),
    sa.Column('ip_address', sa.String(length=45), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_consent_records_consent_type'), 'consent_records', ['consent_type'], unique=False)
    op.create_index(op.f('ix_consent_records_user_id'), 'consent_records', ['user_id'], unique=False)
    op.create_table('enquiries',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('student_id', sa.Integer(), nullable=True),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('mobile', sa.String(length=20), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=True),
    sa.Column('course_id', sa.Integer(), nullable=True),
    sa.Column('college_id', sa.Integer(), nullable=True),
    sa.Column('state_id', sa.Integer(), nullable=True),
    sa.Column('city', sa.String(length=100), nullable=True),
    sa.Column('qualification', sa.String(length=100), nullable=True),
    sa.Column('message', sa.Text(), nullable=True),
    sa.Column('source', sa.String(length=50), nullable=True),
    sa.Column('source_url', sa.String(length=255), nullable=True),
    sa.Column('utm_source', sa.String(length=100), nullable=True),
    sa.Column('utm_medium', sa.String(length=100), nullable=True),
    sa.Column('utm_campaign', sa.String(length=100), nullable=True),
    sa.Column('utm_content', sa.String(length=100), nullable=True),
    sa.Column('ip_address', sa.String(length=45), nullable=True),
    sa.Column('device_type', sa.String(length=20), nullable=True),
    sa.Column('status', sa.String(length=30), nullable=False),
    sa.Column('assigned_counsellor_id', sa.Integer(), nullable=True),
    sa.Column('follow_up_date', sa.Date(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['assigned_counsellor_id'], ['counsellors.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['college_id'], ['colleges.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['state_id'], ['states.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['student_id'], ['student_profiles.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_enquiries_assigned_counsellor_id'), 'enquiries', ['assigned_counsellor_id'], unique=False)
    op.create_index(op.f('ix_enquiries_college_id'), 'enquiries', ['college_id'], unique=False)
    op.create_index(op.f('ix_enquiries_email'), 'enquiries', ['email'], unique=False)
    op.create_index(op.f('ix_enquiries_mobile'), 'enquiries', ['mobile'], unique=False)
    op.create_index(op.f('ix_enquiries_status'), 'enquiries', ['status'], unique=False)
    op.create_index(op.f('ix_enquiries_student_id'), 'enquiries', ['student_id'], unique=False)
    op.create_table('saved_colleges',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('student_id', sa.Integer(), nullable=False),
    sa.Column('college_id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['college_id'], ['colleges.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['student_id'], ['student_profiles.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('student_id', 'college_id', name='uq_saved_college_student')
    )
    op.create_index(op.f('ix_saved_colleges_college_id'), 'saved_colleges', ['college_id'], unique=False)
    op.create_index(op.f('ix_saved_colleges_student_id'), 'saved_colleges', ['student_id'], unique=False)
    op.create_table('lead_notes',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('enquiry_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('note', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['enquiry_id'], ['enquiries.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_lead_notes_enquiry_id'), 'lead_notes', ['enquiry_id'], unique=False)
    op.create_table('lead_status_history',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('enquiry_id', sa.Integer(), nullable=False),
    sa.Column('old_status', sa.String(length=30), nullable=True),
    sa.Column('new_status', sa.String(length=30), nullable=False),
    sa.Column('changed_by', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['changed_by'], ['users.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['enquiry_id'], ['enquiries.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_lead_status_history_enquiry_id'), 'lead_status_history', ['enquiry_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_lead_status_history_enquiry_id'), table_name='lead_status_history')
    op.drop_table('lead_status_history')
    op.drop_index(op.f('ix_lead_notes_enquiry_id'), table_name='lead_notes')
    op.drop_table('lead_notes')
    op.drop_index(op.f('ix_saved_colleges_student_id'), table_name='saved_colleges')
    op.drop_index(op.f('ix_saved_colleges_college_id'), table_name='saved_colleges')
    op.drop_table('saved_colleges')
    op.drop_index(op.f('ix_enquiries_student_id'), table_name='enquiries')
    op.drop_index(op.f('ix_enquiries_status'), table_name='enquiries')
    op.drop_index(op.f('ix_enquiries_mobile'), table_name='enquiries')
    op.drop_index(op.f('ix_enquiries_email'), table_name='enquiries')
    op.drop_index(op.f('ix_enquiries_college_id'), table_name='enquiries')
    op.drop_index(op.f('ix_enquiries_assigned_counsellor_id'), table_name='enquiries')
    op.drop_table('enquiries')
    op.drop_index(op.f('ix_consent_records_user_id'), table_name='consent_records')
    op.drop_index(op.f('ix_consent_records_consent_type'), table_name='consent_records')
    op.drop_table('consent_records')