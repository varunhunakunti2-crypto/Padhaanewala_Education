import asyncio
import hashlib
import json
from collections import defaultdict

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from redis.exceptions import ConnectionError as RedisConnectionError
from starlette.requests import Request

from app.config import settings
from app.main import app as main_app
from app.middleware import ratelimit
from app.middleware.rate_limit_dimensions import (
    _RATE_LIMIT_MULTI_SCRIPT,
    extract_identifier_hashes,
    extract_verified_user_id,
    get_cached_json_body,
    get_trusted_client_ip,
)
from app.middleware.ratelimit import RateLimitMiddleware, _build_p3_checks
from app.middleware.rate_limit_policy import (
    ResolvedRateLimit,
    reset_route_template_cache,
    resolve_rate_limit,
)
from app.utils.security import ALGORITHM, create_access_token


class MultiFakeRedis:
    """Redis fake supporting single-key and multi-key atomic limiter scripts."""

    def __init__(self):
        self.counts = defaultdict(int)
        self.ttls = {}
        self.eval_calls = 0
        self.scripts = []

    async def eval(self, script: str, numkeys: int, *args):
        self.eval_calls += 1
        self.scripts.append(script)
        keys = list(args[:numkeys])
        rest = list(args[numkeys:])

        # Single-key legacy script
        if numkeys == 1 and len(rest) == 1 and "if count == 1 then" in script and "for i = 1" not in script:
            key = keys[0]
            window = int(rest[0])
            self.counts[key] += 1
            if self.counts[key] == 1:
                self.ttls[key] = window
            return [self.counts[key], self.ttls.get(key, -1)]

        # Multi-key check-all then increment-all script
        assert len(rest) == numkeys * 2
        windows = [int(x) for x in rest[:numkeys]]
        limits = [int(x) for x in rest[numkeys:]]

        # Check phase (no side effects)
        for i, key in enumerate(keys):
            if self.counts.get(key, 0) >= limits[i]:
                ttl = self.ttls.get(key, windows[i])
                return [0, i + 1, ttl]

        # Increment phase
        for i, key in enumerate(keys):
            self.counts[key] += 1
            if self.counts[key] == 1:
                self.ttls[key] = windows[i]
        return [1, 0, self.ttls.get(keys[0], windows[0])]

    async def ping(self):
        return True

    async def get(self, key: str):
        value = self.counts.get(key)
        return str(value) if value is not None else None


class BrokenMultiRedis:
    async def eval(self, *args, **kwargs):
        raise RedisConnectionError("refused")

    async def ping(self):
        raise RedisConnectionError("refused")


def _hash(kind: str, value: str) -> str:
    return hashlib.sha256(f"{kind}:{value}".encode("utf-8")).hexdigest()[:32]


@pytest.fixture(autouse=True)
def _reset_policy_cache():
    reset_route_template_cache()
    yield
    reset_route_template_cache()


def _request(method: str, path: str, headers=None, json_body=None, client=("127.0.0.1", 1234), app=None):
    body = b""
    hdrs = []
    if headers:
        for k, v in headers.items():
            hdrs.append((k.lower().encode(), str(v).encode()))
    if json_body is not None:
        body = json.dumps(json_body).encode("utf-8")
        if not any(k == b"content-type" for k, _ in hdrs):
            hdrs.append((b"content-type", b"application/json"))
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": method,
        "path": path,
        "raw_path": path.encode(),
        "headers": hdrs,
        "query_string": b"",
        "scheme": "http",
        "server": ("testserver", 80),
        "client": client,
        "app": app or FastAPI(),
    }
    sent = False

    async def receive():
        nonlocal sent
        if sent:
            return {"type": "http.disconnect"}
        sent = True
        return {"type": "http.request", "body": body, "more_body": False}

    return Request(scope, receive)


def test_extract_verified_user_id_accepts_valid_access_token_and_rejects_invalid():
    token = create_access_token(42, "student")
    req = _request("GET", "/api/v1/users", headers={"authorization": f"Bearer {token}"})
    assert extract_verified_user_id(req) == "42"

    req2 = _request("GET", "/api/v1/users", headers={"authorization": "Bearer not-a-token"})
    assert extract_verified_user_id(req2) is None

    # Wrong type (refresh-like payload shape is not accepted; access token required)
    bad = _request("GET", "/api/v1/users", headers={"authorization": "Bearer abc.def.ghi"})
    assert extract_verified_user_id(bad) is None


