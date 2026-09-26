"""Audit-log helper (R5.3).

Centralises the three things every privileged mutation must do: record who did
what, record before/after state, and stamp the source IP. Callers pass
``request: Request`` so the IP is never forgotten.
"""

from fastapi import Request

from app.models import AuditLog
from app.models.user import User
from app.utils.client_ip import client_ip


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
        old_value=old_value,
        new_value=new_value,
        ip_address=client_ip(request) if request is not None else None,
    )
    db.add(entry)
    return entry


def role_names(user: User) -> list[str]:
    return sorted(role.name for role in user.roles)
