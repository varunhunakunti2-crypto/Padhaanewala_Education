"""P8 CRM, enquiry and lead-generation rate-limit tests.

P8 adds explicit limits to the real public intake route, the CRM lead-write
routes and blog view tracking. It extends the P2-P7 policy engine; the Redis
scripts, response schemas, authorization guards and enquiry/lead behaviour are
unchanged.

The public site has one intake endpoint. `POST /api/v1/enquiries` serves the
admission, counselling and contact forms, so those operations share the
`public_enquiry` ceiling. The admin console's "add lead" posts to the same
route; a verified staff role claim selects the looser `lead_create` tier there.
"""

import uuid
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
from app.middleware.rate_limit_dimensions import (
    extract_identifier_hashes,
    normalized_blog_article_key,
)
from app.middleware.rate_limit_policy import (
    DEFAULT_P8_CRM_LIMITS,
    reset_route_template_cache,
    resolve_rate_limit,
)
from app.models import Enquiry, Role, User
from app.utils.security import create_access_token

RATE_HEADERS = ("RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset")
ENQUIRY_PATH = "/api/v1/enquiries"


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


def _request(method: str, path: str, headers: tuple[tuple[bytes, bytes], ...] = ()) -> Request:
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
        return {"type": "http.request", "body": b"", "more_body": False}

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


def _p8_override(monkeypatch, operation: str, limit: int, window: int = 60) -> None:
    current = {k: dict(v) for k, v in settings.RATE_LIMIT_P8_CRM_LIMITS.items()}
    current[operation] = {"limit": limit, "window_seconds": window}
    monkeypatch.setattr(settings, "RATE_LIMIT_P8_CRM_LIMITS", current)


def _identifier_override(
    monkeypatch, identifier: str, limit: int, window: int = 600
) -> None:
    current = {
        k: dict(v) for k, v in settings.RATE_LIMIT_P8_IDENTIFIER_LIMITS.items()
    }
    current[identifier] = {"limit": limit, "window_seconds": window}
    monkeypatch.setattr(settings, "RATE_LIMIT_P8_IDENTIFIER_LIMITS", current)


def _headers(user_id: int, role: str = "student", ip: str | None = None) -> dict:
    token = create_access_token(user_id, role)
    headers = {"authorization": f"Bearer {token}"}
    if ip is not None:
        headers["x-forwarded-for"] = ip
    return headers


def _repeat(client, method: str, path: str, n: int, **kwargs) -> list:
    return [getattr(client, method)(path, **kwargs).status_code for _ in range(n)]


def _keys(fake: FakeRedis, prefix: str) -> list[str]:
    return [k for k in fake.counts if k.startswith(prefix)]


# ------------------------------------------------------------------ mapping


P8_CASES = [
    ("POST", "/api/v1/enquiries", "public_enquiry", 3, 600, "user"),
    ("POST", "/api/v1/leads/5/notes", "lead_update", 30, 60, "user"),
    ("PATCH", "/api/v1/leads/5/status", "lead_update", 30, 60, "user"),
    ("PATCH", "/api/v1/leads/5/follow-up", "lead_update", 30, 60, "user"),
    ("PATCH", "/api/v1/leads/5/details", "lead_update", 30, 60, "user"),
    ("PATCH", "/api/v1/leads/5/assign", "lead_update", 30, 60, "user"),
    ("DELETE", "/api/v1/leads/5", "lead_update", 30, 60, "user"),
    ("POST", "/api/v1/blogs/7/view", "blog_view", 10, 3600, "article"),
]


@pytest.mark.parametrize(
    "method,path,operation,limit,window,key_dimension", P8_CASES
)
def test_p8_routes_resolve_to_their_configured_limit(
    method, path, operation, limit, window, key_dimension
):
    resolved = _resolved(method, path)
    assert resolved is not None, (method, path)
    assert resolved.namespace == f"p8:{operation}"
    assert (resolved.limit, resolved.window_seconds) == (limit, window)
    assert resolved.key_dimension == key_dimension


def test_defaults_match_the_approved_starting_limits():
    assert DEFAULT_P8_CRM_LIMITS == {
        "public_enquiry": (3, 600),
        "lead_create": (10, 60),
        "lead_update": (30, 60),
        "blog_view": (10, 3600),
    }


