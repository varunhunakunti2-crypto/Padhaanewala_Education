"""Best-effort client IP extraction for audit logs.

`RequestContextMiddleware` already trusts `X-Forwarded-For`, so this mirrors that
trust model. It is intentionally not used for authorization decisions — only for
attribution in the audit trail.
"""

from fastapi import Request

#: Only the first hop in X-Forwarded-For is the client; the rest are proxies.
_MAX_IP_LEN = 45  # matches AuditLog.ip_address String(45), fits IPv6


def client_ip(request: Request | None) -> str | None:
    if request is None:
        return None

    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first[:_MAX_IP_LEN]

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()[:_MAX_IP_LEN]

    if request.client and request.client.host:
        return request.client.host[:_MAX_IP_LEN]

    return None
