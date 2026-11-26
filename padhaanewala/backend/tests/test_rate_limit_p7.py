"""P7 student-operation and mock-test rate-limit tests.

P7 adds explicit, endpoint-specific limits to real student routes on top of the
P2-P6 engine. Nothing here changes authentication, grading or the Redis
implementation; these tests pin the policy mapping, the user/IP dimensions, the
mock-test lifecycle guarantees, the P5 headers and the outage decision.
"""

from collections import defaultdict

import pytest
from fastapi.testclient import TestClient
from redis.exceptions import ConnectionError as RedisConnectionError
from sqlalchemy import select
from starlette.requests import Request

from app.config import settings
from app.database import SessionLocal
from app.main import app as main_app
from app.middleware import ratelimit
from app.middleware.rate_limit_policy import (
    DEFAULT_P7_STUDENT_LIMITS,
    reset_route_template_cache,
    resolve_rate_limit,
)
from app.models import MockTest, TestQuestion
from app.utils.security import create_access_token

RATE_HEADERS = ("RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset")


class FakeRedis:
    """In-memory fake mirroring both limiter Lua scripts plus informational GET."""

    def __init__(self):
        self.counts = defaultdict(int)
        self.ttls = {}
        self.eval_calls = 0
        self.get_calls = 0

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


def _request(method: str, path: str) -> Request:
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
        "client": ("127.0.0.1", 1234),
        "app": main_app,
    }

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    return Request(scope, receive)


def _resolved(method: str, path: str):
    return resolve_rate_limit(_request(method, path), settings)


def _enable(monkeypatch) -> FakeRedis:
    fake = FakeRedis()
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(ratelimit, "get_redis", lambda: fake)
    return fake


def _p7_override(monkeypatch, operation: str, limit: int, window: int = 60) -> None:
    current = {k: dict(v) for k, v in settings.RATE_LIMIT_P7_STUDENT_LIMITS.items()}
    current[operation] = {"limit": limit, "window_seconds": window}
    monkeypatch.setattr(settings, "RATE_LIMIT_P7_STUDENT_LIMITS", current)


def _headers(user_id: int, ip: str | None = None, role: str = "student") -> dict:
    token = create_access_token(user_id, role)
    headers = {"authorization": f"Bearer {token}"}
    if ip is not None:
        headers["x-forwarded-for"] = ip
    return headers


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _repeat(client, method: str, path: str, n: int, **kwargs) -> list:
    return [getattr(client, method)(path, **kwargs).status_code for _ in range(n)]


def _keys(fake: FakeRedis, prefix: str) -> list[str]:
    return [k for k in fake.counts if k.startswith(prefix)]


# ------------------------------------------------------------------ mapping


