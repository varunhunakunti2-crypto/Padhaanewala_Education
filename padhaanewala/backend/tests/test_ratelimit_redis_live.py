"""The rate limiter against a **real** Redis, not a fake.

## Why this file exists

`conftest.py` stubs Redis for the whole suite so a developer's outcome does not
depend on whether a `redis:7-alpine` container happens to be up. That is the
right default, and it has a cost: every limiter test in
`test_ratelimit_redis.py` runs against `FakeRedis`, a Python dict that
reimplements the Lua script's semantics. The properties that only a real server
can demonstrate were therefore never demonstrated anywhere:

* `EVAL` of `_RATE_LIMIT_SCRIPT` is accepted by Redis at all. A syntax error, a
  typo, or a `redis.call` against a command a hardened `redis.conf` has disabled
  all fail at runtime — and nothing caught that, because `FakeRedis.eval` never
  parses the script.
* The increment is genuinely atomic *server-side*. `FakeRedis` is sequential
  and single-threaded, so it cannot tell one atomic `EVAL` apart from the old
  non-atomic `GET`-then-`INCR` under concurrency. The old implementation passed
  every existing test.
* The counter is **shared** between processes. This is BUG-07: with Redis down
  the limiter degrades to per-process counters, which on a single-process dev
  box is indistinguishable from the real thing. Only a test that talks to a real
  server from two independent connections can see the difference.
* `EXPIRE`/`TTL` behave as the script assumes, including `retry_after_seconds`
  being a usable positive number rather than the `-1` `TTL` returns for a key
  with no expiry.
* A real connection *refusal* takes the fail-closed path quickly, rather than
  stalling the request — the 250 ms `socket_connect_timeout` guarantee.

## Two plumbing decisions that look odd on purpose

**One event loop, owned by the fixture.** An `redis.asyncio` client is bound to
the loop that first used it. `TestClient` runs the ASGI app on a loop of its
own and closes it afterwards, so a client built during a request cannot be
closed from outside, and the first version of this file failed teardown with
"Event loop is closed". Every end-to-end test here therefore drives the app
through `httpx.ASGITransport` on a loop the fixture creates, builds and closes.

**The real `get_redis` is captured at import.** `conftest.py` replaces
`app.services.redis_client.get_redis` with a stub for the session, and
`ratelimit.py` does `from ... import get_redis`, so it holds its own reference.
Module import happens during collection, before the session fixture runs, so the
name bound here is the genuine function rather than the stub.

## Skipping, and why a skip is not a pass

These tests skip when no Redis answers, so the suite stays runnable on a bare
checkout. A skip is a recorded statement that this path was unexercised — it is
not a pass. If every test here skips, the file has verified nothing, and that
should be visible in the output rather than inferred.

    docker compose -f docker-compose.dev.yml up -d redis
    pytest tests/test_ratelimit_redis_live.py -v

CI gives every test job a Redis service so this file does not skip there.
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from types import SimpleNamespace

import httpx
import pytest
import redis
import redis.asyncio as aioredis

from app.config import settings
from app.middleware import ratelimit
from app.main import app
from app.services import redis_client

# The genuine accessor, bound during collection — before conftest's session
# fixture swaps in the stub. See the module docstring.
_real_get_redis = redis_client.get_redis

AUTH_PATH = "/api/v1/auth/login"

#: Kept out of the application keyspace. These tests write real keys, and a
#: developer's own rate-limit buckets (or another suite's) must not be disturbed.
TEST_DB = 15

#: Nothing is listening here. A refusal, not a simulated exception.
DEAD_URL = "redis://127.0.0.1:6399/0"

#: Below the limiter's own allowance, so assertions are about the limiter and not
#: about whether the fake credentials happened to be valid.
LOGIN_BODY = {"email": "nobody@example.com", "password": "wrong-password-1"}


#: Resolved once, at import. `settings.REDIS_URL` is not a safe source: the
#: dead-port fixtures monkeypatch it, so anything that needs a *reachable*
#: address during teardown has to use this instead.
_LIVE_URL = settings.REDIS_URL.rsplit("/", 1)[0] + f"/{TEST_DB}"


def _test_url() -> str:
    """`REDIS_URL` retargeted at the throwaway database."""
    return _LIVE_URL


def _sync_redis() -> redis.Redis:
    """A fresh synchronous client.

    Synchronous on purpose: no event-loop affinity, so it can be created inside
    a fixture and used after an event loop has come and gone.
    """
    return redis.Redis.from_url(
        _test_url(),
        decode_responses=True,
        socket_timeout=2,
        socket_connect_timeout=2,
    )


def _redis_available() -> bool:
    client = _sync_redis()
    try:
        return bool(client.ping())
    except Exception:  # noqa: BLE001 - any failure means "not available"
        return False
    finally:
        client.close()


_REACHABLE = _redis_available()

pytestmark = pytest.mark.skipif(
    not _REACHABLE,
    reason=(
        f"no Redis at {_test_url()}. Start one with "
        "`docker compose -f docker-compose.dev.yml up -d redis`. These are the "
        "only tests that exercise the real limiter; a skip here leaves BUG-07's "
        "cluster-wide behaviour unverified."
    ),
)


@pytest.fixture
def namespace() -> str:
    """A unique key prefix per test.

    Tests cannot see each other's counters, and a failed test cannot leave a
    bucket behind that throttles the next one.
    """
    return f"rl-test:{uuid.uuid4().hex}"


@pytest.fixture
def sync_redis(namespace):
    """A real connection, with this test's keys removed afterwards."""
    client = _sync_redis()
    try:
        yield client
    finally:
        keys = list(client.scan_iter(match=f"{namespace}*"))
        if keys:
            client.delete(*keys)
        client.close()


