"""P10 - production readiness for the P1-P9 rate limiter.

P10 is a verification phase, not a new limit phase. This file pins the
properties that make the existing limiter safe to run in production, and that
nothing in P1-P9 already measured:

* **Route coverage** - every registered route/method is either throttled or is
  in an explicit, documented set. The 23 ``/api/v1`` routes that P1-P9 never
  classified are pinned by name, so a future route cannot be added without
  either classifying it or updating the pin. It also pins the deliberate
  exclusions (health/docs), and that a parameterized route produces one bucket
  for every concrete id.

* **Proxy boundary** - ``TRUSTED_PROXY_HOPS`` is the only thing that makes a
  forwarded header believable. At ``hops == 0`` a forged ``X-Forwarded-For`` or
  ``X-Real-IP`` cannot move the bucket; at ``hops == 1`` only the rightmost
  entry (the one Caddy wrote) is used, never a client-supplied prefix. The edge
  configuration that makes ``hops == 1`` correct is pinned too: Caddy
  overwrites the headers and the backend publishes no port.

* **Startup configuration** - a production process refuses to boot with the
  limiter disabled, the policy engine disabled, a data method exempted, a
  non-Redis URL, or a non-positive limit. Every environment refuses malformed
  maps, windows and overrides, because a typo that is silently ignored makes an
  operator believe a limit was changed when it was not.

* **Failure matrix** - credential, paid-AI, public-write and sensitive-admin
  routes fail closed when Redis is gone; public reads and health keep serving.
  A Redis error is retried once, and recovery is observed by the next request.

* **Observability** - structured JSON events for throttles, dependency
  failures, counter-read failures and quota exhaustion, with bounded labels and
  no IP, path, identity or credential in any payload. Enabling/disabling
  logging never changes a request's outcome.

* **Shared state** - two client instances using one Redis share a counter (no
  process-local limiter), and the single-counter path makes exactly one Redis
  round trip.
"""

from __future__ import annotations

import json
import logging
import re
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from redis.exceptions import ConnectionError as RedisConnectionError
from starlette.requests import Request

from app.config import _validate_rate_limit_config, settings
from app.main import app as main_app
from app.middleware import rate_limit_observability as obs
from app.middleware import rate_limit_policy as policy
from app.middleware import ratelimit
from app.middleware.rate_limit_dimensions import (
    seconds_until_utc_midnight,
    utc_day_bucket,
)
from app.middleware.rate_limit_policy import (
    reset_route_template_cache,
    resolve_rate_limit,
)
from app.utils.client_ip import client_ip

REPO_ROOT = Path(__file__).resolve().parents[2]

OBS_LOGGER = "padhaanewala.ratelimit"

#: Every ``/api/v1`` route/method combination the P1-P9 policy engine does not
#: classify, discovered by enumerating the registered Starlette routes. P10
#: deliberately does **not** add limits here: that would change P1-P9 behaviour
#: without approval. The set is pinned so the gap stays visible and a new route
#: fails this test until it is either covered or added deliberately.
KNOWN_UNTHROTTLED_ROUTES = {
    ("POST", "/api/v1/compliance/parental-consent/request"),
    ("GET", "/api/v1/users/me"),
    ("GET", "/api/v1/users/me/profile"),
    ("GET", "/api/v1/users/me/roles"),
    ("GET", "/api/v1/compliance/parental-consent"),
    ("GET", "/api/v1/compliance/status"),
    ("GET", "/api/v1/compliance/requests"),
    ("GET", "/api/v1/compliance/requests/{request_id}"),
    ("GET", "/api/v1/saved-colleges"),
    ("GET", "/api/v1/consent"),
    ("GET", "/api/v1/college-submissions/my"),
    ("GET", "/api/v1/college-submissions/{submission_id}"),
    ("POST", "/api/v1/college-submissions"),
    ("PUT", "/api/v1/college-submissions/{submission_id}"),
    ("DELETE", "/api/v1/college-submissions/{submission_id}"),
    ("GET", "/api/v1/reviews/my"),
    ("POST", "/api/v1/reviews"),
    ("PUT", "/api/v1/reviews/{review_id}"),
    ("GET", "/api/v1/predictor/exams"),
    ("GET", "/api/v1/mock-tests/{mock_test_ref}"),
    ("GET", "/api/v1/mock-tests/{mock_test_ref}/questions"),
    ("GET", "/api/v1/mock-tests/{mock_test_ref}/attempts"),
    ("GET", "/api/v1/mock-tests/{mock_test_ref}/attempts/{attempt_id}"),
}

