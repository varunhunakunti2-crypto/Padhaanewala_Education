"""add_phase9_compliance_tables

Revision ID: c7d4e9a1b308
Revises: 9f3c2a7e8d21
Create Date: 2026-10-02 09:00:00.000000

Phase 9 (DPDP legal and compliance). Three changes:

1. `users.age_band` / `users.is_minor` — the age declaration. An age *band*
   rather than a date of birth: the only question s.9 turns on is whether the
   user is under 18, and s.5(1)(ii) requires collecting no more than is
   necessary for that. `age_band` is nullable and NULL means "not answered",
   which is deliberately distinct from "18_plus" — an unanswered gate question
   read as consent is exactly how a gate becomes decorative.

   Backfill, and why it is conservative rather than optimistic: every existing
   account is set to `age_band = NULL`, i.e. *unverified*, not to `18_plus`.
   The alternative would be to assume every pre-existing account belongs to an
   adult, which is the assumption the whole phase exists to remove, and it
   would launder an unknown number of minors into a state the gate treats as
   consented. NULL makes them blocked and visible instead. The site is not yet
   deployed (Phase 8 is unstarted), so no real user is affected by this today;
   if that changes before deploy, these rows need a real re-consent campaign
   rather than a backfill assumption.

2. `guardian_consents` — verifiable parental consent. A row only reaches
   `verified` after a code is read back from the guardian's own channel, via
   `otp_records` with `purpose = 'guardian_consent'`. Status is a lifecycle
   because the states that matter are between "asked" and "yes", and
   `withdrawn_at` is a separate column rather than an overwrite, since the
   record of having consented is itself the compliance evidence.

3. `data_requests` — the s.8(5)-(6) request channel, with `due_at` computed at
   intake and indexed. The DPDP Rules 2025 90-day deadline is a stored column
   rather than something derived on read, because a deadline that moves when you
   look at it is not a deadline.

4. `enquiries.age_band` / `is_minor` / `guardian_contact` — the same age
   declaration on the *unauthenticated* admission form. `POST /api/v1/enquiries`
   needs no account, so the account-side gate cannot reach it, and it is the
   widest collector of minors' personal data on the site: a name, a mobile
   number, a course, a location and a free-text message from whoever wants a
   callback. Leaving the columns nullable matters only for rows that predate this
   migration; the schema requires the field on every new submission, so nothing
   can arrive undeclared.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c7d4e9a1b308"
down_revision: Union[str, Sequence[str], None] = "9f3c2a7e8d21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # --- 1. age declaration ------------------------------------------------
    op.add_column("users", sa.Column("age_band", sa.String(length=20), nullable=True))
    op.add_column(
        "users",
        sa.Column("is_minor", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index(op.f("ix_users_age_band"), "users", ["age_band"], unique=False)
    op.create_index(op.f("ix_users_is_minor"), "users", ["is_minor"], unique=False)

    # --- 4. age declaration on the public admission form -------------------
    # Applied before the tables below purely so the numbered comments read in the
    # order the operations run; there is no dependency either way.
    op.add_column(
        "enquiries", sa.Column("age_band", sa.String(length=20), nullable=True)
    )
    op.add_column(
        "enquiries",
        sa.Column("is_minor", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "enquiries", sa.Column("guardian_contact", sa.String(length=255), nullable=True)
    )
    op.create_index(
        op.f("ix_enquiries_age_band"), "enquiries", ["age_band"], unique=False
    )
    # The CRM view is "leads who are children", which is a filter on one column
    # over the whole lead table — without the index it is a sequential scan of
    # every enquiry ever taken, on the screen a counsellor has open while dialling.
    op.create_index(
        op.f("ix_enquiries_is_minor"), "enquiries", ["is_minor"], unique=False
    )

    # --- 2. verifiable parental consent ------------------------------------
    op.create_table(
        "guardian_consents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("guardian_name", sa.String(length=255), nullable=False),
        sa.Column("guardian_email", sa.String(length=255), nullable=True),
        sa.Column("guardian_mobile", sa.String(length=20), nullable=True),
        sa.Column("verification_channel", sa.String(length=20), nullable=False),
        sa.Column("verification_target", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("consent_version", sa.String(length=20), nullable=True),
        sa.Column("consent_text", sa.Text(), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("withdrawn_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("request_ip", sa.String(length=45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_guardian_consents_user_id"),
        "guardian_consents",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_guardian_consents_status"),
        "guardian_consents",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_guardian_consents_verification_target"),
        "guardian_consents",
        ["verification_target"],
        unique=False,
    )
    # The request path reads "the live row for this user, newest first".
    op.create_index(
        "ix_guardian_consents_user_status",
        "guardian_consents",
        ["user_id", "status"],
        unique=False,
    )

    # --- 3. data-principal requests ----------------------------------------
    op.create_table(
        "data_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("request_type", sa.String(length=30), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=True),
        sa.Column("details", sa.Text(), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution", sa.Text(), nullable=True),
        sa.Column("handled_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        # SET NULL, not CASCADE: the row records who closed a statutory request,
        # and an audit record that vanishes with its actor is not an audit record.
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["handled_by_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_data_requests_user_id"),
        "data_requests",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_data_requests_request_type"),
        "data_requests",
        ["request_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_data_requests_status"),
        "data_requests",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_data_requests_received_at"),
        "data_requests",
        ["received_at"],
        unique=False,
    )
    # The SLA sweep and the staff queue both scan "open, soonest deadline first".
    op.create_index(
        "ix_data_requests_status_due",
        "data_requests",
        ["status", "due_at"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_data_requests_status_due", table_name="data_requests")
    op.drop_index(op.f("ix_data_requests_received_at"), table_name="data_requests")
    op.drop_index(op.f("ix_data_requests_status"), table_name="data_requests")
    op.drop_index(
        op.f("ix_data_requests_request_type"), table_name="data_requests"
    )
    op.drop_index(op.f("ix_data_requests_user_id"), table_name="data_requests")
    op.drop_table("data_requests")

    op.drop_index(
        "ix_guardian_consents_user_status", table_name="guardian_consents"
    )
    op.drop_index(
        op.f("ix_guardian_consents_verification_target"),
        table_name="guardian_consents",
    )
    op.drop_index(op.f("ix_guardian_consents_status"), table_name="guardian_consents")
    op.drop_index(op.f("ix_guardian_consents_user_id"), table_name="guardian_consents")
    op.drop_table("guardian_consents")

    op.drop_index(op.f("ix_users_is_minor"), table_name="users")
    op.drop_index(op.f("ix_users_age_band"), table_name="users")
    op.drop_column("users", "is_minor")
    op.drop_column("users", "age_band")

    op.drop_index(op.f("ix_enquiries_is_minor"), table_name="enquiries")
    op.drop_index(op.f("ix_enquiries_age_band"), table_name="enquiries")
    op.drop_column("enquiries", "guardian_contact")
    op.drop_column("enquiries", "is_minor")
    op.drop_column("enquiries", "age_band")
