"""The student assistant's provider call.

Before this route existed the Next.js ``app/api/ai/route.ts`` read
``OPENAI_*`` once at module load and called the provider itself. That made the
key a deployment-time secret: rotating it meant editing an environment file and
restarting the frontend, which is the opposite of what the super-admin panel is
for.

The route is unauthenticated because the assistant is on the public site. The
abuse controls are therefore layered outside the handler:

* ``app/middleware/ratelimit.py`` caps the path per client IP.
* The Next.js proxy still applies its own per-IP throttle and 500-character
  input cap, and is the only integration point the public bundle talks to.
* The request schema caps the message and system prompt again, for a caller
  that reaches the backend directly.

No provider exception is ever interpolated into a response: httpx quotes the
request URL on transport failures, and an auth failure can quote headers.
"""

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.ai import ChatRequest, ChatResponse
from app.services import ai_config

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])

#: One upstream call. Mirrors the proxy's own ceiling; a hanging provider must
#: not hold the route open indefinitely.
_PROVIDER_TIMEOUT_SECONDS = 15.0

#: Used only when the proxy does not send its own prompt. Keeping a sensible
#: default here means a direct backend caller gets an on-topic assistant rather
#: than an unconstrained general-purpose model.
_DEFAULT_SYSTEM_PROMPT = (
    "You are the AI assistant for Padhaanewala, an education guidance platform "
    "for Indian students. Answer in clear, friendly language and keep the "
    "conversation about colleges, courses, exams, scholarships and careers. "
    "Never invent admission requirements, rankings or scholarship details; say "
    "when you do not know and point to the official source."
)


def _reply_from(data: object) -> str | None:
    """Extract ``choices[0].message.content`` without trusting the shape."""
    if not isinstance(data, dict):
        return None
    choices = data.get("choices")
    if not isinstance(choices, list) or not choices:
        return None
    first = choices[0]
    if not isinstance(first, dict):
        return None
    message = first.get("message")
    if not isinstance(message, dict):
        return None
    content = message.get("content")
    if not isinstance(content, str):
        return None
    return content.strip() or None


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    """Answer one message using the provider configured in the console."""
    config = ai_config.resolve_chat_config(db)
    if not config.is_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The AI assistant is not configured on this server.",
        )

    try:
        response = httpx.post(
            ai_config.chat_completions_url(config.base_url),
            headers={
                "Authorization": f"Bearer {config.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": config.model,
                "temperature": 0.4,
                "max_tokens": 500,
                "messages": [
                    {
                        "role": "system",
                        "content": payload.system_prompt or _DEFAULT_SYSTEM_PROMPT,
                    },
                    {"role": "user", "content": payload.message},
                ],
            },
            timeout=_PROVIDER_TIMEOUT_SECONDS,
        )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="The AI provider did not respond in time.",
        ) from None
    except httpx.RequestError:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI provider could not be reached.",
        ) from None

    if not response.is_success:
        # Status only. The body can contain the provider's own account or model
        # diagnostics, which is for the settings panel, not a public caller.
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI provider rejected the request.",
        )

    try:
        body = response.json()
    except ValueError:
        body = None
    reply = _reply_from(body)
    if reply is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI provider returned an empty answer.",
        )
    return ChatResponse(reply=reply)