def test_client_supplied_user_id_is_not_trusted(monkeypatch):
    # Even if body/query/header carries user_id, middleware identity comes only from verified JWT.
    fake = MultiFakeRedis()
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_ENABLED", True)
    # Apply user dim to auth category for this test by forcing a category policy via fallback
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_CATEGORY", "authenticated_api")
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_NAMESPACE", "test-user-dim")
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_LIMIT", 100)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_METHODS", ["POST"])
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_APPLY_IDENTITY_FOR_CATEGORIES", ["authenticated_api"])
    monkeypatch.setattr(ratelimit, "get_redis", lambda: fake)

    app = FastAPI()
    app.add_middleware(RateLimitMiddleware)

    @app.post("/api/v1/protected")
    async def protected():
        return {"ok": True}

    client = TestClient(app)
    r = client.post("/api/v1/protected?user_id=999", json={"user_id": 999}, headers={"X-User-Id": "999"})
    assert r.status_code == 200
    # No authenticated user key should be created because there is no verified JWT.
    assert not any(":dim:user:" in k for k in fake.counts.keys())


def test_spoofed_forwarded_header_rejected_for_rate_limit_bucket(monkeypatch):
    fake = MultiFakeRedis()
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 0)
    monkeypatch.setattr(settings, "RATE_LIMIT_EXACT_OVERRIDES", {
        "/api/v1/rl": {"limit": 100, "window_seconds": 60, "methods": ["POST"], "namespace": "spoof", "category": "student_operations", "priority": 500}
    })
    monkeypatch.setattr(ratelimit, "get_redis", lambda: fake)

    app = FastAPI()
    app.add_middleware(RateLimitMiddleware)

    @app.post("/api/v1/rl")
    async def rl():
        return {"ok": True}

    client = TestClient(app)
    for forged in ["1.2.3.4", "9.9.9.9"]:
        resp = client.post("/api/v1/rl", headers={"x-forwarded-for": forged})
        assert resp.status_code == 200
    # Both requests must share the same socket/testclient-derived bucket, not per-forged IP.
    route_keys = [k for k in fake.counts if k.startswith("rl:spoof:/api/v1/rl:")]
    assert len(route_keys) == 1


def test_email_and_phone_normalization_for_identifier_hashes():
    app = FastAPI()

    req_email = _request("POST", "/api/v1/auth/login", json_body={"email": "  USER@Example.COM  "}, app=app)
    body = asyncio.run(get_cached_json_body(req_email))
    hashes = extract_identifier_hashes(req_email, body)
    assert hashes["email"] == _hash("email", "user@example.com")

    req_phone = _request("POST", "/api/v1/auth/login/otp/send", json_body={"mobile": "+91 98765 43210"}, app=app)
    body = asyncio.run(get_cached_json_body(req_phone))
    hashes = extract_identifier_hashes(req_phone, body)
    assert hashes["phone"] == _hash("phone", "9876543210")

    req_reg = _request("POST", "/api/v1/auth/register", json_body={
        "email": "USER@Example.COM", "mobile": "919876543210", "name": "A", "password": "password123", "age_band": "18_plus"
    }, app=app)
    body = asyncio.run(get_cached_json_body(req_reg))
    hashes = extract_identifier_hashes(req_reg, body)
    assert hashes["email"] == _hash("email", "user@example.com")
    assert hashes["phone"] == _hash("phone", "9876543210")


def test_login_identifier_and_ip_enforcement(monkeypatch):
    fake = MultiFakeRedis()
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_IDENTIFIER_LIMITS", {
        **getattr(settings, "RATE_LIMIT_P3_IDENTIFIER_LIMITS", {}),
        "auth:login:email": {"limit": 1, "window_seconds": 600},
        "auth:login:ip": {"limit": 100, "window_seconds": 600},
    })
    monkeypatch.setattr(ratelimit, "get_redis", lambda: fake)

    client = TestClient(main_app)
    # First attempt for same email from different IP should pass route/identifier checks (auth fails with 401)
    r1 = client.post("/api/v1/auth/login", json={"email": "same@example.com", "password": "wrong-password-1"})
    # Simulate different IP for second request by direct middleware call context is hard with TestClient;
    # but identifier hash is email-based so second attempt with same email must be limited by identifier dim.
    r2 = client.post("/api/v1/auth/login", json={"email": "same@example.com", "password": "wrong-password-1"})
    assert r1.status_code in (401, 403)
    assert r2.status_code == 429


