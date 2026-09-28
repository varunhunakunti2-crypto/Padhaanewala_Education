"""add question subject, topic, numeric answer and tolerance

Revision ID: a7e4c1b93d02
Revises: b4e91d7a2c58
Create Date: 2026-09-28 10:14:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a7e4c1b93d02"
down_revision: Union[str, Sequence[str], None] = "b4e91d7a2c58"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # `tolerance` is NOT NULL, so it is added with a server default that Postgres
    # backfills atomically (PG 11+, and the project targets 16). That default is
    # dropped again below purely so the column ends up exactly as the model
    # declares it -- `default=0` is client-side, and leaving a server_default here
    # would show up as drift the next time anyone runs autogenerate.
    op.add_column(
        "test_questions",
        sa.Column("subject", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "test_questions",
        sa.Column("topic", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "test_questions",
        sa.Column("numeric_answer", sa.Numeric(precision=12, scale=4), nullable=True),
    )
    op.add_column(
        "test_questions",
        sa.Column(
            "tolerance",
            sa.Numeric(precision=8, scale=4),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )

    # Backfill: a question that predates this column belonged to whatever subject
    # its paper was filed under. Only fills NULLs, so it cannot overwrite a
    # per-question subject that was already curated for a mixed-section paper.
    op.execute(
        """
        UPDATE test_questions AS q
           SET subject = m.subject
          FROM mock_tests AS m
         WHERE m.id = q.mock_test_id
           AND q.subject IS NULL
        """
    )

    op.alter_column("test_questions", "tolerance", server_default=None)
    op.create_index(
        op.f("ix_test_questions_subject"), "test_questions", ["subject"], unique=False
    )
    op.create_index(
        op.f("ix_test_questions_topic"), "test_questions", ["topic"], unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_test_questions_topic"), table_name="test_questions")
    op.drop_index(op.f("ix_test_questions_subject"), table_name="test_questions")
    op.drop_column("test_questions", "tolerance")
    op.drop_column("test_questions", "numeric_answer")
    op.drop_column("test_questions", "topic")
    op.drop_column("test_questions", "subject")
