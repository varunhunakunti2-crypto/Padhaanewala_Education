"""Wire contracts for the super-admin AI settings panel.

The response type is deliberately *not* the ORM row. ``AiSetting`` holds
ciphertext; returning it with ``from_attributes`` would put a stored credential
one serializer mistake away from a browser. Instead the router builds the
response explicitly and the only key-shaped fields here are a boolean and a
four-character hint.
"""

from datetime import datetime
from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator

#: Which provider a connection test should exercise.
AiTarget = Literal["chat", "gemini"]

#: Placeholder values that mean "no credential". Mirrors
#: ``app.services.ai_config.usable_secret``; the schema rejects them at the edge
#: so a console that submits ``change-me`` is told, rather than silently
#: disabling the assistant.
_PLACEHOLDERS = frozenset({"change-me", "changeme", "none"})


def _normalise_base_url(value: str | None) -> str | None:
    """Trim a trailing slash and require an http(s) URL.

    Local providers (Ollama, LM Studio, vLLM) are a first-class use case, so
    ``http://localhost:11434/v1`` must be accepted; anything that is not
    http(s) is rejected because ``httpx`` would otherwise happily try
    ``file://`` and this endpoint would become a local-file oracle.
    """
    if value is None:
        return None
    stripped = value.strip().rstrip("/")
    if not stripped:
        raise ValueError("must not be blank")
    parsed = urlparse(stripped)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("must be an http(s) URL, e.g. https://api.openai.com/v1")
    return stripped


def _normalise_model(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        raise ValueError("must not be blank")
    return stripped


def _normalise_api_key(value: str | None) -> str | None:
    """An explicit empty string clears the saved key.

    ``None`` is *absent* under ``exclude_unset`` and therefore leaves the key
    alone. The distinction is what lets the panel offer a "Clear key" action
    without also clearing it every time the masked field is rendered empty.
    """
    if value is None:
        return None
    stripped = value.strip()
    if stripped.lower() in _PLACEHOLDERS:
        raise ValueError("this is a placeholder, not an API key")
    return stripped


class AiSettingsResponse(BaseModel):
    """Everything the console may know about the stored configuration."""

    chat_base_url: str
    chat_model: str
    chat_api_key_set: bool
    #: Last four characters only, e.g. ``****a1b2``. Enough to answer "is this
    #: the key I rotated in last week?" without shipping the key.
    chat_api_key_hint: str | None
    #: ``database`` | ``environment`` | ``none``.
    chat_api_key_source: str

    gemini_model: str
    gemini_api_key_set: bool
    gemini_api_key_hint: str | None
    gemini_api_key_source: str

    updated_at: datetime
    updated_by: int | None


class AiSettingsUpdate(BaseModel):
    """A partial update. Absent fields are left untouched.

    ``extra="forbid"`` for the same reason as ``SiteSettingsUpdate``: a stale
    client sending ``chat_api_key_encrypted`` is told it is wrong instead of
    having it quietly ignored -- or worse, applied.
    """

    model_config = ConfigDict(extra="forbid")

    chat_base_url: str | None = Field(None, min_length=1, max_length=500)
    chat_model: str | None = Field(None, min_length=1, max_length=120)
    chat_api_key: str | None = Field(None, max_length=500)

    gemini_model: str | None = Field(None, min_length=1, max_length=120)
    gemini_api_key: str | None = Field(None, max_length=500)

    @field_validator("chat_base_url")
    @classmethod
    def _base_url(cls, value: str | None) -> str | None:
        return _normalise_base_url(value)

    @field_validator("chat_model", "gemini_model")
    @classmethod
    def _model(cls, value: str | None) -> str | None:
        return _normalise_model(value)

    @field_validator("chat_api_key", "gemini_api_key")
    @classmethod
    def _api_key(cls, value: str | None) -> str | None:
        return _normalise_api_key(value)


class AiSettingsTestRequest(BaseModel):
    """Test a draft configuration without saving it.

    Every provider field is optional: omitted values come from the stored row,
    so "Test connection" on an untouched form exercises exactly what the site
    would use. A typed key is used for the test only; it is not persisted.
    """

    model_config = ConfigDict(extra="forbid")

    target: AiTarget = "chat"
    base_url: str | None = Field(None, max_length=500)
    model: str | None = Field(None, max_length=120)
    api_key: str | None = Field(None, max_length=500)

    @field_validator("base_url")
    @classmethod
    def _base_url(cls, value: str | None) -> str | None:
        return _normalise_base_url(value)

    @field_validator("model")
    @classmethod
    def _model(cls, value: str | None) -> str | None:
        return _normalise_model(value)

    @field_validator("api_key")
    @classmethod
    def _api_key(cls, value: str | None) -> str | None:
        return _normalise_api_key(value)


class AiSettingsTestResponse(BaseModel):
    """The outcome of one live provider call.

    ``ok`` is a field rather than an HTTP error because a rejected key is a
    useful *result* the panel renders inline, not a failure of the settings
    endpoint itself. ``200`` therefore means "the test ran"; ``ok`` says whether
    the provider accepted it.
    """

    ok: bool
    target: AiTarget
    model: str
    message: str
    latency_ms: int