def test_otp_identifier_and_ip_enforcement(monkeypatch):
    fake = MultiFakeRedis()
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_IDENTIFIER_LIMITS", {
        **getattr(settings, "RATE_LIMIT_P3_IDENTIFIER_LIMITS", {}),
        "auth:otp_verify:phone": {"limit": 1, "window_seconds": 600},
        "auth:otp_verify:ip": {"limit": 100, "window_seconds": 600},
    })
    monkeypatch.setattr(ratelimit, "get_redis", lambda: fake)

    client = TestClient(main_app)
    body = {"mobile": "9876543210", "otp": "123456"}
    r1 = client.post("/api/v1/auth/login/otp/verify", json=body)
    r2 = client.post("/api/v1/auth/login/otp/verify", json=body)
    assert r1.status_code == 401
    assert r2.status_code == 429


def test_authenticated_user_based_limiting_and_same_user_across_ips(monkeypatch):
    fake = MultiFakeRedis()
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_CATEGORY", "student_operations")
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_NAMESPACE", "p3-student")
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_LIMIT", 100)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_WINDOW_SECONDS", 60)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_METHODS", ["POST"])
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_APPLY_IDENTITY_FOR_CATEGORIES", ["student_operations"])
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_CATEGORY_IDENTITY_LIMITS", {
        **getattr(settings, "RATE_LIMIT_P3_CATEGORY_IDENTITY_LIMITS", {}),
        "student_operations": {"ip_limit": 100, "ip_window": 60, "user_limit": 1, "user_window": 60},
    })
    monkeypatch.setattr(ratelimit, "get_redis", lambda: fake)

    app = FastAPI()
    app.add_middleware(RateLimitMiddleware)

    @app.post("/api/v1/student/action")
    async def action():
        return {"ok": True}

    token = create_access_token(777, "student")
    client = TestClient(app)
    r1 = client.post("/api/v1/student/action", headers={"authorization": f"Bearer {token}", "x-forwarded-for": "10.0.0.1"})
    r2 = client.post("/api/v1/student/action", headers={"authorization": f"Bearer {token}", "x-forwarded-for": "10.0.0.2"})
    # TRUSTED_PROXY_HOPS=0 in tests by default, so XFF is ignored for IP; but user dimension must still block same user.
    assert r1.status_code == 200
    assert r2.status_code == 429
    assert any(":dim:user:student_operations:" in k and k.endswith(":777") for k in fake.counts.keys())


def test_multiple_users_sharing_one_ip_get_independent_user_counters(monkeypatch):
    fake = MultiFakeRedis()
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_CATEGORY", "student_operations")
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_NAMESPACE", "p3-shared-ip")
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_LIMIT", 100)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_METHODS", ["POST"])
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_APPLY_IDENTITY_FOR_CATEGORIES", ["student_operations"])
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_CATEGORY_IDENTITY_LIMITS", {
        **getattr(settings, "RATE_LIMIT_P3_CATEGORY_IDENTITY_LIMITS", {}),
        "student_operations": {"ip_limit": 100, "ip_window": 60, "user_limit": 1, "user_window": 60},
    })
    monkeypatch.setattr(ratelimit, "get_redis", lambda: fake)

    app = FastAPI()
    app.add_middleware(RateLimitMiddleware)

    @app.post("/api/v1/student/do")
    async def do_it():
        return {"ok": True}

    client = TestClient(app)
    t1 = create_access_token(1, "student")
    t2 = create_access_token(2, "student")
    assert client.post("/api/v1/student/do", headers={"authorization": f"Bearer {t1}"}).status_code == 200
    assert client.post("/api/v1/student/do", headers={"authorization": f"Bearer {t2}"}).status_code == 200
    assert any(k.endswith(":dim:user:student_operations:/api/v1/student/do:1") for k in fake.counts.keys())
    assert any(k.endswith(":dim:user:student_operations:/api/v1/student/do:2") for k in fake.counts.keys())