#: Paths that are intentionally outside the limiter. Health must answer when
#: the limiter is unavailable, and schema/docs endpoints are static metadata.
#: They are separated from the gap above so the two decisions cannot be
#: conflated.
INTENTIONALLY_UNTHROTTLED = {
    ("GET", "/health"),
    ("GET", "/docs"),
    ("GET", "/docs/oauth2-redirect"),
    ("GET", "/openapi.json"),
    ("GET", "/redoc"),
}

#: Every ``{name: {limit, window_seconds}}`` map the startup validator checks.
LIMIT_MAPS = [
    "RATE_LIMIT_CATEGORY_DEFAULTS",
    "RATE_LIMIT_NAMED_DEFAULTS",
    "RATE_LIMIT_READ_CATEGORY_LIMITS",
    "RATE_LIMIT_P7_STUDENT_LIMITS",
    "RATE_LIMIT_P8_CRM_LIMITS",
    "RATE_LIMIT_P9_ROLE_LIMITS",
    "RATE_LIMIT_P9_SENSITIVE_LIMITS",
    "RATE_LIMIT_P3_IDENTIFIER_LIMITS",
    "RATE_LIMIT_P3_DAILY_LIMITS",
    "RATE_LIMIT_P8_IDENTIFIER_LIMITS",
]


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


class FlakyRedis(FakeRedis):
    """First ``eval`` hits a stale socket; the retry gets a fresh connection."""

    def __init__(self):
        super().__init__()
        self.failures_left = 1
        self.attempts = 0

    async def eval(self, *args, **kwargs):
        self.attempts += 1
        if self.failures_left:
            self.failures_left -= 1
            raise RedisConnectionError("stale pooled socket")
        return await super().eval(*args, **kwargs)


class ReadFailingRedis(FakeRedis):
    """``eval`` works, the informational ``GET`` after it does not."""

    async def get(self, key: str):
        self.get_calls += 1
        raise RedisConnectionError("read refused")


class SwitchableRedis:
    """Starts unreachable, then recovers - without changing the client object."""

    def __init__(self):
        self.failing = True
        self.inner = FakeRedis()

    async def eval(self, *args, **kwargs):
        if self.failing:
            raise RedisConnectionError("refused")
        return await self.inner.eval(*args, **kwargs)

    async def get(self, key: str):
        if self.failing:
            raise RedisConnectionError("refused")
        return await self.inner.get(key)


@pytest.fixture(autouse=True)
def _reset_policy_cache():
    reset_route_template_cache()
    yield
    reset_route_template_cache()


# ------------------------------------------------------------------ helpers


def _request(
    method: str,
    path: str,
    headers: tuple[tuple[bytes, bytes], ...] = (),
    body: bytes = b"",
    peer: str = "testclient",
) -> Request:
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": method,
        "path": path,
        "raw_path": path.encode(),
        "headers": list(headers),
        "query_string": b"",
        "scheme": "http",
        "server": ("testserver", 80),
        "client": (peer, 1234),
        "app": main_app,
    }

    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    return Request(scope, receive)


def _resolved(method: str, path: str):
    return resolve_rate_limit(_request(method, path), settings)


def _concrete(template: str) -> str:
    return re.sub(r"\{[^}]+\}", "1", template)


def _registered_route_pairs() -> set[tuple[str, str]]:
    # Building the resolver is a side effect of any resolution.
    resolve_rate_limit(_request("GET", "/health"), settings)
    pairs: set[tuple[str, str]] = set()
    for _regex, template, methods in list(policy._resolver._routes):
        for method in sorted(methods or ()):
            if method in {"HEAD", "OPTIONS"}:
                continue
            pairs.add((method, template))
    return pairs


def _enable(monkeypatch) -> FakeRedis:
    fake = FakeRedis()
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(ratelimit, "get_redis", lambda: fake)
    return fake


async def _noop_close() -> None:
    return None


def _enable_broken(monkeypatch) -> None:
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(ratelimit, "get_redis", lambda: BrokenRedis())
    monkeypatch.setattr(ratelimit, "close_redis", _noop_close)


def _unauthenticated_override(monkeypatch, limit: int, window: int = 60) -> None:
    monkeypatch.setattr(
        settings,
        "RATE_LIMIT_P9_UNAUTHENTICATED_ADMIN",
        {"limit": limit, "window_seconds": window},
    )


def _sensitive_override(
    monkeypatch, operation: str, limit: int, window: int = 60
) -> None:
    current = {k: dict(v) for k, v in settings.RATE_LIMIT_P9_SENSITIVE_LIMITS.items()}
    current[operation] = {"limit": limit, "window_seconds": window}
    monkeypatch.setattr(settings, "RATE_LIMIT_P9_SENSITIVE_LIMITS", current)


def _daily_override(monkeypatch, key: str, limit: int, window: int = 86400) -> None:
    current = {k: dict(v) for k, v in settings.RATE_LIMIT_P3_DAILY_LIMITS.items()}
    current[key] = {"limit": limit, "window_seconds": window}
    monkeypatch.setattr(settings, "RATE_LIMIT_P3_DAILY_LIMITS", current)


