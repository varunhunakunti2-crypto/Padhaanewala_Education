"""Regression tests for the Redis-backed rate limiter and the health probe.

The limiter had three defects that only a test can pin, because each one is a
behaviour that still *looks* correct in a manual click-through:

* **Not atomic.** It did `GET` then `INCR` in Python, so concurrent requests all
  read the same pre-increment count and all passed the check. The tests below
  assert the read-modify-write happens server-side in a single call.
* **Fail-open on `/auth`.** `except redis.RedisError: pass` meant a Redis outage
  removed throttling from the login path entirely -- precisely the window an
  attacker picks. A 401 storm during an outage was the observable symptom.
* **Fail-open on health.** `GET /health` only ever checked PostgreSQL, so the
  app reported `ok` while the rate limiter was down.
"""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from redis.exceptions import ConnectionError as RedisConnectionError

from app.config import settings
from app.main import app

client = TestClient(app)

AUTH_PATH = "/api/v1/auth/login"
ENQUIRY_PATH = "/api/v1/enquiries"

#: Below the limiter's own allowance, so tests assert on the limiter's verdict
#: rather than on whether the fake credentials happened to be valid.
LOGIN_BODY = {"email": "nobody@example.com", "password": "wrong-password-1"}


class FakeRedis:
    """In-memory stand-in that counts with the same semantics as the Lua script.

    `count` only increments once a key is created, and the window is recorded on
    creation, so a test that exceeds the limit and then inspects the TTL sees the
    same state the real server would hold.
    """

    def __init__(self) -> None:
        self.counts: dict[str, int] = {}
        self.ttls: dict[str, int] = {}
        self.eval_calls = 0
        self.scripts: list[str] = []

    async def eval(self, script: str, numkeys: int, key: str, window: str) -> list[int]:
        assert numkeys == 1, "the limiter must pass exactly one key to KEYS[1]"
        self.eval_calls += 1
        self.scripts.append(script)
        self.counts[key] = self.counts.get(key, 0) + 1
        if self.counts[key] == 1:
            # Mirrors `if count == 1 then EXPIRE`.
            self.ttls[key] = int(window)
        return [self.counts[key], self.ttls.get(key, -1)]

    async def ping(self) -> bool:
        return True


class BrokenRedis:
    """Every command fails the way an unreachable node does."""

    async def eval(self, *args, **kwargs):
        raise RedisConnectionError("Error 111 connecting to redis:6379. Connection refused.")

    async def ping(self) -> bool:
        raise RedisConnectionError("Error 111 connecting to redis:6379. Connection refused.")


@pytest.fixture
def fake_redis():
    """Enable the limiter for one test with a working counter behind it.

    `conftest.py` disables rate limiting globally so the auth suite is not
    throttled by a shared Redis, so it has to be re-enabled per-test. The
    `RATE_LIMIT_ENABLED` attribute is read per request, not cached at import, so
    patching the singleton in place is enough.
    """
    redis = FakeRedis()
    with (
        patch.object(settings, "RATE_LIMIT_ENABLED", True),
        patch("app.middleware.ratelimit.get_redis", return_value=redis),
    ):
        yield redis


@pytest.fixture
def broken_redis():
    """The same, with Redis down, to pin the open/closed decision."""
    with (
        patch.object(settings, "RATE_LIMIT_ENABLED", True),
        patch("app.middleware.ratelimit.get_redis", return_value=BrokenRedis()),
    ):
        yield


# --------------------------------------------------------------------- limits


def test_login_is_blocked_after_five_attempts(fake_redis):
    """Five attempts pass, the sixth is throttled."""
    statuses = [client.post(AUTH_PATH, json=LOGIN_BODY).status_code for _ in range(6)]

    # Wrong credentials are a 401, which proves the request reached the router
    # rather than being stopped by the limiter.
    assert statuses[:5] == [401] * 5
    assert statuses[5] == 429


def test_throttled_response_names_the_wait(fake_redis):
    """A 429 must tell the caller when to come back, or retries pile up."""
    for _ in range(5):
        client.post(AUTH_PATH, json=LOGIN_BODY)

    body = client.post(AUTH_PATH, json=LOGIN_BODY).json()

    assert body["error"]["code"] == "RATE_LIMIT_EXCEEDED"
    # The window is 60s; the value must be a usable positive number, not the
    # -1 that `TTL` returns for a key that does not exist.
    assert body["error"]["details"]["retry_after_seconds"] >= 1