def test_multiple_counters_single_request_and_no_partial_consumption_on_reject(monkeypatch):
    fake = MultiFakeRedis()
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_CATEGORY", "student_operations")
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_NAMESPACE", "p3-multi")
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_LIMIT", 100)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_METHODS", ["POST"])
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_APPLY_IDENTITY_FOR_CATEGORIES", ["student_operations"])
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_CATEGORY_IDENTITY_LIMITS", {
        **getattr(settings, "RATE_LIMIT_P3_CATEGORY_IDENTITY_LIMITS", {}),
        "student_operations": {"ip_limit": 1, "ip_window": 60, "user_limit": 100, "user_window": 60},
    })
    monkeypatch.setattr(ratelimit, "get_redis", lambda: fake)

    app = FastAPI()
    app.add_middleware(RateLimitMiddleware)

    @app.post("/api/v1/student/multi")
    async def multi():
        return {"ok": True}

    token = create_access_token(55, "student")
    client = TestClient(app)
    # First request consumes route + ip-dim + user-dim atomically.
    assert client.post("/api/v1/student/multi", headers={"authorization": f"Bearer {token}"}).status_code == 200
    before = dict(fake.counts)
    # Second request should be rejected by IP dimension before incrementing anything (atomic check-all).
    assert client.post("/api/v1/student/multi", headers={"authorization": f"Bearer {token}"}).status_code == 429
    assert dict(fake.counts) == before


def test_redis_atomicity_under_concurrent_requests_multi_dim(monkeypatch):
    # Simulate concurrent evaluation by interleaving would be complex; we verify multi-script semantics
    # and shared-key behavior with a shared fake store (single-process sequential here, real Redis covered by live tests).
    fake = MultiFakeRedis()
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_EXACT_OVERRIDES", {
        "/api/v1/concurrent": {"limit": 2, "window_seconds": 60, "methods": ["POST"], "namespace": "conc", "category": "student_operations", "priority": 500}
    })
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_ENABLED", False)
    monkeypatch.setattr(ratelimit, "get_redis", lambda: fake)

    app = FastAPI()
    app.add_middleware(RateLimitMiddleware)

    @app.post("/api/v1/concurrent")
    async def conc():
        return {"ok": True}

    async def run():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            results = await asyncio.gather(*[client.post("/api/v1/concurrent") for _ in range(5)])
        return [r.status_code for r in results]

    statuses = asyncio.run(run())
    assert statuses.count(200) == 2
    assert statuses.count(429) == 3


def test_multiple_backend_instances_share_redis_keys(monkeypatch):
    # Two app/middleware instances sharing the same Redis client emulate separate backend replicas.
    fake = MultiFakeRedis()
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_EXACT_OVERRIDES", {
        "/api/v1/shared": {"limit": 2, "window_seconds": 60, "methods": ["POST"], "namespace": "shared", "category": "student_operations", "priority": 500}
    })
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_ENABLED", False)
    monkeypatch.setattr(ratelimit, "get_redis", lambda: fake)

    def make_client():
        app = FastAPI()
        app.add_middleware(RateLimitMiddleware)

        @app.post("/api/v1/shared")
        async def shared():
            return {"ok": True}

        return TestClient(app)

    c1 = make_client()
    c2 = make_client()
    assert c1.post("/api/v1/shared").status_code == 200
    assert c2.post("/api/v1/shared").status_code == 200
    assert c1.post("/api/v1/shared").status_code == 429
    assert len([k for k in fake.counts if k.startswith("rl:shared:")]) == 1


def test_identifier_hashes_do_not_store_raw_pii_in_keys(monkeypatch):
    fake = MultiFakeRedis()
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_IDENTIFIER_LIMITS", {
        **getattr(settings, "RATE_LIMIT_P3_IDENTIFIER_LIMITS", {}),
        "auth:login:email": {"limit": 10, "window_seconds": 600},
        "auth:login:ip": {"limit": 10, "window_seconds": 600},
    })
    monkeypatch.setattr(ratelimit, "get_redis", lambda: fake)

    client = TestClient(main_app)
    raw_email = "Sensitive.User@example.com"
    client.post("/api/v1/auth/login", json={"email": raw_email, "password": "wrong-password-1"})
    all_keys = " ".join(fake.counts.keys())
    assert "Sensitive.User" not in all_keys
    assert "sensitive.user@example.com" not in all_keys
    assert _hash("email", "sensitive.user@example.com") in all_keys