P7_CASES = [
    (
        "POST",
        "/api/v1/mock-tests/jee-main/start",
        "mock_test_start",
        "mock_test_operations",
        10,
        60,
    ),
    (
        "PUT",
        "/api/v1/mock-tests/jee-main/attempts/9/answers/17",
        "mock_test_answer",
        "mock_test_operations",
        60,
        60,
    ),
    (
        "POST",
        "/api/v1/mock-tests/jee-main/submit",
        "mock_test_submit",
        "mock_test_operations",
        5,
        600,
    ),
    (
        "POST",
        "/api/v1/mock-tests/jee-main/attempts/9/submit",
        "mock_test_submit",
        "mock_test_operations",
        5,
        600,
    ),
    (
        "GET",
        "/api/v1/mock-tests/jee-main/attempts/9/result",
        "mock_test_review",
        "mock_test_operations",
        5,
        3600,
    ),
    (
        "POST",
        "/api/v1/saved-colleges",
        "saved_college_write",
        "student_operations",
        30,
        60,
    ),
    (
        "DELETE",
        "/api/v1/saved-colleges/8",
        "saved_college_write",
        "student_operations",
        30,
        60,
    ),
    (
        "PUT",
        "/api/v1/users/me",
        "profile_update",
        "student_operations",
        10,
        60,
    ),
    ("POST", "/api/v1/consent", "consent_write", "student_operations", 5, 3600),
    (
        "PATCH",
        "/api/v1/consent/3",
        "consent_write",
        "student_operations",
        5,
        3600,
    ),
    (
        "POST",
        "/api/v1/compliance/age",
        "consent_write",
        "student_operations",
        5,
        3600,
    ),
    (
        "POST",
        "/api/v1/compliance/parental-consent",
        "consent_write",
        "student_operations",
        5,
        3600,
    ),
    (
        "POST",
        "/api/v1/compliance/parental-consent/verify",
        "consent_write",
        "student_operations",
        5,
        3600,
    ),
    (
        "POST",
        "/api/v1/compliance/parental-consent/withdraw",
        "consent_write",
        "student_operations",
        5,
        3600,
    ),
    (
        "POST",
        "/api/v1/compliance/requests",
        "consent_write",
        "student_operations",
        5,
        3600,
    ),
    (
        "GET",
        "/api/v1/notifications/my",
        "student_notifications",
        "student_operations",
        30,
        60,
    ),
    (
        "GET",
        "/api/v1/notifications/my/unread-count",
        "student_notifications",
        "student_operations",
        30,
        60,
    ),
    (
        "PUT",
        "/api/v1/notifications/4/read",
        "student_notifications",
        "student_operations",
        30,
        60,
    ),
    (
        "PUT",
        "/api/v1/notifications/my/read-all",
        "student_notifications",
        "student_operations",
        30,
        60,
    ),
    (
        "DELETE",
        "/api/v1/notifications/4",
        "student_notifications",
        "student_operations",
        30,
        60,
    ),
]


@pytest.mark.parametrize(
    "method,path,operation,category,limit,window", P7_CASES
)
def test_p7_routes_resolve_to_their_configured_limit(
    method, path, operation, category, limit, window
):
    resolved = _resolved(method, path)
    assert resolved is not None, (method, path)
    assert resolved.namespace == f"p7:{operation}"
    assert resolved.category == category
    assert (resolved.limit, resolved.window_seconds) == (limit, window)
    # Per-user primary bucket: shared across devices/IPs, independent per user.
    assert resolved.key_dimension == "user"


def test_defaults_match_the_approved_starting_limits():
    assert DEFAULT_P7_STUDENT_LIMITS == {
        "mock_test_start": (10, 60),
        "mock_test_answer": (60, 60),
        "mock_test_submit": (5, 600),
        "mock_test_review": (5, 3600),
        "saved_college_write": (30, 60),
        "profile_update": (10, 60),
        "consent_write": (5, 3600),
        "student_notifications": (30, 60),
    }


def test_configurable_operation_limit_overrides_the_default(monkeypatch):
    _p7_override(monkeypatch, "mock_test_start", 3, 90)
    resolved = _resolved("POST", "/api/v1/mock-tests/jee-main/start")
    assert resolved is not None
    assert (resolved.limit, resolved.window_seconds) == (3, 90)


def test_zero_limit_disables_that_operation(monkeypatch):
    _p7_override(monkeypatch, "mock_test_start", 0)
    assert _resolved("POST", "/api/v1/mock-tests/jee-main/start") is None


def test_attempt_detail_clock_and_other_mock_test_reads_are_not_p7_limited():
    """The runner polls attempt detail as its clock; it must stay outside P7.

    Question retrieval, attempt listing and test listing are also unchanged.
    Only the post-submission result endpoint is the "test review" surface.
    """
    assert _resolved("GET", "/api/v1/mock-tests/jee-main/attempts/9") is None
    assert _resolved("GET", "/api/v1/mock-tests/jee-main/attempts") is None
    assert _resolved("GET", "/api/v1/mock-tests/jee-main/questions") is None
    listing = _resolved("GET", "/api/v1/mock-tests")
    assert listing is not None
    assert (listing.category, listing.limit) == ("catalogue_listings", 60)


