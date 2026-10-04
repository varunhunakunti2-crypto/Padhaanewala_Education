"""Forwarded headers must not be trusted when no proxy is declared.

## The defect this file exists to prevent

`client_ip` exists because `X-Forwarded-For` is client-controlled, and it gated
that header on `TRUSTED_PROXY_HOPS > 0` as it should. It then unconditionally
consulted a **second** forwarded header, `X-Real-IP`, outside that gate.

With the shipped default of `TRUSTED_PROXY_HOPS = 0` that made every caller able
to choose its own attribution:

- `audit_logs.ip_address` and `enquiries.ip_address` accepted arbitrary text, not
  just addresses — `X-Real-IP: not-an-ip-at-all` was stored verbatim in a forensic
  column;
- `_client_key` derives the rate-limit bucket from this value, so varying the
  header minted a **fresh bucket per request** and bypassed the auth limiter that
  BUG-07 exists to make cluster-wide.

`client_ip`'s own docstring claimed "At 0 the header is ignored entirely and the
socket peer is authoritative", which was false for `X-Real-IP`.

## Why the existing test missed it

`test_data_integrity.py` asserts that an `X-Forwarded-For` spoof is ignored at
`hops = 0`. That is the header the code *did* ignore, so the test agreed with
itself while the other header went untested — the same shape as BUG-01, BUG-05,
BUG-09 and BUG-11: a green assertion with nothing behind it.

These tests cover both headers, both settings, and the rate-limit key, because
the defect was only ever visible at the boundary between the extractor and its
two callers.
"""

from __future__ import annotations

import pytest
from starlette.requests import Request

from app.config import settings
from app.middleware.ratelimit import _client_key
from app.utils.client_ip import client_ip

AUTH_PATH = "/api/v1/auth/login"

#: The address of the machine making the request, as the socket sees it. Every
#: assertion below is ultimately about whether this value survives.
SOCKET_PEER = "203.0.113.9"


def _request(headers: dict[str, str] | None = None) -> Request:
    """A request as ASGI hands it over: socket peer set, headers client-supplied."""
    encoded = [
        (key.lower().encode(), value.encode())
        for key, value in (headers or {}).items()
    ]
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": AUTH_PATH,
            "query_string": b"",
            "headers": encoded,
            "client": (SOCKET_PEER, 51234),
            "scheme": "http",
            "server": ("testserver", 80),
            "root_path": "",
            "http_version": "1.1",
        }
    )


@pytest.fixture
def no_proxy(monkeypatch):
    """The shipped default: nothing is claimed to sit in front of the app."""
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 0)


@pytest.fixture
def one_proxy(monkeypatch):
    """A single trusted reverse proxy, as a real deployment behind nginx has."""
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)


# --------------------------------------------------------------------------
# hops == 0 — the default, and the configuration the defect applied to
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "spoof",
    [
        "198.51.100.7",
        "9.9.9.9",
        "not-an-ip-at-all-but-under-45-chars",
        "<script>alert(1)</script>",
        "'; DROP TABLE audit_logs; --",
    ],
)
def test_x_real_ip_is_ignored_when_no_proxy_is_declared(no_proxy, spoof):
    """The regression: `X-Real-IP` is client-controlled at hops == 0.

    Every value here previously landed in `audit_logs.ip_address`, so the test is
    parameterised over non-addresses rather than just over rival IPs — cleaning
    up the text was never the requirement, rejecting it is.
    """
    request = _request({"X-Real-IP": spoof})

    assert client_ip(request) == SOCKET_PEER


def test_x_forwarded_for_is_ignored_when_no_proxy_is_declared(no_proxy):
    """The behaviour that already worked, pinned so the gate stays in place."""
    request = _request({"X-Forwarded-For": "198.51.100.7"})

    assert client_ip(request) == SOCKET_PEER


def test_both_headers_together_are_still_ignored(no_proxy):
    """Sending both is what an attacker probing for a gap would do."""
    request = _request(
        {"X-Forwarded-For": "198.51.100.7", "X-Real-IP": "9.9.9.9"}
    )

    assert client_ip(request) == SOCKET_PEER


def test_a_spoofed_header_cannot_move_the_rate_limit_bucket(no_proxy):
    """The impact that mattered: the auth limiter's key must not be a request input.

    Varying the header previously produced a different bucket per value, which is
    a rate-limit bypass — the limiter was cluster-wide (BUG-07) but its key was
    attacker-controlled.
    """
    keys = {
        _client_key(_request({"X-Real-IP": spoof}))
        for spoof in ("198.51.100.7", "9.9.9.9", "203.0.113.200")
    }

    assert keys == {SOCKET_PEER}, f"spoofed headers minted {len(keys)} buckets"


