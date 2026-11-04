"""Wire contract for the public student assistant."""

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ChatRequest(BaseModel):
    """One turn from the public assistant.

    The caps mirror the Next.js route's own limits. They are repeated here
    because the backend is reachable directly; a client that skips the proxy
    must not be able to send an unbounded prompt to a billed provider.
    """

    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=500)
    #: Supplied by the proxy's system prompt. Capped because it is part of the
    #: billed input and a caller could otherwise prepend a large preamble.
    system_prompt: str | None = Field(None, max_length=4000)

    @field_validator("message")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped


class ChatResponse(BaseModel):
    reply: str