def test_public_intake_fails_closed_and_lead_writes_do_not():
    enquiry = _resolved("POST", ENQUIRY_PATH)
    assert enquiry is not None
    # Paid SMS/email and CRM capacity sit behind this route.
    assert enquiry.fail_closed is True
    assert "identifier" in enquiry.dimensions

    lead = _resolved("PATCH", "/api/v1/leads/5/status")
    assert lead is not None
    # Not a credential or spend surface: follows the global fail-open default.
    assert lead.fail_closed is None

    view = _resolved("POST", "/api/v1/blogs/7/view")
    assert view is not None
    assert view.fail_closed is None


def test_configurable_operation_limits_override_the_default(monkeypatch):
    _p8_override(monkeypatch, "public_enquiry", 2, 900)
    _p8_override(monkeypatch, "lead_update", 4, 120)
    _p8_override(monkeypatch, "blog_view", 3, 1800)

    enquiry = _resolved("POST", ENQUIRY_PATH)
    assert (enquiry.limit, enquiry.window_seconds) == (2, 900)

    lead = _resolved("PATCH", "/api/v1/leads/5/status")
    assert (lead.limit, lead.window_seconds) == (4, 120)

    view = _resolved("POST", "/api/v1/blogs/7/view")
    assert (view.limit, view.window_seconds) == (3, 1800)


def test_non_positive_config_does_not_unthrottle_a_paid_surface(monkeypatch):
    _p8_override(monkeypatch, "public_enquiry", 0)
    enquiry = _resolved("POST", ENQUIRY_PATH)
    assert enquiry is not None
    assert (enquiry.limit, enquiry.window_seconds) == (3, 600)


def test_staff_role_selects_lead_create_on_the_shared_intake_route():
    # Tokens issued by the auth service carry a comma-separated role claim.
    resolved = _resolved_with_token(
        "POST", ENQUIRY_PATH, 9001, "student,counsellor"
    )
    assert resolved is not None
    assert resolved.namespace == "p8:lead_create"
    assert (resolved.limit, resolved.window_seconds) == (10, 60)
    assert resolved.limit == DEFAULT_P8_CRM_LIMITS["lead_create"][0]

    student = _resolved_with_token("POST", ENQUIRY_PATH, 9002, "student")
    assert student is not None
    assert student.namespace == "p8:public_enquiry"

    # An unsigned/forged role never relaxes the public ceiling.
    forged = ratelimit._resolve_limit(
        _request(
            "POST",
            ENQUIRY_PATH,
            ((b"authorization", b"Bearer not-a-real-token"), (b"x-role", b"admin")),
        )
    )
    assert forged is not None
    assert forged.namespace == "p8:public_enquiry"


def test_unrelated_and_p2_p7_policies_are_unchanged():
    auth = _resolved("POST", "/api/v1/auth/login")
    assert auth is not None and (auth.category, auth.limit) == ("authentication", 5)

    predictor = _resolved("POST", "/api/v1/predictor/exams")
    assert predictor is not None and (predictor.category, predictor.limit) == (
        "ai_predictor",
        10,
    )

    chat = _resolved("POST", "/api/v1/ai/chat")
    assert chat is not None and (chat.category, chat.limit) == ("ai_operations", 10)

    p7 = _resolved("POST", "/api/v1/mock-tests/jee-main/start")
    assert p7 is not None and (p7.namespace, p7.limit) == ("p7:mock_test_start", 10)

    # Ordinary blog reading keeps its P4 read rule (60/min), not the view cap.
    read = _resolved("GET", "/api/v1/blogs/7")
    assert read is not None
    assert (read.namespace, read.limit) == ("read:anonymous_api", 60)
    assert read.key_dimension == "ip"

    # P9 classifies these staff surfaces with the general-admin tier; the
    # student/public routes above keep their stricter P7/P8 namespaces.
    banners = _resolved("POST", "/api/v1/banners")
    assert banners is not None and banners.namespace == "p9:admin_general"
    submissions = _resolved("GET", "/api/v1/college-submissions")
    assert submissions is not None and submissions.namespace == "p9:admin_general"


