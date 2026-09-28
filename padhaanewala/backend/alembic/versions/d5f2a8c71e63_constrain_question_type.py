"""constrain question_type on mock_tests and test_questions

Revision ID: d5f2a8c71e63
Revises: a7e4c1b93d02
Create Date: 2026-09-28 12:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d5f2a8c71e63"
down_revision: Union[str, Sequence[str], None] = "a7e4c1b93d02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Spelled out rather than imported from app.question_types on purpose: a
# migration must produce the same schema it produced when it was written. If
# the enum later gains a member, importing it here would silently rewrite the
# meaning of an old revision. tests/test_question_types.py asserts this tuple
# still matches app.question_types.ALL_QUESTION_TYPES.
ALLOWED_QUESTION_TYPES: tuple[str, ...] = ("mcq", "numeric", "essay")

_TABLES = ("mock_tests", "test_questions")


def _allowed_sql() -> str:
    """The allowed set as a SQL literal list."""
    return ", ".join(f"'{value}'" for value in ALLOWED_QUESTION_TYPES)


def upgrade() -> None:
    """Upgrade schema."""
    # Normalise before constraining, not after. The realistic corruption is a
    # case or stray-whitespace variant -- "MCQ", " Numeric" -- which is a typo
    # with an obvious intent, so it is repaired here rather than failing the
    # migration. Anything genuinely unrecognised ("numerical", "fill in the
    # blank") is left alone so that ADD CONSTRAINT below aborts loudly and a
    # human decides: silently mapping those to a default type would mis-grade
    # real questions.
    allowed = _allowed_sql()
    for table in _TABLES:
        op.execute(
            f"""
            UPDATE {table}
               SET question_type = lower(btrim(question_type))
             WHERE question_type IS NOT NULL
               AND question_type <> lower(btrim(question_type))
            """
        )
        op.create_check_constraint(
            f"ck_{table}_question_type",
            table,
            f"question_type IN ({allowed})",
        )


def downgrade() -> None:
    """Downgrade schema."""
    for table in _TABLES:
        op.drop_constraint(f"ck_{table}_question_type", table, type_="check")