def test_unrelated_policies_are_unchanged():
    """P7 must not widen or tighten existing auth/admin/AI/read rules."""
    password = _resolved("PUT", "/api/v1/users/me/password")
    assert password is not None
    assert (password.category, password.limit) == ("authenticated_api", 120)

    admin = _resolved("POST", "/api/v1/settings/ai")
    assert admin is not None
    assert (admin.category, admin.limit) == ("admin_operations", 120)

    chat = _resolved("POST", "/api/v1/ai/chat")
    assert chat is not None
    assert (chat.category, chat.limit) == ("ai_operations", 10)

    dashboard = _resolved("GET", "/api/v1/admin/analytics/overview")
    assert dashboard is not None
    assert (dashboard.category, dashboard.limit, dashboard.key_dimension) == (
        "dashboard_analytics",
        30,
        "user",
    )

    # The admin notification update route is not a student surface. P9 gives it
    # the general-admin role tier instead of leaving it unthrottled.
    notification_update = _resolved("PUT", "/api/v1/notifications/4")
    assert notification_update is not None
    assert notification_update.namespace == "p9:admin_general"


# -------------------------------------------------------------- enforcement


def test_mock_test_start_limit(monkeypatch):
    fake = _enable(monkeypatch)
    client = TestClient(main_app)
    headers = _headers(501)

    statuses = _repeat(
        client,
        "post",
        "/api/v1/mock-tests/jee-main/start",
        11,
        headers=headers,
        json={},
    )

    assert statuses[:10] != [429] * 10
    assert statuses[10] == 429
    keys = _keys(fake, "rl:p7:mock_test_start:")
    assert keys
    assert all(k.endswith(":u:501") for k in keys), keys


def test_answer_autosave_limit(monkeypatch):
    fake = _enable(monkeypatch)
    client = TestClient(main_app)
    headers = _headers(502)

    statuses = _repeat(
        client,
        "put",
        "/api/v1/mock-tests/jee-main/attempts/9/answers/17",
        61,
        headers=headers,
        json={"selected_answer": "A"},
    )

    assert statuses[:60] != [429] * 60
    assert statuses[60] == 429
    keys = _keys(fake, "rl:p7:mock_test_answer:")
    assert len(keys) == 1, keys
    assert "{question_id}" in keys[0]


def test_final_submission_limit_on_both_submit_surfaces(monkeypatch):
    fake = _enable(monkeypatch)
    client = TestClient(main_app)
    headers = _headers(503)

    direct = _repeat(
        client,
        "post",
        "/api/v1/mock-tests/jee-main/submit",
        6,
        headers=headers,
        json={"answers": []},
    )
    assert direct[:5] != [429] * 5
    assert direct[5] == 429

    attempt = _repeat(
        client,
        "post",
        "/api/v1/mock-tests/jee-main/attempts/9/submit",
        6,
        headers=headers,
    )
    assert attempt[:5] != [429] * 5
    assert attempt[5] == 429

    # Distinct templates keep distinct counters; neither is user-supplied.
    assert len(_keys(fake, "rl:p7:mock_test_submit:")) == 2


def test_test_review_limit(monkeypatch):
    fake = _enable(monkeypatch)
    client = TestClient(main_app)
    headers = _headers(504)

    statuses = _repeat(
        client,
        "get",
        "/api/v1/mock-tests/jee-main/attempts/9/result",
        6,
        headers=headers,
    )

    assert statuses[:5] != [429] * 5
    assert statuses[5] == 429
    keys = _keys(fake, "rl:p7:mock_test_review:")
    assert len(keys) == 1, keys
    assert "{attempt_id}" in keys[0]


def test_save_and_remove_college_limit(monkeypatch):
    fake = _enable(monkeypatch)
    client = TestClient(main_app)
    headers = _headers(505)

    saved = _repeat(
        client, "post", "/api/v1/saved-colleges?college_id=1", 31, headers=headers
    )
    assert saved[:30] != [429] * 30
    assert saved[30] == 429

    removed = _repeat(
        client, "delete", "/api/v1/saved-colleges/1", 31, headers=headers
    )
    assert removed[:30] != [429] * 30
    assert removed[30] == 429

    assert len(_keys(fake, "rl:p7:saved_college_write:")) == 2