# -------------------------------------------------------------- enforcement


def test_public_enquiry_limit(monkeypatch):
    fake = _enable(monkeypatch)
    client = TestClient(main_app)

    statuses = _repeat(client, "post", ENQUIRY_PATH, 4, json={})

    assert statuses[:3] != [429] * 3
    assert statuses[3] == 429
    keys = _keys(fake, "rl:p8:public_enquiry:")
    assert len(keys) == 1, keys
    # Anonymous submissions use the trusted client IP, never a body value.
    assert keys[0].endswith(":testclient")


def test_counselling_and_contact_forms_share_the_public_intake_ceiling(monkeypatch):
    fake = _enable(monkeypatch)
    client = TestClient(main_app)

    # The frontend sends the same endpoint for admission, counselling and
    # contact variants; only the body's `source` differs. A caller cannot mint
    # a new bucket by relabelling the form.
    for source in ("website_admission_form", "counselling", "contact"):
        response = client.post(ENQUIRY_PATH, json={"source": source})
        assert response.status_code != 429

    assert client.post(ENQUIRY_PATH, json={"source": "contact"}).status_code == 429
    assert len(_keys(fake, "rl:p8:public_enquiry:")) == 1


def test_lead_create_limit(monkeypatch):
    fake = _enable(monkeypatch)
    client = TestClient(main_app)
    headers = _headers(9101, role="admin")

    statuses = _repeat(client, "post", ENQUIRY_PATH, 11, headers=headers, json={})

    assert statuses[:10] != [429] * 10
    assert statuses[10] == 429
    keys = _keys(fake, "rl:p8:lead_create:")
    assert len(keys) == 1, keys
    assert keys[0].endswith(":u:9101")
    # Staff "add lead" is not identifier-limited: the same student may be
    # re-filed legitimately by one counsellor.
    assert not _keys(fake, "rl:dim:p8:ident:")


def test_student_on_the_shared_route_keeps_the_public_limit(monkeypatch):
    fake = _enable(monkeypatch)
    _p8_override(monkeypatch, "public_enquiry", 2)
    client = TestClient(main_app)
    headers = _headers(9102, role="student")

    statuses = _repeat(client, "post", ENQUIRY_PATH, 3, headers=headers, json={})

    assert statuses[:2] != [429] * 2
    assert statuses[2] == 429
    assert _keys(fake, "rl:p8:public_enquiry:")
    assert not _keys(fake, "rl:p8:lead_create:")


def test_lead_update_limit(monkeypatch):
    fake = _enable(monkeypatch)
    client = TestClient(main_app)
    headers = _headers(9201, role="counsellor")

    statuses = _repeat(
        client,
        "patch",
        "/api/v1/leads/5/status",
        31,
        headers=headers,
        json={"status": "contacted"},
    )

    assert statuses[:30] != [429] * 30
    assert statuses[30] == 429
    keys = _keys(fake, "rl:p8:lead_update:")
    assert len(keys) == 1, keys
    assert "{enquiry_id}" in keys[0]
    assert keys[0].endswith(":u:9201")


def test_counsellors_do_not_consume_each_others_lead_update_quota(monkeypatch):
    fake = _enable(monkeypatch)
    _p8_override(monkeypatch, "lead_update", 1)
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    client = TestClient(main_app)

    first = _headers(9301, role="counsellor", ip="10.9.0.7")
    second = _headers(9302, role="counsellor", ip="10.9.0.7")

    assert (
        client.patch(
            "/api/v1/leads/5/status", headers=first, json={"status": "contacted"}
        ).status_code
        != 429
    )
    assert (
        client.patch(
            "/api/v1/leads/5/status", headers=first, json={"status": "contacted"}
        ).status_code
        == 429
    )
    # Same office NAT, different counsellor: their own bucket is untouched.
    assert (
        client.patch(
            "/api/v1/leads/5/status", headers=second, json={"status": "contacted"}
        ).status_code
        != 429
    )
    assert any(k.endswith(":u:9301") for k in fake.counts)
    assert any(k.endswith(":u:9302") for k in fake.counts)