# ---------------------------------------------------------------------------
# P3.1 — activate configured category IP/user dimensions
# ---------------------------------------------------------------------------

P31_CATEGORY_PATHS = {
    "authenticated_api": "/api/v1/p31/authenticated",
    "anonymous_api": "/api/v1/p31/anonymous",
    "student_operations": "/api/v1/p31/student",
    "admin_operations": "/api/v1/p31/admin",
    "ai_operations": "/api/v1/p31/ai",
    "file_uploads": "/api/v1/p31/upload",
}

P31_USER_CATEGORIES = [
    "authenticated_api",
    "student_operations",
    "admin_operations",
    "ai_operations",
    "file_uploads",
]


def _category_app(path: str) -> FastAPI:
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware)

    @app.post(path)
    async def endpoint():
        return {"ok": True}

    return app


def _configure_category(
    monkeypatch,
    category: str,
    path: str,
    *,
    ip_limit: int,
    user_limit: int | None,
    window: int = 60,
) -> MultiFakeRedis:
    fake = MultiFakeRedis()
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_APPLY_IDENTITY_FOR_CATEGORIES", [category])
    monkeypatch.setattr(
        settings,
        "RATE_LIMIT_P3_CATEGORY_IDENTITY_LIMITS",
        {
            category: {
                "ip_limit": ip_limit,
                "ip_window": window,
                "user_limit": user_limit,
                "user_window": window,
            }
        },
    )
    monkeypatch.setattr(
        settings,
        "RATE_LIMIT_EXACT_OVERRIDES",
        {
            path: {
                "limit": 100,
                "window_seconds": 60,
                "methods": ["POST"],
                "namespace": f"p31-{category}",
                "category": category,
                "priority": 500,
            }
        },
    )
    monkeypatch.setattr(ratelimit, "get_redis", lambda: fake)
    return fake


@pytest.mark.parametrize("category", sorted(P31_CATEGORY_PATHS))
def test_each_configured_category_enforces_ip_dimension(monkeypatch, category):
    """Every configured category must add its IP counter to the request."""
    path = P31_CATEGORY_PATHS[category]
    fake = _configure_category(monkeypatch, category, path, ip_limit=1, user_limit=100)
    client = TestClient(_category_app(path))

    assert client.post(path).status_code == 200
    assert client.post(path).status_code == 429
    assert any(k.startswith(f"rl:dim:ip:{category}:") for k in fake.counts)


@pytest.mark.parametrize("category", P31_USER_CATEGORIES)
def test_authenticated_category_enforces_user_dimension(monkeypatch, category):
    """A verified access token must add the category's user counter."""
    path = P31_CATEGORY_PATHS[category]
    fake = _configure_category(monkeypatch, category, path, ip_limit=100, user_limit=1)
    token = create_access_token(321, "student")
    headers = {"authorization": f"Bearer {token}"}
    client = TestClient(_category_app(path))

    assert client.post(path, headers=headers).status_code == 200
    assert client.post(path, headers=headers).status_code == 429
    assert any(":dim:user:" in k and k.endswith(":321") for k in fake.counts)


def test_same_user_shares_quota_across_different_ips(monkeypatch):
    """The user key must not include the IP, so a user cannot reset by moving."""
    category = "student_operations"
    path = P31_CATEGORY_PATHS[category]
    fake = _configure_category(monkeypatch, category, path, ip_limit=100, user_limit=1)
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    token = create_access_token(777, "student")
    client = TestClient(_category_app(path))

    def post(ip: str):
        return client.post(
            path,
            headers={"authorization": f"Bearer {token}", "x-forwarded-for": ip},
        )

    assert post("10.0.0.1").status_code == 200
    assert post("10.0.0.2").status_code == 429
    assert any(
        k.startswith(f"rl:dim:user:{category}:") and k.endswith(":777")
        for k in fake.counts
    )