def test_profile_update_limit(monkeypatch):
    fake = _enable(monkeypatch)
    client = TestClient(main_app)
    headers = _headers(506)

    statuses = _repeat(
        client, "put", "/api/v1/users/me", 11, headers=headers, json={"name": "A"}
    )

    assert statuses[:10] != [429] * 10
    assert statuses[10] == 429
    assert _keys(fake, "rl:p7:profile_update:")


def test_consent_and_compliance_limit(monkeypatch):
    fake = _enable(monkeypatch)
    client = TestClient(main_app)
    headers = _headers(507)

    consent = _repeat(
        client,
        "post",
        "/api/v1/consent",
        6,
        headers=headers,
        json={"consent_type": "data_processing", "granted": True},
    )
    assert consent[:5] != [429] * 5
    assert consent[5] == 429

    age = _repeat(
        client,
        "post",
        "/api/v1/compliance/age",
        6,
        headers=headers,
        json={"age_band": "18_plus"},
    )
    assert age[:5] != [429] * 5
    assert age[5] == 429

    consent_keys = _keys(fake, "rl:p7:consent_write:")
    assert len(consent_keys) == 2, consent_keys
    assert all(":u:507" in k for k in consent_keys)


def test_notification_limit(monkeypatch):
    fake = _enable(monkeypatch)
    client = TestClient(main_app)
    headers = _headers(508)

    listing = _repeat(
        client, "get", "/api/v1/notifications/my", 31, headers=headers
    )
    assert listing[:30] != [429] * 30
    assert listing[30] == 429

    marks = _repeat(
        client, "put", "/api/v1/notifications/1/read", 31, headers=headers
    )
    assert marks[:30] != [429] * 30
    assert marks[30] == 429

    keys = _keys(fake, "rl:p7:student_notifications:")
    assert len(keys) == 2, keys
    assert all(":u:508" in k for k in keys)


# ------------------------------------------------------- identity dimensions


def test_same_user_shares_one_quota_across_different_ips(monkeypatch):
    _enable(monkeypatch)
    _p7_override(monkeypatch, "mock_test_start", 2)
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    client = TestClient(main_app)

    first = client.post(
        "/api/v1/mock-tests/jee-main/start",
        headers=_headers(601, ip="10.0.0.1"),
        json={},
    )
    second = client.post(
        "/api/v1/mock-tests/jee-main/start",
        headers=_headers(601, ip="10.0.0.2"),
        json={},
    )
    third = client.post(
        "/api/v1/mock-tests/jee-main/start",
        headers=_headers(601, ip="10.0.0.3"),
        json={},
    )

    assert first.status_code != 429
    assert second.status_code != 429
    # Same verified student, new address: the user bucket is already spent.
    assert third.status_code == 429


def test_different_users_sharing_one_ip_have_independent_quotas(monkeypatch):
    fake = _enable(monkeypatch)
    _p7_override(monkeypatch, "mock_test_start", 2)
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    client = TestClient(main_app)

    def start(user_id: int) -> int:
        return client.post(
            "/api/v1/mock-tests/jee-main/start",
            headers=_headers(user_id, ip="10.0.0.9"),
            json={},
        ).status_code

    assert start(611) != 429
    assert start(611) != 429
    assert start(611) == 429
    # A second student behind the same NAT still has their full quota.
    assert start(622) != 429
    assert any(k.endswith(":u:611") for k in fake.counts)
    assert any(k.endswith(":u:622") for k in fake.counts)


def test_invalid_jwt_never_gets_a_user_bucket(monkeypatch):
    fake = _enable(monkeypatch)
    _p7_override(monkeypatch, "mock_test_start", 1)
    client = TestClient(main_app)

    invalid = {"authorization": "Bearer not-a-real-token", "x-user-id": "999"}
    assert (
        client.post(
            "/api/v1/mock-tests/jee-main/start", headers=invalid, json={}
        ).status_code
        != 429
    )
    # The same invalid caller is throttled on the trusted IP bucket.
    assert (
        client.post(
            "/api/v1/mock-tests/jee-main/start", headers=invalid, json={}
        ).status_code
        == 429
    )

    keys = _keys(fake, "rl:p7:mock_test_start:")
    assert keys
    assert all(":u:" not in k for k in keys), keys

    # A valid token then gets its own user bucket, unaffected by the IP counter.
    valid = _headers(630)
    assert (
        client.post(
            "/api/v1/mock-tests/jee-main/start", headers=valid, json={}
        ).status_code
        != 429
    )
    assert any(k.endswith(":u:630") for k in fake.counts)


