"""P5 rate-limit response header tests.

P5 adds standard ``Retry-After`` / ``RateLimit-*`` headers without changing the
existing 429 JSON schema or the P2-P4 enforcement decisions. These tests pin the
header values for single-counter and multi-counter paths, including which
dimension is described when a request is rejected.
"""

from collections import defaultdict

import pytest
from fastapi.testclient import TestClient
from redis.exceptions import ConnectionError as RedisConnectionError

from app.config import settings
from app.main import app as main_app
from app.middleware import ratelimit
from app.middleware.rate_limit_policy import reset_route_template_cache
from app.utils.security import create_access_token

RATE_HEADERS = ("RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset")


class FakeRedis:
    """In-memory fake mirroring both limiter Lua scripts plus informational GET."""

    def __init__(self):
        self.counts = defaultdict(int)
        self.ttls = {}
        self.eval_calls = 0
        self.scripts = []
        self.get_calls = 0
        self.get_returns_none = False

    async def eval(self, script: str, numkeys: int, *args):
        self.eval_calls += 1
        self.scripts.append(script)
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

        # Multi-key P3 script: check-all, then increment-all.
        assert len(rest) == numkeys * 2
        windows = [int(x) for x in rest[:numkeys]]
        limits = [int(x) for x in rest[numkeys:]]
        for i, key in enumerate(keys):
            if self.counts.get(key, 0) >= limits[i]:
                ttl = self.ttls.get(key, windows[i])
                return [0, i + 1, ttl]
        for i, key in enumerate(keys):
            self.counts[key] += 1
            if self.counts[key] == 1:
                self.ttls[key] = windows[i]
        return [1, 0, self.ttls.get(keys[0], windows[0])]

    async def get(self, key: str):
        self.get_calls += 1
        if self.get_returns_none:
            return None
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


def _enable(monkeypatch, fake=None) -> FakeRedis:
    fake = fake or FakeRedis()
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(ratelimit, "get_redis", lambda: fake)
    return fake


def _override(monkeypatch, path: str, **cfg):
    base = {
        "limit": 2,
        "window_seconds": 60,
        "methods": ["GET"],
        "namespace": "p5:single",
        "category": "p5_single",
        "priority": 500,
    }
    base.update(cfg)
    monkeypatch.setattr(
        settings,
        "RATE_LIMIT_EXACT_OVERRIDES",
        {path: base},
        raising=False,
    )


def _route_key(fake: FakeRedis, prefix: str) -> str:
    keys = [k for k in fake.counts if k.startswith(prefix)]
    assert len(keys) == 1, keys
    return keys[0]


def _assert_no_rate_headers(response):
    for name in RATE_HEADERS + ("Retry-After",):
        assert name not in response.headers, (name, response.headers)


def _dashboard_identity(monkeypatch, *, ip_limit: int = 100):
    monkeypatch.setattr(
        settings,
        "RATE_LIMIT_P3_CATEGORY_IDENTITY_LIMITS",
        {
            **settings.RATE_LIMIT_P3_CATEGORY_IDENTITY_LIMITS,
            "dashboard_analytics": {
                "ip_limit": ip_limit,
                "ip_window": 60,
                "user_limit": None,
                "user_window": 60,
            },
        },
    )


# ------------------------------------------------------------------ 429 shape


def test_429_includes_retry_after_and_rate_limit_headers(monkeypatch):
    fake = _enable(monkeypatch)
    _override(monkeypatch, "/api/v1/colleges", limit=2)
    client = TestClient(main_app)

    assert client.get("/api/v1/colleges").status_code == 200
    assert client.get("/api/v1/colleges").status_code == 200
    response = client.get("/api/v1/colleges")

    assert response.status_code == 429
    assert response.headers["Retry-After"] == "60"
    assert response.headers["RateLimit-Limit"] == "2"
    assert response.headers["RateLimit-Remaining"] == "0"
    assert response.headers["RateLimit-Reset"] == "60"
    # Only numbers are exposed; no keys, user IDs, or addresses.
    for name in RATE_HEADERS + ("Retry-After",):
        assert response.headers[name].isdigit(), (name, response.headers[name])

    body = response.json()
    assert set(body) == {"success", "error"}
    assert set(body["error"]) == {"code", "message", "details"}
    assert body["error"]["code"] == "RATE_LIMIT_EXCEEDED"
    assert body["error"]["details"] == {"retry_after_seconds": 60}
    assert body["success"] is False


