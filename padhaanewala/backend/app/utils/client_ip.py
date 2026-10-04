"""Best-effort client IP extraction for rate limiting and the audit trail.

`X-Forwarded-For` is a plain client-controlled header: anybody can send
`X-Forwarded-For: 1.2.3.4` and the server has no way to tell that apart from a
value a real proxy added. Trusting the first entry unconditionally means an
attacker gets a fresh rate-limit bucket per request and can write arbitrary
strings into `audit_logs.ip_address` and `enquiries.ip_address` — which is both
a rate-limit bypass and a corrupted forensic record.

`X-Real-IP` is the same class of header and gets the same treatment. nginx and
several CDNs emit it *instead of* appending to `X-Forwarded-For`, so it is worth
reading — but only when something we trust is known to have written it.

The fix for both is to declare how many reverse proxies actually sit in front of
the app (`TRUSTED_PROXY_HOPS`) and then honour forwarded headers only when that
number is greater than zero. Each proxy appends the peer it observed, so the
entry to trust is that many positions from the *right* of the list. At 0 no
proxy is claimed, so both forwarded headers are attacker-controlled and are
ignored entirely — the socket peer is then the only authority.

This function is never used for authorization decisions, only for throttling and
attribution. Wrong in the other direction it is a privacy problem (recording a
proxy's IP instead of the user's), so `TRUSTED_PROXY_HOPS` must be set to match
the real deployment rather than left at a convenient value. Note the asymmetry
that follows: behind a proxy with the default of 0, requests are attributed to
the proxy. That is the safe direction to fail — set the variable to the real hop
count to fix the attribution.
"""

from ipaddress import ip_address

from fastapi import Request

from app.config import settings

#: `AuditLog.ip_address` is `String(45)`, the longest textual form an IPv6
#: address takes, so every real address fits and nothing longer should be stored.
_MAX_IP_LEN = 45


def _clean(value: str) -> str | None:
    """Length and character checks, applied to every candidate."""
    value = value.strip()
    if not value or len(value) > _MAX_IP_LEN:
        return None
    if any(ch.isspace() or ch in "\"'<>,;" for ch in value):
        return None
    return value


def _sanitize_forwarded(value: str) -> str | None:
    """Return `value` only if it is a real IP address, else `None`.

    Strict, because this is the attacker-controlled path. Length and character
    checks alone are not sufficient: whatever reaches the audit trail is stored
    verbatim in a forensic column, so a candidate that is not an address must be
    rejected outright rather than tidied up. `X-Real-IP: not-an-ip` is short,
    quote-free and whitespace-free, and would otherwise be stored as though it
    were an attribution.
    """
    value = _clean(value)
    if value is None:
        return None
    try:
        ip_address(value)
    except ValueError:
        return None
    return value


def _sanitize_peer(value: str) -> str | None:
    """The socket peer, which is authoritative but not necessarily an address.

    Deliberately looser than the header path. `request.client.host` is not
    attacker-supplied, so demanding a parseable IP buys nothing and costs real
    attribution: `TestClient` presents itself as the string `testclient`, and
    unix-socket ASGI servers report a filesystem path. Rejecting those would
    write `None` into `audit_logs.ip_address` and collapse every such caller onto
    the single `unknown` rate-limit bucket, which is a denial of service in its
    own right.
    """
    return _clean(value)


def client_ip(request: Request | None) -> str | None:
    if request is None:
        return None

    hops = settings.TRUSTED_PROXY_HOPS

    # Forwarded headers are evidence only when a trusted proxy is known to have
    # overwritten them. `hops == 0` claims there is none, so anything arriving in
    # these headers was written by the caller.
    if hops > 0:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            chain = [_sanitize_forwarded(part) for part in forwarded.split(",")]
            # Right-to-left: the last entry was added by the proxy closest to us
            # and is the most trustworthy. Walk back `hops` proxies and take the
            # address the one before that observed.
            index = len(chain) - hops
            if 0 <= index < len(chain) and chain[index]:
                return chain[index]
            # The chain is shorter than the declared topology, so it cannot be
            # trusted. Fall through to the socket peer rather than guessing.

        # Reachable only because `hops > 0` asserts a trusted proxy set it. This
        # branch used to run unconditionally, which is what let any client forge
        # its own attribution and mint a fresh rate-limit bucket per request.
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            sanitized = _sanitize_forwarded(real_ip)
            if sanitized:
                return sanitized

    if request.client and request.client.host:
        return _sanitize_peer(request.client.host)

    return None