def test_client_supplied_user_ids_cannot_bypass_enforcement(monkeypatch):
    fake = _enable(monkeypatch)
    _p7_override(monkeypatch, "mock_test_start", 2)
    client = TestClient(main_app)
    headers = {**_headers(42), "x-user-id": "999"}

    def start() -> int:
        return client.post(
            "/api/v1/mock-tests/jee-main/start?user_id=999",
            headers=headers,
            json={"user_id": 999},
        ).status_code

    assert start() != 429
    assert start() != 429
    assert start() == 429

    keys = _keys(fake, "rl:p7:mock_test_start:")
    assert any(k.endswith(":u:42") for k in keys), keys
    assert not any(k.endswith(":u:999") for k in keys), keys


def test_dynamic_route_templates_share_one_bucket(monkeypatch):
    fake = _enable(monkeypatch)
    _p7_override(monkeypatch, "mock_test_answer", 2)
    client = TestClient(main_app)
    headers = _headers(43)

    first = client.put(
        "/api/v1/mock-tests/jee-main/attempts/9/answers/1",
        headers=headers,
        json={"selected_answer": "A"},
    )
    second = client.put(
        "/api/v1/mock-tests/jee-main/attempts/9/answers/2",
        headers=headers,
        json={"selected_answer": "B"},
    )
    third = client.put(
        "/api/v1/mock-tests/jee-main/attempts/9/answers/3",
        headers=headers,
        json={"selected_answer": "C"},
    )

    assert first.status_code != 429
    assert second.status_code != 429
    assert third.status_code == 429

    keys = _keys(fake, "rl:p7:mock_test_answer:")
    assert len(keys) == 1, keys
    assert "{question_id}" in keys[0]
    assert "{attempt_id}" in keys[0]


# ------------------------------------------------- forwarded-IP trust chain


def test_forged_forwarded_for_cannot_mint_buckets_without_a_trusted_proxy(
    monkeypatch,
):
    """At the shipped default (no proxy) XFF is caller-controlled and ignored."""
    fake = _enable(monkeypatch)
    _p7_override(monkeypatch, "mock_test_start", 1)
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 0)
    client = TestClient(main_app)
    invalid = {"authorization": "Bearer invalid"}

    for forged in ("1.2.3.4", "9.9.9.9", "203.0.113.77"):
        client.post(
            "/api/v1/mock-tests/jee-main/start",
            headers={**invalid, "x-forwarded-for": forged},
            json={},
        )

    keys = _keys(fake, "rl:p7:mock_test_start:")
    assert len(keys) == 1, keys
    assert not any(forged in keys[0] for forged in ("1.2.3.4", "9.9.9.9"))


def test_a_forged_prefix_cannot_move_the_trusted_proxy_hop(monkeypatch):
    """With one declared proxy, only the proxy-appended (right-most) entry counts."""
    fake = _enable(monkeypatch)
    _p7_override(monkeypatch, "mock_test_start", 1)
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    client = TestClient(main_app)
    invalid = {"authorization": "Bearer invalid"}

    first = client.post(
        "/api/v1/mock-tests/jee-main/start",
        headers={**invalid, "x-forwarded-for": "1.2.3.4, 203.0.113.9"},
        json={},
    )
    second = client.post(
        "/api/v1/mock-tests/jee-main/start",
        headers={**invalid, "x-forwarded-for": "9.9.9.9, 203.0.113.9"},
        json={},
    )

    assert first.status_code != 429
    # Same trusted peer despite a different forged prefix: one shared bucket.
    assert second.status_code == 429
    keys = _keys(fake, "rl:p7:mock_test_start:")
    assert len(keys) == 1, keys
    assert "203.0.113.9" in keys[0]


# --------------------------------------------------------- headers / outage