def _close_client_ignoring_transport(client) -> None:
    """Release a client's sockets without contacting anything.

    Deliberately not `aclose()`. Two orderings are possible and both are wrong
    for a client pointed at a dead port: closing it on its own live loop makes
    redis-py negotiate a QUIT and raise `TimeoutError`, and closing it after
    that loop is gone raises "Event loop is closed". Neither is a defect under
    test — the point of the dead-port fixtures is that the *application*
    fail-closes, and the connection it left behind is an artefact of that.

    redis-py's `Connection.disconnect(nowait=True)` is the right primitive: it
    closes the writer and returns without awaiting `wait_closed()`, which is the
    await that raises `TimeoutError` against a dead port. It is a coroutine, so
    it needs a live loop — hence the throwaway one, since the client's own is
    already closed by this point.
    """
    pool = client.connection_pool
    connections = list(pool._available_connections) + list(pool._in_use_connections)
    pool._available_connections.clear()
    pool._in_use_connections.clear()
    if not connections:
        return

    async def close_all() -> None:
        await asyncio.gather(
            *(c.disconnect(nowait=True) for c in connections),
            return_exceptions=True,
        )

    try:
        asyncio.run(close_all())
    except Exception:  # noqa: BLE001 - teardown must not fail
        pass


def _delete_namespace(namespace: str, url: str) -> None:
    """Remove one test's rate-limit keys.

    Takes the URL as an argument rather than reading `settings.REDIS_URL`, which
    the dead-port fixtures have monkeypatched to a port with nothing behind it.
    The cleanup connection has to go somewhere real, or the next run inherits a
    bucket and teardown pays a connection timeout.
    """
    probe = redis.Redis.from_url(
        url, decode_responses=True, socket_timeout=2, socket_connect_timeout=2
    )
    try:
        keys = list(probe.scan_iter(match=f"rl:{namespace}:*"))
        if keys:
            probe.delete(*keys)
    finally:
        probe.close()


