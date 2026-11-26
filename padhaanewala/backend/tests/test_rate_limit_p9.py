"""P9 admin-operation, role-based and sensitive-action rate-limit tests.

P9 extends the P2-P8 policy engine with three things:

* a role-selected general ceiling for staff-guarded admin routes,
* fixed per-user ceilings for sensitive operations (bulk import, media upload,
  settings/AI-settings writes, role/permission changes, user mutations, audit
  reads), and
* a body-selected stricter tier for the single user PATCH that handles both an
  ordinary mutation and a role change.

Nothing here changes authentication, authorization, Redis scripts, response
schemas or any P2-P8 limit. The role used to pick a tier comes only from the
verified access token; the endpoint's own ``require_role`` guard still decides
whether the caller may perform the action at all.

The tests use random user ids so they do not depend on accumulated database
state: every request is either anonymous or carries a token for a subject that
does not exist, so the limiter is exercised while the endpoint safely rejects
the request after the counter has already moved.
"""

from collections import defaultdict

import pytest
from fastapi.testclient import TestClient
from redis.exceptions import ConnectionError as RedisConnectionError
from starlette.requests import Request

from app.config import settings
from app.main import app as main_app
from app.middleware import ratelimit
from app.middleware.rate_limit_policy import (
    DEFAULT_P9_ROLE_LIMITS,
    DEFAULT_P9_SENSITIVE_LIMITS,
    DEFAULT_P9_UNAUTHENTICATED_ADMIN,
    reset_route_template_cache,
    resolve_rate_limit,
)
from app.utils.security import create_access_token

RATE_HEADERS = ("RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset")

GENERAL_WRITE_PATHS = [
    ("POST", "/api/v1/banners"),
    ("POST", "/api/v1/blog-categories"),
    ("POST", "/api/v1/blogs"),
    ("PUT", "/api/v1/colleges/1"),
    ("POST", "/api/v1/courses"),
    ("POST", "/api/v1/exams"),
    ("POST", "/api/v1/faqs"),
    ("POST", "/api/v1/mock-tests"),
    ("PUT", "/api/v1/notifications/4"),
    ("POST", "/api/v1/question-imports/5/drafts"),
    ("POST", "/api/v1/questions"),
    ("POST", "/api/v1/scholarships"),
    ("PUT", "/api/v1/seo"),
    ("POST", "/api/v1/universities"),
    ("POST", "/api/v1/college-submissions/5/approve"),
    ("POST", "/api/v1/reviews/5/moderate"),
]

