"""Audit-log helper (R5.3).

Centralises the three things every privileged mutation must do: record who did
what, record before/after state, and stamp the source IP. Callers pass
``request: Request`` so the IP is never forgotten.

Phase 9.6 adds a fourth, and it is the reason this file is worth reading before
extending: **PII is redacted on the way in**.

The problem this solves is not hypothetical. `new_value=payload.model_dump(...)`
is the convenient way to write an audit row, and it copies *whatever the caller
sent* — so the day a schema grows an `email` or a `mobile`, the audit log starts
keeping a second, unindexed, differently-protected copy of every student's
contact details, in a table with a two-year retention and no redaction. Nothing
about the audit log is less accessible than the table it was copied from, so it
is strictly a downgrade in confidentiality and strictly an upgrade in blast
radius.

Redaction happens here rather than at each call site because a rule enforced in
eleven places is a rule enforced in ten. It is deliberately conservative —
unknown keys pass through untouched, because a false positive that silently
destroys the evidence a privilege-escalation investigation needs is its own kind
of failure. The sensitive key list is short, explicit and reviewable, and adding
to it is a one-line change with a test asserting the new key is caught.
"""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID

from fastapi import Request

from app.models import AuditLog
from app.models.user import User
from app.utils.client_ip import client_ip

#: Keys whose values are personal data or credentials and must never be written
#: verbatim into an audit row. Matched case-insensitively against the key name.
#:
#: `password`/`token`/`secret` are credentials rather than PII, and they belong
#: here for the same reason: an audit row is not a secret store, and a hash
#: change is recorded as a *fact* (`{"password_changed": True}`) rather than by
#: copying the value.
SENSITIVE_KEYS: frozenset[str] = frozenset(
    {
        "password",
        "password_hash",
        "new_password",
        "current_password",
        "token",
        "refresh_token",
        "access_token",
        "otp",
        "code",
        "code_hash",
        "secret",
        "authorization",
        "cookie",
        "email",
        "mobile",
        "guardian_email",
        "guardian_mobile",
        "ip_address",
    }
)

#: What a redacted value is replaced with. A fixed marker rather than a hash: the
#: point of the audit row is that the field *changed*, not that the row is
#: sufficient to reverse the change. A keyed hash would be a second copy of the
#: value wearing a disguise.
REDACTED = "[redacted]"

#: Nesting depth walked into a payload. Bounded so a pathological structure
#: cannot turn an audit write into a stack overflow — and because past three
#: levels the shape is application state, not the field-level change the row
#: exists to record.
MAX_DEPTH = 3


def _jsonable(value):
    """Coerce a value into something the JSON columns can actually hold.

    `old_value`/`new_value` are `JSON` columns, and PostgreSQL serialises them
    with `json.dumps`. A `datetime`, `Decimal` or `Enum` reaching one of those
    parameters therefore raises `TypeError` — and it raises at **flush time**, not
    inside `record()`, so a `try/except` around the audit call cannot contain it.
    The mutation's `db.commit()` is what fails, which is how an audit row took
    down the whole data-subject-request workflow: `new_value={"due_at": <datetime>}`
    turned every `POST /compliance/requests` into a 500.

    Doing the conversion here rather than at each call site is the same argument
    as redaction: the column is JSON for every caller, so the guarantee belongs
    with the column. Timestamps become ISO 8601, which is what the rest of the API
    emits anyway.
    """
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {k: _jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_jsonable(v) for v in value]
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, Enum):
        return _jsonable(value.value)
    if isinstance(value, UUID):
        return str(value)
    # Anything else is stored as text rather than dropped. A repr in an audit row
    # is recoverable; a missing key is not, and an audit row exists to be read by
    # whoever investigates this later.
    return str(value)


def redact(payload: dict | None, *, _depth: int = 0) -> dict | None:
    """Return `payload` with every sensitive value replaced by `REDACTED`.

    Nested dicts and lists are walked, so a payload that wraps the contact
    details one level down is caught too — which is the shape
    `payload.model_dump()` produces for any schema with a sub-object.

    Known over-redaction: a field legitimately named `code` is redacted, because
    `code` is the OTP field name in `otp_records` and a leaked OTP in the audit
    log is worse than a course code missing from an audit row. No current call
    site passes such a field. If one ever does, the fix is to rename it in the
    caller rather than to weaken this list.
    """
    if payload is None:
        return None
    if _depth >= MAX_DEPTH:
        return payload

    out: dict = {}
    for key, value in payload.items():
        if isinstance(key, str) and key.strip().lower() in SENSITIVE_KEYS:
            out[key] = REDACTED
        elif isinstance(value, dict):
            out[key] = redact(value, _depth=_depth + 1)
        elif isinstance(value, list):
            out[key] = [
                redact(item, _depth=_depth + 1) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            out[key] = value
    # Applied last, over the whole structure, so nested datetimes are converted
    # on the same pass as the top-level ones.
    return _jsonable(out)


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
    """Append one audit row.

    The intent is that an audit problem must never 500 a mutation, but that
    cannot be delivered by a `try/except` here: the row is only serialised when
    the session flushes, so a bad value surfaces at the caller's `db.commit()`,
    outside this frame. `_jsonable` is therefore the real guarantee — it makes
    every payload representable before the row is built — and this docstring used
    to claim a safety net that did not exist, which is how the
    data-subject-request endpoint spent its life returning 500.
    """
    entry = AuditLog(
        user_id=actor.id if actor is not None else None,
        action=action[:50],
        entity_type=entity_type[:50],
        entity_id=entity_id,
        old_value=redact(old_value),
        new_value=redact(new_value),
        ip_address=client_ip(request) if request is not None else None,
    )
    db.add(entry)
    return entry


def role_names(user: User) -> list[str]:
    return sorted(role.name for role in user.roles)