# --------------------------------------------------------------------------
# hops > 0 — a trusted proxy really is in front, so its headers are evidence
# --------------------------------------------------------------------------


def test_x_real_ip_is_honoured_when_a_proxy_is_declared(one_proxy):
    """nginx and several CDNs emit `X-Real-IP` instead of appending to XFF."""
    request = _request({"X-Real-IP": "198.51.100.7"})

    assert client_ip(request) == "198.51.100.7"


def test_x_forwarded_for_is_honoured_when_a_proxy_is_declared(one_proxy):
    request = _request({"X-Forwarded-For": "198.51.100.7"})

    assert client_ip(request) == "198.51.100.7"


def test_x_forwarded_for_is_read_from_the_right_for_a_declared_proxy(one_proxy):
    """One hop means the last entry is the client the proxy observed."""
    request = _request({"X-Forwarded-For": "203.0.113.1, 198.51.100.7"})

    assert client_ip(request) == "198.51.100.7"


def test_a_chain_shorter_than_the_declared_topology_falls_back_to_the_socket(
    monkeypatch,
):
    """A chain too short to locate the declared hop cannot prove where it starts.

    Two hops are declared but only one address arrived, so the entry cannot be
    attributed to the client rather than to a proxy, and the socket peer is used
    instead. Note that a one-entry chain is *not* this case: with a single trusted
    proxy that entry genuinely is the peer it observed.
    """
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 2)
    request = _request({"X-Forwarded-For": "198.51.100.7"})

    assert client_ip(request) == SOCKET_PEER


def test_a_non_address_is_rejected_even_from_a_declared_proxy(one_proxy):
    """A trusted proxy is not a licence to store arbitrary text in the audit trail."""
    request = _request({"X-Real-IP": "definitely-not-an-ip"})

    assert client_ip(request) == SOCKET_PEER


def test_ipv6_is_honoured_from_a_declared_proxy(one_proxy):
    """The column is `String(45)`, sized for IPv6, so IPv6 must not be rejected."""
    assert client_ip(_request({"X-Real-IP": "2001:db8::1"})) == "2001:db8::1"


def test_ipv6_from_forwarded_for_is_honoured_from_a_declared_proxy(one_proxy):
    assert client_ip(_request({"X-Forwarded-For": "2001:db8::1"})) == "2001:db8::1"


# --------------------------------------------------------------------------
# Invariants that must hold regardless
# --------------------------------------------------------------------------


def test_no_request_yields_an_unattributed_answer(no_proxy):
    """Failing closed to `None` would silently drop throttle and attribution keys.

    `unknown` is the documented fallback in `_client_key`; `client_ip` returning
    `None` for a request that has a socket peer would collapse every such caller
    into that one bucket, which is its own denial-of-service.
    """
    assert client_ip(_request()) == SOCKET_PEER


def test_a_request_without_a_socket_peer_is_none(no_proxy):
    """Not every ASGI server populates `client`. `None` is correct there."""
    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": AUTH_PATH,
            "query_string": b"",
            "headers": [],
            "client": None,
            "scheme": "http",
            "server": ("testserver", 80),
            "root_path": "",
            "http_version": "1.1",
        }
    )

    assert client_ip(request) is None


def test_a_socket_peer_that_is_not_an_ip_is_still_returned(no_proxy):
    """The socket peer is authoritative, so it is held to a looser standard.

    `TestClient` presents itself as the string `testclient`, and a unix-socket
    ASGI server reports a filesystem path. Validating the peer as strictly as a
    forwarded header writes `None` into `audit_logs.ip_address` and collapses
    every such caller onto the single `unknown` rate-limit bucket — a denial of
    service manufactured by a hardening change.

    This is not a licence to trust the peer as an *address* for the audit trail's
    purposes; it only means "not `None`". The distinction is that the peer cannot
    be chosen by the caller, whereas a header can.
    """
    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": AUTH_PATH,
            "query_string": b"",
            "headers": [],
            "client": ("testclient", 50000),
            "scheme": "http",
            "server": ("testserver", 80),
            "root_path": "",
            "http_version": "1.1",
        }
    )

    assert client_ip(request) == "testclient"


def test_a_forwarded_header_is_still_rejected_when_the_peer_would_not_be(no_proxy):
    """The looser standard must not leak back into the header path."""
    request = Request(
        {
            "type": "http",
            "method": "POST",
            "path": AUTH_PATH,
            "query_string": b"",
            "headers": [(b"x-real-ip", b"not-an-ip")],
            "client": ("testclient", 50000),
            "scheme": "http",
            "server": ("testserver", 80),
            "root_path": "",
            "http_version": "1.1",
        }
    )

    assert client_ip(request) == "testclient"


def test_none_request_is_none():
    assert client_ip(None) is None