def test_retry_after_matches_the_relevant_redis_ttl(monkeypatch):
    fake = _enable(monkeypatch)
    _override(monkeypatch, "/api/v1/colleges", limit=1)
    client = TestClient(main_app)

    assert client.get("/api/v1/colleges").status_code == 200
    key = _route_key(fake, "rl:p5:single:/api/v1/colleges:")
    fake.ttls[key] = 17

    response = client.get("/api/v1/colleges")
    assert response.status_code == 429
    assert response.headers["Retry-After"] == "17"
    assert response.headers["RateLimit-Reset"] == "17"
    assert response.json()["error"]["details"]["retry_after_seconds"] == 17


def test_retry_values_are_never_zero_or_negative(monkeypatch):
    fake = _enable(monkeypatch)
    _override(monkeypatch, "/api/v1/colleges", limit=1)
    client = TestClient(main_app)

    assert client.get("/api/v1/colleges").status_code == 200
    key = _route_key(fake, "rl:p5:single:/api/v1/colleges:")
    fake.ttls[key] = -1

    response = client.get("/api/v1/colleges")
    assert response.status_code == 429
    assert response.headers["Retry-After"] == "1"
    assert response.headers["RateLimit-Reset"] == "1"
    assert response.json()["error"]["details"]["retry_after_seconds"] == 1


# -------------------------------------------------------------- success headers


def test_successful_limited_request_exposes_correct_headers(monkeypatch):
    _enable(monkeypatch)
    _override(monkeypatch, "/api/v1/colleges", limit=3)
    client = TestClient(main_app)

    expected_remaining = ["2", "1", "0"]
    for remaining in expected_remaining:
        response = client.get("/api/v1/colleges")
        assert response.status_code == 200
        assert response.headers["RateLimit-Limit"] == "3"
        assert response.headers["RateLimit-Remaining"] == remaining
        assert response.headers["RateLimit-Reset"] == "60"
        assert "Retry-After" not in response.headers


def test_multi_counter_success_reports_the_primary_counter(monkeypatch):
    fake = _enable(monkeypatch)
    _dashboard_identity(monkeypatch, ip_limit=100)
    _override(
        monkeypatch,
        "/api/v1/admin/analytics/overview",
        limit=2,
        namespace="read:dashboard_analytics",
        category="dashboard_analytics",
        key_dimension="user",
    )
    client = TestClient(main_app)
    token = create_access_token(55, "admin")
    headers = {"authorization": f"Bearer {token}"}

    response = client.get("/api/v1/admin/analytics/overview", headers=headers)
    assert response.status_code != 429
    assert response.headers["RateLimit-Limit"] == "2"
    assert response.headers["RateLimit-Remaining"] == "1"
    assert response.headers["RateLimit-Reset"] == "60"
    assert any(k.endswith(":u:55") for k in fake.counts)


def test_multi_counter_success_omits_headers_if_count_is_unavailable(monkeypatch):
    """No fabricated remaining count when the informational read cannot answer."""
    fake = _enable(monkeypatch)
    fake.get_returns_none = True
    _dashboard_identity(monkeypatch, ip_limit=100)
    _override(
        monkeypatch,
        "/api/v1/admin/analytics/overview",
        limit=2,
        namespace="read:dashboard_analytics",
        category="dashboard_analytics",
        key_dimension="user",
    )
    client = TestClient(main_app)
    token = create_access_token(56, "admin")

    response = client.get(
        "/api/v1/admin/analytics/overview",
        headers={"authorization": f"Bearer {token}"},
    )
    assert response.status_code != 429
    _assert_no_rate_headers(response)


# --------------------------------------------------- multi-dimensional rejection


