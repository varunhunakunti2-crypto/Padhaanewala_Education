"""Audit-log helper (R5.3).

Centralises the three things every privileged mutation must do: record who did
what, record before/after state, and stamp the source IP. Callers pass
``request: Request`` so the IP is never forgotten.
"""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum

from fastapi import Request

from app.models import AuditLog
from app.models.user import User
from app.utils.client_ip import client_ip


def jsonable(value):
    """Coerce a payload fragment into something ``json.dumps`` accepts.

    ``AuditLog.old_value``/``new_value`` are plain ``JSON`` columns, so
    SQLAlchemy serialises them with ``json.dumps`` at flush time. ``Decimal``,
    ``datetime`` and ``Enum`` are not JSON-native, and a caller that logs the
    payload it was handed — the obvious thing to do, and what every existing
    caller does — turns a ``Decimal`` into a ``TypeError`` raised from inside
    the flush.

    That would break the contract this module documents: an audit write must
    never be the reason a legitimate mutation 500s. The failure is also silent
    in the worst direction, because it surfaces as a 500 on the *write* the
    admin was trying to perform, which reads as "the app is broken" rather than
    "the audit trail is stricter than the schema".

    Unknown types fall back to ``str`` rather than propagating, so this cannot
    raise on a payload shape nobody anticipated.
    """
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, Decimal):
        # float rather than str: an audit diff is read by eye, and "12.5" and
        # 12.5 are the same number to the person checking whether an admin
        # changed a fee. Precision beyond float is not what this column is for.
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Enum):
        return jsonable(value.value)
    if isinstance(value, dict):
        return {str(k): jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set, frozenset)):
        return [jsonable(v) for v in value]
    return str(value)


def record(
    db,
    *,
    request: Request | None,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    actor: User | None = None,
    old_value: dict | None = None,
    new_value: dict | None = None,
) -> AuditLog:
    """Append one audit row. Never raises — audit failure must not 500 a mutation."""
    entry = AuditLog(
        user_id=actor.id if actor is not None else None,
        action=action[:50],
        entity_type=entity_type[:50],
        entity_id=entity_id,
        old_value=jsonable(old_value),
        new_value=jsonable(new_value),
        ip_address=client_ip(request) if request is not None else None,
    )
    db.add(entry)
    return entry


def role_names(user: User) -> list[str]:
    return sorted(role.name for role in user.roles)