def test_p5_headers_and_schema_on_a_p7_429(monkeypatch):
    _enable(monkeypatch)
    _p7_override(monkeypatch, "mock_test_start", 1)
    client = TestClient(main_app)
    headers = _headers(701)

    assert (
        client.post(
            "/api/v1/mock-tests/jee-main/start", headers=headers, json={}
        ).status_code
        != 429
    )
    rejected = client.post(
        "/api/v1/mock-tests/jee-main/start", headers=headers, json={}
    )

    assert rejected.status_code == 429
    assert rejected.headers["RateLimit-Limit"] == "1"
    assert rejected.headers["RateLimit-Remaining"] == "0"
    assert rejected.headers["RateLimit-Reset"] == "60"
    assert rejected.headers["Retry-After"] == "60"
    for name in RATE_HEADERS + ("Retry-After",):
        assert rejected.headers[name].isdigit()

    body = rejected.json()
    assert set(body) == {"success", "error"}
    assert set(body["error"]) == {"code", "message", "details"}
    assert body["error"]["code"] == "RATE_LIMIT_EXCEEDED"
    assert body["error"]["details"] == {"retry_after_seconds": 60}
    assert body["success"] is False


def test_p7_operations_fail_open_on_a_redis_outage(monkeypatch):
    """Student writes are not credential or cost surfaces, so they fail open.

    A Redis blip must not turn "save your profile" or "start your test" into a
    503; the request reaches the endpoint (which still authenticates). No
    RateLimit-* values are fabricated.
    """
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(ratelimit, "get_redis", lambda: BrokenRedis())
    client = TestClient(main_app)

    response = client.post(
        "/api/v1/consent",
        headers=_headers(702),
        json={"consent_type": "data_processing", "granted": True},
    )

    assert response.status_code not in (429, 503)
    for name in RATE_HEADERS + ("Retry-After",):
        assert name not in response.headers


def test_auth_fail_closed_behaviour_is_unchanged(monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(ratelimit, "get_redis", lambda: BrokenRedis())
    client = TestClient(main_app)

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "wrong-password-1"},
    )

    assert response.status_code == 503
    assert response.headers["Retry-After"] == "1"
    assert response.json()["error"]["code"] == "SERVICE_UNAVAILABLE"


# ------------------------------------------- mock-test lifecycle regression


