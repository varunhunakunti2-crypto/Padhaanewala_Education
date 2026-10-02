"""DPDP Act, 2023 — data-principal rights: retention, erasure and the 90-day SLA.

Section 8(2) requires a Data Fiduciary to erase personal data once the purpose
for processing is served, and s.8(5) gives the data principal the right to have
that erasure carried out on request. Neither happens on its own: nothing in this
codebase had a sweeper, so every expired code, dead session and withdrawn consent
was sitting in the database indefinitely and growing.

**Dry run is the default.** `--apply` is required to change anything. A retention
job that is safe to run by accident is a retention job nobody runs, and one that
is destructive on first contact is a retention job nobody runs twice.

    python scripts/retention_sweep.py                     # report only
    python scripts/retention_sweep.py --apply             # do it
    python scripts/retention_sweep.py --apply --limit 50  # small batch first

Run it from cron. There is no scheduler in this project (no Celery, no APScheduler
— `.env.example` records the removal), so the host timer is the mechanism and
`docker-entrypoint.sh` deliberately does **not** run this: a container that
restarts must not silently erase anybody's data.

What each step is allowed to do, and why:

* **OTP records** are purged by expiry alone. A code that has expired can never be
  verified again — `otp_service` checks the timestamp on every read — so keeping
  it serves no purpose and the `code_hash` is a credential-shaped string.
* **Refresh tokens** are purged by expiry. A revoked *live* token is not touched:
  the reuse-detection ledger is evidence, and Phase 3's whole argument is that a
  revoked token must stay findable.
* **Consent records are never deleted.** `withdrawn_at` is the compliance record,
  and s.9(5) requires the withdrawal to be demonstrable. Retaining them past the
  child reaching 18 is deliberate.
* **Audit logs** are purged on a long horizon, because they are the forensic
  trail a Phase 9.3 breach report is reconstructed from.
* **Anonymised users** are the s.8(2) erasure path: the row survives with its
  identifiers destroyed, because `audit_logs.user_id` is SET NULL and a foreign
  key cascade would take the audit trail with it.
"""

import argparse
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Allow `python scripts/retention_sweep.py` from any working directory: the repo
# root (which contains the `app` package) is not on sys.path by default, because
# Python puts the *script's* directory there instead.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import func, select, text  # noqa: E402

from app.config import settings  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models import (  # noqa: E402
    AuditLog,
    GuardianConsent,
    OtpRecord,
    RefreshToken,
    User,
)
from app.models.data_request import OPEN_STATUSES, DataRequest  # noqa: E402

#: How long a dead OTP row is kept before the sweep removes it. Not zero: a code
#: is only purged once it has been expired for long enough that no in-flight
#: request could still be verifying against it.
OTP_GRACE_DAYS = 7

#: Audit logs are the evidence a breach report and every privilege escalation
#: investigation is built from. Two years is the longest horizon DPDP or the IT
#: Rules contemplate for a consumer-facing product, and it is *long* on purpose.
AUDIT_RETENTION_DAYS = 730

#: A user who has asked to be erased has their identifiers destroyed this long
#: after the request was marked completed, rather than instantly — the grace
#: window is what makes an accidental or fraudulent erasure request recoverable.
ERASURE_GRACE_DAYS = 30


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _cutoff(days: int) -> datetime:
    return _now() - timedelta(days=days)


def _count(db, stmt) -> int:
    return db.scalar(select(func.count()).select_from(stmt.subquery())) or 0


def _report(label: str, count: int, apply: bool, limit: int | None) -> int:
    """Print one step's result, honouring `--limit` honestly.

    The cap has to change the query, not the printed number. A `--limit` that
    only edited the output would report a truthful count and then have deleted
    more rows than the operator asked for, which is the one behaviour a
    destructive script must not have.
    """
    shown = count if limit is None else min(count, limit)
    suffix = f" (of {count}, capped by --limit)" if shown != count else ""
    print(f"  {label:32s} {shown}{suffix}")
    return shown


# --------------------------------------------------------------------- steps