def test_counter_uses_one_atomic_call_per_request(fake_redis):
    """The limit must not depend on a read-then-write race in Python.

    The old implementation issued `GET` followed by `INCR`; a client that
    observes a `GET` here means the read-modify-write has moved back into the
    application and concurrent requests can each pass the check.
    """
    for _ in range(4):
        client.post(AUTH_PATH, json=LOGIN_BODY)

    assert fake_redis.eval_calls == 4
    assert "redis.call('INCR'" in fake_redis.scripts[0]
    # `EXPIRE` guarded by `count == 1` is what stops a steady trickle from
    # keeping a bucket alive forever by re-extending the window on every hit.
    assert "if count == 1 then" in fake_redis.scripts[0]


def test_window_is_set_once_and_not_extended_by_traffic(fake_redis):
    """A sustained trickle must not earn a fresh window on every request."""
    for _ in range(3):
        client.post(AUTH_PATH, json=LOGIN_BODY)

    key = next(iter(fake_redis.ttls))
    assert fake_redis.ttls[key] == 60


def test_reads_are_never_throttled(fake_redis):
    """Catalog pages fan out many parallel GETs; throttling them breaks the ISR."""
    statuses = [client.get("/api/v1/colleges").status_code for _ in range(20)]

    assert fake_redis.eval_calls == 0
    assert all(s != 429 for s in statuses)


# --------------------------------------------------------- open vs closed


def test_auth_fails_closed_when_redis_is_down(broken_redis):
    """An unreachable counter must not mean unlimited login attempts."""
    for _ in range(20):
        resp = client.post(AUTH_PATH, json=LOGIN_BODY)

        assert resp.status_code == 503, "auth must not proceed while throttling is down"

    body = client.post(AUTH_PATH, json=LOGIN_BODY).json()
    # 503, not 429: a 429 invites immediate retries, which turns one Redis blip
    # into a retry storm against a dependency that is already struggling.
    assert body["error"]["code"] == "SERVICE_UNAVAILABLE"


def test_public_write_fails_open_when_redis_is_down(broken_redis):
    """Losing a spam throttle on lead capture beats refusing every enquiry."""
    resp = client.post(ENQUIRY_PATH, json={})

    assert resp.status_code != 503
    assert resp.status_code != 429


def test_public_write_still_throttles_when_redis_is_healthy(fake_redis):
    """The open/closed split must not have disabled the limit itself."""
    statuses = [client.post(ENQUIRY_PATH, json={}).status_code for _ in range(6)]

    assert 429 in statuses


# ------------------------------------------------------------------- health


def test_health_reports_redis_ok(fake_redis):
    with patch("app.services.redis_client.get_redis", return_value=FakeRedis()):
        body = client.get("/health").json()

    assert body["checks"]["redis"]["ok"] is True
    assert "PING" in body["checks"]["redis"]["detail"]


def test_health_degrades_and_returns_503_when_redis_is_down(fake_redis):
    """A dead Redis must not be reported as healthy.

    The rate limiter now fails closed on `/api/v1/auth`, so a Redis outage is a
    login outage. A green health check during one is what turns a five-minute
    dependency blip into an incident nobody is paged for.
    """
    with patch("app.services.redis_client.get_redis", return_value=BrokenRedis()):
        resp = client.get("/health")

    assert resp.status_code == 503
    body = resp.json()
    assert body["status"] == "degraded"
    assert body["checks"]["redis"]["ok"] is False
    # The database check still ran and is still reported, so a Redis outage is
    # not mistaken for a total outage.
    assert body["checks"]["database"]["ok"] is True


def test_health_redis_failure_detail_does_not_leak_the_url():
    """The Redis error text can carry the connection URL, credentials included."""
    with patch("app.services.redis_client.get_redis", return_value=BrokenRedis()):
        detail = client.get("/health").json()["checks"]["redis"]["detail"]

    assert "6379" not in detail
    assert "redis://" not in detail

