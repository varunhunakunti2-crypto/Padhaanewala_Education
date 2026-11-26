"""P6 — shared Redis protection for the AI endpoints.

P6 replaces the Next.js process-local ``Map`` with the backend's existing Redis
limiter and adds per-identity minute/daily quotas to the routes that can spend
money at a provider. These tests pin the actual enforcement: the route-level
ceiling, the IP/user dimensions, the UTC daily bucket, fail-closed behaviour for
paid operations, and the fact that a rejected request never reaches a provider.

The provider is always faked. The Redis fake mirrors both Lua scripts already in
``app.middleware.ratelimit`` / ``app.middleware.rate_limit_dimensions``; no
script is reimplemented here.
"""

from collections import defaultdict
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from redis.exceptions import ConnectionError as RedisConnectionError
from starlette.requests import Request

from app.config import settings
from app.main import app as main_app
from app.middleware import rate_limit_dimensions as dims
from app.middleware import ratelimit
from app.middleware.rate_limit_policy import (
    ResolvedRateLimit,
    reset_route_template_cache,
    resolve_rate_limit,
)
from app.middleware.ratelimit import _build_p3_checks
from app.utils.security import create_access_token

RATE_HEADERS = ("RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset")


class FakeRedis:
    """In-memory fake of the single-key and multi-key limiter scripts."""

    def __init__(self):
        self.counts = defaultdict(int)
        self.ttls = {}
        self.eval_calls = 0

    async def eval(self, script: str, numkeys: int, *args):
        self.eval_calls += 1
        keys = list(args[:numkeys])
        rest = list(args[numkeys:])

        # Legacy single-key script: EVAL script 1 key window
        if numkeys == 1 and len(rest) == 1 and "for i = 1" not in script:
            key = keys[0]
            window = int(rest[0])
            self.counts[key] += 1
            if self.counts[key] == 1:
                self.ttls[key] = window
            return [self.counts[key], self.ttls.get(key, -1)]

        # Multi-key script: check-all, then increment-all.
        assert len(rest) == numkeys * 2
        windows = [int(x) for x in rest[:numkeys]]
        limits = [int(x) for x in rest[numkeys:]]
        for i, key in enumerate(keys):
            if self.counts.get(key, 0) >= limits[i]:
                return [0, i + 1, self.ttls.get(key, windows[i])]
        for i, key in enumerate(keys):
            self.counts[key] += 1
            if self.counts[key] == 1:
                self.ttls[key] = windows[i]
        return [1, 0, self.ttls.get(keys[0], windows[0])]

    async def get(self, key: str):
        value = self.counts.get(key)
        return str(value) if value is not None else None

    async def ping(self):
        return True


class BrokenRedis:
    async def eval(self, *args, **kwargs):
        raise RedisConnectionError("refused")

    async def get(self, *args, **kwargs):
        raise RedisConnectionError("refused")

    async def ping(self):
        raise RedisConnectionError("refused")


@pytest.fixture(autouse=True)
def _reset_policy_cache():
    reset_route_template_cache()
    yield
    reset_route_template_cache()


@pytest.fixture(autouse=True)
def _no_provider(monkeypatch):
    """Never let a test reach a real AI provider.

    The chat handler resolves its provider configuration from the database. A
    developer machine with a key saved in the admin console would otherwise make
    this suite issue a real billed request. The one provider test overrides this
    patch with its own fake.
    """
    from app.routers import ai as ai_router

    class _NotConfigured:
        is_configured = False
        base_url = ""
        model = ""
        api_key = ""

    monkeypatch.setattr(
        ai_router.ai_config, "resolve_chat_config", lambda db: _NotConfigured()
    )
    yield


def _enable(monkeypatch, fake=None) -> FakeRedis:
    fake = fake or FakeRedis()
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_ENABLED", True)
    monkeypatch.setattr(ratelimit, "get_redis", lambda: fake)
    return fake


def _disable(monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)


async def _noop_close():
    return None


def _request(
    method: str,
    path: str,
    headers: dict | None = None,
    client: tuple[str, int] = ("127.0.0.1", 1234),
):
    hdrs = []
    for key, value in (headers or {}).items():
        hdrs.append((key.lower().encode(), str(value).encode()))
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
        "app": main_app,
    }

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    return Request(scope, receive)


def _daily(monkeypatch, **overrides):
    """Merge test-specific daily limits into the configured map."""
    limits = {k: dict(v) for k, v in settings.RATE_LIMIT_P3_DAILY_LIMITS.items()}
    for key, cfg in overrides.items():
        limits[key.replace("__", ":")] = cfg
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_DAILY_LIMITS", limits)


