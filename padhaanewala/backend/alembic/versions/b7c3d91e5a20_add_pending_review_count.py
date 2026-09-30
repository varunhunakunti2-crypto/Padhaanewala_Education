"""separate pending review answers from unattempted questions

Revision ID: b7c3d91e5a20
Revises: d5f2a8c71e63
Create Date: 2026-09-28

`test_attempts.unanswered_count` was computed as
`len(questions) - correct_count - incorrect_count`, which forced every answer the
autograder could not decide (essay, MCQ published without a key, numeric
published without a numeric_answer) into the "unanswered" bucket. A student who
wrote a full essay was reported as never having attempted the question, while
the essay still earned zero marks and carried no pending-review signal.

Adds a dedicated `pending_review_count` so the four tallies partition the paper
without overloading one of them:

    correct + incorrect + unanswered + pending_review == len(questions)

Existing rows are deliberately left NULL. Their `unanswered_count` already
mixes the two meanings, and the split cannot be reconstructed after the fact --
guessing would be worse than admitting the two are unknown.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b7c3d91e5a20"
down_revision: Union[str, Sequence[str], None] = "d5f2a8c71e63"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "test_attempts",
        sa.Column("pending_review_count", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("test_attempts", "pending_review_count")