def test_blog_view_limit_per_article_ip(monkeypatch):
    fake = _enable(monkeypatch)
    client = TestClient(main_app)

    statuses = _repeat(client, "post", "/api/v1/blogs/7001/view", 11)

    assert statuses[:10] != [429] * 10
    assert statuses[10] == 429
    keys = _keys(fake, "rl:p8:blog_view:")
    assert len(keys) == 1, keys
    assert "{blog_ref}" in keys[0]
    assert "7001" not in keys[0]


def test_different_articles_have_independent_view_buckets(monkeypatch):
    fake = _enable(monkeypatch)
    client = TestClient(main_app)

    first = _repeat(client, "post", "/api/v1/blogs/7002/view", 10)
    second = _repeat(client, "post", "/api/v1/blogs/7003/view", 1)

    assert first[:10] != [429] * 10
    assert second == [204]
    assert len(_keys(fake, "rl:p8:blog_view:")) == 2


def test_same_article_and_ip_share_a_bucket_and_query_strings_are_ignored(
    monkeypatch,
):
    fake = _enable(monkeypatch)
    client = TestClient(main_app)

    for index in range(10):
        client.post(f"/api/v1/blogs/7004/view?utm_source=campaign-{index}")

    rejected = client.post("/api/v1/blogs/7004/view?utm_medium=email")
    assert rejected.status_code == 429
    keys = _keys(fake, "rl:p8:blog_view:")
    assert len(keys) == 1, keys
    # The action's own id appears only as a hash, not the ref or query string.
    assert "7004" not in keys[0]
    assert "campaign" not in keys[0]


def test_invalid_blog_refs_collapse_into_one_bounded_bucket(monkeypatch):
    fake = _enable(monkeypatch)
    client = TestClient(main_app)

    # These cannot match the router's id-or-lowercase-slug shape, so they all
    # map to the single `invalid` article dimension instead of minting a key per
    # arbitrary value.
    refs = [f"Bad-Ref-{uuid.uuid4().hex}" for _ in range(10)]
    for ref in refs:
        assert client.post(f"/api/v1/blogs/{ref}/view").status_code == 204

    assert client.post("/api/v1/blogs/under_score/view").status_code == 429
    assert len(_keys(fake, "rl:p8:blog_view:")) == 1


def test_ordinary_blog_gets_do_not_touch_the_view_bucket(monkeypatch):
    fake = _enable(monkeypatch)
    client = TestClient(main_app)

    for _ in range(3):
        client.get("/api/v1/blogs/7005")

    assert not _keys(fake, "rl:p8:blog_view:")


# ------------------------------------------------------- identifier buckets


def test_normalized_phone_identifiers_share_a_bucket_across_ip_and_format(
    monkeypatch,
):
    fake = _enable(monkeypatch)
    _p8_override(monkeypatch, "public_enquiry", 100)
    _identifier_override(monkeypatch, "enquiry:phone", 2)
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    client = TestClient(main_app)

    formats = ["+91 98450 00001", "919845000001", "9845000001"]
    statuses = [
        client.post(
            ENQUIRY_PATH,
            json={"mobile": fmt},
            headers={"x-forwarded-for": f"10.8.0.{i + 1}"},
        ).status_code
        for i, fmt in enumerate(formats)
    ]

    assert statuses[:2] != [429] * 2
    # Third variant from a fresh IP: the shared phone bucket is spent.
    assert statuses[2] == 429
    phone_keys = _keys(fake, "rl:dim:p8:ident:enquiry:phone:")
    assert len(phone_keys) == 1, phone_keys


def test_normalized_email_identifiers_share_a_bucket_across_ip(monkeypatch):
    fake = _enable(monkeypatch)
    _p8_override(monkeypatch, "public_enquiry", 100)
    _identifier_override(monkeypatch, "enquiry:email", 2)
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    client = TestClient(main_app)

    formats = ["Student@Example.com", " student@example.com ", "STUDENT@EXAMPLE.COM"]
    statuses = [
        client.post(
            ENQUIRY_PATH,
            json={"email": fmt},
            headers={"x-forwarded-for": f"10.7.0.{i + 1}"},
        ).status_code
        for i, fmt in enumerate(formats)
    ]

    assert statuses[:2] != [429] * 2
    assert statuses[2] == 429
    assert len(_keys(fake, "rl:dim:p8:ident:enquiry:email:")) == 1


