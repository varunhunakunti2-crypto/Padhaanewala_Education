"""Super-admin AI provider settings.

This router deliberately has its own prefix and its own role guard instead of
extending ``/api/v1/settings``:

* ``site_settings`` is published and writable by ``admin``. Credentials are
  neither, so they get a route that cannot be reached by widening that one.
* A new route also means the existing settings contract -- its response shape,
  its audit row and every test around it -- is untouched by this feature.

Every handler requires :data:`app.roles.SUPER_ADMIN_ROLES`. The console hides
the nav entry for anyone else, but the guard is the security boundary; the nav
filter is a courtesy.
"""

import time
from datetime import UTC, datetime

import httpx
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_role
from app.models import AiSetting, User
from app.roles import SUPER_ADMIN_ROLES
from app.schemas.ai_settings import (
    AiSettingsResponse,
    AiSettingsTestRequest,
    AiSettingsTestResponse,
    AiSettingsUpdate,
)
from app.services import ai_config, secret_box
from app.utils import audit

router = APIRouter(prefix="/api/v1/settings/ai", tags=["ai-settings"])

_SINGLETON_ID = ai_config.SINGLETON_ID

#: One live provider call. Long enough for a slow provider, short enough that a
#: stuck "Test connection" does not hold the admin's request forever.
_TEST_TIMEOUT_SECONDS = 15.0

_GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"


def _load(db: Session) -> AiSetting:
    """Load the singleton, creating it for a schema built without migrations.

    The migration seeds the row, so in a migrated database this branch never
    runs. It exists for ``Base.metadata.create_all`` in a scratch/test schema,
    same as ``site_settings._load``.
    """
    row = db.get(AiSetting, _SINGLETON_ID)
    if row is None:
        # Only the id: every configuration column stays NULL so the resolver
        # falls through to the environment, exactly as it does for a freshly
        # migrated deployment.
        row = AiSetting(id=_SINGLETON_ID)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _hint(api_key: str | None) -> str | None:
    """Last four characters, never the key. ``None`` when nothing is set."""
    if not api_key:
        return None
    return f"****{api_key[-4:]}"


def _to_response(row: AiSetting) -> AiSettingsResponse:
    chat = ai_config.chat_config_from_row(row)
    gemini = ai_config.gemini_config_from_row(row)
    return AiSettingsResponse(
        chat_base_url=chat.base_url,
        chat_model=chat.model,
        chat_api_key_set=chat.is_configured,
        chat_api_key_hint=_hint(chat.api_key),
        chat_api_key_source=chat.source,
        gemini_model=gemini.model,
        gemini_api_key_set=gemini.is_configured,
        gemini_api_key_hint=_hint(gemini.api_key),
        gemini_api_key_source=gemini.source,
        updated_at=row.updated_at,
        updated_by=row.updated_by,
    )


@router.get(
    "",
    response_model=AiSettingsResponse,
    dependencies=[Depends(require_role(*SUPER_ADMIN_ROLES))],
)
def read_ai_settings(db: Session = Depends(get_db)) -> AiSettingsResponse:
    """The stored configuration, with credentials reduced to a flag and hint."""
    return _to_response(_load(db))


@router.put("", response_model=AiSettingsResponse)
def update_ai_settings(
    payload: AiSettingsUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*SUPER_ADMIN_ROLES)),
) -> AiSettingsResponse:
    """Apply the changed fields and return the whole configuration.

    ``exclude_unset`` semantics, matching ``update_site_settings``: an absent
    field is left alone. For the two credential fields the rule is one step
    further -- **an explicit empty string clears the key**, and the audit row
    records only whether a key was set before and after. The plaintext key never
    reaches the audit log even though ``SENSITIVE_KEYS`` would also redact it:
    redaction is a safety net, not the design.
    """
    row = _load(db)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        return _to_response(row)

    old_value: dict = {}
    new_value: dict = {}

    # Credential fields first: they are transformed, not assigned verbatim.
    for field, column in (
        ("chat_api_key", "chat_api_key_encrypted"),
        ("gemini_api_key", "gemini_api_key_encrypted"),
    ):
        if field not in changes:
            continue
        plaintext = changes.pop(field)
        old_value[f"{field}_set"] = bool(getattr(row, column))
        if plaintext:
            setattr(row, column, secret_box.encrypt(plaintext))
            new_value[f"{field}_set"] = True
        else:
            setattr(row, column, None)
            new_value[f"{field}_set"] = False

    # Remaining fields are plain configuration.
    for field, value in changes.items():
        old_value[field] = getattr(row, field)
        new_value[field] = value
        setattr(row, field, value)

    row.updated_by = user.id
    # Set explicitly rather than relying on `onupdate`: a single-key rotation is
    # exactly the change an operator later wants dated, and it must not depend
    # on SQLAlchemy noticing a non-key column in the same UPDATE.
    row.updated_at = datetime.now(UTC)

    audit.record(
        db,
        request=request,
        action="update_ai_settings",
        entity_type="ai_settings",
        entity_id=row.id,
        actor=user,
        old_value=old_value,
        new_value=new_value,
    )
    db.commit()
    db.refresh(row)
    return _to_response(row)


