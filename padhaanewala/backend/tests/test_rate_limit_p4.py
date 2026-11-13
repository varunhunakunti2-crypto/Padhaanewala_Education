"""P4 read-route rate limiting tests.

P4 turns on GET/HEAD throttling for an explicit, audited set of read routes
(catalogue, search, statistics, listings, media, dashboard analytics). These
tests pin both the policy decisions and the Redis enforcement, including the
user-keyed dashboard path, query/template bucket normalization, exemptions, and
the unchanged write-route limits.
"""

from collections import defaultdict
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from redis.exceptions import ConnectionError as RedisConnectionError
from starlette.requests import Request

from app.config import settings
from app.main import app as main_app
from app.middleware import ratelimit
from app.middleware.rate_limit_policy import (
    reset_route_template_cache,
    resolve_rate_limit,
)
from app.utils.security import create_access_token


class FakeRedis:
    """In-memory fake mirroring both limiter Lua scripts."""

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

    async def ping(self):
        return True

    async def get(self, key: str):
        value = self.counts.get(key)
        return str(value) if value is not None else None


class BrokenRedis:
    async def eval(self, *args, **kwargs):
        raise RedisConnectionError("refused")

    async def ping(self):
        raise RedisConnectionError("refused")


@pytest.fixture(autouse=True)
def _reset_policy_cache():
    reset_route_template_cache()
    yield
    reset_route_template_cache()


def _request(method: str, path: str, *, app=None, client=("127.0.0.1", 1234)) -> Request:
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": method,
        "path": path,
        "raw_path": path.encode(),
        "headers": [],
        "query_string": b"",
        "scheme": "http",
        "server": ("testserver", 80),
        "client": client,
        "app": app or main_app,
    }

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    return Request(scope, receive)