def test_raw_pii_never_appears_in_redis_keys(monkeypatch):
    fake = _enable(monkeypatch)
    _p8_override(monkeypatch, "public_enquiry", 100)
    client = TestClient(main_app)

    phone = "9845098765"
    email = "Private.Person@Example.com"
    client.post(ENQUIRY_PATH, json={"mobile": phone, "email": email})

    assert fake.counts, "the limiter must have counted something"
    for key in fake.counts:
        assert phone not in key
        assert "98450" not in key
        assert email.lower() not in key
        assert "private.person" not in key

    # The hash is still deterministic and namespaced by identifier type.
    hashes = extract_identifier_hashes(
        _request("POST", ENQUIRY_PATH), {"mobile": phone, "email": email}
    )
    assert len(hashes.get("phone", "")) == 32
    assert len(hashes.get("email", "")) == 32
    assert any(key.endswith(hashes["phone"]) for key in fake.counts)


# -------------------------------------------------------- identity coupling


def test_authenticated_users_have_independent_quotas(monkeypatch):
    fake = _enable(monkeypatch)
    _p8_override(monkeypatch, "public_enquiry", 2)
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    client = TestClient(main_app)

    first = _headers(9401, ip="10.6.0.9")
    second = _headers(9402, ip="10.6.0.9")

    statuses = [
        client.post(ENQUIRY_PATH, headers=first, json={}).status_code,
        client.post(ENQUIRY_PATH, headers=first, json={}).status_code,
        client.post(ENQUIRY_PATH, headers=first, json={}).status_code,
        client.post(ENQUIRY_PATH, headers=second, json={}).status_code,
        client.post(ENQUIRY_PATH, headers=second, json={}).status_code,
    ]

    assert statuses[2] == 429
    # A second student behind the same NAT still has their full quota.
    assert statuses[3] != 429
    assert statuses[4] != 429
    assert any(k.endswith(":u:9401") for k in fake.counts)
    assert any(k.endswith(":u:9402") for k in fake.counts)


def test_same_user_shares_one_quota_across_different_ips(monkeypatch):
    _enable(monkeypatch)
    _p8_override(monkeypatch, "public_enquiry", 2)
    monkeypatch.setattr(settings, "TRUSTED_PROXY_HOPS", 1)
    client = TestClient(main_app)

    statuses = [
        client.post(
            ENQUIRY_PATH,
            headers=_headers(9403, ip=f"10.5.0.{i + 1}"),
            json={},
        ).status_code
        for i in range(3)
    ]

    assert statuses[:2] != [429] * 2
    assert statuses[2] == 429


def test_invalid_jwt_never_gets_a_user_bucket(monkeypatch):
    fake = _enable(monkeypatch)
    _p8_override(monkeypatch, "public_enquiry", 1)
    client = TestClient(main_app)

    invalid = {"authorization": "Bearer not-a-real-token", "x-user-id": "999"}
    assert client.post(ENQUIRY_PATH, headers=invalid, json={}).status_code != 429
    assert client.post(ENQUIRY_PATH, headers=invalid, json={}).status_code == 429

    keys = _keys(fake, "rl:p8:public_enquiry:")
    assert keys
    assert all(":u:" not in key for key in keys), keys

    # A valid token is unaffected by the spent IP bucket.
    assert (
        client.post(ENQUIRY_PATH, headers=_headers(9404), json={}).status_code
        != 429
    )
    assert any(k.endswith(":u:9404") for k in fake.counts)


def test_client_supplied_ids_cannot_bypass_enforcement(monkeypatch):
    fake = _enable(monkeypatch)
    _p8_override(monkeypatch, "public_enquiry", 2)
    client = TestClient(main_app)
    headers = {**_headers(42), "x-user-id": "999"}

    def submit() -> int:
        return client.post(
            f"{ENQUIRY_PATH}?user_id=999",
            headers=headers,
            json={"user_id": 999},
        ).status_code

    assert submit() != 429
    assert submit() != 429
    assert submit() == 429

    keys = _keys(fake, "rl:p8:public_enquiry:")
    assert any(k.endswith(":u:42") for k in keys), keys
    assert not any(k.endswith(":u:999") for k in keys), keys