def _provider_detail(response: httpx.Response) -> str:
    """A short, human-readable provider error, with newlines collapsed.

    Provider error bodies are the only way an admin learns "the model name is
    wrong" instead of "it failed". They do not contain the key; the request sent
    it in a header, and only the *response* is read here.
    """
    try:
        body = response.json()
    except ValueError:
        return ""
    message: object = None
    if isinstance(body, dict):
        error = body.get("error")
        if isinstance(error, dict):
            message = error.get("message")
        elif isinstance(error, str):
            message = error
        if message is None:
            message = body.get("detail") or body.get("message")
    if not isinstance(message, str):
        return ""
    return " ".join(message.split())[:240]


def _test_chat(base_url: str, model: str, api_key: str) -> tuple[bool, str]:
    url = ai_config.chat_completions_url(base_url)
    try:
        response = httpx.post(
            url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [{"role": "user", "content": "ping"}],
                "max_tokens": 1,
                "temperature": 0,
            },
            timeout=_TEST_TIMEOUT_SECONDS,
        )
    except httpx.TimeoutException:
        return False, (
            f"The provider did not answer within {_TEST_TIMEOUT_SECONDS:.0f}s. "
            "Check the base URL and that the provider is reachable from this server."
        )
    except httpx.RequestError:
        # Never interpolate the exception: httpx quotes the URL, and on some
        # transports the request headers.
        return (
            False,
            "Could not reach the provider. Check the base URL and the server's network access.",
        )

    if response.is_success:
        return True, f"The provider accepted the key and answered with {model}."

    detail = _provider_detail(response)
    suffix = f" Provider said: {detail}" if detail else ""
    return (
        False,
        f"The provider rejected the request (HTTP {response.status_code}).{suffix}",
    )


def _test_gemini(model: str, api_key: str) -> tuple[bool, str]:
    url = f"{_GEMINI_ENDPOINT}/{model}:generateContent"
    try:
        response = httpx.post(
            url,
            headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
            json={
                "contents": [{"parts": [{"text": "ping"}]}],
                "generationConfig": {"maxOutputTokens": 1},
            },
            timeout=_TEST_TIMEOUT_SECONDS,
        )
    except httpx.TimeoutException:
        return False, (
            f"Gemini did not answer within {_TEST_TIMEOUT_SECONDS:.0f}s. "
            "Check the server's network access."
        )
    except httpx.RequestError:
        return False, "Could not reach Gemini. Check the server's network access."

    if response.is_success:
        return True, f"Gemini accepted the key and answered with {model}."

    detail = _provider_detail(response)
    suffix = f" Provider said: {detail}" if detail else ""
    return False, f"Gemini rejected the request (HTTP {response.status_code}).{suffix}"


@router.post("/test", response_model=AiSettingsTestResponse)
def test_ai_settings(
    payload: AiSettingsTestRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(*SUPER_ADMIN_ROLES)),
) -> AiSettingsTestResponse:
    """Call the provider once with the draft values, without saving anything.

    Omitted fields fall back to the stored row, so the button works on an
    untouched form. A key typed into the test box is used for this call only --
    the super admin still has to press Save to persist it.
    """
    row = _load(db)

    started = time.perf_counter()
    if payload.target == "chat":
        stored = ai_config.chat_config_from_row(row)
        base_url = payload.base_url or stored.base_url
        model = payload.model or stored.model
        api_key = payload.api_key or stored.api_key
        if not api_key:
            elapsed = int((time.perf_counter() - started) * 1000)
            return AiSettingsTestResponse(
                ok=False,
                target="chat",
                model=model,
                message="No API key is configured. Enter one above, or set OPENAI_API_KEY on the server.",
                latency_ms=elapsed,
            )
        ok, message = _test_chat(base_url, model, api_key)
    else:
        stored = ai_config.gemini_config_from_row(row)
        model = payload.model or stored.model
        api_key = payload.api_key or stored.api_key
        if not api_key:
            elapsed = int((time.perf_counter() - started) * 1000)
            return AiSettingsTestResponse(
                ok=False,
                target="gemini",
                model=model,
                message="No Gemini API key is configured. Enter one above, or set GEMINI_API_KEY on the server.",
                latency_ms=elapsed,
            )
        ok, message = _test_gemini(model, api_key)

    return AiSettingsTestResponse(
        ok=ok,
        target=payload.target,
        model=model,
        message=message,
        latency_ms=int((time.perf_counter() - started) * 1000),
    )