def _identity(monkeypatch, category: str, **cfg):
    limits = {
        k: dict(v) for k, v in settings.RATE_LIMIT_P3_CATEGORY_IDENTITY_LIMITS.items()
    }
    limits[category] = cfg
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_CATEGORY_IDENTITY_LIMITS", limits)


def _send(client: TestClient, path: str, n: int, **kwargs) -> list[int]:
    return [client.post(path, **kwargs).status_code for _ in range(n)]


# --------------------------------------------------------------- policy shape


def test_ai_routes_resolve_to_p6_policies():
    cases = [
        ("POST", "/api/v1/ai/chat", "ai_operations", 10, True),
        ("POST", "/api/v1/question-imports/pdf", "ai_question_generation", 3, True),
        ("POST", "/api/v1/predictor", "ai_predictor", 10, None),
    ]
    for method, path, category, limit, fail_closed in cases:
        resolved = resolve_rate_limit(_request(method, path), settings)
        assert resolved is not None, path
        assert resolved.category == category, (path, resolved.category)
        assert resolved.limit == limit, (path, resolved.limit)
        assert resolved.window_seconds == 60, path
        assert resolved.fail_closed == fail_closed, (path, resolved.fail_closed)


def test_import_has_minute_ten_minute_and_daily_dimensions(monkeypatch):
    resolved = ResolvedRateLimit(
        namespace="/api/v1/question-imports/pdf",
        limit=3,
        window_seconds=60,
        bucket_path="/api/v1/question-imports/pdf",
        category="ai_question_generation",
        fail_closed=True,
        path="/api/v1/question-imports/pdf",
    )
    checks = _build_p3_checks(
        _request("POST", "/api/v1/question-imports/pdf"), resolved, "42", {}
    )
    by_dim = defaultdict(list)
    for check in checks:
        by_dim[check.dimension].append((check.limit, check.window_seconds))

    assert (3, 60) in by_dim["ip"]
    assert (3, 60) in by_dim["user"]
    assert (5, 600) in by_dim["ip"]
    assert (5, 600) in by_dim["user"]
    assert any(limit == 10 for limit, _ in by_dim["daily"])
    assert all(check.fail_closed is True for check in checks)


def test_ai_categories_are_configurable(monkeypatch):
    monkeypatch.setattr(
        settings,
        "RATE_LIMIT_CATEGORY_DEFAULTS",
        {
            **settings.RATE_LIMIT_CATEGORY_DEFAULTS,
            "ai_operations": {"limit": 7, "window_seconds": 30},
        },
    )
    resolved = resolve_rate_limit(_request("POST", "/api/v1/ai/chat"), settings)
    assert resolved is not None
    assert (resolved.limit, resolved.window_seconds) == (7, 30)


# --------------------------------------------------------- per-minute limits


def test_ai_chat_per_minute_limit(monkeypatch):
    fake = _enable(monkeypatch)
    client = TestClient(main_app)

    statuses = _send(client, "/api/v1/ai/chat", 11, json={"message": "hello"})

    assert statuses[:10] == [503] * 10  # provider not configured in tests
    assert statuses[10] == 429
    assert any(k.startswith("rl:/api/v1/ai/chat:") for k in fake.counts)


def test_predictor_per_minute_limit(monkeypatch):
    _enable(monkeypatch)
    client = TestClient(main_app)

    statuses = _send(client, "/api/v1/predictor", 11, json={})

    assert statuses[:10] == [422] * 10  # validation runs, not the provider
    assert statuses[10] == 429


def test_pdf_import_per_minute_limit(monkeypatch):
    fake = _enable(monkeypatch)
    client = TestClient(main_app)

    statuses = _send(client, "/api/v1/question-imports/pdf", 4)

    assert statuses[:3] != [429] * 3
    assert statuses[3] == 429
    assert any(k.startswith("rl:/api/v1/question-imports/pdf:") for k in fake.counts)


# ------------------------------------------------------------ daily quotas


def test_daily_user_quota_is_shared_across_ips(monkeypatch):
    _enable(monkeypatch)
    _identity(
        monkeypatch,
        "ai_operations",
        ip_limit=1000,
        ip_window=60,
        user_limit=1000,
        user_window=60,
    )
    _daily(
        monkeypatch,
        ai_operations__user={"limit": 2, "window_seconds": 86400},
        ai_operations__ip={"limit": 1000, "window_seconds": 86400},
    )
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    token = create_access_token(123, "student")
    client = TestClient(main_app)
    headers = {"authorization": f"Bearer {token}"}

    first = client.post(
        "/api/v1/ai/chat",
        json={"message": "hello"},
        headers={**headers, "x-forwarded-for": "203.0.113.10"},
    )
    second = client.post(
        "/api/v1/ai/chat",
        json={"message": "hello"},
        headers={**headers, "x-forwarded-for": "203.0.113.11"},
    )
    third = client.post(
        "/api/v1/ai/chat",
        json={"message": "hello"},
        headers={**headers, "x-forwarded-for": "203.0.113.12"},
    )

    assert first.status_code != 429
    assert second.status_code != 429
    assert third.status_code == 429