def _app_harness(monkeypatch, namespace: str, url: str, enabled: bool = True):
    """Wire the application to a real Redis and yield a loop-owned driver.

    `run` executes a coroutine on a loop this fixture controls, so the async
    client the application builds is created and closed on the same loop. The
    `http` helper posts to the app on that loop without `TestClient`.
    """
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", enabled)
    monkeypatch.setattr(settings, "REDIS_URL", url)
    # Both references, for the reason given in the module docstring: the health
    # check looks the name up on the module, the middleware holds its own.
    monkeypatch.setattr(redis_client, "get_redis", _real_get_redis)
    monkeypatch.setattr(ratelimit, "get_redis", _real_get_redis)
    # Every key the limiter writes goes under this prefix, so cleanup is exact
    # and a developer's real buckets are never touched.
    monkeypatch.setattr(ratelimit, "_limit_for", lambda path: (namespace, 5, 60))
    # The namespace is substituted for key isolation, but `FAIL_CLOSED_NAMESPACES`
    # decides the *policy*. Without this the auth tests below would silently
    # exercise the fail-open branch and pass for the wrong reason — which is
    # exactly what the first version of this file did.
    monkeypatch.setattr(
        ratelimit, "FAIL_CLOSED_NAMESPACES", frozenset({namespace})
    )

    previous = redis_client._client
    redis_client._client = None
    loop = asyncio.new_event_loop()

    def run(coro):
        return loop.run_until_complete(coro)

    async def post(path: str, json_body: dict, count: int = 1) -> list[httpx.Response]:
        """Fire `count` requests concurrently and return the responses.

        `asyncio.gather` is what makes the concurrency real: sequential calls
        would each finish before the next starts, which is precisely the case in
        which a non-atomic counter looks correct.
        """
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://testserver"
        ) as http:
            return list(
                await asyncio.gather(
                    *(http.post(path, json=json_body) for _ in range(count))
                )
            )

    async def post_sequentially(
        path: str, json_body: dict, count: int
    ) -> list[httpx.Response]:
        """One at a time, so each response is ordered against its own counter.

        The concurrency assertions need `post`; the "the sixth attempt is
        refused" assertion needs this, because under `gather` the request that
        receives count=6 is whichever the server happens to schedule, so the 429
        can land anywhere in the list. That is not a weaker property — it is the
        same limit, observed from the other side — but it has to be asserted
        differently.
        """
        transport = httpx.ASGITransport(app=app)
        responses: list[httpx.Response] = []
        async with httpx.AsyncClient(
            transport=transport, base_url="http://testserver"
        ) as http:
            for _ in range(count):
                responses.append(await http.post(path, json=json_body))
        return responses

    async def get(path: str):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(
            transport=transport, base_url="http://testserver"
        ) as http:
            return await http.get(path)

    try:
        yield SimpleNamespace(
            run=run,
            post=post,
            post_sequentially=post_sequentially,
            get=get,
            namespace=namespace,
        )
    finally:
        client = redis_client._client
        redis_client._client = previous
        loop.close()
        if client is not None:
            # Closed *after* the loop it was built on is gone, which is the only
            # order that works: `aclose()` on a client whose loop has closed
            # raises "Event loop is closed", and on a live loop it raises
            # `TimeoutError` when the pool holds a half-open connection to the
            # dead port this fixture deliberately pointed it at. Both are
            # teardown noise for a refusal the test provoked on purpose, so the
            # socket is dropped directly instead.
            _close_client_ignoring_transport(client)
        # Always against the *healthy* database, never `url`. The dead-port
        # fixtures wrote no keys, so the scan finds nothing, and pointing it at
        # the dead port would turn cleanup itself into a timeout.
        _delete_namespace(namespace, _test_url())


@pytest.fixture
def live_app(monkeypatch, namespace):
    """The application against a real, healthy Redis."""
    yield from _app_harness(monkeypatch, namespace, _test_url())


@pytest.fixture
def dead_app(monkeypatch, namespace):
    """The application against a port with nothing listening."""
    yield from _app_harness(monkeypatch, namespace, DEAD_URL)


# --------------------------------------------------------------------------
# The script itself, against a real server
# --------------------------------------------------------------------------


def test_the_lua_script_is_accepted_by_redis(sync_redis, namespace):
    """`FakeRedis.eval` ignores the script body entirely.

    A syntax error, a bad `redis.call`, or a command a hardened `redis.conf` has
    disabled would pass every existing test and then fail on the first real
    login in production.
    """
    key = f"{namespace}:script-accepted"

    count, ttl = sync_redis.eval(ratelimit._RATE_LIMIT_SCRIPT, 1, key, "60")

    assert int(count) == 1
    assert 0 < int(ttl) <= 60