def _enable(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(ratelimit, "get_redis", lambda: fake)
    return fake


def _resolved(method: str, path: str):
    return resolve_rate_limit(_request(method, path), settings)


def _route_key(fake: FakeRedis, prefix: str) -> str:
    keys = [k for k in fake.counts if k.startswith(prefix)]
    assert len(keys) == 1, keys
    return keys[0]


# --------------------------------------------------------------- policy shape


def test_public_catalogue_get_is_limited(monkeypatch):
    """A public catalogue GET is now IP-throttled at 60/min."""
    fake = _enable(monkeypatch)
    client = TestClient(main_app)

    assert client.get("/api/v1/colleges").status_code != 429
    key = _route_key(fake, "rl:read:public_catalogue:/api/v1/colleges:")
    assert not any(":u:" in k for k in fake.counts)

    # 59 pre-existing hits + this one = the 60th allowed; the next is throttled.
    fake.counts[key] = 59
    assert client.get("/api/v1/colleges").status_code != 429
    assert client.get("/api/v1/colleges").status_code == 429


def test_college_search_uses_30_per_min(monkeypatch):
    resolved = _resolved("GET", "/api/v1/colleges/search")
    assert resolved is not None
    assert (resolved.category, resolved.limit, resolved.window_seconds) == (
        "college_search",
        30,
        60,
    )

    fake = _enable(monkeypatch)
    client = TestClient(main_app)
    assert client.get("/api/v1/colleges/search?q=abc").status_code != 429
    key = _route_key(fake, "rl:read:college_search:/api/v1/colleges/search:")
    fake.counts[key] = 29
    assert client.get("/api/v1/colleges/search?q=xyz").status_code != 429
    assert client.get("/api/v1/colleges/search?q=def").status_code == 429


def test_course_search_uses_30_per_min():
    for path in ["/api/v1/courses", "/api/v1/courses/categories", "/api/v1/courses/abc"]:
        resolved = _resolved("GET", path)
        assert resolved is not None
        assert (resolved.category, resolved.limit, resolved.window_seconds) == (
            "course_search",
            30,
            60,
        )


def test_statistics_uses_10_per_min(monkeypatch):
    resolved = _resolved("GET", "/api/v1/stats/catalog")
    assert resolved is not None
    assert (resolved.category, resolved.limit, resolved.window_seconds) == (
        "catalogue_statistics",
        10,
        60,
    )

    fake = _enable(monkeypatch)
    client = TestClient(main_app)
    assert client.get("/api/v1/stats/catalog").status_code != 429
    key = _route_key(fake, "rl:read:catalogue_statistics:/api/v1/stats/catalog:")
    fake.counts[key] = 9
    assert client.get("/api/v1/stats/catalog").status_code != 429
    assert client.get("/api/v1/stats/catalog").status_code == 429


def test_listing_routes_use_configured_limits():
    for path in [
        "/api/v1/universities",
        "/api/v1/universities/abc",
        "/api/v1/scholarships",
        "/api/v1/exams",
        "/api/v1/exams/upcoming",
        "/api/v1/mock-tests",
    ]:
        resolved = _resolved("GET", path)
        assert resolved is not None, path
        assert (resolved.category, resolved.limit, resolved.window_seconds) == (
            "catalogue_listings",
            60,
            60,
        ), path


def test_anonymous_api_reads_use_60_per_min():
    for path in [
        "/api/v1/faqs",
        "/api/v1/blogs",
        "/api/v1/blogs/abc",
        "/api/v1/locations/states",
        "/api/v1/banners",
        "/api/v1/reviews/college/abc",
    ]:
        resolved = _resolved("GET", path)
        assert resolved is not None, path
        assert (resolved.category, resolved.limit, resolved.window_seconds) == (
            "anonymous_api",
            60,
            60,
        ), path


def test_media_reads_use_30_per_min():
    for path in ["/api/v1/media", "/api/v1/media/5", "/api/v1/media/files/5"]:
        resolved = _resolved("GET", path)
        assert resolved is not None, path
        assert (resolved.category, resolved.limit, resolved.window_seconds) == (
            "media_access",
            30,
            60,
        ), path


def test_head_is_limited_with_get_policy():
    resolved = _resolved("HEAD", "/api/v1/colleges/search")
    assert resolved is not None
    assert (resolved.category, resolved.limit) == ("college_search", 30)


# ----------------------------------------------------------- dashboard identity


def _dashboard_override(monkeypatch, *, limit: int = 2):
    monkeypatch.setattr(
        settings,
        "RATE_LIMIT_EXACT_OVERRIDES",
        {
            "/api/v1/admin/analytics/overview": {
                "limit": limit,
                "window_seconds": 60,
                "methods": ["GET"],
                "namespace": "read:dashboard_analytics",
                "category": "dashboard_analytics",
                "priority": 500,
                "key_dimension": "user",
            }
        },
        raising=False,
    )
    monkeypatch.setattr(
        settings,
        "RATE_LIMIT_P3_CATEGORY_IDENTITY_LIMITS",
        {
            **settings.RATE_LIMIT_P3_CATEGORY_IDENTITY_LIMITS,
            "dashboard_analytics": {
                "ip_limit": 100,
                "ip_window": 60,
                "user_limit": None,
                "user_window": 60,
            },
        },
    )


def test_dashboard_analytics_default_is_30_per_verified_user():
    resolved = _resolved("GET", "/api/v1/admin/analytics/overview")
    assert resolved is not None
    assert (
        resolved.category,
        resolved.limit,
        resolved.window_seconds,
        resolved.key_dimension,
    ) == ("dashboard_analytics", 30, 60, "user")


def test_anonymous_dashboard_falls_back_to_ip_bucket(monkeypatch):
    """An unauthenticated caller is still limited, on the IP fallback bucket."""
    fake = _enable(monkeypatch)
    client = TestClient(main_app)

    assert client.get("/api/v1/admin/analytics/overview").status_code != 429
    primary = [
        k
        for k in fake.counts
        if k.startswith(
            "rl:read:dashboard_analytics:/api/v1/admin/analytics/overview:"
        )
    ]
    assert primary, fake.counts
    assert all(":u:" not in k for k in primary)


def test_dashboard_analytics_uses_verified_user_identity(monkeypatch):
    """The primary dashboard counter is keyed by the JWT subject, not a header."""
    fake = _enable(monkeypatch)
    _dashboard_override(monkeypatch)
    client = TestClient(main_app)
    token = create_access_token(42, "admin")
    headers = {"authorization": f"Bearer {token}", "x-user-id": "999"}

    # Endpoint authorization may reject the synthetic user; only the limiter
    # verdict matters here.
    assert client.get("/api/v1/admin/analytics/overview", headers=headers).status_code != 429
    assert client.get("/api/v1/admin/analytics/overview", headers=headers).status_code != 429
    assert client.get("/api/v1/admin/analytics/overview", headers=headers).status_code == 429

    assert any(
        k.startswith("rl:read:dashboard_analytics:/api/v1/admin/analytics/overview:u:42")
        for k in fake.counts
    )
    assert not any(k.endswith(":u:999") for k in fake.counts)


def test_same_dashboard_user_shares_quota_across_different_ips(monkeypatch):
    fake = _enable(monkeypatch)
    _dashboard_override(monkeypatch)
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    client = TestClient(main_app)
    token = create_access_token(777, "admin")

    def get(ip: str):
        return client.get(
            "/api/v1/admin/analytics/overview",
            headers={
                "authorization": f"Bearer {token}",
                "x-forwarded-for": ip,
            },
        )

    assert get("10.0.0.1").status_code != 429
    assert get("10.0.0.2").status_code != 429
    # Same verified user, new address: the user bucket is already exhausted.
    assert get("10.0.0.3").status_code == 429
    assert any(
        k.startswith("rl:read:dashboard_analytics:/api/v1/admin/analytics/overview:u:777")
        for k in fake.counts
    )


def test_different_users_sharing_one_ip_have_independent_dashboard_quotas(monkeypatch):
    fake = _enable(monkeypatch)
    _dashboard_override(monkeypatch)
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    client = TestClient(main_app)

    def get(user_id: int):
        token = create_access_token(user_id, "admin")
        return client.get(
            "/api/v1/admin/analytics/overview",
            headers={
                "authorization": f"Bearer {token}",
                "x-forwarded-for": "10.0.0.9",
            },
        )

    assert get(11).status_code != 429
    assert get(11).status_code != 429
    assert get(11).status_code == 429
    # A second user behind the same address gets their own quota.
    assert get(22).status_code != 429
    assert any(k.endswith(":u:11") for k in fake.counts)
    assert any(k.endswith(":u:22") for k in fake.counts)


# -------------------------------------------------------- matching and buckets


def test_specific_route_rule_overrides_broader_rule():
    search = _resolved("GET", "/api/v1/colleges/search")
    catalogue = _resolved("GET", "/api/v1/colleges")
    courses = _resolved("GET", "/api/v1/courses")

    assert (search.category, search.limit) == ("college_search", 30)
    assert (catalogue.category, catalogue.limit) == ("public_catalogue", 60)
    assert (courses.category, courses.limit) == ("course_search", 30)


def test_dynamic_route_templates_share_bucket(monkeypatch):
    fake = _enable(monkeypatch)
    monkeypatch.setattr(
        settings,
        "RATE_LIMIT_EXACT_OVERRIDES",
        {
            "/api/v1/universities/{university_ref}": {
                "limit": 1,
                "window_seconds": 60,
                "methods": ["GET"],
                "namespace": "read:catalogue_listings",
                "category": "catalogue_listings",
                "priority": 500,
            }
        },
        raising=False,
    )
    client = TestClient(main_app)

    assert client.get("/api/v1/universities/alpha").status_code != 429
    assert client.get("/api/v1/universities/beta").status_code == 429

    key = _route_key(
        fake, "rl:read:catalogue_listings:/api/v1/universities/{university_ref}:"
    )
    assert "alpha" not in key and "beta" not in key


def test_query_parameters_do_not_create_separate_buckets(monkeypatch):
    fake = _enable(monkeypatch)
    monkeypatch.setattr(
        settings,
        "RATE_LIMIT_EXACT_OVERRIDES",
        {
            "/api/v1/colleges/search": {
                "limit": 1,
                "window_seconds": 60,
                "methods": ["GET"],
                "namespace": "read:college_search",
                "category": "college_search",
                "priority": 500,
            }
        },
        raising=False,
    )
    client = TestClient(main_app)

    assert client.get("/api/v1/colleges/search?q=alpha&limit=5").status_code != 429
    assert client.get("/api/v1/colleges/search?q=beta&limit=10").status_code == 429

    key = _route_key(fake, "rl:read:college_search:/api/v1/colleges/search:")
    assert "q=" not in key and "limit=" not in key


def test_read_limits_are_configurable(monkeypatch):
    monkeypatch.setattr(
        settings,
        "RATE_LIMIT_READ_CATEGORY_LIMITS",
        {
            **settings.RATE_LIMIT_READ_CATEGORY_LIMITS,
            "college_search": {"limit": 7, "window_seconds": 120},
        },
    )
    resolved = _resolved("GET", "/api/v1/colleges/search")
    assert resolved is not None
    assert (resolved.limit, resolved.window_seconds) == (7, 120)


# ------------------------------------------------------- exemptions and safety


def test_unclassified_get_routes_remain_unthrottled():
    """No blanket GET rule: only audited templates are classified."""
    for path in [
        "/api/v1/predictor/exams",
        "/api/v1/users/me",
    ]:
        assert _resolved("GET", path) is None, path

    # P9 intentionally classifies the staff-only CRM reads, so they are no
    # longer part of the unthrottled set.
    for path in ["/api/v1/enquiries", "/api/v1/leads"]:
        admin_read = _resolved("GET", path)
        assert admin_read is not None, path
        assert admin_read.namespace == "p9:admin_general", path

    # P7 intentionally classifies the student notification listing, so it is no
    # longer part of the unthrottled set.
    notifications = _resolved("GET", "/api/v1/notifications/my")
    assert notifications is not None
    assert notifications.namespace == "p7:student_notifications"


def test_options_remains_exempt(monkeypatch):
    assert _resolved("OPTIONS", "/api/v1/colleges") is None

    fake = _enable(monkeypatch)
    client = TestClient(main_app)
    resp = client.options("/api/v1/colleges")
    assert resp.status_code in (200, 204, 400, 405)
    assert fake.eval_calls == 0


def test_health_and_docs_remain_unaffected():
    for path in ["/health", "/openapi.json", "/docs", "/redoc"]:
        assert _resolved("GET", path) is None, path


def test_existing_write_limits_and_p8_intake_limits():
    """P4 pins the P2/P3/P6 write ceilings; P8 intentionally tightens intake."""
    cases = [
        ("POST", "/api/v1/auth/login", "auth", 5, 60),
        ("POST", "/api/v1/enquiries", "p8:public_enquiry", 3, 600),
        ("POST", "/api/v1/predictor", "/api/v1/predictor", 10, 60),
        ("POST", "/api/v1/ai/chat", "/api/v1/ai/chat", 10, 60),
        ("POST", "/api/v1/question-imports/pdf", "/api/v1/question-imports/pdf", 3, 60),
    ]
    for method, path, namespace, limit, window in cases:
        resolved = _resolved(method, path)
        assert resolved is not None, path
        assert (
            resolved.namespace,
            resolved.limit,
            resolved.window_seconds,
        ) == (namespace, limit, window), path


def test_read_routes_fail_open_on_redis_outage(monkeypatch):
    """Read throttling must not take catalogue pages down with Redis."""
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(ratelimit, "get_redis", lambda: BrokenRedis())
    monkeypatch.setattr(ratelimit, "close_redis", AsyncMock())

    client = TestClient(main_app)
    resp = client.get("/api/v1/colleges")

    assert resp.status_code != 429
    assert resp.status_code != 503