def test_daily_ip_quota_for_anonymous_requests(monkeypatch):
    fake = _enable(monkeypatch)
    _identity(
        monkeypatch,
        "ai_operations",
        ip_limit=1000,
        ip_window=60,
        user_limit=None,
        user_window=60,
    )
    _daily(
        monkeypatch,
        ai_operations__user={"limit": 1000, "window_seconds": 86400},
        ai_operations__ip={"limit": 2, "window_seconds": 86400},
    )
    client = TestClient(main_app)

    statuses = _send(client, "/api/v1/ai/chat", 3, json={"message": "hello"})

    assert statuses[:2] != [429, 429]
    assert statuses[2] == 429
    assert any(k.startswith("rl:dim:daily:ip:ai_operations:") for k in fake.counts)


def test_different_users_on_one_ip_have_independent_user_quotas(monkeypatch):
    _enable(monkeypatch)
    _identity(
        monkeypatch,
        "ai_operations",
        ip_limit=1000,
        ip_window=60,
        user_limit=1000,
        user_window=60,
    )
    _daily(
        monkeypatch,
        ai_operations__user={"limit": 1, "window_seconds": 86400},
        ai_operations__ip={"limit": 1000, "window_seconds": 86400},
    )
    client = TestClient(main_app)
    alice = {"authorization": f"Bearer {create_access_token(11, 'student')}"}
    bob = {"authorization": f"Bearer {create_access_token(12, 'student')}"}

    assert client.post("/api/v1/ai/chat", json={"message": "hi"}, headers=alice).status_code != 429
    assert client.post("/api/v1/ai/chat", json={"message": "hi"}, headers=bob).status_code != 429
    assert client.post("/api/v1/ai/chat", json={"message": "hi"}, headers=alice).status_code == 429


def test_daily_keys_use_utc_day_bucket_and_reset(monkeypatch):
    monkeypatch.setattr(ratelimit, "utc_day_bucket", lambda: "20260101")
    monkeypatch.setattr(ratelimit, "seconds_until_utc_midnight", lambda: 3600)
    resolved = ResolvedRateLimit(
        namespace="/api/v1/ai/chat",
        limit=10,
        window_seconds=60,
        bucket_path="/api/v1/ai/chat",
        category="ai_operations",
        fail_closed=True,
        path="/api/v1/ai/chat",
    )
    request = _request("POST", "/api/v1/ai/chat")
    day_one = _build_p3_checks(request, resolved, "42", {})
    daily_one = [c for c in day_one if c.dimension == "daily"]
    assert daily_one
    assert all(c.key.endswith(":20260101") for c in daily_one)
    assert all(c.window_seconds == 3600 for c in daily_one)

    monkeypatch.setattr(ratelimit, "utc_day_bucket", lambda: "20260102")
    day_two = _build_p3_checks(request, resolved, "42", {})
    daily_two = [c for c in day_two if c.dimension == "daily"]
    assert daily_two
    assert all(c.key.endswith(":20260102") for c in daily_two)
    assert {c.key for c in daily_one}.isdisjoint({c.key for c in daily_two})


def test_seconds_until_utc_midnight_is_bounded_and_exact():
    assert dims.seconds_until_utc_midnight(
        datetime(2026, 1, 1, 23, 59, 59, tzinfo=UTC)
    ) == 1
    assert dims.seconds_until_utc_midnight(
        datetime(2026, 1, 1, 0, 0, 0, tzinfo=UTC)
    ) == 86400


# ------------------------------------------------ shared store / outage / abuse


def test_two_app_instances_share_the_same_redis_counters(monkeypatch):
    fake = _enable(monkeypatch)
    first = TestClient(main_app)
    second = TestClient(main_app)

    statuses = []
    for i in range(11):
        client = first if i % 2 == 0 else second
        statuses.append(client.post("/api/v1/ai/chat", json={"message": "hi"}).status_code)

    assert statuses[:10] != [429] * 10
    assert statuses[10] == 429
    assert fake.eval_calls >= 11


