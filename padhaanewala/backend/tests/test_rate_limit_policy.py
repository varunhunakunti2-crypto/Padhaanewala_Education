import asyncio

import httpx
from fastapi import FastAPI
from starlette.requests import Request

from app.config import settings
from app.middleware.rate_limit_policy import (
    build_runtime_rules,
    reset_route_template_cache,
    resolve_rate_limit,
    resolve_route_template,
)
from app.middleware.ratelimit import RateLimitMiddleware


class FakeRedis:
    """In-memory fake supporting both legacy single-key and P3 multi-key EVAL.

    P3.1 applies category dimensions to explicitly classified routes, so a
    request can now evaluate several counters atomically. The fake mirrors the
    Lua semantics for both call shapes.
    """

    def __init__(self):
        self.counts = {}
        self.ttls = {}
        self.eval_calls = 0
        self.scripts = []

    async def eval(self, script: str, numkeys: int, *args):
        self.eval_calls += 1
        self.scripts.append(script)
        keys = list(args[:numkeys])
        rest = list(args[numkeys:])

        # Legacy single-key limiter script: EVAL script 1 key window
        if numkeys == 1 and len(rest) == 1 and "for i = 1" not in script:
            key = keys[0]
            window = int(rest[0])
            self.counts[key] = self.counts.get(key, 0) + 1
            if self.counts[key] == 1:
                self.ttls[key] = window
            return [self.counts[key], self.ttls.get(key, -1)]

        # P3 multi-key script: EVAL script N keys... windows... limits...
        assert len(rest) == numkeys * 2
        windows = [int(x) for x in rest[:numkeys]]
        limits = [int(x) for x in rest[numkeys:]]
        for i, key in enumerate(keys):
            if self.counts.get(key, 0) >= limits[i]:
                ttl = self.ttls.get(key, windows[i])
                return [0, i + 1, ttl]
        for i, key in enumerate(keys):
            self.counts[key] = self.counts.get(key, 0) + 1
            if self.counts[key] == 1:
                self.ttls[key] = windows[i]
        return [1, 0, self.ttls.get(keys[0], windows[0])]

    async def get(self, key: str):
        value = self.counts.get(key)
        return str(value) if value is not None else None


def _request(app: FastAPI, method: str, path: str) -> Request:
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
        "client": ("127.0.0.1", 12345),
        "app": app,
    }

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    return Request(scope, receive)


def _base_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware)

    @app.get("/api/v1/items/{item_id}")
    async def get_item(item_id: int):
        return {"item_id": item_id}

    @app.post("/api/v1/items/{item_id}")
    async def post_item(item_id: int):
        return {"item_id": item_id}

    @app.post("/api/v1/exact")
    async def exact():
        return {"ok": True}

    @app.post("/api/v1/prefix/resource")
    async def prefixed():
        return {"ok": True}

    @app.options("/api/v1/prefix/resource")
    async def prefixed_options():
        return {"ok": True}

    return app


def test_default_policy_selection_auth_tight_and_generous():
    app = _base_app()
    reset_route_template_cache()
    resolved = resolve_rate_limit(_request(app, "POST", "/api/v1/auth/login"), settings)
    assert resolved is not None
    assert (resolved.namespace, resolved.limit, resolved.window_seconds, resolved.category) == (
        "auth",
        5,
        60,
        "authentication",
    )

    resolved = resolve_rate_limit(_request(app, "POST", "/api/v1/auth/forgot-password"), settings)
    assert resolved is not None
    assert (resolved.namespace, resolved.limit, resolved.window_seconds) == ("auth", 20, 60)


def test_exact_route_matching():
    app = _base_app()
    reset_route_template_cache()
    resolved = resolve_rate_limit(_request(app, "POST", "/api/v1/ai/chat"), settings)
    assert resolved is not None
    assert resolved.namespace == "/api/v1/ai/chat"
    assert resolved.limit == 10


def test_prefix_route_matching():
    app = _base_app()
    reset_route_template_cache()
    resolved = resolve_rate_limit(_request(app, "POST", "/api/v1/predictor/subpath"), settings)
    assert resolved is not None
    assert resolved.namespace == "/api/v1/predictor"
    assert resolved.limit == 10 and resolved.window_seconds == 60


def test_dynamic_route_normalization_and_template_resolution():
    app = _base_app()
    reset_route_template_cache()
    req = _request(app, "POST", "/api/v1/items/123")
    assert resolve_route_template(req) == "/api/v1/items/{item_id}"


def test_http_method_matching_respects_policy_methods():
    app = _base_app()
    reset_route_template_cache()
    # Existing protected rule is write-only in P2 for compatibility.
    assert resolve_rate_limit(_request(app, "GET", "/api/v1/predictor"), settings) is None
    assert resolve_rate_limit(_request(app, "POST", "/api/v1/predictor"), settings) is not None


