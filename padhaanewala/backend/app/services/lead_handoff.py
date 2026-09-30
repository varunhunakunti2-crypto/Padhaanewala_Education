"""Enquiry -> lead hand-off.

`POST /api/v1/enquiries` captures a public, unauthenticated lead. On its own
that leaves a row nobody owns: Phase 25's gate is "enquiry creates a lead /
admin sees new lead", and an unowned, unannounced enquiry is neither. This
module is the missing step, called by the router right after the enquiry is
committed.

Two things happen:

1. The enquiry is assigned to the least-loaded active counsellor (round-robin
   by open-lead count). When every counsellor is at `max_leads` the enquiry
   stays unassigned and only the admins hear about it — spec §39 calls this
   "overflow to admin".
2. An in-app `Notification` is written for every active admin, and for the
   assigned counsellor when there is one, so the lead is pushed to somebody
   instead of waiting to be discovered.
"""

import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Counsellor, Enquiry, Notification, Role, User, user_roles
from app.roles import ADMIN_ROLES

logger = logging.getLogger(__name__)

#: Statuses that close a lead. An enquiry in one of these no longer counts
#: towards a counsellor's workload, so it neither consumes round-robin capacity
#: nor blocks a later assignment. `routers/leads.py` imports this rather than
#: repeating the list, so the admin's manual assign and the automatic one
#: always agree on what "full" means.
CLOSED_LEAD_STATUSES: tuple[str, ...] = ("won", "lost", "closed")

#: Notification discriminators, so an inbox can be filtered by origin.
NOTIFICATION_NEW_LEAD = "new_lead"
NOTIFICATION_LEAD_ASSIGNED = "lead_assigned"

#: `notifications.title` / `.message` column widths. `enquiries.name` is
#: VARCHAR(255) and the lead prefix pushes past the title limit on its own, so
#: the text is clipped rather than trusted — an over-long name is a student who
#: typed a lot, not a reason to lose the alert that tells somebody about them.
TITLE_LIMIT = 255
MESSAGE_LIMIT = 1000


def _clip(value: str, limit: int) -> str:
    return value if len(value) <= limit else value[: limit - 1] + "…"


def _open_lead_counts(db: Session) -> dict[int, int]:
    """Open-lead count per counsellor id. Counsellors with none are absent."""
    rows = db.execute(
        select(Enquiry.assigned_counsellor_id, func.count(Enquiry.id))
        .where(
            Enquiry.assigned_counsellor_id.is_not(None),
            Enquiry.status.notin_(CLOSED_LEAD_STATUSES),
        )
        .group_by(Enquiry.assigned_counsellor_id)
    ).all()
    return {counsellor_id: count for counsellor_id, count in rows}


def counsellor_loads(db: Session) -> dict[int, int]:
    """Open-lead count for every counsellor, defaulting to 0.

    Used by the counsellor listing endpoint so the admin console can render
    "12 / 100" next to each name instead of asking the admin to guess.
    """
    counts = _open_lead_counts(db)
    ids = db.scalars(select(Counsellor.id)).all()
    return {counsellor_id: counts.get(counsellor_id, 0) for counsellor_id in ids}


def pick_counsellor(db: Session) -> Counsellor | None:
    """The least-loaded active counsellor with headroom, or ``None``.

    Ties break on the lowest id, so a given enquiry always lands on the same
    counsellor for the same database state. Letting the planner pick the winner
    would mean two concurrent enquiries could silently go to different people
    with identical load, which is the opposite of round-robin.
    """
    active = db.scalars(
        select(Counsellor)
        .where(Counsellor.is_active.is_(True))
        .order_by(Counsellor.id)
    ).all()
    if not active:
        return None

    counts = _open_lead_counts(db)
    with_headroom = [c for c in active if counts.get(c.id, 0) < c.max_leads]
    if not with_headroom:
        return None
    return min(with_headroom, key=lambda c: (counts.get(c.id, 0), c.id))


def _active_admin_ids(db: Session) -> list[int]:
    """Ids of every active user holding an admin role.

    Goes through the ``user_roles`` join table rather than reading
    ``User.roles`` so this stays one query and cannot lazy-load once per
    candidate user. ``roles.py`` remains the only place that decides which role
    names count as admin.
    """
    return list(
        db.scalars(
            select(User.id)
            .join(user_roles, user_roles.c.user_id == User.id)
            .join(Role, Role.id == user_roles.c.role_id)
            .where(User.is_active.is_(True), Role.name.in_(ADMIN_ROLES))
            .distinct()
        ).all()
    )


def promote_enquiry_to_lead(db: Session, enquiry: Enquiry) -> Counsellor | None:
    """Assign `enquiry` and announce it. Commits its own work.

    Commits separately from the enquiry insert on purpose. Lead capture is
    public and unauthenticated; a broken notification fan-out must not be able
    to roll back a student's enquiry, and an admin alert must not be able to
    abort the assignment. The two failure domains are therefore separate
    transactions, and the notification block gets its own savepoint so a
    partial fan-out cannot leave a half-written commit behind.

    Returns the assigned counsellor, or ``None`` when the lead overflowed to
    the admins.
    """
    counsellor = pick_counsellor(db)
    if counsellor is not None:
        enquiry.assigned_counsellor_id = counsellor.id

    # The assignment is worth committing even if the alerting below fails, so
    # flush it to the database and take a savepoint from here on.
    db.commit()
    db.refresh(enquiry)

    # Clipped as whole strings, not as the name inside them: the "New enquiry: "
    # prefix is what pushes a 255-character name over the 255-character column.
    title = _clip(f"New enquiry: {enquiry.name}", TITLE_LIMIT)
    message = _clip(f"{enquiry.name} ({enquiry.mobile})", MESSAGE_LIMIT)
    data = {"enquiry_id": enquiry.id, "mobile": enquiry.mobile}

    try:
        with db.begin_nested():
            for admin_id in _active_admin_ids(db):
                db.add(
                    Notification(
                        user_id=admin_id,
                        type=NOTIFICATION_NEW_LEAD,
                        title=title,
                        message=message,
                        data=data,
                    )
                )
            if counsellor is not None:
                db.add(
                    Notification(
                        user_id=counsellor.user_id,
                        type=NOTIFICATION_LEAD_ASSIGNED,
                        title="A new lead was assigned to you",
                        message=message,
                        data=data,
                    )
                )
        db.commit()
    except Exception:
        # Losing the alert is bad; losing the enquiry or the assignment is
        # worse. Keep the lead, drop the alert, and say so in the logs.
        db.rollback()
        logger.exception(
            "Enquiry %s was captured and assigned to counsellor %s, but the "
            "lead notification could not be written",
            enquiry.id,
            counsellor.id if counsellor else None,
        )

    return counsellor