def _register_user() -> dict:
    import uuid

    client = TestClient(main_app)
    payload = {
        "name": "P7 Student",
        "email": f"p7.student.{uuid.uuid4().hex[:8]}@example.com",
        "mobile": f"9{uuid.uuid4().int % 1_000_000_000:09d}",
        "password": "SecurePass123!",
        "age_band": "18_plus",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    return {**payload, **response.json()}


def _create_mock_test() -> MockTest:
    import uuid

    mock_test = MockTest(
        name=f"P7 Engine {uuid.uuid4().hex[:6]}",
        slug=f"p7-engine-{uuid.uuid4().hex[:8]}",
        subject="Mathematics",
        difficulty="medium",
        question_type="mcq",
        duration_minutes=30,
        total_marks=0,
        negative_marking=False,
        negative_marks_value=1,
        attempts_allowed=3,
        result_visibility="immediate",
        test_type="standard",
        is_active=True,
    )
    mock_test.questions = [
        TestQuestion(
            question_text=f"Question {i}",
            question_type="mcq",
            options=["A", "B", "C", "D"],
            correct_answer="A",
            marks=2,
            negative_marks=1,
            difficulty="medium",
            sort_order=i,
            explanation=f"Explanation {i}",
        )
        for i in range(1, 4)
    ]
    with SessionLocal() as db:
        db.add(mock_test)
        db.commit()
        db.refresh(mock_test)
        return mock_test


def _cleanup(mock_test_id: int) -> None:
    with SessionLocal() as db:
        mock_test = db.get(MockTest, mock_test_id)
        if mock_test:
            db.delete(mock_test)
            db.commit()


def test_timers_and_idempotent_resubmission_are_unchanged(monkeypatch):
    """P7 counts requests; it does not touch the clock, grading or idempotency."""
    mock_test = _create_mock_test()
    try:
        user = _register_user()
        fake = _enable(monkeypatch)
        client = TestClient(main_app)
        headers = _auth_headers(user["access_token"])

        start = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/start", headers=headers
        )
        assert start.status_code == 200, start.text
        body = start.json()
        attempt_id = body["attempt"]["id"]
        question_id = body["questions"][0]["id"]

        # The authoritative clock is polled far more often than the 5/hour
        # review cap; each call must still succeed and describe the same attempt.
        clocks = [
            client.get(
                f"/api/v1/mock-tests/{mock_test.slug}/attempts/{attempt_id}",
                headers=headers,
            )
            for _ in range(12)
        ]
        assert all(response.status_code == 200 for response in clocks)
        assert {response.json()["attempt"]["id"] for response in clocks} == {
            attempt_id
        }
        assert all(
            response.json()["attempt"]["time_remaining_seconds"] >= 0
            for response in clocks
        )
        assert not _keys(fake, "rl:p7:mock_test_review:")

        saved = client.put(
            f"/api/v1/mock-tests/{mock_test.slug}/attempts/{attempt_id}"
            f"/answers/{question_id}",
            json={"selected_answer": "A"},
            headers=headers,
        )
        assert saved.status_code == 200, saved.text

        first = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/attempts/{attempt_id}/submit",
            headers=headers,
        )
        assert first.status_code == 200, first.text

        # Re-submitting a graded attempt stays idempotent: same stored result.
        second = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/attempts/{attempt_id}/submit",
            headers=headers,
        )
        assert second.status_code == 200, second.text
        assert second.json()["attempt"]["status"] == "submitted"
        assert float(second.json()["attempt"]["score"]) == float(
            first.json()["attempt"]["score"]
        )

        # Autosave after submission keeps its original refusal.
        late = client.put(
            f"/api/v1/mock-tests/{mock_test.slug}/attempts/{attempt_id}"
            f"/answers/{question_id}",
            json={"selected_answer": "B"},
            headers=headers,
        )
        assert late.status_code == 400
        assert "already submitted" in late.json()["detail"]
    finally:
        _cleanup(mock_test.id)


def test_legacy_bulk_duplicate_submission_is_still_rejected(monkeypatch):
    mock_test = _create_mock_test()
    try:
        user = _register_user()
        _enable(monkeypatch)
        client = TestClient(main_app)
        headers = _auth_headers(user["access_token"])

        bank = client.get(
            f"/api/v1/mock-tests/{mock_test.slug}/questions"
        ).json()
        answers = {
            "answers": [
                {"question_id": question["id"], "selected_answer": "A"}
                for question in bank
            ]
        }

        first = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/submit",
            json=answers,
            headers=headers,
        )
        assert first.status_code == 200, first.text

        second = client.post(
            f"/api/v1/mock-tests/{mock_test.slug}/submit",
            json=answers,
            headers=headers,
        )
        assert second.status_code == 400
        assert "already submitted" in second.json()["detail"]
    finally:
        _cleanup(mock_test.id)


def test_p7_rules_do_not_create_a_blanket_limit():
    """An unrelated, unclassified route remains outside the limiter."""
    # P9 classifies the staff-guarded banner write and submission listing, so
    # they are covered by the general-admin tier rather than left open.
    banners = _resolved("POST", "/api/v1/banners")
    assert banners is not None and banners.namespace == "p9:admin_general"
    submissions = _resolved("GET", "/api/v1/college-submissions")
    assert submissions is not None and submissions.namespace == "p9:admin_general"
    # A path that matches no registered route (and no rule) stays unclassified.
    assert _resolved("GET", "/api/v1/does-not-exist") is None
    # The pre-existing P2-P6 rules are still whatever they were.
    predictor = _resolved("POST", "/api/v1/predictor/exams")
    assert predictor is not None
    assert (predictor.category, predictor.limit) == ("ai_predictor", 10)
    enquiries = _resolved("POST", "/api/v1/enquiries/anything")
    assert enquiries is not None
    assert (enquiries.category, enquiries.limit) == ("enquiries_crm", 5)