def test_multi_dimension_rejection_reports_the_rejecting_dimension(monkeypatch):
    """The IP guard rejects here, so headers must describe its 1/min limit."""
    fake = _enable(monkeypatch)
    _dashboard_identity(monkeypatch, ip_limit=1)
    _override(
        monkeypatch,
        "/api/v1/admin/analytics/overview",
        limit=100,
        namespace="read:dashboard_analytics",
        category="dashboard_analytics",
        key_dimension="user",
    )
    client = TestClient(main_app)
    token = create_access_token(77, "admin")
    headers = {"authorization": f"Bearer {token}"}

    first = client.get("/api/v1/admin/analytics/overview", headers=headers)
    assert first.status_code != 429
    assert first.headers["RateLimit-Limit"] == "100"
    assert first.headers["RateLimit-Remaining"] == "99"

    ip_key = _route_key(fake, "rl:dim:ip:dashboard_analytics:")
    fake.ttls[ip_key] = 23

    rejected = client.get("/api/v1/admin/analytics/overview", headers=headers)
    assert rejected.status_code == 429
    # The failed counter is the 1/min IP guard, not the 100/min user bucket.
    assert rejected.headers["RateLimit-Limit"] == "1"
    assert rejected.headers["RateLimit-Remaining"] == "0"
    assert rejected.headers["RateLimit-Reset"] == "23"
    assert rejected.headers["Retry-After"] == "23"
    assert rejected.json()["error"]["code"] == "RATE_LIMIT_EXCEEDED"
    assert set(rejected.json()["error"]) == {"code", "message", "details"}
    assert set(rejected.json()["error"]["details"]) == {"retry_after_seconds"}


def test_user_based_limit_reports_user_counter_values(monkeypatch):
    fake = _enable(monkeypatch)
    _dashboard_identity(monkeypatch, ip_limit=100)
    _override(
        monkeypatch,
        "/api/v1/admin/analytics/overview",
        limit=2,
        namespace="read:dashboard_analytics",
        category="dashboard_analytics",
        key_dimension="user",
    )
    client = TestClient(main_app)
    token = create_access_token(88, "admin")
    headers = {"authorization": f"Bearer {token}"}

    assert client.get("/api/v1/admin/analytics/overview", headers=headers).status_code != 429
    second = client.get("/api/v1/admin/analytics/overview", headers=headers)
    assert second.status_code != 429
    assert second.headers["RateLimit-Limit"] == "2"
    assert second.headers["RateLimit-Remaining"] == "0"

    rejected = client.get("/api/v1/admin/analytics/overview", headers=headers)
    assert rejected.status_code == 429
    assert rejected.headers["RateLimit-Limit"] == "2"
    assert rejected.headers["RateLimit-Remaining"] == "0"
    assert any(k.endswith(":u:88") for k in fake.counts)


def test_ip_based_dashboard_limit_reports_ip_counter_values(monkeypatch):
    """Anonymous dashboard callers use the 30/min IP fallback bucket."""
    fake = _enable(monkeypatch)
    _dashboard_identity(monkeypatch, ip_limit=120)
    client = TestClient(main_app)

    first = client.get("/api/v1/admin/analytics/overview")
    assert first.status_code != 429
    assert first.headers["RateLimit-Limit"] == "30"
    assert first.headers["RateLimit-Remaining"] == "29"
    assert not any(":u:" in k for k in fake.counts)

    primary = _route_key(
        fake, "rl:read:dashboard_analytics:/api/v1/admin/analytics/overview:"
    )
    fake.counts[primary] = 30

    rejected = client.get("/api/v1/admin/analytics/overview")
    assert rejected.status_code == 429
    assert rejected.headers["RateLimit-Limit"] == "30"
    assert rejected.headers["RateLimit-Remaining"] == "0"


# ----------------------------------------------------------- exemptions / outage


def test_unclassified_requests_receive_no_rate_limit_headers(monkeypatch):
    fake = _enable(monkeypatch)
    client = TestClient(main_app)

    response = client.get("/api/v1/predictor/exams")
    assert response.status_code == 200
    _assert_no_rate_headers(response)
    assert fake.eval_calls == 0


def test_fail_closed_503_has_no_fabricated_rate_limit_headers(monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(ratelimit, "get_redis", lambda: BrokenRedis())

    client = TestClient(main_app)
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "wrong-password-1"},
    )

    assert response.status_code == 503
    # No fabricated RateLimit-* values; the existing 503 retry hint remains.
    for name in RATE_HEADERS:
        assert name not in response.headers, (name, response.headers)
    assert response.headers["Retry-After"] == "1"
    assert response.json()["error"]["code"] == "SERVICE_UNAVAILABLE"


def test_public_fail_open_request_has_no_rate_limit_headers_on_outage(monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(ratelimit, "get_redis", lambda: BrokenRedis())

    client = TestClient(main_app)
    response = client.get("/api/v1/colleges")

    assert response.status_code != 429
    assert response.status_code != 503
    _assert_no_rate_headers(response)
