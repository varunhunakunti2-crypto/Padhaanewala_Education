"""Add the public college-suggestion submission queue.

    Revision ID: a9c4e2f7b601
    Revises: e6b2f4a90c31
    Create Date: 2026-10-16 00:00:00.000000

Adds `college_submissions`, the staging table behind the "suggest a college"
workflow. A submission is a proposal, never a college: the only way a row here
becomes a published `colleges` record is an explicit, audited admin approval
that materialises the college. Nothing in this table is `NOT NULL` beyond the
bare minimum (`proposed_name`), because a suggestion is allowed to be partial —
the reviewer fills the gaps, not the submitter.

`submitted_by`, `reviewer_id` and `college_id` are all `ON DELETE SET NULL`: a
submission is evidence of a proposal and of who reviewed it, so deleting a user
or a college must not erase the row. That is the opposite of the `reviews`
cascade, and it is deliberate — a review is only meaningful against the college
it rates, whereas a submission stands on its own.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a9c4e2f7b601"
down_revision: str | Sequence[str] | None = "e6b2f4a90c31"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "college_submissions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("submitted_by", sa.Integer(), nullable=True),
        sa.Column("proposed_name", sa.String(length=255), nullable=False),
        sa.Column("proposed_official_name", sa.String(length=255), nullable=True),
        sa.Column("proposed_college_type", sa.String(length=50), nullable=True),
        sa.Column("proposed_ownership", sa.String(length=50), nullable=True),
        sa.Column("proposed_university_name", sa.String(length=255), nullable=True),
        sa.Column("proposed_state_id", sa.Integer(), nullable=True),
        sa.Column("proposed_state_name", sa.String(length=100), nullable=True),
        sa.Column("proposed_city", sa.String(length=100), nullable=True),
        sa.Column("proposed_address", sa.Text(), nullable=True),
        sa.Column("proposed_website", sa.String(length=255), nullable=True),
        sa.Column("proposed_email", sa.String(length=255), nullable=True),
        sa.Column("proposed_phone", sa.String(length=20), nullable=True),
        sa.Column("proposed_overview", sa.Text(), nullable=True),
        sa.Column("submitter_notes", sa.Text(), nullable=True),
        sa.Column(
            "status", sa.String(length=20), nullable=False, server_default="pending"
        ),
        sa.Column("reviewer_id", sa.Integer(), nullable=True),
        sa.Column("reviewer_notes", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("college_id", sa.Integer(), nullable=True),
        sa.Column("possible_duplicate_college_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["submitted_by"], ["users.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["proposed_state_id"], ["states.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["reviewer_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["college_id"], ["colleges.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["possible_duplicate_college_id"], ["colleges.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_college_submissions_submitted_by"),
        "college_submissions",
        ["submitted_by"],
        unique=False,
    )
    op.create_index(
        op.f("ix_college_submissions_proposed_name"),
        "college_submissions",
        ["proposed_name"],
        unique=False,
    )
    op.create_index(
        op.f("ix_college_submissions_proposed_state_id"),
        "college_submissions",
        ["proposed_state_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_college_submissions_status"),
        "college_submissions",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_college_submissions_college_id"),
        "college_submissions",
        ["college_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_college_submissions_college_id"), table_name="college_submissions"
    )
    op.drop_index(
        op.f("ix_college_submissions_status"), table_name="college_submissions"
    )
    op.drop_index(
        op.f("ix_college_submissions_proposed_state_id"),
        table_name="college_submissions",
    )
    op.drop_index(
        op.f("ix_college_submissions_proposed_name"), table_name="college_submissions"
    )
    op.drop_index(
        op.f("ix_college_submissions_submitted_by"), table_name="college_submissions"
    )
    op.drop_table("college_submissions")