GENERAL_READ_PATHS = [
    "/api/v1/users",
    "/api/v1/users/5",
    "/api/v1/enquiries",
    "/api/v1/leads",
    "/api/v1/leads/5",
    "/api/v1/notifications",
    "/api/v1/notifications/sends",
    "/api/v1/counsellors",
    "/api/v1/compliance/admin/requests",
    "/api/v1/college-submissions",
    "/api/v1/reviews/moderation",
    "/api/v1/questions",
    "/api/v1/question-imports",
    "/api/v1/seo",
    "/api/v1/seo/college/1",
    "/api/v1/settings",
    "/api/v1/settings/ai",
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


@pytest.fixture(autouse=True)
def _reset_policy_cache():
    reset_route_template_cache()
    yield
    reset_route_template_cache()


def _request(
    method: str,
    path: str,
    headers: tuple[tuple[bytes, bytes], ...] = (),
    body: bytes = b"",
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
        "client": ("127.0.0.1", 1234),
        "app": main_app,
    }

    async def receive():
        return {"type": "http.request", "body": body, "more_body": False}

    return Request(scope, receive)


def _resolved(method: str, path: str):
    return resolve_rate_limit(_request(method, path), settings)


def _resolved_with_token(method: str, path: str, user_id: int, role: str):
    token = create_access_token(user_id, role).encode()
    request = _request(
        method, path, ((b"authorization", b"Bearer " + token),)
    )
    return ratelimit._resolve_limit(request)


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


def _role_override(monkeypatch, role: str, limit: int, window: int = 60) -> None:
    current = {k: dict(v) for k, v in settings.RATE_LIMIT_P9_ROLE_LIMITS.items()}
    current[role] = {"limit": limit, "window_seconds": window}
    monkeypatch.setattr(settings, "RATE_LIMIT_P9_ROLE_LIMITS", current)


def _sensitive_override(
    monkeypatch, operation: str, limit: int, window: int = 60
) -> None:
    current = {
        k: dict(v) for k, v in settings.RATE_LIMIT_P9_SENSITIVE_LIMITS.items()
    }
    current[operation] = {"limit": limit, "window_seconds": window}
    monkeypatch.setattr(settings, "RATE_LIMIT_P9_SENSITIVE_LIMITS", current)


def _unauthenticated_override(monkeypatch, limit: int, window: int = 60) -> None:
    monkeypatch.setattr(
        settings,
        "RATE_LIMIT_P9_UNAUTHENTICATED_ADMIN",
        {"limit": limit, "window_seconds": window},
    )


def _headers(user_id: int, role: str = "admin", ip: str | None = None) -> dict:
    token = create_access_token(user_id, role)
    headers = {"authorization": f"Bearer {token}"}
    if ip is not None:
        headers["x-forwarded-for"] = ip
    return headers


def _repeat(client, method: str, path: str, n: int, **kwargs) -> list:
    return [getattr(client, method)(path, **kwargs).status_code for _ in range(n)]


def _keys(fake: FakeRedis, prefix: str) -> list[str]:
    return [k for k in fake.counts if k.startswith(prefix)]


# --------------------------------------------------------------- resolution


@pytest.mark.parametrize("method,path", GENERAL_WRITE_PATHS)
def test_general_admin_writes_resolve_to_the_admin_general_tier(method, path):
    resolved = _resolved(method, path)
    assert resolved is not None, (method, path)
    assert resolved.namespace == "p9:admin_general"
    assert resolved.category == "admin_general"
    # The unauthenticated base, not an administrator quota.
    assert (resolved.limit, resolved.window_seconds) == DEFAULT_P9_UNAUTHENTICATED_ADMIN
    assert resolved.key_dimension == "user"
    assert resolved.fail_closed is True
    assert {role for limit in resolved.role_limits for role in limit.roles} == {
        "super_admin",
        "admin",
        "content_manager",
        "seo_manager",
        "counsellor",
    }


@pytest.mark.parametrize("path", GENERAL_READ_PATHS)
def test_general_admin_reads_resolve_to_the_admin_general_tier(path):
    resolved = _resolved("GET", path)
    assert resolved is not None, path
    assert resolved.namespace == "p9:admin_general"
    assert resolved.key_dimension == "user"
    # Read-only staff surfaces keep the global fail-open default.
    assert resolved.fail_closed is None


def test_public_and_student_routes_are_not_turned_into_admin_routes():
    # Shared routers: the public/owner action keeps P7, not the admin tier.
    for method, path, namespace in [
        ("GET", "/api/v1/users/me", None),
        ("PUT", "/api/v1/users/me", "p7:profile_update"),
        ("GET", "/api/v1/notifications/my", "p7:student_notifications"),
        ("GET", "/api/v1/college-submissions/my", None),
        ("POST", "/api/v1/college-submissions", None),
        ("POST", "/api/v1/reviews", None),
        ("GET", "/api/v1/reviews/college/1", "read:anonymous_api"),
        ("GET", "/api/v1/blog-categories", "read:anonymous_api"),
        ("POST", "/api/v1/blogs/7/view", "p8:blog_view"),
        ("POST", "/api/v1/mock-tests/x/start", "p7:mock_test_start"),
    ]:
        resolved = _resolved(method, path)
        if namespace is None:
            assert resolved is None, (method, path, resolved)
        else:
            assert resolved is not None and resolved.namespace == namespace


# ------------------------------------------------------------------- tiers


def test_default_role_tiers_match_the_approved_values():
    assert DEFAULT_P9_ROLE_LIMITS == {
        "super_admin": (180, 60),
        "admin": (120, 60),
        "content_manager": (120, 60),
        "seo_manager": (90, 60),
        "counsellor": (90, 60),
    }


@pytest.mark.parametrize(
    "role,expected",
    [
        ("super_admin", 180),
        ("admin", 120),
        ("content_manager", 120),
        ("seo_manager", 90),
        ("counsellor", 90),
    ],
)
def test_verified_role_selects_its_own_tier(role, expected):
    resolved = _resolved_with_token("POST", "/api/v1/faqs", 5001, role)
    assert resolved is not None
    assert (resolved.namespace, resolved.limit) == ("p9:admin_general", expected)


@pytest.mark.parametrize(
    "claim,expected",
    [
        ("super_admin,admin", 180),
        ("admin,content_manager", 120),
        ("content_manager,seo_manager", 120),
        ("seo_manager,counsellor", 90),
        ("student,counsellor", 90),
        ("student,admin", 120),
    ],
)
def test_multi_role_token_receives_its_highest_ranked_tier(claim, expected):
    resolved = _resolved_with_token("POST", "/api/v1/faqs", 5002, claim)
    assert resolved is not None
    assert resolved.limit == expected


@pytest.mark.parametrize("role", ["student", "", "unknown_role"])
def test_non_admin_token_keeps_the_unauthenticated_ceiling(role):
    resolved = _resolved_with_token("POST", "/api/v1/faqs", 5003, role)
    assert resolved is not None
    assert (resolved.limit, resolved.window_seconds) == (
        DEFAULT_P9_UNAUTHENTICATED_ADMIN
    )


def test_unauthenticated_and_forged_callers_never_get_admin_quota():
    base = DEFAULT_P9_UNAUTHENTICATED_ADMIN

    anonymous = ratelimit._resolve_limit(_request("POST", "/api/v1/faqs"))
    assert anonymous is not None and anonymous.limit == base[0]

    forged = ratelimit._resolve_limit(
        _request(
            "POST",
            "/api/v1/faqs",
            (
                (b"authorization", b"Bearer not-a-real-token"),
                (b"x-role", b"super_admin"),
                (b"x-user-id", b"1"),
            ),
        )
    )
    assert forged is not None and forged.limit == base[0]
    assert forged.namespace == "p9:admin_general"


def test_client_headers_cannot_choose_a_privileged_tier():
    scoped = _request(
        "POST",
        "/api/v1/faqs?role=super_admin",
        ((b"x-role", b"super_admin"), (b"x-user-id", b"1")),
    )
    resolved = ratelimit._resolve_limit(scoped)
    assert resolved is not None
    assert resolved.limit == DEFAULT_P9_UNAUTHENTICATED_ADMIN[0]


def test_deleted_or_demoted_admin_token_keeps_its_token_tier_until_expiry(
    monkeypatch,
):
    """Documented limitation: the tier follows the signed claim, not the DB.

    This is intentional: the middleware cannot take a database dependency on the
    request path, and the endpoint still re-checks the role against the database
    (proved by the 401 below). A demoted/deleted administrator therefore keeps
    the looser *throttling* tier until the access token expires.
    """
    _enable(monkeypatch)
    resolved = _resolved_with_token("POST", "/api/v1/faqs", 9_999_999, "super_admin")
    assert resolved is not None and resolved.limit == 180

    # The looser throttling tier does not grant access: the endpoint re-checks
    # the subject against the database and rejects it.
    response = TestClient(main_app).post(
        "/api/v1/faqs", headers=_headers(9_999_999, role="super_admin"), json={}
    )
    assert response.status_code in (401, 403)


# --------------------------------------------------------------- sensitive


def test_default_sensitive_limits_match_the_approved_values():
    assert DEFAULT_P9_SENSITIVE_LIMITS == {
        "bulk_import": (5, 60),
        "media_upload": (10, 600),
        "settings_update": (10, 60),
        "ai_settings": (3, 60),
        "role_change": (5, 60),
        "user_mutation": (20, 60),
        "audit_read": (30, 60),
    }


@pytest.mark.parametrize(
    "method,path,namespace,limit,window",
    [
        (
            "POST",
            "/api/v1/question-imports/5/review-all",
            "p9:bulk_import",
            5,
            60,
        ),
        ("POST", "/api/v1/media/upload", "p9:media_upload", 10, 600),
        ("PUT", "/api/v1/settings", "p9:settings_update", 10, 60),
        ("PUT", "/api/v1/settings/ai", "p9:ai_settings", 3, 60),
        ("POST", "/api/v1/settings/ai/test", "p9:ai_settings", 3, 60),
        ("PATCH", "/api/v1/users/5", "p9:user_mutation", 20, 60),
        ("GET", "/api/v1/audit-logs", "p9:audit_read", 30, 60),
    ],
)
def test_sensitive_routes_resolve_to_their_fixed_ceiling(
    method, path, namespace, limit, window
):
    resolved = _resolved(method, path)
    assert resolved is not None, (method, path)
    assert resolved.namespace == namespace
    assert (resolved.limit, resolved.window_seconds) == (limit, window)
    assert resolved.key_dimension == "user"


def test_sensitive_limits_do_not_vary_by_role():
    for role, expected in [
        ("super_admin", 3),
        ("admin", 3),
        ("content_manager", 3),
        ("seo_manager", 3),
        ("counsellor", 3),
    ]:
        resolved = _resolved_with_token(
            "PUT", "/api/v1/settings/ai", 5100, role
        )
        assert resolved is not None
        assert (resolved.namespace, resolved.limit) == ("p9:ai_settings", expected)


def test_bulk_import_ceiling_does_not_replace_the_p6_pdf_import_limit():
    pdf = _resolved("POST", "/api/v1/question-imports/pdf")
    assert pdf is not None
    # The paid Gemini import keeps its stricter P6 ceiling.
    assert (pdf.category, pdf.limit, pdf.window_seconds) == (
        "ai_question_generation",
        3,
        60,
    )

    review_all = _resolved("POST", "/api/v1/question-imports/5/review-all")
    assert review_all is not None
    assert (review_all.namespace, review_all.limit) == ("p9:bulk_import", 5)


def test_user_mutation_body_tier_selects_the_role_change_ceiling():
    resolved = _resolved("PATCH", "/api/v1/users/5")
    assert resolved is not None
    assert (resolved.namespace, resolved.limit, resolved.window_seconds) == (
        "p9:user_mutation",
        20,
        60,
    )
    assert len(resolved.body_tiers) == 1
    tier = resolved.body_tiers[0]
    assert (tier.field, tier.namespace, tier.limit, tier.window_seconds) == (
        "role_ids",
        "p9:role_change",
        5,
        60,
    )
    assert tier.fail_closed is True


def test_sensitive_mutations_fail_closed_but_audit_read_keeps_the_global_default():
    for method, path in [
        ("POST", "/api/v1/question-imports/5/review-all"),
        ("POST", "/api/v1/media/upload"),
        ("PUT", "/api/v1/settings"),
        ("PUT", "/api/v1/settings/ai"),
        ("POST", "/api/v1/settings/ai/test"),
        ("PATCH", "/api/v1/users/5"),
    ]:
        resolved = _resolved(method, path)
        assert resolved is not None, (method, path)
        assert resolved.fail_closed is True, (method, path)

    audit = _resolved("GET", "/api/v1/audit-logs")
    assert audit is not None
    assert audit.fail_closed is None


# ---------------------------------------------------------------- config


def test_configurable_p9_limits_apply(monkeypatch):
    _role_override(monkeypatch, "super_admin", 300, 120)
    _role_override(monkeypatch, "admin", 200, 120)
    _unauthenticated_override(monkeypatch, 4, 30)
    _sensitive_override(monkeypatch, "media_upload", 2, 900)
    _sensitive_override(monkeypatch, "role_change", 7, 120)

    base = _resolved("POST", "/api/v1/faqs")
    assert (base.limit, base.window_seconds) == (4, 30)
    super_admin = _resolved_with_token("POST", "/api/v1/faqs", 5201, "super_admin")
    assert (super_admin.limit, super_admin.window_seconds) == (300, 120)
    admin = _resolved_with_token("POST", "/api/v1/faqs", 5202, "admin")
    assert (admin.limit, admin.window_seconds) == (200, 120)

    upload = _resolved("POST", "/api/v1/media/upload")
    assert (upload.limit, upload.window_seconds) == (2, 900)

    user_patch = _resolved("PATCH", "/api/v1/users/5")
    assert user_patch.body_tiers[0].limit == 7
    assert user_patch.body_tiers[0].window_seconds == 120


def test_non_positive_or_malformed_config_keeps_the_safe_default(monkeypatch):
    _unauthenticated_override(monkeypatch, 0)
    _role_override(monkeypatch, "super_admin", -1)
    _sensitive_override(monkeypatch, "bulk_import", 0)
    monkeypatch.setitem(settings.RATE_LIMIT_P9_SENSITIVE_LIMITS, "media_upload", "bad")

    base = _resolved("POST", "/api/v1/faqs")
    assert base.limit == DEFAULT_P9_UNAUTHENTICATED_ADMIN[0]
    super_admin = _resolved_with_token("POST", "/api/v1/faqs", 5301, "super_admin")
    assert super_admin.limit == 180
    bulk = _resolved("POST", "/api/v1/question-imports/5/review-all")
    assert bulk.limit == 5
    upload = _resolved("POST", "/api/v1/media/upload")
    assert (upload.limit, upload.window_seconds) == (10, 600)


# -------------------------------------------------------------- enforcement


def test_general_admin_write_limit_uses_the_verified_user_bucket(monkeypatch):
    fake = _enable(monkeypatch)
    _role_override(monkeypatch, "admin", 2)
    client = TestClient(main_app)
    headers = _headers(6001, role="admin")

    statuses = _repeat(
        client, "post", "/api/v1/faqs", 3, headers=headers, json={}
    )

    assert statuses[:2] != [429] * 2
    assert statuses[2] == 429
    keys = _keys(fake, "rl:p9:admin_general:")
    assert len(keys) == 1, keys
    assert keys[0].endswith(":u:6001")
    # Admin categories are deliberately excluded from P3's shared-IP identity
    # dimensions, so no second counter can couple users behind one office NAT.
    assert not any(k.startswith("rl:dim:") for k in fake.counts)


def test_shared_office_ip_does_not_couple_two_admins(monkeypatch):
    fake = _enable(monkeypatch)
    _role_override(monkeypatch, "admin", 1)
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    client = TestClient(main_app)

    first = _headers(6101, role="admin", ip="10.20.0.7")
    second = _headers(6102, role="admin", ip="10.20.0.7")

    assert (
        client.post("/api/v1/faqs", headers=first, json={}).status_code != 429
    )
    assert client.post("/api/v1/faqs", headers=first, json={}).status_code == 429
    # Same NAT, different administrator: their own bucket is untouched.
    assert (
        client.post("/api/v1/faqs", headers=second, json={}).status_code != 429
    )
    assert any(k.endswith(":u:6101") for k in fake.counts)
    assert any(k.endswith(":u:6102") for k in fake.counts)


def test_same_admin_shares_one_quota_across_different_ips(monkeypatch):
    _enable(monkeypatch)
    _role_override(monkeypatch, "admin", 2)
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    client = TestClient(main_app)

    statuses = [
        client.post(
            "/api/v1/faqs",
            headers=_headers(6201, role="admin", ip=f"10.21.0.{i + 1}"),
            json={},
        ).status_code
        for i in range(3)
    ]

    assert statuses[:2] != [429] * 2
    assert statuses[2] == 429


def test_anonymous_callers_are_capped_at_the_base_admin_limit(monkeypatch):
    fake = _enable(monkeypatch)
    _unauthenticated_override(monkeypatch, 2)
    client = TestClient(main_app)

    statuses = _repeat(client, "post", "/api/v1/faqs", 3, json={})

    assert statuses[:2] != [429] * 2
    assert statuses[2] == 429
    keys = _keys(fake, "rl:p9:admin_general:")
    assert len(keys) == 1
    assert keys[0].endswith(":testclient")


def test_admin_reads_are_also_role_tiered(monkeypatch):
    fake = _enable(monkeypatch)
    _role_override(monkeypatch, "counsellor", 1)
    client = TestClient(main_app)

    counsellor = _headers(6301, role="counsellor")
    admin = _headers(6302, role="admin")

    assert client.get("/api/v1/users", headers=counsellor).status_code != 429
    assert client.get("/api/v1/users", headers=counsellor).status_code == 429
    assert client.get("/api/v1/users", headers=admin).status_code != 429
    assert len(_keys(fake, "rl:p9:admin_general:")) == 2


def test_media_upload_is_limited_before_the_file_is_inspected(monkeypatch):
    fake = _enable(monkeypatch)
    _sensitive_override(monkeypatch, "media_upload", 1, 600)
    client = TestClient(main_app)

    filename = "private-client-name.png"
    files = {"file": (filename, b"not-an-image", "image/png")}

    first = client.post("/api/v1/media/upload", files=files)
    second = client.post("/api/v1/media/upload", files=files)

    # The first request reaches the endpoint and is rejected by its guard; the
    # second is stopped by the middleware before parsing/storage/provider work.
    assert first.status_code != 429
    assert second.status_code == 429
    keys = _keys(fake, "rl:p9:media_upload:")
    assert len(keys) == 1
    assert filename not in keys[0]
    assert "private-client" not in keys[0]


def test_bulk_import_is_limited_before_the_job_runs(monkeypatch):
    fake = _enable(monkeypatch)
    _sensitive_override(monkeypatch, "bulk_import", 1)
    client = TestClient(main_app)

    first = client.post("/api/v1/question-imports/77/review-all", json={})
    second = client.post("/api/v1/question-imports/77/review-all", json={})

    assert first.status_code != 429
    assert second.status_code == 429
    keys = _keys(fake, "rl:p9:bulk_import:")
    assert len(keys) == 1
    assert "77" not in keys[0]
    assert "{job_id}" in keys[0]


def test_settings_ai_settings_and_audit_limits(monkeypatch):
    fake = _enable(monkeypatch)
    _sensitive_override(monkeypatch, "settings_update", 1)
    _sensitive_override(monkeypatch, "ai_settings", 1)
    _sensitive_override(monkeypatch, "audit_read", 1)
    client = TestClient(main_app)

    assert client.put("/api/v1/settings", json={}).status_code != 429
    assert client.put("/api/v1/settings", json={}).status_code == 429

    assert (
        client.post("/api/v1/settings/ai/test", json={}).status_code != 429
    )
    assert client.post("/api/v1/settings/ai/test", json={}).status_code == 429

    assert client.get("/api/v1/audit-logs").status_code != 429
    assert client.get("/api/v1/audit-logs").status_code == 429

    assert len(_keys(fake, "rl:p9:settings_update:")) == 1
    assert len(_keys(fake, "rl:p9:ai_settings:")) == 1
    assert len(_keys(fake, "rl:p9:audit_read:")) == 1


def test_role_change_presence_selects_the_stricter_tier_and_cannot_escalate(
    monkeypatch,
):
    fake = _enable(monkeypatch)
    _sensitive_override(monkeypatch, "user_mutation", 2)
    _sensitive_override(monkeypatch, "role_change", 1)
    client = TestClient(main_app)
    headers = _headers(6401, role="admin")

    # An ordinary mutation uses the 20/min-tier counter.
    ordinary = [
        client.patch(
            "/api/v1/users/5", headers=headers, json={"is_active": True}
        ).status_code
        for _ in range(3)
    ]
    assert ordinary[:2] != [429] * 2
    assert ordinary[2] == 429
    assert len(_keys(fake, "rl:p9:user_mutation:")) == 1

    # Sending role_ids can only select the stricter role-change tier.
    assert (
        client.patch(
            "/api/v1/users/5", headers=headers, json={"role_ids": [2]}
        ).status_code
        != 429
    )
    assert (
        client.patch(
            "/api/v1/users/5", headers=headers, json={"role_ids": [2]}
        ).status_code
        == 429
    )
    assert len(_keys(fake, "rl:p9:role_change:")) == 1

    # Omitting role_ids cannot perform a role change, and cannot buy the looser
    # tier for a role-changing request: the router treats absence as "leave
    # roles alone" and the limiter has already used the ordinary tier.
    omitted = _resolved("PATCH", "/api/v1/users/5")
    assert omitted is not None
    assert omitted.body_tiers[0].field == "role_ids"


def test_uninspectable_body_cannot_downgrade_a_role_change(monkeypatch):
    """Padding or malforming the body must not buy the looser mutation tier.

    The middleware inspects at most 16 KiB. A role-change payload padded past
    that limit is uninspectable, so it is charged the strictest body tier
    rather than the ordinary 20/min ceiling it could otherwise claim.
    """
    fake = _enable(monkeypatch)
    _sensitive_override(monkeypatch, "user_mutation", 2)
    _sensitive_override(monkeypatch, "role_change", 1)
    client = TestClient(main_app)
    headers = {
        **_headers(6451, role="admin"),
        "content-type": "application/json",
    }

    oversized = (
        b'{"role_ids":[2],"padding":"' + b"x" * 20_000 + b'"}'
    )
    assert (
        client.patch("/api/v1/users/5", headers=headers, content=oversized).status_code
        != 429
    )
    assert (
        client.patch("/api/v1/users/5", headers=headers, content=oversized).status_code
        == 429
    )
    assert len(_keys(fake, "rl:p9:role_change:")) == 1
    assert not _keys(fake, "rl:p9:user_mutation:")

    # Malformed JSON is equally uninspectable and takes the same safe path.
    malformed = b'{"role_ids": [2]'
    assert (
        client.patch("/api/v1/users/6", headers=headers, content=malformed).status_code
        == 429
    )


def test_success_and_rejection_headers_match_the_selected_tier(monkeypatch):
    _enable(monkeypatch)
    _role_override(monkeypatch, "admin", 2)
    client = TestClient(main_app)
    headers = _headers(6501, role="admin")

    first = client.post("/api/v1/faqs", headers=headers, json={})
    assert first.status_code != 429
    for name in RATE_HEADERS:
        assert name in first.headers
    assert first.headers["RateLimit-Limit"] == "2"
    assert first.headers["RateLimit-Remaining"] == "1"

    client.post("/api/v1/faqs", headers=headers, json={})
    rejected = client.post("/api/v1/faqs", headers=headers, json={})
    assert rejected.status_code == 429
    assert rejected.headers["RateLimit-Limit"] == "2"
    assert rejected.headers["RateLimit-Remaining"] == "0"
    assert rejected.headers["Retry-After"]
    body = rejected.json()
    assert body["success"] is False
    assert body["error"]["code"] == "RATE_LIMIT_EXCEEDED"
    assert "retry_after_seconds" in body["error"]["details"]


def test_sensitive_mutation_returns_503_when_redis_is_unavailable(monkeypatch):
    _enable_broken(monkeypatch)
    client = TestClient(main_app)

    response = client.post("/api/v1/media/upload")
    assert response.status_code == 503
    assert response.headers["Retry-After"] == "1"
    body = response.json()
    assert body["error"]["code"] == "SERVICE_UNAVAILABLE"

    bulk = client.post("/api/v1/question-imports/5/review-all", json={})
    assert bulk.status_code == 503

    settings_update = client.put("/api/v1/settings", json={})
    assert settings_update.status_code == 503


def test_admin_and_audit_reads_follow_the_global_fail_open_default(monkeypatch):
    _enable_broken(monkeypatch)
    monkeypatch.setattr(settings, "RATE_LIMIT_FAIL_OPEN", True)
    client = TestClient(main_app)

    users = client.get("/api/v1/users", headers=_headers(6601, role="admin"))
    assert users.status_code != 503

    audit = client.get("/api/v1/audit-logs", headers=_headers(6602, role="admin"))
    assert audit.status_code != 503

    settings_read = client.get(
        "/api/v1/settings", headers=_headers(6603, role="admin")
    )
    assert settings_read.status_code != 503


def test_p9_does_not_alter_p2_p8_limits():
    auth = _resolved("POST", "/api/v1/auth/login")
    assert auth is not None and (auth.category, auth.limit) == (
        "authentication",
        5,
    )

    chat = _resolved("POST", "/api/v1/ai/chat")
    assert chat is not None and (chat.category, chat.limit) == (
        "ai_operations",
        10,
    )

    predictor = _resolved("POST", "/api/v1/predictor/exams")
    assert predictor is not None and (predictor.category, predictor.limit) == (
        "ai_predictor",
        10,
    )

    student = _resolved("PUT", "/api/v1/users/me")
    assert student is not None and (student.namespace, student.limit) == (
        "p7:profile_update",
        10,
    )

    mock_start = _resolved("POST", "/api/v1/mock-tests/jee-main/start")
    assert mock_start is not None and (mock_start.namespace, mock_start.limit) == (
        "p7:mock_test_start",
        10,
    )

    blog_view = _resolved("POST", "/api/v1/blogs/7/view")
    assert blog_view is not None and (blog_view.namespace, blog_view.limit) == (
        "p8:blog_view",
        10,
    )

    # A read route that already had a P4 rule keeps it.
    blog_read = _resolved("GET", "/api/v1/blogs/7")
    assert blog_read is not None and (blog_read.namespace, blog_read.limit) == (
        "read:anonymous_api",
        60,
    )