def test_redis_outage_fails_closed_for_ai_chat(monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(ratelimit, "get_redis", lambda: BrokenRedis())
    monkeypatch.setattr(ratelimit, "close_redis", _noop_close)
    client = TestClient(main_app)

    response = client.post("/api/v1/ai/chat", json={"message": "hello"})

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "SERVICE_UNAVAILABLE"
    assert response.headers["Retry-After"] == "1"
    for name in RATE_HEADERS:
        assert name not in response.headers


def test_redis_outage_fails_closed_for_pdf_import(monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(ratelimit, "get_redis", lambda: BrokenRedis())
    monkeypatch.setattr(ratelimit, "close_redis", _noop_close)
    client = TestClient(main_app)

    response = client.post("/api/v1/question-imports/pdf")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "SERVICE_UNAVAILABLE"


def test_redis_outage_keeps_predictor_available(monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(ratelimit, "get_redis", lambda: BrokenRedis())
    monkeypatch.setattr(ratelimit, "close_redis", _noop_close)
    client = TestClient(main_app)

    response = client.post("/api/v1/predictor", json={})

    # Non-paid and deterministic: the outage must not take it down.
    assert response.status_code not in (429, 503)
    assert response.status_code == 422


def test_rejected_request_never_calls_the_provider(monkeypatch):
    _enable(monkeypatch)
    from app.routers import ai as ai_router

    calls = {"post": 0}

    class Config:
        is_configured = True
        base_url = "http://provider.invalid/v1"
        model = "test-model"
        api_key = "test-key"

    class ProviderResponse:
        is_success = True

        def json(self):
            return {"choices": [{"message": {"content": "ok"}}]}

    def fake_post(*args, **kwargs):
        calls["post"] += 1
        return ProviderResponse()

    monkeypatch.setattr(ai_router.ai_config, "resolve_chat_config", lambda db: Config())
    monkeypatch.setattr(ai_router.httpx, "post", fake_post)
    client = TestClient(main_app)

    statuses = _send(client, "/api/v1/ai/chat", 11, json={"message": "hello"})

    assert statuses[:10] == [200] * 10
    assert statuses[10] == 429
    assert calls["post"] == 10


def test_spoofed_user_header_cannot_reset_the_user_quota(monkeypatch):
    _enable(monkeypatch)
    _identity(
        monkeypatch,
        "ai_operations",
        ip_limit=1000,
        ip_window=60,
        user_limit=1000,
        user_window=60,
    )
    _daily(
        monkeypatch,
        ai_operations__user={"limit": 1, "window_seconds": 86400},
        ai_operations__ip={"limit": 1000, "window_seconds": 86400},
    )
    token = create_access_token(321, "student")
    client = TestClient(main_app)

    first = client.post(
        "/api/v1/ai/chat",
        json={"message": "hi"},
        headers={"authorization": f"Bearer {token}", "x-user-id": "999"},
    )
    second = client.post(
        "/api/v1/ai/chat",
        json={"message": "hi"},
        headers={"authorization": f"Bearer {token}", "x-user-id": "111"},
    )

    assert first.status_code != 429
    assert second.status_code == 429


def test_spoofed_forwarded_ip_cannot_mint_fresh_buckets(monkeypatch):
    _enable(monkeypatch)
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 0)
    client = TestClient(main_app)

    statuses = [
        client.post(
            "/api/v1/ai/chat",
            json={"message": "hi"},
            headers={"x-forwarded-for": f"203.0.113.{i}"},
        ).status_code
        for i in range(11)
    ]

    assert statuses[10] == 429


def test_429_carries_p5_headers(monkeypatch):
    _enable(monkeypatch)
    client = TestClient(main_app)

    for _ in range(10):
        client.post("/api/v1/ai/chat", json={"message": "hi"})
    response = client.post("/api/v1/ai/chat", json={"message": "hi"})

    assert response.status_code == 429
    assert response.headers["RateLimit-Limit"] == "10"
    assert response.headers["RateLimit-Remaining"] == "0"
    assert int(response.headers["RateLimit-Reset"]) >= 1
    assert int(response.headers["Retry-After"]) >= 1
    assert response.json()["error"]["code"] == "RATE_LIMIT_EXCEEDED"


# --------------------------------------------------------- validation intact


def test_chat_backend_validation_is_unchanged(monkeypatch):
    _disable(monkeypatch)
    client = TestClient(main_app)

    empty = client.post("/api/v1/ai/chat", json={"message": "   "})
    too_long = client.post("/api/v1/ai/chat", json={"message": "x" * 501})

    assert empty.status_code == 422
    assert too_long.status_code == 422


def test_backend_chat_schema_still_rejects_oversized_prompts(monkeypatch):
    _disable(monkeypatch)
    client = TestClient(main_app)

    response = client.post("/api/v1/ai/chat", json={"message": "x" * 501})

    assert response.status_code == 422