def _events(caplog) -> list[dict]:
    payloads = []
    for record in caplog.records:
        if record.name != OBS_LOGGER:
            continue
        try:
            payload = json.loads(record.getMessage())
        except (TypeError, ValueError):
            continue
        if isinstance(payload, dict) and payload.get("component") == "rate_limit":
            payloads.append(payload)
    return payloads


def _capture(caplog) -> None:
    caplog.set_level(logging.INFO, logger=OBS_LOGGER)


def _production(**updates):
    base = {
        "APP_ENV": "production",
        "RATE_LIMIT_ENABLED": True,
        "RATE_LIMIT_POLICY_ENGINE_ENABLED": True,
        "RATE_LIMIT_EXEMPT_METHODS": ["OPTIONS"],
        "REDIS_URL": "redis://redis:6379/0",
    }
    base.update(updates)
    return settings.model_copy(update=base)


def _development(**updates):
    base = {
        "APP_ENV": "development",
        "RATE_LIMIT_ENABLED": True,
        "REDIS_URL": "redis://localhost:6379/0",
    }
    base.update(updates)
    return settings.model_copy(update=base)


# ------------------------------------------------------- route coverage


def test_every_registered_route_is_covered_or_explicitly_pinned():
    missing = {
        (method, template)
        for method, template in _registered_route_pairs()
        if _resolved(method, _concrete(template)) is None
    }
    assert missing == KNOWN_UNTHROTTLED_ROUTES | INTENTIONALLY_UNTHROTTLED


def test_the_unthrottled_api_gap_is_the_documented_twenty_three_routes():
    # Keeping the count explicit means a new unclassified route cannot quietly
    # grow the gap: the equality test above and this number both have to change.
    assert len(KNOWN_UNTHROTTLED_ROUTES) == 23


def test_parameterized_route_template_is_what_reaches_the_bucket():
    resolved = _resolved("PATCH", "/api/v1/users/987654")
    assert resolved is not None
    assert resolved.route_template == "/api/v1/users/{user_id}"
    assert "987654" not in (resolved.route_template or "")


def test_two_concrete_ids_share_one_template_bucket(monkeypatch):
    fake = _enable(monkeypatch)
    _sensitive_override(monkeypatch, "user_mutation", 1)
    client = TestClient(main_app)

    assert client.patch("/api/v1/users/1", json={}).status_code != 429
    assert client.patch("/api/v1/users/2", json={}).status_code == 429

    keys = [k for k in fake.counts if k.startswith("rl:p9:user_mutation:")]
    assert keys == ["rl:p9:user_mutation:/api/v1/users/{user_id}:testclient"]


def test_query_string_does_not_create_a_second_bucket(monkeypatch):
    fake = _enable(monkeypatch)
    client = TestClient(main_app)

    client.get("/api/v1/colleges?page=1")
    client.get("/api/v1/colleges?page=2&search=ignored")

    keys = [k for k in fake.counts if k.startswith("rl:read:public_catalogue:")]
    assert keys == ["rl:read:public_catalogue:/api/v1/colleges:testclient"]


# ------------------------------------------------------- startup config


def test_shipped_settings_pass_the_validator_in_both_environments():
    _validate_rate_limit_config(_production(), production=True)
    _validate_rate_limit_config(settings, production=False)


def test_production_refuses_a_disabled_limiter():
    with pytest.raises(ValueError, match="RATE_LIMIT_ENABLED must be true"):
        _validate_rate_limit_config(
            _production(RATE_LIMIT_ENABLED=False), production=True
        )


def test_production_refuses_a_disabled_policy_engine():
    with pytest.raises(
        ValueError, match="RATE_LIMIT_POLICY_ENGINE_ENABLED must be true"
    ):
        _validate_rate_limit_config(
            _production(RATE_LIMIT_POLICY_ENGINE_ENABLED=False), production=True
        )