# ------------------------------------------------------ behaviour preserved


def _register(prefix: str) -> dict:
    client = TestClient(main_app)
    payload = {
        "name": f"P8 {prefix}",
        "email": f"p8.{prefix}.{uuid.uuid4().hex[:8]}@example.com",
        "mobile": f"7{uuid.uuid4().int % 1_000_000_000:09d}",
        "password": "SecurePass123!",
        "age_band": "18_plus",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    return {**payload, **response.json()}


def _login(email: str) -> str:
    response = TestClient(main_app).post(
        "/api/v1/auth/login",
        json={"email": email, "password": "SecurePass123!"},
    )
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def _grant_role(email: str, role_name: str) -> None:
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        role = db.scalar(select(Role).where(Role.name == role_name))
        assert user is not None and role is not None
        if role not in user.roles:
            user.roles.append(role)
        db.commit()


def test_duplicate_enquiry_and_idempotency_behaviour_remains_intact(monkeypatch):
    _enable(monkeypatch)
    client = TestClient(main_app)
    mobile = f"6{uuid.uuid4().int % 1_000_000_000:09d}"
    payload = {
        "name": "P8 Duplicate Check",
        "mobile": mobile,
        "email": f"p8.dupe.{uuid.uuid4().hex[:8]}@example.com",
        "age_band": "18_plus",
        "message": "Please call me",
    }

    try:
        first = client.post(ENQUIRY_PATH, json=payload)
        second = client.post(ENQUIRY_PATH, json=payload)

        # P8 counts requests; it does not deduplicate or swallow a legitimate
        # immediate retry inside the approved ceiling.
        assert first.status_code == 201, first.text
        assert second.status_code == 201, second.text
        assert first.json()["id"] != second.json()["id"]

        with SessionLocal() as db:
            rows = db.scalars(
                select(Enquiry).where(Enquiry.mobile == mobile)
            ).all()
            assert len(rows) == 2
            assert all(row.status == "new" for row in rows)
    finally:
        with SessionLocal() as db:
            for row in db.scalars(
                select(Enquiry).where(Enquiry.mobile == mobile)
            ).all():
                db.delete(row)
            db.commit()


def test_rate_limited_enquiry_is_rejected_not_silently_discarded(monkeypatch):
    """A throttled submission must say so, and must not create a half-lead.

    The limit is enforced in middleware, before the router writes the enquiry,
    promotes it to a lead or queues notifications. So the caller gets an
    explicit 429 and the database holds only the requests that were accepted -
    nothing is accepted and then quietly dropped.
    """
    _enable(monkeypatch)
    _p8_override(monkeypatch, "public_enquiry", 1, 600)
    client = TestClient(main_app)
    mobile = f"5{uuid.uuid4().int % 1_000_000_000:09d}"
    payload = {
        "name": "P8 Throttled",
        "mobile": mobile,
        "age_band": "18_plus",
        "message": "First attempt",
    }

    try:
        first = client.post(ENQUIRY_PATH, json=payload)
        assert first.status_code == 201, first.text

        second = client.post(
            ENQUIRY_PATH, json={**payload, "message": "Second attempt"}
        )
        assert second.status_code == 429
        assert second.json()["error"]["code"] == "RATE_LIMIT_EXCEEDED"

        with SessionLocal() as db:
            rows = db.scalars(
                select(Enquiry).where(Enquiry.mobile == mobile)
            ).all()
            assert len(rows) == 1
            assert rows[0].message == "First attempt"
    finally:
        with SessionLocal() as db:
            for row in db.scalars(
                select(Enquiry).where(Enquiry.mobile == mobile)
            ).all():
                db.delete(row)
            db.commit()


def test_existing_crm_authorization_remains_unchanged(monkeypatch):
    student = _register("student")
    counsellor = _register("counsellor")
    _grant_role(counsellor["email"], "counsellor")
    counsellor_token = _login(counsellor["email"])

    _p8_override(monkeypatch, "lead_update", 100)
    _enable(monkeypatch)
    client = TestClient(main_app)
    student_headers = {"Authorization": f"Bearer {student['access_token']}"}
    counsellor_headers = {"Authorization": f"Bearer {counsellor_token}"}
    status_body = {"status": "contacted"}

    # A student holds no CRM role: still 403, not a rate-limit error.
    denied = client.patch(
        "/api/v1/leads/999999/status", headers=student_headers, json=status_body
    )
    assert denied.status_code == 403

    # Anonymous callers are still 401.
    assert (
        client.patch(
            "/api/v1/leads/999999/status", json=status_body
        ).status_code
        == 401
    )

    # A counsellor passes authorization and then hits the normal 404 for an
    # unknown lead. Limiting did not change the guard.
    assert (
        client.patch(
            "/api/v1/leads/999999/status",
            headers=counsellor_headers,
            json=status_body,
        ).status_code
        == 404
    )

    # Assignment stays admin-only even though it is a P8 lead-update route.
    assert (
        client.patch(
            "/api/v1/leads/999999/assign",
            headers=counsellor_headers,
            json={"counsellor_id": 1},
        ).status_code
        == 403
    )


# --------------------------------------------------------- headers / outage


def test_p5_headers_and_schema_on_a_p8_429(monkeypatch):
    _enable(monkeypatch)
    _p8_override(monkeypatch, "public_enquiry", 1, 600)
    client = TestClient(main_app)

    assert client.post(ENQUIRY_PATH, json={}).status_code != 429
    rejected = client.post(ENQUIRY_PATH, json={})

    assert rejected.status_code == 429
    assert rejected.headers["RateLimit-Limit"] == "1"
    assert rejected.headers["RateLimit-Remaining"] == "0"
    assert rejected.headers["RateLimit-Reset"] == "600"
    assert rejected.headers["Retry-After"] == "600"
    for name in RATE_HEADERS + ("Retry-After",):
        assert rejected.headers[name].isdigit()

    body = rejected.json()
    assert set(body) == {"success", "error"}
    assert set(body["error"]) == {"code", "message", "details"}
    assert body["success"] is False
    assert body["error"]["code"] == "RATE_LIMIT_EXCEEDED"
    assert body["error"]["details"] == {"retry_after_seconds": 600}


def test_public_enquiry_fails_closed_on_a_redis_outage(monkeypatch):
    """Unprotected intake can trigger paid SMS/email and CRM work."""
    _enable_broken(monkeypatch)
    client = TestClient(main_app)

    response = client.post(ENQUIRY_PATH, json={})

    assert response.status_code == 503
    assert response.headers["Retry-After"] == "1"
    assert response.json()["error"]["code"] == "SERVICE_UNAVAILABLE"
    assert "RateLimit-Limit" not in response.headers


def test_lead_updates_and_blog_views_fail_open_on_a_redis_outage(monkeypatch):
    _enable_broken(monkeypatch)
    client = TestClient(main_app)

    lead = client.patch(
        "/api/v1/leads/5/status",
        headers=_headers(9501, role="counsellor"),
        json={"status": "contacted"},
    )
    assert lead.status_code not in (429, 503)
    for name in RATE_HEADERS + ("Retry-After",):
        assert name not in lead.headers

    view = client.post("/api/v1/blogs/7006/view")
    assert view.status_code == 204
    for name in RATE_HEADERS + ("Retry-After",):
        assert name not in view.headers


# ------------------------------------------------------- article dimension


def test_blog_article_dimension_is_normalized_bounded_and_hashed():
    numeric = normalized_blog_article_key(
        _request("POST", "/api/v1/blogs/42/view")
    )
    padded = normalized_blog_article_key(
        _request("POST", "/api/v1/blogs/0042/view")
    )
    assert numeric == padded
    assert len(numeric) == 32
    assert "42" not in numeric

    slug = normalized_blog_article_key(
        _request("POST", "/api/v1/blogs/how-to-choose-a-college/view")
    )
    assert len(slug) == 32
    assert "how-to-choose" not in slug

    invalid = {
        normalized_blog_article_key(
            _request("POST", f"/api/v1/blogs/{ref}/view")
        )
        for ref in ("Hello-World", "under_score", "a" * 300, "x?y=1")
    }
    assert len(invalid) == 1
