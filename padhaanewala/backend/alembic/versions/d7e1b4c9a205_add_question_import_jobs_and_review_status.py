"""Draft questions from an uploaded PDF, reviewed by an admin before they ship.

    Revision ID: d7e1b4c9a205
    Revises: c2a7e9f4b613
    Create Date: 2026-10-05 12:00:00.000000

Adds the review gate that makes the PDF import safe to have at all.

`POST /question-imports/pdf` runs a language model over a question paper and
writes what it produces straight into `test_questions`. That is a problem on its
own: the autograder reads the same table, the paper listing reads it, and the
student's paper is built from it. A model that mislabels option `c` as correct
would mark every student wrong on that question and nothing anywhere would say so.

So every question now carries `review_status`, and the rule is one line: **a
question reaches a student only when it is `approved`.**

`approved` is the column default. That is the whole migration strategy -- the 75
seeded questions, the existing test papers and every hand-authored question keep
their published state without a single row being touched, and there is no window
in which the column is NULL and a student-facing query has to decide what NULL
means. Only `pdf_ai` questions are ever born `pending`.

`source` and `import_job_id` are the provenance: which questions came from the
model, and which upload produced them. `import_job_id` is `ON DELETE SET NULL`
so discarding a job does not remove questions an admin has already approved, and
so deleting the admin account does not delete the content they authored (the same
reason `test_answers.graded_by` is SET NULL).

`question_import_jobs` is the batch header. It exists because an AI draft has to
survive the request that produced it: without it there is nothing for the admin
panel to show when an editor comes back to review, and regenerating on demand
returns something different each time. `status` carries `failed` as a real state
rather than only an exception, because "your key is wrong" and "this PDF has no
extractable text" are both things an admin needs to be told in words.

CHECK constraints match the enum vocabulary in `app/models/question_import.py`,
for the reason the existing `question_type` CHECK exists: rows still arrive by
hand and by script, and a typo there is silent.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "d7e1b4c9a205"
down_revision: Union[str, Sequence[str], None] = "c2a7e9f4b613"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # The batch header first: `test_questions.import_job_id` points at it.
    op.create_table(
        "question_import_jobs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("mock_test_id", sa.Integer(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("page_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("text_length", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "status", sa.String(length=20), nullable=False, server_default="processing"
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("draft_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("approved_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rejected_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "status IN ('processing', 'ready', 'failed')", name="ck_qij_status"
        ),
        sa.ForeignKeyConstraint(
            ["mock_test_id"],
            ["mock_tests.id"],
            ondelete="CASCADE",
            name="question_import_jobs_mock_test_id_fkey",
        ),
        # SET NULL on `created_by`: deleting a staff account must not delete the
        # record of content they authored.
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            ondelete="SET NULL",
            name="question_import_jobs_created_by_fkey",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_question_import_jobs_mock_test_id"),
        "question_import_jobs",
        ["mock_test_id"],
    )
    op.create_index(
        op.f("ix_question_import_jobs_created_by"),
        "question_import_jobs",
        ["created_by"],
    )
    op.create_index(
        op.f("ix_question_import_jobs_status"), "question_import_jobs", ["status"]
    )

    op.add_column(
        "test_questions",
        sa.Column(
            "review_status",
            sa.String(length=20),
            nullable=False,
            # The default is what publishes the existing bank without touching it.
            # Stated as a server_default as well as the ORM default so a row
            # inserted by a script that does not know about this column is
            # approved rather than NULL -- and NULL is not in the CHECK, so it
            # would be rejected outright.
            server_default="approved",
        ),
    )
    op.add_column(
        "test_questions",
        sa.Column("source", sa.String(length=20), nullable=False, server_default="manual"),
    )
    op.add_column(
        "test_questions",
        sa.Column("import_job_id", sa.Integer(), nullable=True),
    )
    op.create_check_constraint(
        "ck_test_questions_review_status",
        "test_questions",
        "review_status IN ('approved', 'pending', 'rejected')",
    )
    op.create_check_constraint(
        "ck_test_questions_source",
        "test_questions",
        "source IN ('manual', 'pdf_ai')",
    )
    op.create_foreign_key(
        "test_questions_import_job_id_fkey",
        "test_questions",
        "question_import_jobs",
        ["import_job_id"],
        ["id"],
        # SET NULL so discarding a job leaves approved questions standing, and so
        # deleting a job is never able to remove published content.
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_test_questions_review_status"), "test_questions", ["review_status"]
    )
    op.create_index(op.f("ix_test_questions_source"), "test_questions", ["source"])
    op.create_index(
        op.f("ix_test_questions_import_job_id"), "test_questions", ["import_job_id"]
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_test_questions_import_job_id"), table_name="test_questions")
    op.drop_index(op.f("ix_test_questions_source"), table_name="test_questions")
    op.drop_index(op.f("ix_test_questions_review_status"), table_name="test_questions")
    op.drop_constraint(
        "test_questions_import_job_id_fkey", "test_questions", type_="foreignkey"
    )
    op.drop_constraint(
        "ck_test_questions_source", "test_questions", type_="check"
    )
    op.drop_constraint(
        "ck_test_questions_review_status", "test_questions", type_="check"
    )
    op.drop_column("test_questions", "import_job_id")
    op.drop_column("test_questions", "source")
    op.drop_column("test_questions", "review_status")

    op.drop_index(op.f("ix_question_import_jobs_status"), table_name="question_import_jobs")
    op.drop_index(
        op.f("ix_question_import_jobs_created_by"), table_name="question_import_jobs"
    )
    op.drop_index(
        op.f("ix_question_import_jobs_mock_test_id"), table_name="question_import_jobs"
    )
    op.drop_table("question_import_jobs")
