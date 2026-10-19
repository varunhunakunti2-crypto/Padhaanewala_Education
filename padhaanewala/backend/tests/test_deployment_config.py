"""Deployment hardening the test suite can actually read.

The Dockerfile is never imported by the application, so nothing else notices if
its `CMD` changes. These pin the decisions made when the header-trust hole was
closed (see `test_data_integrity.py` for the runtime behaviour they protect):

  * uvicorn must NOT be told to trust `X-Forwarded-For` from its peers. With
    `--proxy-headers` / `--forwarded-allow-ips`, uvicorn rewrites
    `request.client` from a client-supplied header *before* application code
    runs, so `client_ip()`'s `TRUSTED_PROXY_HOPS` check is bypassed and a caller
    on a directly-reachable host can forge their own attribution.

  * the backend stays single-worker: `SESSION_*` state and the rate limiter's
    Redis client are process-local. See the Dockerfile comment above `CMD`.
"""

from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DOCKERFILE = REPO_ROOT / "backend" / "Dockerfile"


def _dockerfile_text() -> str:
    assert DOCKERFILE.exists(), f"{DOCKERFILE} is missing; this test is the only reader"
    return DOCKERFILE.read_text(encoding="utf-8")


def _cmd_instruction(text: str) -> str:
    """Return the top-level `CMD` instruction, joining `\\`-continued lines.

    Deliberately anchored at column 0: `HEALTHCHECK` carries an indented
    `CMD curl ...` continuation line that would otherwise match first.
    """
    lines = text.splitlines()
    for index, line in enumerate(lines):
        if not line.startswith("CMD"):
            continue
        collected = [line]
        while collected[-1].rstrip().endswith("\\"):
            index += 1
            collected.append(lines[index])
        return "\n".join(collected)
    raise AssertionError("Dockerfile has no top-level CMD instruction")


def test_uvicorn_does_not_trust_forwarded_headers_from_any_peer() -> None:
    """`client_ip()` must be the single authority on the client IP.

    `--no-proxy-headers` must be explicit: uvicorn 0.52 defaults `proxy_headers`
    to True and `forwarded_allow_ips` to `$FORWARDED_ALLOW_IPS` or `127.0.0.1`,
    so omitting the flag entirely still rewrites `request.client` for loopback
    peers.
    """
    cmd = _cmd_instruction(_dockerfile_text())
    assert '"--no-proxy-headers"' in cmd
    assert "--forwarded-allow-ips" not in cmd


def test_backend_runs_a_single_worker() -> None:
    cmd = _cmd_instruction(_dockerfile_text())
    assert '"--workers", "1"' in cmd
