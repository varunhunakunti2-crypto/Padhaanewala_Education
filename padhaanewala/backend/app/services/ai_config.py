"""Runtime resolution of AI-provider configuration.

The super admin edits one row from the console; every process that calls a
provider reads that row *at call time*. Nothing is captured at import time, so a
rotated key takes effect on the next request without a restart.

Two rules make this safe to deploy over an existing installation:

* **The database wins, the environment is the fallback.** A deployment that
  already has ``OPENAI_API_KEY`` / ``GEMINI_API_KEY`` in its environment keeps
  working with no migration step, and the console's first read shows the key as
  "from environment" rather than "not configured".
* **A placeholder is not a credential.** ``change-me`` ships in ``.env.example``
  and means "nobody set this"; treating it as a key turns a clear "not
  configured" into an opaque provider 401. This module shares
  ``config._is_placeholder``'s definition without importing the private name.

The plaintext key only exists inside :class:`ChatConfig` / :class:`GeminiConfig`
for the duration of one provider call. No schema or log line mentions it.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.config import settings
from app.models import AiSetting
from app.services import secret_box

#: The one row. Matches the ``CHECK (id = 1)`` in the migration and
#: ``site_settings``' convention.
SINGLETON_ID = 1

#: Values that ship as documentation rather than configuration.
_PLACEHOLDERS = frozenset({"", "change-me", "changeme", "none"})

DEFAULT_CHAT_BASE_URL = "https://api.openai.com/v1"
DEFAULT_CHAT_MODEL = "gpt-4o-mini"
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"


def usable_secret(value: str | None) -> str | None:
    """Return the trimmed value, or ``None`` when it is not a real credential."""
    if value is None:
        return None
    stripped = value.strip()
    if stripped.lower() in _PLACEHOLDERS:
        return None
    return stripped


def chat_completions_url(base_url: str) -> str:
    """The OpenAI-compatible completion path for a configured base URL.

    Accepts both the usual base (``https://api.openai.com/v1``) and a base that
    already names the path, because people paste whatever their provider's
    documentation shows. Appending blindly would produce
    ``.../chat/completions/chat/completions`` and a 404 that looks like a bad
    key.
    """
    trimmed = base_url.rstrip("/")
    if trimmed.endswith("/chat/completions"):
        return trimmed
    return f"{trimmed}/chat/completions"


def _usable_text(value: str | None) -> str | None:
    """Configuration text: a blank or placeholder falls back to the next source."""
    return usable_secret(value)


def _first(*values: str | None) -> str | None:
    for value in values:
        cleaned = _usable_text(value)
        if cleaned:
            return cleaned
    return None


@dataclass(frozen=True)
class ChatConfig:
    """An OpenAI-compatible chat endpoint, ready to call."""

    base_url: str
    model: str
    api_key: str | None
    #: ``"database"``, ``"environment"`` or ``"none"``. Surfaced so the console
    #: can say *where* the active key comes from; it never exposes the key.
    source: str

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)


@dataclass(frozen=True)
class GeminiConfig:
    """The native Gemini endpoint used by the PDF question importer."""

    model: str
    api_key: str | None
    source: str

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key)


def _key_state(
    encrypted: str | None, environment_value: str | None
) -> tuple[str | None, str]:
    """Resolve one credential and report where it came from.

    The database is tried first. A key encrypted under a different
    ``SECRET_KEY`` decrypts to ``None`` (:mod:`app.services.secret_box`), which
    is treated exactly like "never saved": fall back to the environment rather
    than failing a public request.
    """
    stored = usable_secret(secret_box.decrypt(encrypted))
    if stored:
        return stored, "database"
    from_env = usable_secret(environment_value)
    if from_env:
        return from_env, "environment"
    return None, "none"


def chat_config_from_row(row: AiSetting | None) -> ChatConfig:
    """Resolve chat configuration from an already-loaded row."""
    api_key, source = _key_state(
        row.chat_api_key_encrypted if row else None,
        os.getenv("OPENAI_API_KEY"),
    )
    base_url = (
        _first(
            row.chat_base_url if row else None,
            os.getenv("OPENAI_BASE_URL"),
            DEFAULT_CHAT_BASE_URL,
        )
        or DEFAULT_CHAT_BASE_URL
    )
    model = (
        _first(
            row.chat_model if row else None,
            os.getenv("OPENAI_MODEL"),
            DEFAULT_CHAT_MODEL,
        )
        or DEFAULT_CHAT_MODEL
    )
    # A trailing slash is the difference between `.../v1/chat/completions` and
    # `.../v1//chat/completions`; some providers 404 the latter.
    return ChatConfig(
        base_url=base_url.rstrip("/"), model=model, api_key=api_key, source=source
    )


def gemini_config_from_row(row: AiSetting | None) -> GeminiConfig:
    """Resolve Gemini configuration from an already-loaded row."""
    api_key, source = _key_state(
        row.gemini_api_key_encrypted if row else None,
        settings.GEMINI_API_KEY,
    )
    model = (
        _first(
            row.gemini_model if row else None,
            settings.GEMINI_MODEL,
            DEFAULT_GEMINI_MODEL,
        )
        or DEFAULT_GEMINI_MODEL
    )
    return GeminiConfig(model=model, api_key=api_key, source=source)


def resolve_chat_config(db: Session) -> ChatConfig:
    """Read the singleton and resolve the chat provider for this request."""
    return chat_config_from_row(db.get(AiSetting, SINGLETON_ID))


def resolve_gemini_config(db: Session) -> GeminiConfig:
    """Read the singleton and resolve the PDF-import provider for this request."""
    return gemini_config_from_row(db.get(AiSetting, SINGLETON_ID))