def test_endpoint_specific_override_exact(monkeypatch):
    app = _base_app()
    reset_route_template_cache()
    monkeypatch.setattr(
        settings,
        "RATE_LIMIT_EXACT_OVERRIDES",
        {
            "/api/v1/exact": {
                "limit": 2,
                "window_seconds": 60,
                "methods": ["POST"],
                "namespace": "exact-test",
                "category": "override",
                "priority": 500,
            }
        },
        raising=False,
    )
    resolved = resolve_rate_limit(_request(app, "POST", "/api/v1/exact"), settings)
    assert resolved is not None
    assert (resolved.namespace, resolved.limit, resolved.window_seconds) == ("exact-test", 2, 60)


def test_default_fallback_policy_can_be_enabled(monkeypatch):
    app = _base_app()
    reset_route_template_cache()
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_ENABLED", True, raising=False)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_LIMIT", 7, raising=False)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_WINDOW_SECONDS", 60, raising=False)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_NAMESPACE", "default-fallback", raising=False)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_METHODS", ["POST"], raising=False)
    resolved = resolve_rate_limit(_request(app, "POST", "/api/v1/unknown-unclassified"), settings)
    assert resolved is not None
    assert (resolved.namespace, resolved.limit, resolved.window_seconds) == ("default-fallback", 7, 60)


def test_unknown_route_handling_without_fallback_returns_none():
    app = _base_app()
    reset_route_template_cache()
    resolved = resolve_rate_limit(_request(app, "POST", "/api/v1/not-configured"), settings)
    assert resolved is None


def test_build_runtime_rules_deduplicates_conflicts(monkeypatch):
    monkeypatch.setattr(
        settings,
        "RATE_LIMIT_EXACT_OVERRIDES",
        {
            "/api/v1/exact": {
                "limit": 1,
                "window_seconds": 60,
                "methods": ["POST"],
                "namespace": "low",
                "priority": 100,
            },
            "/api/v1/exact ": {  # unlikely, but demonstrates structure safety
                "limit": 1,
                "window_seconds": 60,
                "methods": ["POST"],
                "namespace": "ignored-shape",
            },
        },
        raising=False,
    )
    monkeypatch.setattr(
        settings,
        "RATE_LIMIT_PREFIX_OVERRIDES",
        [{"pattern": "/api/v1/exact", "match": "exact", "limit": 2, "window_seconds": 60, "methods": ["POST"], "namespace": "high", "priority": 500}],
        raising=False,
    )
    rules = build_runtime_rules(settings)
    exacts = [r for r in rules if r.pattern == "/api/v1/exact" and r.match == "exact" and tuple(sorted(r.policy.methods)) == ("POST",)]
    assert len(exacts) == 1
    assert exacts[0].policy.namespace == "high"


def test_cors_options_handling_is_explicitly_exempt(monkeypatch):
    app = _base_app()
    reset_route_template_cache()
    # Enable fallback broadly, but OPTIONS must remain exempt by explicit config.
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_ENABLED", True, raising=False)
    monkeypatch.setattr(settings, "RATE_LIMIT_DEFAULT_FALLBACK_METHODS", ["OPTIONS", "POST"], raising=False)
    assert resolve_rate_limit(_request(app, "OPTIONS", "/api/v1/prefix/resource"), settings) is None

    fake = FakeRedis()
    import app.middleware.ratelimit as rl

    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(rl, "get_redis", lambda: fake)

    async def run():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            resp = await client.options("/api/v1/prefix/resource")
        return resp

    resp = asyncio.run(run())
    assert resp.status_code in (200, 204)
    assert fake.eval_calls == 0


def test_multiple_requests_share_same_normalized_route_bucket(monkeypatch):
    app = _base_app()
    reset_route_template_cache()
    fake = FakeRedis()
    import app.middleware.ratelimit as rl

    # Configure a strict policy for parameterized POST route to prove shared bucket.
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    monkeypatch.setattr(
        settings,
        "RATE_LIMIT_EXACT_OVERRIDES",
        {
            "/api/v1/items/{item_id}": {
                "limit": 1,
                "window_seconds": 60,
                "methods": ["POST"],
                "namespace": "items-param",
                "category": "student_operations",
                "priority": 500,
            }
        },
        raising=False,
    )
    monkeypatch.setattr(rl, "get_redis", lambda: fake)

    async def run():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            r1 = await client.post("/api/v1/items/123")
            r2 = await client.post("/api/v1/items/456")
        return r1, r2

    r1, r2 = asyncio.run(run())
    assert r1.status_code == 200
    assert r2.status_code == 429
    assert fake.eval_calls == 2
    # The route bucket must stay one normalized key. P3 may add additive
    # category-dimension keys for the same request, so select the route bucket.
    route_keys = [k for k in fake.counts if k.startswith("rl:items-param:/api/v1/items/{item_id}:")]
    assert len(route_keys) == 1
    only_key = route_keys[0]
    assert "/api/v1/items/123" not in only_key
    assert "/api/v1/items/456" not in only_key
    assert "redis.call('INCR'" in fake.scripts[0]
