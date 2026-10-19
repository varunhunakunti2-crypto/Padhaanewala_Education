"""Add the proctoring session and event tables.

    Revision ID: c4d8e1a7f203
    Revises: a9c4e2f7b601
    Create Date: 2026-10-16 00:00:00.000000

`app/models/proctoring.py` defines `ProctoringSession` and `ProctoringEvent`
(Phases 23-28, the secure proctored examination mode), and
`app/models/__init__.py` imports them, but no migration ever created the
tables. The models were therefore ahead of the schema: every `TestAttempt`
carries a `proctoring_session` backref, and anything that deletes an attempt
(for example `MockTest` teardown, which cascades to its attempts) makes
SQLAlchemy load that relationship to settle the foreign key -- against a table
that did not exist. The result was `UndefinedTable: relation
"proctoring_sessions" does not exist` across the whole mock-test and grading
suite, and the same failure would have hit production the first time an
attempt was deleted.

The two tables are created here in dependency order: sessions first (referenced
by events), events second. All three foreign keys are `ON DELETE CASCADE` --
a proctoring session is meaningless without its attempt, user and mock test,
and its recorded events are meaningless without the session -- matching the
`ondelete` declarations in the model. `attempt_id` carries a **unique** index
because a proctoring session is 1:1 with an attempt (`unique=True, index=True`
in the model collapses to a single unique index). The `started_at`,
`created_at` and `updated_at` timestamps are supplied by the ORM's Python-side
defaults rather than a server default, exactly as declared on the model.

The check constraints are spelled out as literals rather than imported from
`app.models.proctoring`, because a migration records history: importing the
live constant would silently rewrite what this revision does the next time the
enum grows.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c4d8e1a7f203"
down_revision: str | Sequence[str] | None = "a9c4e2f7b601"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

#: Frozen copy of the event-type and severity vocabularies as of this revision.
EVENT_TYPES = (
    "FACE_NOT_DETECTED",
    "MULTIPLE_FACES",
    "TAB_SWITCH",
    "WINDOW_BLUR",
    "FULLSCREEN_EXIT",
    "SCREEN_SHARE_STOPPED",
    "SCREEN_SHARE_SURFACE_CHANGED",
    "COPY_BLOCKED",
    "PASTE_BLOCKED",
    "CONTEXT_MENU_BLOCKED",
    "PERMISSION_REVOKED",
    "AUTO_SUBMIT",
    "CAMERA_DISCONNECTED",
    "MIC_DISCONNECTED",
    "SCREEN_SHARE_DISCONNECTED",
    "FULL_ATTENTION_LOST",
    "FULL_ATTENTION_REGAINED",
    "NO_STUDENT",
    "MULTIPLE_STUDENTS",
    "ANSWER_SAVED",
    "EXAM_STARTED",
    "EXAM_ENDED",
    "EXAM_SUBMITTED",
    "SCREEN_RECORDING_STOPPED",
    "SECONDARY_DISPLAY_DETECTED",
)

SEVERITIES = ("low", "medium", "high", "critical")


def _quoted(values: tuple[str, ...]) -> str:
    return ", ".join(repr(value) for value in values)


def upgrade() -> None:
    op.create_table(
        "proctoring_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("attempt_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("mock_test_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ended_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["attempt_id"], ["test_attempts.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["mock_test_id"], ["mock_tests.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            "status IN ('active', 'ended')",
            name="ck_proctoring_sessions_status",
        ),
    )
    op.create_index(
        op.f("ix_proctoring_sessions_attempt_id"),
        "proctoring_sessions",
        ["attempt_id"],
        unique=True,
    )
    op.create_index(
        op.f("ix_proctoring_sessions_user_id"),
        "proctoring_sessions",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_proctoring_sessions_mock_test_id"),
        "proctoring_sessions",
        ["mock_test_id"],
        unique=False,
    )

    op.create_table(
        "proctoring_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("remaining_seconds", sa.Integer(), nullable=True),
        sa.Column("detail", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["session_id"], ["proctoring_sessions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint(
            f"event_type IN ({_quoted(EVENT_TYPES)})",
            name="ck_proctoring_events_event_type",
        ),
        sa.CheckConstraint(
            f"severity IN ({_quoted(SEVERITIES)})",
            name="ck_proctoring_events_severity",
        ),
    )
    op.create_index(
        op.f("ix_proctoring_events_session_id"),
        "proctoring_events",
        ["session_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_proctoring_events_session_id"), table_name="proctoring_events"
    )
    op.drop_table("proctoring_events")
    op.drop_index(
        op.f("ix_proctoring_sessions_mock_test_id"), table_name="proctoring_sessions"
    )
    op.drop_index(
        op.f("ix_proctoring_sessions_user_id"), table_name="proctoring_sessions"
    )
    op.drop_index(
        op.f("ix_proctoring_sessions_attempt_id"), table_name="proctoring_sessions"
    )
    op.drop_table("proctoring_sessions")