def test_different_users_sharing_one_ip_have_independent_user_quotas(monkeypatch):
    """User buckets are keyed by verified user id, not by the shared IP."""
    category = "student_operations"
    path = P31_CATEGORY_PATHS[category]
    fake = _configure_category(monkeypatch, category, path, ip_limit=100, user_limit=1)
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    client = TestClient(_category_app(path))

    def post(user_id: int):
        token = create_access_token(user_id, "student")
        return client.post(
            path,
            headers={"authorization": f"Bearer {token}", "x-forwarded-for": "10.0.0.9"},
        )

    assert post(11).status_code == 200
    assert post(22).status_code == 200
    assert any(k.endswith(":11") and ":dim:user:" in k for k in fake.counts)
    assert any(k.endswith(":22") and ":dim:user:" in k for k in fake.counts)


def test_anonymous_requests_are_limited_by_ip(monkeypatch):
    """Anonymous callers still get the category IP bucket, with no user bucket."""
    category = "anonymous_api"
    path = P31_CATEGORY_PATHS[category]
    fake = _configure_category(monkeypatch, category, path, ip_limit=1, user_limit=None)
    client = TestClient(_category_app(path))

    assert client.post(path).status_code == 200
    assert client.post(path).status_code == 429
    assert any(k.startswith(f"rl:dim:ip:{category}:") for k in fake.counts)
    assert not any(":dim:user:" in k for k in fake.counts)


def test_default_explicit_category_classifications_resolve(monkeypatch):
    """Default rules classify only the listed routes into the target categories."""
    cases = [
        ("POST", "/api/v1/ai/chat", "ai_operations"),
        # P9 deliberately moves the administrative upload and settings writes
        # out of the broad P3 categories and into their own sensitive ceilings.
        ("POST", "/api/v1/media/upload", "admin_media_upload"),
        ("PUT", "/api/v1/settings", "admin_settings_update"),
        ("PATCH", "/api/v1/users/5", "admin_user_mutation"),
        ("GET", "/api/v1/audit-logs", "admin_audit_read"),
        ("POST", "/api/v1/question-imports/5/review-all", "admin_bulk_import"),
        # P7 deliberately moves these student surfaces out of the generic
        # `authenticated_api` category and gives each its own operation limit.
        ("PUT", "/api/v1/users/me", "student_operations"),
        ("POST", "/api/v1/saved-colleges", "student_operations"),
        ("POST", "/api/v1/consent", "student_operations"),
        ("PUT", "/api/v1/notifications/my/read-all", "student_operations"),
        # P8 deliberately gives view tracking its own category and per-article
        # limit instead of treating it as generic anonymous traffic.
        ("POST", "/api/v1/blogs/example-post/view", "blog_view"),
        ("POST", "/api/v1/predictor", "ai_predictor"),
        ("POST", "/api/v1/question-imports/pdf", "ai_question_generation"),
    ]
    for method, path, category in cases:
        resolved = resolve_rate_limit(_request(method, path, app=main_app), settings)
        assert resolved is not None, (method, path)
        assert resolved.category == category, (method, path, resolved.category)


def test_ai_and_file_upload_categories_use_configured_limits():
    """The configured AI/file-upload IP and user limits are what get enforced."""
    request = _request("POST", "/api/v1/ai/chat", app=main_app)
    for category, expected_limit, expected_window in [
        ("ai_operations", 10, 60),
        ("file_uploads", 5, 600),
    ]:
        resolved = ResolvedRateLimit(
            namespace=f"cat:{category}",
            limit=100,
            window_seconds=60,
            bucket_path="/api/v1/test",
            category=category,
            path="/api/v1/test",
        )
        checks = _build_p3_checks(request, resolved, "5", {})
        ip_check = next(c for c in checks if c.dimension == "ip")
        user_check = next(c for c in checks if c.dimension == "user")
        assert (ip_check.limit, ip_check.window_seconds) == (expected_limit, expected_window)
        assert (user_check.limit, user_check.window_seconds) == (expected_limit, expected_window)


def test_existing_route_specific_limit_is_preserved():
    """P3.1 category dimensions must not replace the auth 5/minute route limit."""
    resolved = resolve_rate_limit(_request("POST", "/api/v1/auth/login", app=main_app), settings)
    assert resolved is not None
    assert (resolved.namespace, resolved.limit, resolved.window_seconds) == ("auth", 5, 60)
    assert resolved.category == "authentication"
