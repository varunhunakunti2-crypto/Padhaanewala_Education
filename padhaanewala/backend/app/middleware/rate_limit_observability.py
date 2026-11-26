"""Privacy-safe structured observability for the rate limiter (P10).

Every event is a single log record produced through the application's normal
logging configuration (``logging.basicConfig`` in ``app/main.py``): by default
that is the ``stderr`` stream with the standard
``"<asctime> <level> <logger> - "`` prefix, followed by one JSON object. It
introduces no formatter, handler, background task or per-request network call.

To ingest, parse the JSON object that starts at the first ``{`` on the line, or
configure the platform's logging to use a JSON formatter (which then makes the
whole line JSON). Container logs must capture **both** stdout and stderr.

## What is safe to log

The helpers below accept only **bounded labels**:

* ``namespace`` / ``category`` come from the centralized policy definitions or
  operator configuration, never from a request.
* ``dimension`` is an enumerated value.
* ``route_template`` is a *registered Starlette route template* such as
  ``/api/v1/colleges/{college_ref}/courses``. It is never the raw request path,
  so no college id, slug, query string or search term is emitted. When the
  route cannot be resolved the value is the literal ``"unmatched"``.
* ``error_type`` is a Python exception class name (``TimeoutError``), not the
  exception message, which could contain a Redis URL with credentials.

There is intentionally **no parameter** for a client IP, user id, hashed
identifier, email, phone, OTP, JWT, password, prompt or request path. Those
values cannot be passed in by mistake because the functions do not accept them.

## Volume

A throttled request, a dependency failure and a quota exhaustion are always
logged. An allowed request is logged only when
``RATE_LIMIT_OBSERVABILITY_LOG_ALLOWED`` is enabled, because public catalogue
reads are high-volume and would otherwise dominate the log stream. With the flag
on, the decision events are the per-route statistics; aggregating them is the
log platform's job.

Monitoring must never break the request it is monitoring: every emit is wrapped
so a broken ``logging`` handler cannot raise into the middleware.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.config import settings

logger = logging.getLogger("padhaanewala.ratelimit")

#: Labels are restricted to characters that appear in route templates, policy
#: names and namespace prefixes. Anything else is replaced, so a future caller
#: that passes an unexpected string cannot smuggle a delimiter or a newline
#: into a JSON log line.
_SAFE_LABEL = re.compile(r"[^A-Za-z0-9_.:{}()/-]+")
_MAX_LABEL = 96
_MAX_ROUTE = 160

_DIMENSIONS = frozenset(
    {
        "route_ip",
        "ip",
        "user",
        "daily",
        "identifier",
        "article",
        "unknown",
    }
)


def _label(value: Any, *, maximum: int = _MAX_LABEL) -> str:
    text = value if isinstance(value, str) else ""
    text = _SAFE_LABEL.sub("_", text).strip("_")
    return text[:maximum] or "unknown"


def _enabled() -> bool:
    return bool(getattr(settings, "RATE_LIMIT_OBSERVABILITY_ENABLED", True))


def _emit(payload: dict[str, Any], *, level: int = logging.INFO) -> None:
    """Write one JSON line. Never raises into the request path."""
    try:
        if not _enabled():
            return
        logger.log(
            level,
            json.dumps(
                {"component": "rate_limit", **payload},
                separators=(",", ":"),
                sort_keys=True,
            ),
        )
    except Exception:  # pragma: no cover - logging must never break a request
        pass


def _common(
    *,
    namespace: str,
    category: str,
    dimension: str,
    route_template: str | None,
) -> dict[str, Any]:
    return {
        "namespace": _label(namespace),
        "category": _label(category),
        "dimension": dimension if dimension in _DIMENSIONS else "unknown",
        "route": _label(route_template, maximum=_MAX_ROUTE)
        if route_template
        else "unmatched",
    }


def _latency_ms(value: float | None) -> float | None:
    if value is None:
        return None
    try:
        return round(max(float(value), 0.0), 3)
    except (TypeError, ValueError):
        return None


def emit_decision(
    *,
    outcome: str,
    namespace: str,
    category: str,
    dimension: str,
    route_template: str | None,
    http_status: int,
    redis_latency_ms: float | None,
    limit: int | None = None,
    window_seconds: int | None = None,
) -> None:
    """One rate-limit verdict: ``allowed`` or ``throttled``.

    The allowed event is gated by ``RATE_LIMIT_OBSERVABILITY_LOG_ALLOWED``; the
    throttled event is always emitted so a 429 can be counted by namespace,
    category and dimension without enabling high-volume logging.
    """
    if outcome == "allowed" and not bool(
        getattr(settings, "RATE_LIMIT_OBSERVABILITY_LOG_ALLOWED", False)
    ):
        return
    payload: dict[str, Any] = {
        "event": "ratelimit.decision",
        "outcome": outcome if outcome in {"allowed", "throttled"} else "unknown",
        "http_status": int(http_status),
        **_common(
            namespace=namespace,
            category=category,
            dimension=dimension,
            route_template=route_template,
        ),
    }
    latency = _latency_ms(redis_latency_ms)
    if latency is not None:
        payload["redis_latency_ms"] = latency
    if limit is not None:
        payload["limit"] = int(limit)
    if window_seconds is not None:
        payload["window_seconds"] = int(window_seconds)
    _emit(payload)


def emit_dependency_failure(
    *,
    event: str,
    namespace: str,
    category: str,
    dimension: str,
    route_template: str | None,
    fail_mode: str,
    error_type: str,
    redis_latency_ms: float | None,
) -> None:
    """Redis error, counter-read failure or retry.

    ``fail_mode`` is ``open`` or ``closed`` and describes what the middleware
    did, not what it hoped to do. ``error_type`` is a class name only.
    """
    if fail_mode not in {"open", "closed", "unknown"}:
        fail_mode = "unknown"
    payload: dict[str, Any] = {
        "event": event,
        "outcome": f"fail_{fail_mode}" if fail_mode != "unknown" else "retry",
        "fail_mode": fail_mode,
        "error_type": _label(error_type),
        **_common(
            namespace=namespace,
            category=category,
            dimension=dimension,
            route_template=route_template,
        ),
    }
    latency = _latency_ms(redis_latency_ms)
    if latency is not None:
        payload["redis_latency_ms"] = latency
    _emit(payload, level=logging.WARNING)


def emit_quota_exhausted(
    *,
    quota: str,
    namespace: str,
    category: str,
    dimension: str,
    route_template: str | None,
    limit: int,
    window_seconds: int,
) -> None:
    """A paid/limited quota ran out: a UTC-daily allowance or an AI ceiling."""
    if quota not in {"daily", "ai"}:
        quota = "unknown"
    _emit(
        {
            "event": "ratelimit.quota_exhausted",
            "outcome": "throttled",
            "quota": quota,
            "limit": int(limit),
            "window_seconds": int(window_seconds),
            **_common(
                namespace=namespace,
                category=category,
                dimension=dimension,
                route_template=route_template,
            ),
        },
        level=logging.WARNING,
    )
