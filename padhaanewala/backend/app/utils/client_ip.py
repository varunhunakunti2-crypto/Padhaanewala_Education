"""Best-effort client IP extraction for rate limiting and the audit trail.

`X-Forwarded-For` is a plain client-controlled header: anybody can send
`X-Forwarded-For: 1.2.3.4` and the server has no way to tell that apart from a
value a real proxy added. Trusting the first entry unconditionally means an
attacker gets a fresh rate-limit bucket per request and can write arbitrary
strings into `audit_logs.ip_address` and `enquiries.ip_address` — which is both
a rate-limit bypass and a corrupted forensic record.

The fix is to declare how many reverse proxies actually sit in front of the app
(`TRUSTED_PROXY_HOPS`) and take the entry that many positions from the *right*
of the list, because each proxy appends the peer it observed. At 0 the header
is ignored entirely and the socket peer is authoritative.

This function is never used for authorization decisions, only for throttling and
attribution. Wrong in the other direction it is a privacy problem (recording a
proxy's IP instead of the user's), so `TRUSTED_PROXY_HOPS` must be set to match
the real deployment rather than left at a convenient value.
"""

from fastapi import Request

from app.config import settings

#: Only the first hop in X-Forwarded-For is the client; the rest are proxies.
_MAX_IP_LEN = 45  # matches AuditLog.ip_address String(45), fits IPv6


def _sanitize(value: str) -> str | None:
    value = value.strip()
    # A malformed value must never be stored verbatim; it would either fail the
    # String(45) column or smuggle attacker text into the audit trail.
    if not value or len(value) > _MAX_IP_LEN:
        return None
    if any(ch.isspace() or ch in "\"'<>,;" for ch in value):
        return None
    return value


def client_ip(request: Request | None) -> str | None:
    if request is None:
        return None

    hops = settings.TRUSTED_PROXY_HOPS
    if hops > 0:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            chain = [_sanitize(part) for part in forwarded.split(",")]
            # Right-to-left: the last entry was added by the proxy closest to us
            # and is the most trustworthy. Walk back `hops` proxies and take the
            # address the one before that observed.
            index = len(chain) - hops
            if 0 <= index < len(chain) and chain[index]:
                return chain[index]
            # The chain is shorter than the declared topology, so it cannot be
            # trusted. Fall through to the socket peer rather than guessing.

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        sanitized = _sanitize(real_ip)
        if sanitized:
            return sanitized

    if request.client and request.client.host:
        return _sanitize(request.client.host)

    return None