def plan_expired_otps(db, apply: bool, limit: int | None = None) -> int:
    """Rows whose code expired more than `OTP_GRACE_DAYS` ago."""
    cutoff = _cutoff(OTP_GRACE_DAYS)
    stmt = select(OtpRecord).where(OtpRecord.expires_at < cutoff)
    if not apply:
        return _report("expired OTP records", _count(db, stmt), apply, limit)
    query = db.query(OtpRecord).filter(OtpRecord.expires_at < cutoff)
    if limit is not None:
        query = query.limit(limit)
    deleted = query.delete(synchronize_session=False)
    db.commit()
    return _report("expired OTP records", deleted, apply, limit)


def plan_expired_refresh_tokens(db, apply: bool, limit: int | None = None) -> int:
    """Refresh tokens past their own expiry.

    Revoked tokens are deliberately *not* eligible: the reuse-detection ledger
    only works while a revoked row is still findable.
    """
    cutoff = _cutoff(1)
    stmt = select(RefreshToken).where(RefreshToken.expires_at < cutoff)
    if not apply:
        return _report("expired refresh tokens", _count(db, stmt), apply, limit)
    query = db.query(RefreshToken).filter(RefreshToken.expires_at < cutoff)
    if limit is not None:
        query = query.limit(limit)
    deleted = query.delete(synchronize_session=False)
    db.commit()
    return _report("expired refresh tokens", deleted, apply, limit)


def plan_stale_audit_logs(db, apply: bool, limit: int | None = None) -> int:
    cutoff = _cutoff(AUDIT_RETENTION_DAYS)
    stmt = select(AuditLog).where(AuditLog.created_at < cutoff)
    if not apply:
        return _report("stale audit logs", _count(db, stmt), apply, limit)
    query = db.query(AuditLog).filter(AuditLog.created_at < cutoff)
    if limit is not None:
        query = query.limit(limit)
    deleted = query.delete(synchronize_session=False)
    db.commit()
    return _report("stale audit logs", deleted, apply, limit)


def plan_expired_guardian_consents(db, apply: bool, limit: int | None = None) -> int:
    """Mark lapsed consents `expired`.

    A status change, never a delete — these rows are the evidence that consent
    was once given, and s.9(5) requires the lapse to be demonstrable. The flag is
    what `compliance_service` reads to stop processing.
    """
    stmt = (
        select(GuardianConsent)
        .where(
            GuardianConsent.status == "verified",
            GuardianConsent.expires_at < _now(),
        )
        .limit(limit)
        if limit is not None
        else select(GuardianConsent).where(
            GuardianConsent.status == "verified",
            GuardianConsent.expires_at < _now(),
        )
    )
    rows = db.scalars(stmt).all()
    if apply:
        for row in rows:
            row.status = "expired"
        db.commit()
    return _report("lapsed guardian consents", len(rows), apply, limit)


def report_sla(db, apply: bool) -> None:
    """Open data-principal requests, most urgent first.

    Reported rather than actioned. The sweep's job is to make a breach
    *visible*; the response itself is a human decision, and a job that closed
    requests automatically would be closing them wrongly.
    """
    now = _now()
    warn = now + timedelta(days=settings.DATA_REQUEST_WARN_DAYS)
    rows = db.execute(
        text(
            "SELECT id, user_id, request_type, due_at FROM data_requests "
            "WHERE status = ANY(:open) ORDER BY due_at ASC"
        ),
        {"open": list(OPEN_STATUSES)},
    ).all()

    for row in rows:
        due = _aware(row.due_at)
        if due < now:
            print(
                f"  BREACH   request #{row.id} ({row.request_type}) for user "
                f"{row.user_id} was due {due.date()} — the "
                f"{settings.DATA_REQUEST_SLA_DAYS}-day deadline has passed"
            )
        elif due <= warn:
            print(
                f"  due in {(due - now).days}d  request #{row.id} "
                f"({row.request_type}) for user {row.user_id}"
            )

    if not rows:
        print("  no open requests")


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


#: Matches the placeholder `anonymise_erased_users` writes. `invalid.` is a
#: reserved TLD (RFC 2606) that can never resolve, so an anonymised address cannot
#: reach a real mailbox even if something tried to send to it.
_ANONYMISED_EMAIL = "erased-%s@invalid.padhaanewala"