@pytest.mark.parametrize("method", ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"])
def test_production_refuses_exempting_a_real_traffic_method(method):
    with pytest.raises(ValueError, match="must not exempt real traffic methods"):
        _validate_rate_limit_config(
            _production(RATE_LIMIT_EXEMPT_METHODS=["OPTIONS", method]),
            production=True,
        )


def test_options_exemption_is_still_allowed_in_production():
    _validate_rate_limit_config(
        _production(RATE_LIMIT_EXEMPT_METHODS=["OPTIONS"]), production=True
    )


@pytest.mark.parametrize(
    "url",
    [
        "http://user:supersecret@redis.example.com:6379/0",
        "postgresql://redis:6379/0",
        "",
    ],
)
def test_production_refuses_a_non_redis_url_without_echoing_it(url):
    cfg = _production(REDIS_URL=url)
    with pytest.raises(ValueError, match="REDIS_URL must use") as excinfo:
        _validate_rate_limit_config(cfg, production=True)
    assert "supersecret" not in str(excinfo.value)
    assert "user:" not in str(excinfo.value)


@pytest.mark.parametrize("attr", LIMIT_MAPS)
def test_production_refuses_a_zero_limit_in_every_limit_map(attr):
    cfg = _production(**{attr: {"probe": {"limit": 0, "window_seconds": 60}}})
    with pytest.raises(ValueError, match=r"\.limit must be >= 1"):
        _validate_rate_limit_config(cfg, production=True)


@pytest.mark.parametrize("attr", LIMIT_MAPS)
def test_development_allows_an_explicitly_disabled_zero_limit(attr):
    # Zero is how an operator disables one category in a non-production stack.
    _validate_rate_limit_config(
        _development(**{attr: {"probe": {"limit": 0, "window_seconds": 60}}}),
        production=False,
    )


@pytest.mark.parametrize("attr", LIMIT_MAPS)
def test_negative_limits_are_refused_everywhere(attr):
    cfg = _development(**{attr: {"probe": {"limit": -1, "window_seconds": 60}}})
    with pytest.raises(ValueError, match="must be >= 0"):
        _validate_rate_limit_config(cfg, production=False)


def test_malformed_limit_is_refused_instead_of_silently_ignored():
    cfg = _development(
        RATE_LIMIT_P9_ROLE_LIMITS={"admin": {"limit": "lots", "window_seconds": 60}}
    )
    with pytest.raises(ValueError, match="must be an integer"):
        _validate_rate_limit_config(cfg, production=False)


def test_malformed_window_is_refused_with_its_setting_name():
    cfg = _development(
        RATE_LIMIT_P8_CRM_LIMITS={
            "public_enquiry": {"limit": 3, "window_seconds": "10m"}
        }
    )
    with pytest.raises(ValueError, match="RATE_LIMIT_P8_CRM_LIMITS.*window_seconds"):
        _validate_rate_limit_config(cfg, production=False)


def test_enabled_override_requires_a_limit():
    cfg = _production(
        RATE_LIMIT_EXACT_OVERRIDES={"/api/v1/x": {"window_seconds": 60}}
    )
    with pytest.raises(ValueError, match="limit is required"):
        _validate_rate_limit_config(cfg, production=True)


def test_disabled_override_may_be_a_placeholder_without_a_limit():
    cfg = _production(
        RATE_LIMIT_EXACT_OVERRIDES={"/api/v1/x": {"enabled": False}}
    )
    _validate_rate_limit_config(cfg, production=True)


def test_overrides_reject_unknown_methods_and_matches():
    bad_method = _development(
        RATE_LIMIT_PREFIX_OVERRIDES=[
            {"pattern": "/api/v1/x", "limit": 1, "methods": ["FETCH"]}
        ]
    )
    with pytest.raises(ValueError, match="unknown methods"):
        _validate_rate_limit_config(bad_method, production=False)

    bad_match = _development(
        RATE_LIMIT_EXACT_OVERRIDES={
            "/api/v1/x": {"limit": 1, "match": "regex"}
        }
    )
    with pytest.raises(ValueError, match="match must be"):
        _validate_rate_limit_config(bad_match, production=False)


def test_fallback_policy_must_be_positive_and_method_bounded():
    with pytest.raises(ValueError, match="must both be > 0"):
        _validate_rate_limit_config(
            _development(
                RATE_LIMIT_DEFAULT_FALLBACK_ENABLED=True,
                RATE_LIMIT_DEFAULT_FALLBACK_LIMIT=0,
            ),
            production=False,
        )

    with pytest.raises(ValueError, match="must not be empty"):
        _validate_rate_limit_config(
            _development(
                RATE_LIMIT_DEFAULT_FALLBACK_ENABLED=True,
                RATE_LIMIT_DEFAULT_FALLBACK_LIMIT=60,
                RATE_LIMIT_DEFAULT_FALLBACK_WINDOW_SECONDS=60,
                RATE_LIMIT_DEFAULT_FALLBACK_METHODS=[],
            ),
            production=False,
        )

    with pytest.raises(ValueError, match="unknown methods"):
        _validate_rate_limit_config(
            _development(
                RATE_LIMIT_DEFAULT_FALLBACK_METHODS=["POST", "FETCH"],
            ),
            production=False,
        )


def test_unknown_exemption_method_is_a_typo_not_an_exemption():
    with pytest.raises(ValueError, match="unknown methods"):
        _validate_rate_limit_config(
            _development(RATE_LIMIT_EXEMPT_METHODS=["OPTIONS", "GTE"]),
            production=False,
        )


# ------------------------------------------------------- trusted proxy


def _ip(headers: dict | None = None, peer: str = "198.51.100.20") -> str | None:
    request = _request(
        "GET",
        "/api/v1/colleges",
        tuple((k.lower().encode(), v.encode()) for k, v in (headers or {}).items()),
        peer=peer,
    )
    return client_ip(request)


def test_no_declared_proxy_means_forwarded_headers_are_client_controlled(monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 0)
    assert _ip({"x-forwarded-for": "203.0.113.9"}) == "198.51.100.20"
    assert _ip({"x-real-ip": "203.0.113.9"}) == "198.51.100.20"
    assert (
        _ip({"x-forwarded-for": "203.0.113.9", "x-real-ip": "203.0.113.10"})
        == "198.51.100.20"
    )


def test_caddy_chain_with_one_hop_uses_the_rightmost_entry(monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    assert _ip({"x-forwarded-for": "203.0.113.9"}) == "203.0.113.9"
    # A forged prefix cannot win: the proxy appended the address it observed.
    assert (
        _ip({"x-forwarded-for": "1.2.3.4, 203.0.113.9"}) == "203.0.113.9"
    )


def test_a_shorter_chain_than_the_declared_topology_falls_back_to_the_peer(
    monkeypatch,
):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 3)
    assert _ip({"x-forwarded-for": "203.0.113.9"}) == "198.51.100.20"


def test_invalid_forwarded_values_are_never_used_as_an_identity(monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    assert _ip({"x-forwarded-for": "not-an-ip"}) == "198.51.100.20"
    # The entry the proxy appended is the rightmost one. If it is unparseable
    # and X-Real-IP is also unparseable, attribution falls back to the socket
    # peer rather than storing either string.
    assert (
        _ip({"x-forwarded-for": "6.6.6.6, not-an-ip", "x-real-ip": "nope"})
        == "198.51.100.20"
    )


def test_x_real_ip_is_honoured_only_behind_a_trusted_proxy(monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    assert _ip({"x-real-ip": "203.0.113.9"}) == "203.0.113.9"


def test_forged_header_cannot_mint_a_fresh_bucket_without_a_proxy(monkeypatch):
    fake = _enable(monkeypatch)
    _unauthenticated_override(monkeypatch, limit=100)
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 0)
    client = TestClient(main_app)

    for forged in ("1.1.1.1", "2.2.2.2", "3.3.3.3"):
        client.post(
            "/api/v1/faqs", json={}, headers={"x-forwarded-for": forged}
        )

    keys = [k for k in fake.counts if k.startswith("rl:p9:admin_general:")]
    assert len(keys) == 1
    assert keys[0].endswith(":testclient")


def test_edge_config_makes_the_one_hop_chain_true_and_backend_unpublished():
    caddy = (REPO_ROOT / "docker" / "Caddyfile").read_text(encoding="utf-8")
    assert "(trusted_proxy_headers)" in caddy
    for header in (
        "header_up X-Forwarded-For {remote_host}",
        "header_up X-Real-IP {remote_host}",
        "header_up X-Forwarded-Proto {scheme}",
        "header_up X-Forwarded-Host {host}",
    ):
        assert header in caddy
    assert caddy.count("import trusted_proxy_headers") >= 3

    compose = (REPO_ROOT / "docker-compose.prod.yml").read_text(encoding="utf-8")
    assert 'TRUSTED_PROXY_HOPS: "1"' in compose
    assert "noeviction" in compose
    backend_block = compose.split("\n  backend:", 1)[1].split("\n  frontend:", 1)[0]
    # A comment mentions `ports:` on purpose; only a real mapping is a defect.
    assert not re.search(r"^\s+ports:", backend_block, re.M)


def test_env_template_documents_the_proxy_and_observability_switches():
    template = (REPO_ROOT / ".env.example").read_text(encoding="utf-8")
    assert "TRUSTED_PROXY_HOPS" in template
    assert "RATE_LIMIT_OBSERVABILITY_ENABLED" in template
    assert "RATE_LIMIT_OBSERVABILITY_LOG_ALLOWED" in template


# ------------------------------------------------------- failure matrix


#: ``True`` -> must fail closed (503); ``None`` -> inherits the global
#: ``RATE_LIMIT_FAIL_OPEN`` default, which ships as fail-open for these routes.
FAIL_MATRIX = [
    ("POST", "/api/v1/auth/login", True),
    ("POST", "/api/v1/auth/login/otp/verify", True),
    ("POST", "/api/v1/ai/chat", True),
    ("POST", "/api/v1/question-imports/pdf", True),
    ("POST", "/api/v1/enquiries", True),
    ("PATCH", "/api/v1/users/5", True),
    ("POST", "/api/v1/media/upload", True),
    ("POST", "/api/v1/question-imports/5/review-all", True),
    ("PUT", "/api/v1/settings", True),
    ("PUT", "/api/v1/settings/ai", True),
    ("GET", "/api/v1/colleges", None),
    ("GET", "/api/v1/audit-logs", None),
    ("POST", "/api/v1/mock-tests/1/start", None),
    ("GET", "/api/v1/mock-tests/1/attempts/1/result", None),
    ("POST", "/api/v1/users/me", None),
    ("POST", "/api/v1/saved-colleges", None),
    ("GET", "/api/v1/reviews/college/1", None),
]


@pytest.mark.parametrize("method,path,expected", FAIL_MATRIX)
def test_fail_mode_is_the_reviewed_one_for_each_sensitive_surface(
    method, path, expected
):
    resolved = _resolved(method, path)
    assert resolved is not None, (method, path)
    assert resolved.fail_closed is expected, (method, path, resolved)


@pytest.mark.parametrize(
    "method,path",
    [
        ("POST", "/api/v1/auth/login"),
        ("POST", "/api/v1/ai/chat"),
        ("POST", "/api/v1/enquiries"),
        ("PATCH", "/api/v1/users/5"),
    ],
)
def test_fail_closed_surfaces_return_503_when_redis_is_gone(
    monkeypatch, method, path
):
    _enable_broken(monkeypatch)
    response = TestClient(main_app).request(
        method, path, json={"message": "hi"} if "ai" in path else {}
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "SERVICE_UNAVAILABLE"
    assert response.headers["Retry-After"] == "1"


def test_fail_open_reads_keep_serving_when_redis_is_gone(monkeypatch):
    _enable_broken(monkeypatch)
    client = TestClient(main_app)
    response = client.get("/api/v1/colleges")
    assert response.status_code != 503
    assert response.status_code != 429


def test_global_fail_open_switch_flips_only_the_global_rows(monkeypatch):
    # A public read has no explicit choice, so the global switch governs it.
    monkeypatch.setattr(settings, "RATE_LIMIT_FAIL_OPEN", False)
    _enable_broken(monkeypatch)
    response = TestClient(main_app).get("/api/v1/colleges")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "SERVICE_UNAVAILABLE"


def test_health_is_never_throttled_and_stays_reachable(monkeypatch):
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    assert _resolved("GET", "/health") is None

    _enable_broken(monkeypatch)
    response = TestClient(main_app).get("/health")
    assert response.status_code != 429


def test_redis_error_is_retried_once_before_failing(monkeypatch):
    flaky = FlakyRedis()
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(ratelimit, "get_redis", lambda: flaky)
    monkeypatch.setattr(ratelimit, "close_redis", _noop_close)

    response = TestClient(main_app).post("/api/v1/settings/ai/test", json={})

    assert response.status_code != 503
    assert flaky.failures_left == 0
    # Exactly one failed attempt and one successful retry.
    assert flaky.attempts == 2
    assert flaky.eval_calls == 1


def test_a_recovered_redis_resumes_counting_without_a_restart(monkeypatch):
    switch = SwitchableRedis()
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(ratelimit, "get_redis", lambda: switch)
    monkeypatch.setattr(ratelimit, "close_redis", _noop_close)
    _unauthenticated_override(monkeypatch, limit=1)
    client = TestClient(main_app)

    # Outage: the read fails open and the request still reaches the endpoint.
    assert client.get("/api/v1/users").status_code != 503

    # Recovery: the very next request is counted, and the limit is enforced.
    switch.failing = False
    assert client.get("/api/v1/users").status_code != 429
    assert client.get("/api/v1/users").status_code == 429


# ------------------------------------------------------- observability


def test_throttled_decision_is_always_logged_and_allowed_is_opt_in(
    monkeypatch, caplog
):
    _capture(caplog)
    obs.emit_decision(
        outcome="allowed",
        namespace="ns",
        category="cat",
        dimension="route_ip",
        route_template="/api/v1/x",
        http_status=200,
        redis_latency_ms=1.0,
    )
    assert _events(caplog) == []

    monkeypatch.setattr(settings, "RATE_LIMIT_OBSERVABILITY_LOG_ALLOWED", True)
    obs.emit_decision(
        outcome="allowed",
        namespace="ns",
        category="cat",
        dimension="route_ip",
        route_template="/api/v1/x",
        http_status=200,
        redis_latency_ms=1.0,
    )
    payload = _events(caplog)[-1]
    assert payload["event"] == "ratelimit.decision"
    assert payload["outcome"] == "allowed"
    assert payload["redis_latency_ms"] == 1.0


def test_labels_are_bounded_and_sanitised(caplog):
    _capture(caplog)
    obs.emit_decision(
        outcome="throttled",
        namespace="ns\nwith newline",
        category="c" * 300,
        dimension="not-a-dimension",
        route_template="/api/v1/x",
        http_status=429,
        redis_latency_ms=None,
    )
    payload = _events(caplog)[-1]
    assert payload["dimension"] == "unknown"
    assert "\n" not in payload["namespace"]
    assert len(payload["category"]) <= 96


def test_observability_never_breaks_the_request_it_observes(monkeypatch, caplog):
    def explode(*args, **kwargs):
        raise RuntimeError("logging backend is down")

    monkeypatch.setattr(obs.logger, "log", explode)
    # Must not raise.
    obs.emit_decision(
        outcome="throttled",
        namespace="ns",
        category="cat",
        dimension="route_ip",
        route_template="/api/v1/x",
        http_status=429,
        redis_latency_ms=1.0,
    )


def test_observability_kill_switch_suppresses_every_event(monkeypatch, caplog):
    _capture(caplog)
    monkeypatch.setattr(settings, "RATE_LIMIT_OBSERVABILITY_ENABLED", False)
    obs.emit_decision(
        outcome="throttled",
        namespace="ns",
        category="cat",
        dimension="route_ip",
        route_template="/api/v1/x",
        http_status=429,
        redis_latency_ms=1.0,
    )
    obs.emit_dependency_failure(
        event="ratelimit.redis_error",
        namespace="ns",
        category="cat",
        dimension="route_ip",
        route_template="/api/v1/x",
        fail_mode="closed",
        error_type="TimeoutError",
        redis_latency_ms=1.0,
    )
    assert _events(caplog) == []


def test_middleware_throttle_event_names_the_template_not_the_request_path(
    monkeypatch, caplog
):
    _capture(caplog)
    _enable(monkeypatch)
    _sensitive_override(monkeypatch, "user_mutation", 1)
    client = TestClient(main_app)

    client.patch("/api/v1/users/54321", json={})
    response = client.patch("/api/v1/users/54321", json={})
    assert response.status_code == 429

    payloads = _events(caplog)
    assert payloads
    assert all("54321" not in json.dumps(item) for item in payloads)
    assert all("testclient" not in json.dumps(item) for item in payloads)
    throttled = [p for p in payloads if p.get("outcome") == "throttled"]
    assert throttled
    assert throttled[0]["route"] == "/api/v1/users/{user_id}"
    assert throttled[0]["category"] == "admin_user_mutation"


def test_redis_outage_event_carries_the_fail_mode_not_the_error_message(
    monkeypatch, caplog
):
    _capture(caplog)
    _enable_broken(monkeypatch)
    TestClient(main_app).post("/api/v1/auth/login", json={})

    failures = [
        p for p in _events(caplog) if p["event"] == "ratelimit.redis_error"
    ]
    assert failures
    assert failures[-1]["fail_mode"] == "closed"
    assert failures[-1]["error_type"] == "ConnectionError"
    assert "refused" not in json.dumps(failures[-1])


def test_retry_and_counter_read_failures_are_distinct_events(
    monkeypatch, caplog
):
    _capture(caplog)
    flaky = FlakyRedis()
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(ratelimit, "get_redis", lambda: flaky)
    monkeypatch.setattr(ratelimit, "close_redis", _noop_close)
    TestClient(main_app).post("/api/v1/settings/ai/test", json={})

    events = [p["event"] for p in _events(caplog)]
    assert "ratelimit.redis_retry" in events


def test_counter_read_failure_keeps_the_allowed_request_alive(
    monkeypatch, caplog
):
    _capture(caplog)
    redis = ReadFailingRedis()
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(ratelimit, "get_redis", lambda: redis)

    # Auth write routes carry a route counter plus an identity counter, so they
    # take the multi-counter path (the only path that reads a value back).
    response = TestClient(main_app).post("/api/v1/auth/logout")
    assert response.status_code != 503
    assert redis.eval_calls == 1
    assert redis.get_calls == 1

    failures = [
        p
        for p in _events(caplog)
        if p["event"] == "ratelimit.counter_read_failure"
    ]
    assert failures
    assert failures[0]["fail_mode"] == "open"


def test_daily_quota_exhaustion_gets_its_own_alertable_event(
    monkeypatch, caplog
):
    _capture(caplog)
    _enable(monkeypatch)
    _daily_override(monkeypatch, "ai_operations:ip", 1)
    client = TestClient(main_app)

    assert client.post("/api/v1/ai/chat", json={"message": "hi"}).status_code != 429
    assert client.post("/api/v1/ai/chat", json={"message": "hi"}).status_code == 429

    quotas = [
        p for p in _events(caplog) if p["event"] == "ratelimit.quota_exhausted"
    ]
    assert quotas
    assert quotas[-1]["quota"] == "daily"
    assert quotas[-1]["dimension"] == "daily"


def test_ai_ceiling_exhaustion_is_quota_alertable_too(monkeypatch, caplog):
    _capture(caplog)
    _enable(monkeypatch)
    client = TestClient(main_app)

    statuses = [
        client.post("/api/v1/ai/chat", json={"message": "hi"}).status_code
        for _ in range(11)
    ]
    assert statuses[-1] == 429

    quotas = [
        p for p in _events(caplog) if p["event"] == "ratelimit.quota_exhausted"
    ]
    assert quotas
    assert quotas[-1]["quota"] == "ai"


def test_decision_events_record_redis_latency(monkeypatch, caplog):
    _capture(caplog)
    _enable(monkeypatch)
    _unauthenticated_override(monkeypatch, limit=1)
    client = TestClient(main_app)

    client.post("/api/v1/faqs", json={})
    client.post("/api/v1/faqs", json={})

    decisions = [
        p for p in _events(caplog) if p["event"] == "ratelimit.decision"
    ]
    assert decisions
    for payload in decisions:
        assert isinstance(payload["redis_latency_ms"], (int, float))
        assert 0 <= payload["redis_latency_ms"] < 60_000


# ------------------------------------------------- shared state / limits


def test_two_instances_sharing_redis_share_one_counter(monkeypatch):
    _enable(monkeypatch)
    _unauthenticated_override(monkeypatch, limit=1)

    first_process = TestClient(main_app)
    second_process = TestClient(main_app)

    assert first_process.post("/api/v1/faqs", json={}).status_code != 429
    # A second client object represents a second worker process. If the
    # limiter kept state in process memory this would be allowed.
    assert second_process.post("/api/v1/faqs", json={}).status_code == 429


def test_exact_boundary_allows_the_limit_and_rejects_one_more(monkeypatch):
    _enable(monkeypatch)
    _unauthenticated_override(monkeypatch, limit=3)
    client = TestClient(main_app)

    statuses = [client.post("/api/v1/faqs", json={}).status_code for _ in range(4)]
    assert statuses[:3] == [401, 401, 401]
    assert statuses[3] == 429


def test_success_headers_report_the_boundary_and_no_identity(monkeypatch):
    _enable(monkeypatch)
    _unauthenticated_override(monkeypatch, limit=2)
    client = TestClient(main_app)

    first = client.post("/api/v1/faqs", json={})
    assert first.headers["RateLimit-Limit"] == "2"
    assert first.headers["RateLimit-Remaining"] == "1"
    assert first.headers["RateLimit-Reset"].isdigit()
    assert "testclient" not in json.dumps(dict(first.headers))

    second = client.post("/api/v1/faqs", json={})
    assert second.status_code != 429
    assert second.headers["RateLimit-Remaining"] == "0"

    rejected = client.post("/api/v1/faqs", json={})
    assert rejected.status_code == 429
    assert rejected.headers["RateLimit-Remaining"] == "0"
    assert rejected.headers["Retry-After"].isdigit()


def test_single_counter_request_uses_one_redis_round_trip(monkeypatch):
    fake = _enable(monkeypatch)
    TestClient(main_app).post("/api/v1/settings/ai/test", json={})
    assert fake.eval_calls == 1
    assert fake.get_calls == 0


def test_multi_counter_request_does_not_add_extra_eval_calls(monkeypatch):
    fake = _enable(monkeypatch)
    TestClient(main_app).post("/api/v1/ai/chat", json={"message": "hi"})
    # One atomic multi-key EVAL plus one informational GET for headers.
    assert fake.eval_calls == 1
    assert fake.get_calls == 1


# ------------------------------------------------------- daily rollover


def test_utc_day_bucket_changes_at_midnight_not_local_time():
    late = datetime(2026, 1, 1, 23, 59, 59, tzinfo=UTC)
    early = datetime(2026, 1, 2, 0, 0, 0, tzinfo=UTC)
    assert utc_day_bucket(late) == "20260101"
    assert utc_day_bucket(early) == "20260102"


def test_daily_reset_is_clamped_to_the_utc_day_boundary():
    assert (
        seconds_until_utc_midnight(datetime(2026, 1, 1, 23, 59, 30, tzinfo=UTC))
        == 30
    )
    # Exactly midnight resets to a full day, never zero.
    assert (
        seconds_until_utc_midnight(datetime(2026, 1, 2, 0, 0, 0, tzinfo=UTC))
        == 86400
    )
    # A naive timestamp is treated as UTC rather than raising.
    assert 1 <= seconds_until_utc_midnight(datetime(2026, 1, 1, 23, 59, 59)) <= 86400
