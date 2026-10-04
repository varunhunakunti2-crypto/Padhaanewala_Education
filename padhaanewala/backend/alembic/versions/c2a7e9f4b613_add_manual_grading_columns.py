"""add_manual_grading_columns

Revision ID: c2a7e9f4b613
Revises: b4e8f2a71d09
Create Date: 2026-10-04 10:00:00.000000

`_grade_attempt` routes an `essay` to `pending_review_count` and leaves
`test_answers.is_correct` and `marks_awarded` NULL, because there is nothing in
the paper to compare a written answer against. That was half a design: the
attempt recorded that a verdict was owed, and no code anywhere could ever pay
it. The essay stayed at zero marks for the life of the account, the attempt's
total silently excluded it, and `pending_review_count` was a number that only
ever went down when the question was deleted.

These three columns are the missing write path. `graded_by` / `graded_at`
record who marked the work and when, which is what turns an unexplained mark
into a reviewable decision; `grader_feedback` carries the explanation to the
student, on the only question type where the answer key cannot speak for
itself.

`graded_by` is ON DELETE SET NULL on purpose. Deleting a staff account must not
delete the evidence that somebody marked the work -- the verdict and the marks
are the record, the identity is provenance, and provenance that outlives the
account it names is strictly better than a hole in the middle of an exam
result.

Existing rows stay NULL, which reads as "never manually graded" and is correct
for every row that exists today.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c2a7e9f4b613"
down_revision: Union[str, Sequence[str], None] = "b4e8f2a71d09"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "test_answers",
        sa.Column("graded_by", sa.Integer(), nullable=True),
    )
    op.add_column(
        "test_answers",
        sa.Column("graded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "test_answers",
        sa.Column("grader_feedback", sa.Text(), nullable=True),
    )
    op.create_foreign_key(
        "test_answers_graded_by_fkey",
        "test_answers",
        "users",
        ["graded_by"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("test_answers_graded_by_fkey", "test_answers", type_="foreignkey")
    op.drop_column("test_answers", "grader_feedback")
    op.drop_column("test_answers", "graded_at")
    op.drop_column("test_answers", "graded_by")