def anonymise_erased_users(db, apply: bool, limit: int | None = None) -> int:
    """Destroy the identifiers of accounts whose erasure request is complete.

    The row itself survives on purpose. `audit_logs.user_id` is ON DELETE SET
    NULL, so deleting the user would not take the audit trail with it — but it
    would leave every audit row pointing at a missing actor, and the record of
    *who* did what is the part that has evidentiary value.

    A user with no completed erasure request is never touched, whatever else is
    true about them. This step is not a "clean up inactive accounts" job; that
    would be a retention policy nobody asked for, applied to data nobody
    requested deleting. The `~like` filter is what makes the step idempotent:
    without it a second sweep would "anonymise" the same rows again and report
    them as newly processed.
    """
    # A proper subquery rather than a raw `text()` join: `count()` over a joined
    # `TextClause` is not selectable, so the dry run cannot report this step's
    # size — and a step that cannot be counted before it runs is a step nobody
    # would run for the first time.
    erased = (
        select(DataRequest.user_id)
        .where(
            DataRequest.request_type == "erasure",
            DataRequest.status == "completed",
        )
        .distinct()
        .subquery()
    )
    stmt = (
        select(User)
        .join(erased, erased.c.user_id == User.id)
        .where(~User.email.like(_ANONYMISED_EMAIL))
    )
    if limit is not None:
        stmt = stmt.limit(limit)

    if not apply:
        return _report("anonymised erasure requests", _count(db, stmt), apply, limit)

    rows = db.scalars(stmt).all()
    for user in rows:
        user.email = _ANONYMISED_EMAIL % user.id
        # `0000000000` is not a dialable Indian mobile and cannot collide with a
        # real number, because the accounts that were here already had one and
        # are the only rows being rewritten.
        user.mobile = "0000000000"
        user.is_active = False
        user.password_hash = "!anonymised"
        user.is_email_verified = False
        user.is_mobile_verified = False
        user.age_band = None
        profile = user.student_profile
        if profile is not None:
            profile.name = "Erased"
            profile.education_level = None
            profile.course_interest = None
            profile.preferred_state = None
            profile.preferred_city = None
            profile.budget_min = None
            profile.budget_max = None
        for consent in user.guardian_consents:
            consent.guardian_name = "Erased"
            consent.guardian_email = None
            consent.guardian_mobile = None
    db.commit()
    return _report("anonymised erasure requests", len(rows), apply, limit)


# ---------------------------------------------------------------------- main


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually make the changes. Without this the script only reports.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Cap the rows touched per step. Use for a first careful run.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    mode = "APPLY" if args.apply else "DRY RUN (nothing will be changed)"
    print(f"== retention sweep: {mode} ==")
    print(f"   SLA deadline {settings.DATA_REQUEST_SLA_DAYS}d, "
          f"warning at {settings.DATA_REQUEST_WARN_DAYS}d")
    print(f"   audit retention {AUDIT_RETENTION_DAYS}d, "
          f"OTP grace {OTP_GRACE_DAYS}d\n")

    with SessionLocal() as db:
        steps = (
            ("expired OTP records", plan_expired_otps),
            ("expired refresh tokens", plan_expired_refresh_tokens),
            ("lapsed guardian consents", plan_expired_guardian_consents),
            ("stale audit logs", plan_stale_audit_logs),
            ("anonymised erasure requests", anonymise_erased_users),
        )
        total = 0
        for label, step in steps:
            try:
                total += step(db, args.apply, args.limit)
            except Exception as exc:  # noqa: BLE001
                # One failing step must not abandon the rest: the SLA report below
                # is the part that matters most, and a session-wide abort would
                # lose it. The rollback keeps earlier work from half-committing.
                db.rollback()
                print(f"  {label:32s} FAILED: {type(exc).__name__}: {exc}")

        print("\n== data-principal request SLA ==")
        report_sla(db, args.apply)

    print(f"\n{'Applied' if args.apply else 'Would change'} {total} row(s).")
    if not args.apply:
        print("Re-run with --apply to make these changes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