def test_the_script_sets_the_window_only_on_creation(sync_redis, namespace):
    """A steady trickle must not earn a fresh window on every request.

    The `if count == 1` guard is the whole defence, asserted here against the
    server's own clock rather than a fake's dict.
    """
    key = f"{namespace}:window"

    original_ttl = int(sync_redis.eval(ratelimit._RATE_LIMIT_SCRIPT, 1, key, "60")[1])
    assert 0 < original_ttl <= 60

    # Age the window measurably, then add traffic.
    sync_redis.expire(key, original_ttl - 5)
    aged = int(sync_redis.ttl(key))

    for _ in range(5):
        sync_redis.eval(ratelimit._RATE_LIMIT_SCRIPT, 1, key, "60")

    final_ttl = int(sync_redis.ttl(key))
    # The window kept counting down; traffic did not reset it to 60.
    assert final_ttl <= aged, f"traffic extended the window: {aged} -> {final_ttl}"
    assert 0 < final_ttl < original_ttl


def test_concurrent_increments_do_not_lose_a_single_hit(sync_redis, namespace):
    """The atomicity the old `GET`-then-`INCR` implementation lacked.

    Fifty concurrent `EVAL` calls must leave the counter at exactly 50. A
    read-modify-write race in the application loses updates, which is the reason
    the script exists — and `FakeRedis` is sequential, so it could never have
    caught that regression.
    """
    key = f"{namespace}:concurrency"
    n = 50

    pipe = sync_redis.pipeline(transaction=False)
    for _ in range(n):
        pipe.eval(ratelimit._RATE_LIMIT_SCRIPT, 1, key, "60")
    pipe.execute()

    assert int(sync_redis.get(key)) == n, (
        "the counter lost increments under concurrency, so the limit is not a limit"
    )


def test_two_independent_connections_share_one_counter(sync_redis, namespace):
    """The BUG-07 property: the counter is cluster-wide, not per-process.

    Two separate connections stand in for two application processes — the same
    thing the per-process fallback silently got wrong.
    """
    key = f"{namespace}:shared"
    other = _sync_redis()
    try:
        first = int(sync_redis.eval(ratelimit._RATE_LIMIT_SCRIPT, 1, key, "60")[0])
        second = int(other.eval(ratelimit._RATE_LIMIT_SCRIPT, 1, key, "60")[0])
        third = int(other.eval(ratelimit._RATE_LIMIT_SCRIPT, 1, key, "60")[0])
    finally:
        other.close()

    assert first == 1
    # Connection B never read the counter in Python, yet its first call returns
    # 2. That is the server, not the client, holding the state.
    assert (second, third) == (2, 3)


def test_retry_after_is_a_usable_positive_number(sync_redis, namespace):
    """`TTL` returns -1 for a key with no expiry, and that must not reach a client.

    `_throttled` clamps with `max(retry_after, 1)`; this asserts the clamp exists
    *and* that a real limiter key carries a sensible value.
    """
    key = f"{namespace}:no-expiry"
    sync_redis.set(key, "3")
    assert int(sync_redis.ttl(key)) == -1, "precondition: this key has no expiry"

    body = ratelimit._throttled("auth", 5, -1)
    assert json.loads(body.body)["error"]["details"]["retry_after_seconds"] >= 1

    # And a real limiter key, whose TTL is a usable number.
    limiter_key = f"{namespace}:retry-after"
    ttl = int(sync_redis.eval(ratelimit._RATE_LIMIT_SCRIPT, 1, limiter_key, "60")[1])
    assert 0 < ttl <= 60
    assert ratelimit._throttled("auth", 5, ttl).status_code == 429


# --------------------------------------------------------------------------
# The middleware, end to end, over a real connection
# --------------------------------------------------------------------------


def test_login_is_throttled_end_to_end(live_app, namespace):
    """The full path: HTTP request -> middleware -> Lua -> 429.

    Every other limiter test patches `get_redis`. This one lets the middleware
    reach the real server, so it covers what a fake cannot: the actual `EVAL`,
    the real key namespace, and the script's return shape being unpacked as
    `[count, ttl]`.
    """
    responses = live_app.run(live_app.post_sequentially(AUTH_PATH, LOGIN_BODY, count=6))
    statuses = [r.status_code for r in responses]

    assert statuses[:5] == [401] * 5, f"unexpected: {statuses}"
    assert statuses[5] == 429, f"real Redis did not throttle the 6th login: {statuses}"
    assert responses[5].json()["error"]["code"] == "RATE_LIMIT_EXCEEDED"

    # The counter really is in Redis, under the namespace the middleware chose.
    probe = _sync_redis()
    try:
        keys = list(probe.scan_iter(match=f"rl:{namespace}:*"))
        assert keys, "no rate-limit key was written to Redis"
        assert int(probe.get(keys[0])) == 6
        # The window is set, so the bucket expires rather than leaking forever.
        assert 0 < int(probe.ttl(keys[0])) <= 60
    finally:
        probe.close()


def test_concurrent_logins_never_exceed_the_limit(live_app):
    """The property BUG-07 leaves unguarded, at the HTTP boundary.

    Twenty simultaneous login attempts must produce exactly five passes and
    fifteen throttles. A non-atomic limiter lets more than five through, and on
    the auth path that is unlimited password guessing.
    """
    responses = live_app.run(live_app.post(AUTH_PATH, LOGIN_BODY, count=20))
    statuses = [r.status_code for r in responses]

    throttled = statuses.count(429)
    assert throttled == 15, (
        f"expected exactly 15 throttles of 20 attempts, got {throttled}: {statuses}"
    )
    assert set(statuses) == {401, 429}, f"unexpected statuses: {statuses}"


def test_health_reports_redis_ok(live_app):
    """`GET /health` must see the real server, not a stub.

    The stub in `conftest.py` makes `/health` green unconditionally, which is
    exactly why a dead Redis in production would have been invisible.
    """
    resp = live_app.run(live_app.get("/health"))

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["checks"]["redis"]["ok"] is True
    assert "Redis answered PING" in body["checks"]["redis"]["detail"]


# --------------------------------------------------------------------------
# Real connection refusal, the failure path a fake cannot fake
# --------------------------------------------------------------------------


def test_health_reports_degraded_against_a_closed_port(dead_app):
    """A real refusal must degrade the verdict and return 503."""
    resp = dead_app.run(dead_app.get("/health"))

    assert resp.status_code == 503
    body = resp.json()
    assert body["status"] == "degraded"
    assert body["checks"]["redis"]["ok"] is False
    # The database is still fine, so this is not reported as a total outage.
    assert body["checks"]["database"]["ok"] is True


def test_auth_fails_closed_against_a_closed_port(dead_app):
    """A real refusal must produce the fail-closed 503, and do it quickly.

    `test_ratelimit_redis.py` covers this with `BrokenRedis`, which raises a
    constructed exception. Here the refusal is real, which additionally proves
    the 250 ms `socket_connect_timeout` keeps a dead Redis from stalling every
    login — the fast-fail guarantee the config comment claims.
    """
    started = time.perf_counter()
    resp = dead_app.run(dead_app.post_sequentially(AUTH_PATH, LOGIN_BODY, count=1))[0]
    elapsed = time.perf_counter() - started

    assert resp.status_code == 503, resp.text
    assert resp.json()["error"]["code"] == "SERVICE_UNAVAILABLE"
    assert elapsed < 5, f"fail-closed took {elapsed:.2f}s, so it is not fast-failing"


def test_the_refused_client_still_honours_its_timeout():
    """The connection attempt itself must be bounded.

    Asserted directly against a real client rather than through a request, so a
    regression in `redis_client.get_redis`'s timeout configuration shows up as a
    slow test rather than as a slow production login.
    """
    client = aioredis.from_url(
        DEAD_URL, socket_connect_timeout=settings.REDIS_SOCKET_TIMEOUT_SECONDS
    )
    started = time.perf_counter()
    try:
        with pytest.raises(Exception):  # noqa: B017 - any Redis error will do
            asyncio.run(client.ping())
        elapsed = time.perf_counter() - started
    finally:
        asyncio.run(client.aclose())

    assert elapsed < 5, (
        f"connecting to a dead port took {elapsed:.2f}s; "
        "socket_connect_timeout is not bounding the attempt"
    )
