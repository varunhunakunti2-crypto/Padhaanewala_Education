"""Centralized, configurable rate-limit policy engine (P2).

This module is the single source of truth for:
- category definitions and default limits,
- route classification/matching (exact, prefix, parameterized template),
- HTTP method handling and explicit exemptions,
- endpoint-specific overrides and a safe default fallback policy.

The middleware executes before endpoint routing, so request-to-route-template
resolution is performed here against the application's registered Starlette
routes (built lazily and cached). Redis counting/execution remains in
``app.middleware.ratelimit`` to preserve the existing atomic Lua implementation.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field, replace
from functools import lru_cache
from typing import Iterable

from starlette.requests import Request
from starlette.routing import Mount, Route

from app.roles import LEAD_ROLES, rank

WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
READ_METHODS = frozenset({"GET", "HEAD"})
ALL_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"})


@dataclass(frozen=True)
class RoleLimit:
    """Role-selected alternative limit for one route.

    Used by P8 where a public intake route and the admin "add lead" action are
    literally the same endpoint. The role comes from the signed access token,
    never from a request field, and authorization is still enforced by the
    endpoint's own role dependency.
    """

    namespace: str
    roles: frozenset[str]
    limit: int
    window_seconds: int


@dataclass(frozen=True)
class BodyTier:
    """A stricter limit selected by the presence of one request-body field.

    P9 uses this for ``PATCH /api/v1/users/{user_id}``: the same route handles an
    ordinary user-management mutation and a role/permission change, and the
    latter is a far more dangerous operation. The field name is fixed in the
    policy; a client can only *select the stricter tier* by sending it. Omitting
    it cannot change roles (the router treats an absent ``role_ids`` as "leave
    roles alone"), so presence can never buy extra quota.
    """

    field: str
    namespace: str
    category: str
    limit: int
    window_seconds: int
    fail_closed: bool | None = True


@dataclass(frozen=True)
class RateLimitPolicy:
    """One enforceable policy decision."""

    category: str
    namespace: str
    limit: int
    window_seconds: int
    methods: frozenset[str]
    enabled: bool = True
    fail_closed: bool | None = None  # None -> global/default behaviour
    exempt: bool = False
    route_template: str | None = None
    # P3 additive dimensions: "ip", "user", "identifier", "daily" (route limit remains primary).
    dimensions: tuple[str, ...] = ()
    # P4 primary bucket identity for read routes. "ip" preserves the existing
    # route+IP key; "user" keys the primary counter by verified JWT subject so
    # per-user quotas are independent of the caller's address. P8 adds
    # "article", where the primary key includes a validated article reference
    # plus the trusted IP (blog view protection).
    key_dimension: str = "ip"
    # P8 role-selected limits for routes shared by public and CRM callers.
    role_limits: tuple[RoleLimit, ...] = ()
    # P9 body-selected stricter tiers (role/permission changes on the user PATCH).
    body_tiers: tuple[BodyTier, ...] = ()

    @property
    def is_active(self) -> bool:
        return self.enabled and not self.exempt and self.limit > 0 and self.window_seconds > 0

    def applies_to_method(self, method: str) -> bool:
        return method.upper() in self.methods


@dataclass(frozen=True)
class RouteRule:
    """Classification/match rule. More specific rules must be checked first."""

    pattern: str
    policy: RateLimitPolicy
    methods: frozenset[str] | None = None
    match: str = "exact"  # exact | prefix | regex
    priority: int = 0
    _compiled: re.Pattern[str] | None = field(default=None, compare=False, repr=False)

    def compiled(self) -> "RouteRule":
        if self.match != "regex" or self._compiled is not None:
            return self
        return RouteRule(
            pattern=self.pattern,
            policy=self.policy,
            methods=self.methods,
            match=self.match,
            priority=self.priority,
            _compiled=re.compile(self.pattern),
        )

    def matches(self, method: str, path: str, template: str | None) -> bool:
        methods = self.methods or self.policy.methods
        if method.upper() not in methods:
            return False
        target = template or path
        if self.match == "exact":
            return path == self.pattern or target == self.pattern
        if self.match == "prefix":
            return path == self.pattern or path.startswith(self.pattern.rstrip("/") + "/")
        if self.match == "regex":
            rule = self.compiled()
            assert rule._compiled is not None
            return bool(rule._compiled.match(path) or (target and rule._compiled.match(target)))
        return False


@dataclass(frozen=True)
class ResolvedRateLimit:
    namespace: str
    limit: int
    window_seconds: int
    bucket_path: str
    category: str
    fail_closed: bool | None = None
    dimensions: tuple[str, ...] = ()
    path: str = ""
    key_dimension: str = "ip"
    # P8 role-selected alternatives for a shared public/staff route.
    role_limits: tuple[RoleLimit, ...] = ()
    # P9 body-selected stricter alternatives (role/permission changes).
    body_tiers: tuple[BodyTier, ...] = ()
    # P10: the registered route template, or ``None`` when the request did not
    # match one. Observability logs this instead of the concrete path so no id,
    # slug or query string can reach a log line.
    route_template: str | None = None


# ---------------------------------------------------------------------------
# Category defaults (P2 architecture; not all are enforced as new coverage yet)
# ---------------------------------------------------------------------------

DEFAULT_CATEGORY_POLICIES: dict[str, dict[str, int]] = {
    "authenticated_api": {"limit": 120, "window_seconds": 60},
    "anonymous_api": {"limit": 60, "window_seconds": 60},
    "public_catalogue": {"limit": 60, "window_seconds": 60},
    "authentication": {"limit": 20, "window_seconds": 60},
    "student_operations": {"limit": 60, "window_seconds": 60},
    "mock_test_operations": {"limit": 60, "window_seconds": 60},
    "ai_operations": {"limit": 10, "window_seconds": 60},
    "ai_question_generation": {"limit": 3, "window_seconds": 60},
    "ai_predictor": {"limit": 10, "window_seconds": 60},
    "file_uploads": {"limit": 30, "window_seconds": 60},
    "enquiries_crm": {"limit": 5, "window_seconds": 3600},
    "admin_operations": {"limit": 120, "window_seconds": 60},
}

DEFAULT_NAMED_LIMITS: dict[str, tuple[int, int]] = {
    "college_search": (30, 60),
    "course_search": (30, 60),
    "catalogue_statistics": (10, 60),
    "dashboard_analytics": (30, 60),
}

#: P4 read-route limits (GET/HEAD only). Centralized here and mirrored by
#: ``settings.RATE_LIMIT_READ_CATEGORY_LIMITS``, which is applied at rule-build
#: time so operators can tune these without editing code.
DEFAULT_READ_LIMITS: dict[str, tuple[int, int]] = {
    "anonymous_api": (60, 60),
    "public_catalogue": (60, 60),
    "college_search": (30, 60),
    "course_search": (30, 60),
    "catalogue_statistics": (10, 60),
    "catalogue_listings": (60, 60),
    "media_access": (30, 60),
    "dashboard_analytics": (30, 60),
}

#: P7 student-operation limits. Mirrored by
#: ``settings.RATE_LIMIT_P7_STUDENT_LIMITS`` at rule-build time, keyed by the
#: same operation name. Every one of these is a *user-keyed* primary bucket
#: (``key_dimension="user"``); the trusted client IP is the fallback only when
#: the caller presents no valid access token.
DEFAULT_P7_STUDENT_LIMITS: dict[str, tuple[int, int]] = {
    "mock_test_start": (10, 60),
    "mock_test_answer": (60, 60),
    "mock_test_submit": (5, 600),
    "mock_test_review": (5, 3600),
    "saved_college_write": (30, 60),
    "profile_update": (10, 60),
    "consent_write": (5, 3600),
    "student_notifications": (30, 60),
}

P7_NAMESPACE_PREFIX = "p7:"

#: P8 CRM/enquiry/lead-generation limits. Mirrored by
#: ``settings.RATE_LIMIT_P8_CRM_LIMITS`` at rule-build time, keyed by the same
#: operation name. ``public_enquiry`` is the single public intake ceiling (the
#: admission, counselling and contact forms all post to the same endpoint);
#: ``lead_create`` is the higher ceiling selected by a verified staff role on
#: that same route.
DEFAULT_P8_CRM_LIMITS: dict[str, tuple[int, int]] = {
    "public_enquiry": (3, 600),
    "lead_create": (10, 60),
    "lead_update": (30, 60),
    "blog_view": (10, 3600),
}

P8_NAMESPACE_PREFIX = "p8:"

#: P9 admin-operation limits. General admin routes share one namespace and one
#: role-selected tier per route template; sensitive operations get their own
#: fixed ceiling and namespace. Mirrored by ``settings.RATE_LIMIT_P9_*`` at
#: rule-build time. Non-positive or malformed entries keep the centralized
#: default rather than unthrottling an administrator surface.
DEFAULT_P9_ROLE_LIMITS: dict[str, tuple[int, int]] = {
    "super_admin": (180, 60),
    "admin": (120, 60),
    "content_manager": (120, 60),
    "seo_manager": (90, 60),
    "counsellor": (90, 60),
}

DEFAULT_P9_UNAUTHENTICATED_ADMIN: tuple[int, int] = (10, 60)

DEFAULT_P9_SENSITIVE_LIMITS: dict[str, tuple[int, int]] = {
    "bulk_import": (5, 60),
    "media_upload": (10, 600),
    "settings_update": (10, 60),
    "ai_settings": (3, 60),
    "role_change": (5, 60),
    "user_mutation": (20, 60),
    "audit_read": (30, 60),
}

P9_NAMESPACE_PREFIX = "p9:"
P9_ADMIN_GENERAL_NAMESPACE = "p9:admin_general"
P9_ADMIN_GENERAL_CATEGORY = "admin_general"


class RouteTemplateResolver:
    """Resolves concrete request paths to registered route templates."""

    def __init__(self) -> None:
        self._built_for: int | None = None
        self._routes: list[tuple[re.Pattern[str], str, frozenset[str] | None]] = []

    def _collect(self, routes: Iterable[object], prefix: str = "") -> None:
        for route in routes:
            if isinstance(route, Mount):
                mount_path = prefix + getattr(route, "path", "")
                self._collect(getattr(route, "routes", []) or [], mount_path)
                continue
            # FastAPI wraps `include_router` results in an internal
            # `_IncludedRouter` instead of flattening them into `Route` objects.
            # Without descending into it, template resolution silently returns
            # None for every router-mounted endpoint and buckets fall back to the
            # concrete path (per-id buckets). Duck-typed so this does not depend
            # on a private class import.
            included_router = getattr(route, "original_router", None)
            if included_router is not None:
                context = getattr(route, "include_context", None)
                include_prefix = getattr(context, "prefix", "") or ""
                self._collect(
                    getattr(included_router, "routes", []) or [],
                    prefix + include_prefix,
                )
                continue
            if not isinstance(route, Route):
                continue
            path_format = prefix + getattr(route, "path_format", getattr(route, "path", ""))
            path_regex = getattr(route, "path_regex", None)
            if path_regex is None:
                continue
            methods = getattr(route, "methods", None)
            self._routes.append((path_regex, path_format, frozenset(methods) if methods else None))

    def ensure(self, request: Request) -> None:
        app = request.app
        marker = id(getattr(app, "router", app))
        if self._built_for == marker and self._routes:
            return
        self._routes = []
        router = getattr(app, "router", None)
        routes = getattr(router, "routes", None) or getattr(app, "routes", None) or []
        self._collect(routes)
        # Prefer static segments over dynamic ones so a concrete route such as
        # /api/v1/colleges/search wins over /api/v1/colleges/{college_ref}.
        # Length alone is not enough: the parameterized template is longer and
        # would otherwise capture the static path, collapsing the two buckets.
        self._routes.sort(
            key=lambda item: (
                sum(1 for seg in item[1].split("/") if seg and "{" not in seg),
                -item[1].count("{"),
                len(item[1]),
            ),
            reverse=True,
        )
        self._built_for = marker

    def resolve(self, request: Request) -> str | None:
        self.ensure(request)
        path = request.url.path
        method = request.method.upper()
        for regex, template, methods in self._routes:
            if methods and method not in methods and method != "HEAD":
                continue
            if regex.match(path):
                return template
        return None


_resolver = RouteTemplateResolver()


def reset_route_template_cache() -> None:
    global _resolver
    _resolver = RouteTemplateResolver()


def resolve_route_template(request: Request) -> str | None:
    try:
        return _resolver.resolve(request)
    except Exception:
        return None


def _write_methods_policy(
    *,
    category: str,
    namespace: str,
    limit: int,
    window_seconds: int,
    fail_closed: bool | None = None,
    exempt: bool = False,
    dimensions: tuple[str, ...] = (),
) -> RateLimitPolicy:
    return RateLimitPolicy(
        category=category,
        namespace=namespace,
        limit=limit,
        window_seconds=window_seconds,
        methods=WRITE_METHODS,
        fail_closed=fail_closed,
        exempt=exempt,
        dimensions=dimensions,
    )


def _category_policy_rule(
    pattern: str,
    category: str,
    *,
    match: str = "prefix",
    priority: int = 150,
) -> RouteRule:
    """Explicit P3.1 category classification for one write-route prefix.

    Only routes listed with this helper receive category-level IP/user
    dimensions. A route that is not listed stays unclassified rather than
    inheriting a category from a blanket fallback. Write methods only; P4 read
    coverage is defined separately by ``_read_policy_rule``.
    """
    defaults = DEFAULT_CATEGORY_POLICIES[category]
    return RouteRule(
        pattern,
        _write_methods_policy(
            category=category,
            namespace=f"cat:{category}",
            limit=int(defaults["limit"]),
            window_seconds=int(defaults["window_seconds"]),
        ),
        match=match,
        priority=priority,
    )


def _read_methods_policy(
    *,
    category: str,
    namespace: str,
    limit: int,
    window_seconds: int,
    fail_closed: bool | None = None,
    key_dimension: str = "ip",
    dimensions: tuple[str, ...] = (),
) -> RateLimitPolicy:
    return RateLimitPolicy(
        category=category,
        namespace=namespace,
        limit=limit,
        window_seconds=window_seconds,
        methods=READ_METHODS,
        fail_closed=fail_closed,
        key_dimension=key_dimension,
        dimensions=dimensions,
    )


def _read_policy_rule(
    pattern: str,
    category: str,
    *,
    match: str = "prefix",
    priority: int = 200,
    key_dimension: str = "ip",
) -> RouteRule:
    """Explicit P4 read-route classification (GET/HEAD only).

    Read rules are opt-in per route. There is deliberately no blanket GET rule:
    only templates listed in ``default_policy_rules`` are throttled. The bucket
    is the resolved route template, so query strings and concrete path values do
    not create fresh buckets.
    """
    limit, window = DEFAULT_READ_LIMITS[category]
    return RouteRule(
        pattern,
        _read_methods_policy(
            category=category,
            namespace=f"read:{category}",
            limit=int(limit),
            window_seconds=int(window),
            key_dimension=key_dimension,
        ),
        match=match,
        priority=priority,
    )


def _p7_rule(
    operation: str,
    pattern: str,
    methods: frozenset[str],
    *,
    match: str = "exact",
    priority: int = 320,
) -> RouteRule:
    """Explicit P7 student-operation classification.

    One rule per real route template. The bucket is the resolved template, so a
    concrete attempt/question/notification id never mints a fresh counter. The
    primary counter is keyed by the *verified* JWT subject (``key_dimension``
    ``user``): the same student shares one quota across devices and addresses,
    while two students behind one NAT keep independent quotas. With no valid
    access token there is no user key, and the trusted client IP is used
    instead, so an invalid/expired token cannot escape throttling.

    ``mock_test_*`` operations are classified as ``mock_test_operations``;
    everything else as ``student_operations``. Neither category applies a
    shared-IP identity counter (see ``config.RATE_LIMIT_P3_CATEGORY_IDENTITY_LIMITS``).
    """
    limit, window = DEFAULT_P7_STUDENT_LIMITS[operation]
    category = (
        "mock_test_operations"
        if operation.startswith("mock_test_")
        else "student_operations"
    )
    return RouteRule(
        pattern,
        RateLimitPolicy(
            category=category,
            namespace=f"{P7_NAMESPACE_PREFIX}{operation}",
            limit=int(limit),
            window_seconds=int(window),
            methods=methods,
            key_dimension="user",
        ),
        match=match,
        priority=priority,
    )


def _p8_rule(
    operation: str,
    pattern: str,
    methods: frozenset[str],
    *,
    match: str = "exact",
    priority: int = 330,
    key_dimension: str = "user",
    fail_closed: bool | None = None,
    role_limits: tuple[RoleLimit, ...] = (),
) -> RouteRule:
    """Explicit P8 CRM/enquiry/blog-view classification.

    One rule per real route template, so neither the record id in the path nor a
    query string can mint a fresh bucket. Lead writes are keyed by the verified
    JWT subject (IP only when no valid token is presented); the public intake
    route is keyed the same way, and additionally carries hashed phone/email
    identifier counters. ``public_enquiry`` is the only P8 rule that adds the
    ``identifier`` dimension, and it fails closed because each accepted form can
    trigger paid SMS/email and cannibalise CRM capacity.

    Blog view is keyed by a validated article reference plus the trusted IP.
    """
    limit, window = DEFAULT_P8_CRM_LIMITS[operation]
    return RouteRule(
        pattern,
        RateLimitPolicy(
            category="enquiries_crm" if operation != "blog_view" else "blog_view",
            namespace=f"{P8_NAMESPACE_PREFIX}{operation}",
            limit=int(limit),
            window_seconds=int(window),
            methods=methods,
            key_dimension=key_dimension,
            fail_closed=fail_closed,
            dimensions=("identifier",) if operation == "public_enquiry" else (),
            role_limits=role_limits,
        ),
        match=match,
        priority=priority,
    )


def _p9_role_limits() -> tuple[RoleLimit, ...]:
    """Role tiers for a general admin route, most-privileged first.

    Ordered with ``app.roles.PRIVILEGE_ORDER`` so a token carrying several roles
    always receives its highest-ranked tier. The ordering is what makes
    multi-role tokens deterministic and non-combinable: the first match wins.
    """
    return tuple(
        RoleLimit(
            namespace=P9_ADMIN_GENERAL_NAMESPACE,
            roles=frozenset({role}),
            limit=DEFAULT_P9_ROLE_LIMITS[role][0],
            window_seconds=DEFAULT_P9_ROLE_LIMITS[role][1],
        )
        for role in sorted(DEFAULT_P9_ROLE_LIMITS, key=rank)
    )


def _p9_general_policy(
    methods: frozenset[str], *, fail_closed: bool | None
) -> RateLimitPolicy:
    """Base policy for an administrative route.

    The base limit is deliberately the *unauthenticated* ceiling, not the
    loosest admin tier: a caller is only promoted to ``180/min`` (or another
    role tier) when it presents a valid access token whose verified role claim
    matches. The primary bucket is the verified JWT subject, so one
    administrator's quota is shared across their addresses while two
    administrators behind the same office NAT stay independent.
    """
    limit, window = DEFAULT_P9_UNAUTHENTICATED_ADMIN
    return RateLimitPolicy(
        category=P9_ADMIN_GENERAL_CATEGORY,
        namespace=P9_ADMIN_GENERAL_NAMESPACE,
        limit=limit,
        window_seconds=window,
        methods=methods,
        key_dimension="user",
        fail_closed=fail_closed,
        role_limits=_p9_role_limits(),
    )


def _p9_general_rule(
    pattern: str,
    methods: frozenset[str],
    *,
    match: str = "prefix",
    priority: int = 200,
    fail_closed: bool | None = True,
) -> RouteRule:
    """Explicit P9 general-admin classification (read or write).

    Writes use ``priority=200``: they override the broad P3 category rules
    (150) but stay below P7/P8 student rules and the sensitive P9 rules, so the
    shared student/admin routes keep their stricter operation limits. Reads use
    ``priority=300``: they override a pre-P9 public read rule only where the
    route is genuinely staff-guarded (the SEO reads are the one such case).
    """
    return RouteRule(
        pattern,
        _p9_general_policy(methods, fail_closed=fail_closed),
        match=match,
        priority=priority,
    )


def _p9_body_tier(operation: str, field: str) -> BodyTier:
    """Body-selected stricter tier for one fixed request field."""
    limit, window = DEFAULT_P9_SENSITIVE_LIMITS[operation]
    return BodyTier(
        field=field,
        namespace=f"{P9_NAMESPACE_PREFIX}{operation}",
        category=f"admin_{operation}",
        limit=limit,
        window_seconds=window,
    )


def _p9_sensitive_rule(
    operation: str,
    pattern: str,
    methods: frozenset[str],
    *,
    match: str = "exact",
    priority: int = 340,
    fail_closed: bool | None = True,
    body_tiers: tuple[BodyTier, ...] = (),
) -> RouteRule:
    """Explicit P9 sensitive-operation classification.

    One namespace per operation, keyed by the verified JWT subject (trusted IP
    only when no valid token is presented). Sensitive mutations set
    ``fail_closed=True``: a Redis outage must not become an unbounded bulk
    import, upload, settings rewrite or privilege change. The audit-log read is
    read-only and keeps the global fail policy; it is not a mutation.
    """
    limit, window = DEFAULT_P9_SENSITIVE_LIMITS[operation]
    return RouteRule(
        pattern,
        RateLimitPolicy(
            category=f"admin_{operation}",
            namespace=f"{P9_NAMESPACE_PREFIX}{operation}",
            limit=limit,
            window_seconds=window,
            methods=methods,
            key_dimension="user",
            fail_closed=fail_closed,
            body_tiers=body_tiers,
        ),
        match=match,
        priority=priority,
    )


@lru_cache(maxsize=1)
def default_policy_rules() -> tuple[RouteRule, ...]:
    """Default P2-compatible rule set.

    Preserves existing effective limits/coverage exactly for currently protected
    endpoints while providing centralized, extensible policy definitions.
    """
    # P3: auth routes get additive IP/user/category/identifier dimensions while
    # preserving existing route-level limits/namespaces and fail-closed behavior.
    auth_tight = _write_methods_policy(
        category="authentication",
        namespace="auth",
        limit=5,
        window_seconds=60,
        fail_closed=True,
        dimensions=("ip", "identifier"),
    )
    auth_generous = _write_methods_policy(
        category="authentication",
        namespace="auth",
        limit=20,
        window_seconds=60,
        fail_closed=True,
        dimensions=("ip", "identifier"),
    )
    rules: list[RouteRule] = [
        # Exact auth overrides (current tight set)
        RouteRule("/api/v1/auth/login", auth_tight, priority=300),
        RouteRule("/api/v1/auth/register", auth_tight, priority=300),
        RouteRule("/api/v1/auth/refresh", auth_tight, priority=300),
        RouteRule("/api/v1/auth/login/otp/verify", auth_tight, priority=300),
        # Existing public write limits (write methods only in P2 for compatibility)
        RouteRule(
            "/api/v1/enquiries",
            _write_methods_policy(
                category="enquiries_crm", namespace="/api/v1/enquiries", limit=5, window_seconds=3600
            ),
            match="prefix",
            priority=250,
        ),
        # P8 - public intake / CRM lead generation. The admission, counselling
        # and contact forms are all the same endpoint, so they share the
        # stricter ``public_enquiry`` ceiling. A verified staff role (signed JWT
        # claim; authorization remains the endpoint's own) selects
        # ``lead_create`` instead, so the admin console's "add lead" action is
        # not held to the public form limit.
        _p8_rule(
            "public_enquiry",
            "/api/v1/enquiries",
            frozenset({"POST"}),
            fail_closed=True,
            role_limits=(
                RoleLimit(
                    namespace=f"{P8_NAMESPACE_PREFIX}lead_create",
                    roles=frozenset(LEAD_ROLES),
                    limit=DEFAULT_P8_CRM_LIMITS["lead_create"][0],
                    window_seconds=DEFAULT_P8_CRM_LIMITS["lead_create"][1],
                ),
            ),
        ),
        # Lead updates: note, status, follow-up, details, assignment and delete.
        # Every pattern is a real template from `routers/leads.py`; the record id
        # stays in the template, so all leads share one per-user quota.
        _p8_rule(
            "lead_update", "/api/v1/leads/{enquiry_id}/notes", frozenset({"POST"})
        ),
        _p8_rule(
            "lead_update", "/api/v1/leads/{enquiry_id}/status", frozenset({"PATCH"})
        ),
        _p8_rule(
            "lead_update",
            "/api/v1/leads/{enquiry_id}/follow-up",
            frozenset({"PATCH"}),
        ),
        _p8_rule(
            "lead_update", "/api/v1/leads/{enquiry_id}/details", frozenset({"PATCH"})
        ),
        _p8_rule(
            "lead_update", "/api/v1/leads/{enquiry_id}/assign", frozenset({"PATCH"})
        ),
        _p8_rule(
            "lead_update", "/api/v1/leads/{enquiry_id}", frozenset({"DELETE"})
        ),
        # Blog view tracking: POST only, never the GET read path. The primary
        # bucket is article + trusted IP; the article ref is validated and
        # hashed in the middleware so arbitrary refs collapse into one bounded
        # bucket and query strings never create a new one.
        _p8_rule(
            "blog_view",
            "/api/v1/blogs/{blog_ref}/view",
            frozenset({"POST"}),
            key_dimension="article",
        ),
        # P9 - role-based general admin ceilings. These prefixes contain only
        # staff-guarded write handlers. Where a prefix also carries a
        # public/student write, a higher-priority P7/P8 rule wins:
        #   /blogs/{ref}/view -> P8 blog_view (330)
        #   /mock-tests/{ref}/start|submit|answers -> P7 (320)
        #   /notifications/{id}/read|my/read-all|{id} delete -> P7 (320)
        # The shared /college-submissions and /reviews write surfaces are listed
        # individually below so their public/owner writes stay unclassified.
        _p9_general_rule("/api/v1/banners", WRITE_METHODS),
        # Blog categories live on the same router but at a sibling path; the
        # public GET keeps its P4 read rule.
        _p9_general_rule("/api/v1/blog-categories", WRITE_METHODS),
        _p9_general_rule("/api/v1/blogs", WRITE_METHODS),
        _p9_general_rule("/api/v1/colleges", WRITE_METHODS),
        _p9_general_rule("/api/v1/courses", WRITE_METHODS),
        _p9_general_rule("/api/v1/exams", WRITE_METHODS),
        _p9_general_rule("/api/v1/faqs", WRITE_METHODS),
        _p9_general_rule("/api/v1/mock-tests", WRITE_METHODS),
        _p9_general_rule("/api/v1/notifications", WRITE_METHODS),
        _p9_general_rule("/api/v1/question-imports", WRITE_METHODS),
        _p9_general_rule("/api/v1/questions", WRITE_METHODS),
        _p9_general_rule("/api/v1/scholarships", WRITE_METHODS),
        _p9_general_rule("/api/v1/seo", WRITE_METHODS),
        _p9_general_rule("/api/v1/universities", WRITE_METHODS),
        # Staff-only writes whose router also serves a public/owner action, so a
        # prefix rule would throttle the wrong caller.
        _p9_general_rule(
            "/api/v1/college-submissions/{submission_id}/approve",
            frozenset({"POST"}),
            match="exact",
        ),
        _p9_general_rule(
            "/api/v1/college-submissions/{submission_id}/reject",
            frozenset({"POST"}),
            match="exact",
        ),
        _p9_general_rule(
            "/api/v1/college-submissions/{submission_id}/request-changes",
            frozenset({"POST"}),
            match="exact",
        ),
        _p9_general_rule(
            "/api/v1/compliance/admin/requests/{request_id}",
            frozenset({"PATCH"}),
            match="exact",
        ),
        _p9_general_rule(
            "/api/v1/reviews/{review_id}/moderate", frozenset({"POST"}), match="exact"
        ),
        _p9_general_rule(
            "/api/v1/reviews/{review_id}", frozenset({"DELETE"}), match="exact"
        ),
        # P9 - sensitive operations. Fixed ceilings regardless of role, per-user
        # buckets, fail closed for mutations. The PDF/Gemini import is
        # deliberately absent: P6's stricter 3/min rule (priority 300) remains
        # authoritative and must not be widened to the bulk-import ceiling.
        _p9_sensitive_rule(
            "bulk_import",
            "/api/v1/question-imports/{job_id}/review-all",
            frozenset({"POST"}),
            priority=280,
        ),
        _p9_sensitive_rule(
            "media_upload",
            "/api/v1/media/upload",
            frozenset({"POST"}),
            priority=340,
        ),
        _p9_sensitive_rule(
            "settings_update", "/api/v1/settings", frozenset({"PUT"}), priority=340
        ),
        _p9_sensitive_rule(
            "ai_settings", "/api/v1/settings/ai", frozenset({"PUT"}), priority=350
        ),
        _p9_sensitive_rule(
            "ai_settings",
            "/api/v1/settings/ai/test",
            frozenset({"POST"}),
            priority=350,
        ),
        _p9_sensitive_rule(
            "user_mutation",
            "/api/v1/users/{user_id}",
            frozenset({"PATCH"}),
            priority=340,
            body_tiers=(_p9_body_tier("role_change", "role_ids"),),
        ),
        _p9_sensitive_rule(
            "audit_read",
            "/api/v1/audit-logs",
            READ_METHODS,
            priority=350,
            fail_closed=None,
        ),
        # P9 - staff read surfaces that had no read policy. Drafted as exact
        # templates where the router also has a public/student read (users/me,
        # notifications/my, submissions/my, reviews/my, reviews/college). The
        # SEO reads are staff-only, so their P9 role tier deliberately replaces
        # the pre-P9 public read rule.
        _p9_general_rule(
            "/api/v1/users", READ_METHODS, match="exact", priority=300, fail_closed=None
        ),
        _p9_general_rule(
            "/api/v1/users/{user_id}",
            READ_METHODS,
            match="exact",
            priority=300,
            fail_closed=None,
        ),
        _p9_general_rule(
            "/api/v1/users/admin-only",
            READ_METHODS,
            match="exact",
            priority=300,
            fail_closed=None,
        ),
        _p9_general_rule(
            "/api/v1/roles", READ_METHODS, match="exact", priority=300, fail_closed=None
        ),
        _p9_general_rule(
            "/api/v1/enquiries",
            READ_METHODS,
            match="exact",
            priority=300,
            fail_closed=None,
        ),
        _p9_general_rule(
            "/api/v1/leads", READ_METHODS, match="exact", priority=300, fail_closed=None
        ),
        _p9_general_rule(
            "/api/v1/leads/{enquiry_id}",
            READ_METHODS,
            match="exact",
            priority=300,
            fail_closed=None,
        ),
        _p9_general_rule(
            "/api/v1/notifications",
            READ_METHODS,
            match="exact",
            priority=300,
            fail_closed=None,
        ),
        _p9_general_rule(
            "/api/v1/notifications/sends",
            READ_METHODS,
            match="exact",
            priority=300,
            fail_closed=None,
        ),
        _p9_general_rule(
            "/api/v1/counsellors",
            READ_METHODS,
            match="exact",
            priority=300,
            fail_closed=None,
        ),
        _p9_general_rule(
            "/api/v1/compliance/admin/requests",
            READ_METHODS,
            match="exact",
            priority=300,
            fail_closed=None,
        ),
        _p9_general_rule(
            "/api/v1/college-submissions",
            READ_METHODS,
            match="exact",
            priority=300,
            fail_closed=None,
        ),
        _p9_general_rule(
            "/api/v1/reviews/moderation",
            READ_METHODS,
            match="exact",
            priority=300,
            fail_closed=None,
        ),
        _p9_general_rule(
            "/api/v1/mock-tests/admin",
            READ_METHODS,
            priority=300,
            fail_closed=None,
        ),
        _p9_general_rule(
            "/api/v1/questions", READ_METHODS, priority=300, fail_closed=None
        ),
        _p9_general_rule(
            "/api/v1/question-imports", READ_METHODS, priority=300, fail_closed=None
        ),
        _p9_general_rule("/api/v1/seo", READ_METHODS, priority=300, fail_closed=None),
        _p9_general_rule(
            "/api/v1/settings",
            READ_METHODS,
            match="exact",
            priority=300,
            fail_closed=None,
        ),
        _p9_general_rule(
            "/api/v1/settings/ai",
            READ_METHODS,
            match="exact",
            priority=300,
            fail_closed=None,
        ),
        RouteRule(
            "/api/v1/predictor",
            _write_methods_policy(
                category="ai_predictor", namespace="/api/v1/predictor", limit=10, window_seconds=60
            ),
            match="prefix",
            priority=250,
        ),
        # Write-method stats rule preserved for compatibility; the P4 read rule
        # below now handles GET/HEAD on the same route.
        RouteRule(
            "/api/v1/stats/catalog",
            _write_methods_policy(
                category="public_catalogue", namespace="/api/v1/stats/catalog", limit=60, window_seconds=60
            ),
            match="exact",
            priority=250,
        ),
        RouteRule(
            "/api/v1/ai/chat",
            _write_methods_policy(
                category="ai_operations",
                namespace="/api/v1/ai/chat",
                limit=10,
                window_seconds=60,
                fail_closed=True,
            ),
            match="prefix",
            priority=250,
        ),
        # P6 — the PDF/Gemini import is the only paid question-generation path.
        # Exact match so the other question-import write routes keep their
        # admin_operations policy. Fail closed: a Redis outage must not become
        # unbounded provider spend.
        RouteRule(
            "/api/v1/question-imports/pdf",
            _write_methods_policy(
                category="ai_question_generation",
                namespace="/api/v1/question-imports/pdf",
                limit=3,
                window_seconds=60,
                fail_closed=True,
            ),
            match="exact",
            priority=300,
        ),
        # P3.1 explicit category classification. Only these routes receive
        # category-level IP/user dimensions; unlisted routes stay unclassified.
        # Write methods only: global GET enforcement remains deferred.
        _category_policy_rule("/api/v1/ai", "ai_operations"),
        _category_policy_rule("/api/v1/media", "file_uploads"),
        _category_policy_rule("/api/v1/users/me", "authenticated_api"),
        _category_policy_rule("/api/v1/saved-colleges", "authenticated_api"),
        _category_policy_rule("/api/v1/consent", "authenticated_api"),
        _category_policy_rule("/api/v1/notifications/my", "authenticated_api"),
        _category_policy_rule(
            "/api/v1/notifications/{notification_id}/read",
            "authenticated_api",
            match="exact",
        ),
        _category_policy_rule(
            "/api/v1/blogs/{blog_ref}/view", "anonymous_api", match="exact"
        ),
        _category_policy_rule("/api/v1/admin", "admin_operations"),
        _category_policy_rule("/api/v1/settings", "admin_operations"),
        _category_policy_rule("/api/v1/audit-logs", "admin_operations"),
        _category_policy_rule("/api/v1/roles", "admin_operations"),
        _category_policy_rule("/api/v1/question-imports", "admin_operations"),
        # P4 explicit read-route classification (GET/HEAD only). There is no
        # blanket GET rule: unlisted routes stay unthrottled. More specific
        # rules carry higher priority, so e.g. /colleges/search (30/min) beats
        # the broad /colleges catalogue rule (60/min).
        _read_policy_rule(
            "/api/v1/colleges/search", "college_search", match="exact", priority=400
        ),
        _read_policy_rule("/api/v1/courses", "course_search", priority=350),
        _read_policy_rule("/api/v1/stats", "catalogue_statistics", priority=350),
        _read_policy_rule(
            "/api/v1/admin/analytics",
            "dashboard_analytics",
            priority=350,
            key_dimension="user",
        ),
        _read_policy_rule("/api/v1/media", "media_access", priority=300),
        _read_policy_rule("/api/v1/universities", "catalogue_listings", priority=250),
        _read_policy_rule("/api/v1/scholarships", "catalogue_listings", priority=250),
        _read_policy_rule("/api/v1/exams", "catalogue_listings", priority=250),
        _read_policy_rule(
            "/api/v1/mock-tests", "catalogue_listings", match="exact", priority=250
        ),
        _read_policy_rule("/api/v1/colleges", "public_catalogue", priority=200),
        _read_policy_rule("/api/v1/cutoffs", "public_catalogue", priority=200),
        _read_policy_rule("/api/v1/fees", "public_catalogue", priority=200),
        _read_policy_rule("/api/v1/placements", "public_catalogue", priority=200),
        _read_policy_rule("/api/v1/rankings", "public_catalogue", priority=200),
        _read_policy_rule("/api/v1/seat-matrix", "public_catalogue", priority=200),
        _read_policy_rule("/api/v1/admissions", "public_catalogue", priority=200),
        _read_policy_rule("/api/v1/locations", "anonymous_api", priority=200),
        _read_policy_rule("/api/v1/faqs", "anonymous_api", priority=200),
        _read_policy_rule("/api/v1/blogs", "anonymous_api", priority=200),
        _read_policy_rule("/api/v1/blog-categories", "anonymous_api", priority=200),
        _read_policy_rule("/api/v1/banners", "anonymous_api", priority=200),
        _read_policy_rule("/api/v1/seo", "anonymous_api", priority=200),
        _read_policy_rule("/api/v1/reviews/college", "anonymous_api", priority=200),
        # P7 explicit student-operation and mock-test limits. Each rule targets
        # a real registered template; the limiter buckets on that template so
        # ids and query strings never create per-object counters. The read rule
        # for "test review" is the result endpoint, *not* the attempt-detail
        # endpoint the runner polls as its authoritative clock.
        _p7_rule(
            "mock_test_start",
            "/api/v1/mock-tests/{mock_test_ref}/start",
            frozenset({"POST"}),
        ),
        _p7_rule(
            "mock_test_answer",
            "/api/v1/mock-tests/{mock_test_ref}/attempts/{attempt_id}/answers/{question_id}",
            frozenset({"PUT"}),
        ),
        # Both final-submit surfaces are capped. They are separate templates,
        # so each carries its own bucket, and both remain idempotent inside the
        # router (re-submitting a graded attempt returns the stored result).
        _p7_rule(
            "mock_test_submit",
            "/api/v1/mock-tests/{mock_test_ref}/submit",
            frozenset({"POST"}),
        ),
        _p7_rule(
            "mock_test_submit",
            "/api/v1/mock-tests/{mock_test_ref}/attempts/{attempt_id}/submit",
            frozenset({"POST"}),
        ),
        _p7_rule(
            "mock_test_review",
            "/api/v1/mock-tests/{mock_test_ref}/attempts/{attempt_id}/result",
            frozenset({"GET"}),
        ),
        _p7_rule(
            "saved_college_write", "/api/v1/saved-colleges", frozenset({"POST"})
        ),
        _p7_rule(
            "saved_college_write",
            "/api/v1/saved-colleges/{college_id}",
            frozenset({"DELETE"}),
        ),
        _p7_rule("profile_update", "/api/v1/users/me", frozenset({"PUT"})),
        _p7_rule("consent_write", "/api/v1/consent", frozenset({"POST"})),
        _p7_rule(
            "consent_write",
            "/api/v1/consent/{consent_id}",
            frozenset({"PATCH"}),
        ),
        _p7_rule(
            "consent_write", "/api/v1/compliance/age", frozenset({"POST"})
        ),
        _p7_rule(
            "consent_write",
            "/api/v1/compliance/parental-consent",
            frozenset({"POST"}),
        ),
        _p7_rule(
            "consent_write",
            "/api/v1/compliance/parental-consent/verify",
            frozenset({"POST"}),
        ),
        _p7_rule(
            "consent_write",
            "/api/v1/compliance/parental-consent/withdraw",
            frozenset({"POST"}),
        ),
        _p7_rule(
            "consent_write", "/api/v1/compliance/requests", frozenset({"POST"})
        ),
        _p7_rule(
            "student_notifications",
            "/api/v1/notifications/my",
            frozenset({"GET"}),
        ),
        _p7_rule(
            "student_notifications",
            "/api/v1/notifications/my/unread-count",
            frozenset({"GET"}),
        ),
        _p7_rule(
            "student_notifications",
            "/api/v1/notifications/my/read-all",
            frozenset({"PUT"}),
        ),
        _p7_rule(
            "student_notifications",
            "/api/v1/notifications/{notification_id}/read",
            frozenset({"PUT"}),
        ),
        _p7_rule(
            "student_notifications",
            "/api/v1/notifications/{notification_id}",
            frozenset({"DELETE"}),
        ),
        # Generous fallback for remaining auth writes
        RouteRule("/api/v1/auth", auth_generous, match="prefix", priority=200),
    ]
    # Deterministic resolution: highest priority first, then longest pattern.
    rules.sort(key=lambda r: (r.priority, len(r.pattern)), reverse=True)
    return tuple(rules)


def _apply_read_limit_config(rule: RouteRule, read_limits: dict) -> RouteRule:
    """Apply configured read-category limit/window to a default read rule.

    Only GET/HEAD rules are touched; write policies keep their own limits. This
    is how ``settings.RATE_LIMIT_READ_CATEGORY_LIMITS`` stays authoritative
    without rebuilding the default rule set on every request.
    """
    if rule.policy.methods != READ_METHODS:
        return rule
    cfg = read_limits.get(rule.policy.category)
    if not isinstance(cfg, dict):
        return rule
    try:
        limit = int(cfg.get("limit", rule.policy.limit))
        window = int(cfg.get("window_seconds", rule.policy.window_seconds))
    except (TypeError, ValueError):
        return rule
    if limit <= 0 or window <= 0:
        return rule
    if limit == rule.policy.limit and window == rule.policy.window_seconds:
        return rule
    return RouteRule(
        pattern=rule.pattern,
        policy=replace(rule.policy, limit=limit, window_seconds=window),
        methods=rule.methods,
        match=rule.match,
        priority=rule.priority,
        _compiled=rule._compiled,
    )


def _apply_write_limit_config(rule: RouteRule, category_limits: dict, categories: set[str]) -> RouteRule:
    """Apply a configured category limit/window to an opted-in write rule.

    Only categories listed in ``RATE_LIMIT_WRITE_LIMIT_CONFIG_CATEGORIES`` are
    touched. The hand-tuned auth/enquiry rules keep their own numbers; this is
    how P6's cost-bearing AI ceilings stay configurable without altering P2/P3
    behaviour.
    """
    if rule.policy.methods != WRITE_METHODS:
        return rule
    if rule.policy.category not in categories:
        return rule
    cfg = category_limits.get(rule.policy.category)
    if not isinstance(cfg, dict):
        return rule
    try:
        limit = int(cfg.get("limit", rule.policy.limit))
        window = int(cfg.get("window_seconds", rule.policy.window_seconds))
    except (TypeError, ValueError):
        return rule
    if limit <= 0 or window <= 0:
        return rule
    if limit == rule.policy.limit and window == rule.policy.window_seconds:
        return rule
    return RouteRule(
        pattern=rule.pattern,
        policy=replace(rule.policy, limit=limit, window_seconds=window),
        methods=rule.methods,
        match=rule.match,
        priority=rule.priority,
        _compiled=rule._compiled,
    )


def _apply_p7_limit_config(rule: RouteRule, p7_limits: dict) -> RouteRule:
    """Apply the configured limit/window to a P7 student-operation rule.

    The operation name is encoded in the namespace (``p7:<operation>``), so the
    mapping needs no second table. A non-positive limit is honoured as a disable
    (``is_active`` is False, so the route is not throttled); a malformed entry
    leaves the centralized default in place rather than silently unthrottling.
    """
    namespace = rule.policy.namespace
    if not namespace.startswith(P7_NAMESPACE_PREFIX):
        return rule
    operation = namespace[len(P7_NAMESPACE_PREFIX) :]
    cfg = p7_limits.get(operation)
    if not isinstance(cfg, dict):
        return rule
    try:
        limit = int(cfg.get("limit", rule.policy.limit))
        window = int(cfg.get("window_seconds", rule.policy.window_seconds))
    except (TypeError, ValueError):
        return rule
    if limit == rule.policy.limit and window == rule.policy.window_seconds:
        return rule
    return RouteRule(
        pattern=rule.pattern,
        policy=replace(rule.policy, limit=limit, window_seconds=window),
        methods=rule.methods,
        match=rule.match,
        priority=rule.priority,
        _compiled=rule._compiled,
    )


def _apply_p8_limit_config(rule: RouteRule, p8_limits: dict) -> RouteRule:
    """Apply configured limits to a P8 rule and its role-selected alternatives.

    Non-positive or malformed values leave the centralized default in place:
    these routes can trigger paid notifications or CRM writes, so a bad
    configuration entry must not silently unthrottle them. The shared intake
    route carries a second (role-selected) namespace, which is tuned from the
    same table by its own operation name.
    """
    policy = rule.policy
    if not policy.namespace.startswith(P8_NAMESPACE_PREFIX):
        return rule

    def configured(operation: str, limit: int, window: int) -> tuple[int, int]:
        cfg = p8_limits.get(operation)
        if not isinstance(cfg, dict):
            return limit, window
        try:
            new_limit = int(cfg.get("limit", limit))
            new_window = int(cfg.get("window_seconds", window))
        except (TypeError, ValueError):
            return limit, window
        if new_limit <= 0 or new_window <= 0:
            return limit, window
        return new_limit, new_window

    operation = policy.namespace[len(P8_NAMESPACE_PREFIX) :]
    limit, window = configured(operation, policy.limit, policy.window_seconds)
    role_limits: list[RoleLimit] = []
    for role_limit in policy.role_limits:
        role_operation = (
            role_limit.namespace[len(P8_NAMESPACE_PREFIX) :]
            if role_limit.namespace.startswith(P8_NAMESPACE_PREFIX)
            else ""
        )
        role_limit_value, role_window = configured(
            role_operation, role_limit.limit, role_limit.window_seconds
        )
        role_limits.append(
            replace(
                role_limit,
                limit=role_limit_value,
                window_seconds=role_window,
            )
        )
    if (
        limit == policy.limit
        and window == policy.window_seconds
        and tuple(role_limits) == policy.role_limits
    ):
        return rule
    return RouteRule(
        pattern=rule.pattern,
        policy=replace(
            policy,
            limit=limit,
            window_seconds=window,
            role_limits=tuple(role_limits),
        ),
        methods=rule.methods,
        match=rule.match,
        priority=rule.priority,
        _compiled=rule._compiled,
    )


def _apply_p9_limit_config(
    rule: RouteRule,
    role_limits_cfg: dict,
    sensitive_cfg: dict,
    unauth_cfg: dict,
) -> RouteRule:
    """Apply configured limits to a P9 general or sensitive rule.

    Non-positive or malformed values leave the centralized default in place:
    these are administrator surfaces and cost/privilege-bearing operations, so a
    bad configuration entry must never silently unthrottle one. The general
    admin base and each role tier are tuned independently; sensitive operations
    (including the body-selected ``role_change`` tier) are tuned by operation
    name.
    """
    policy = rule.policy
    if not policy.namespace.startswith(P9_NAMESPACE_PREFIX):
        return rule

    def configured(cfg: object, limit: int, window: int) -> tuple[int, int]:
        if not isinstance(cfg, dict):
            return limit, window
        try:
            new_limit = int(cfg.get("limit", limit))
            new_window = int(cfg.get("window_seconds", window))
        except (TypeError, ValueError):
            return limit, window
        if new_limit <= 0 or new_window <= 0:
            return limit, window
        return new_limit, new_window

    if policy.namespace == P9_ADMIN_GENERAL_NAMESPACE:
        limit, window = configured(
            unauth_cfg, policy.limit, policy.window_seconds
        )
        role_limits: list[RoleLimit] = []
        for role_limit in policy.role_limits:
            role_name = next(iter(role_limit.roles), "")
            role_value, role_window = configured(
                role_limits_cfg.get(role_name),
                role_limit.limit,
                role_limit.window_seconds,
            )
            role_limits.append(
                replace(
                    role_limit,
                    limit=role_value,
                    window_seconds=role_window,
                )
            )
        if (
            limit == policy.limit
            and window == policy.window_seconds
            and tuple(role_limits) == policy.role_limits
        ):
            return rule
        return RouteRule(
            pattern=rule.pattern,
            policy=replace(
                policy,
                limit=limit,
                window_seconds=window,
                role_limits=tuple(role_limits),
            ),
            methods=rule.methods,
            match=rule.match,
            priority=rule.priority,
            _compiled=rule._compiled,
        )

    operation = policy.namespace[len(P9_NAMESPACE_PREFIX) :]
    limit, window = configured(
        sensitive_cfg.get(operation), policy.limit, policy.window_seconds
    )
    body_tiers: list[BodyTier] = []
    for body_tier in policy.body_tiers:
        body_operation = (
            body_tier.namespace[len(P9_NAMESPACE_PREFIX) :]
            if body_tier.namespace.startswith(P9_NAMESPACE_PREFIX)
            else operation
        )
        tier_limit, tier_window = configured(
            sensitive_cfg.get(body_operation),
            body_tier.limit,
            body_tier.window_seconds,
        )
        body_tiers.append(
            replace(
                body_tier,
                limit=tier_limit,
                window_seconds=tier_window,
            )
        )
    if (
        limit == policy.limit
        and window == policy.window_seconds
        and tuple(body_tiers) == policy.body_tiers
    ):
        return rule
    return RouteRule(
        pattern=rule.pattern,
        policy=replace(
            policy,
            limit=limit,
            window_seconds=window,
            body_tiers=tuple(body_tiers),
        ),
        methods=rule.methods,
        match=rule.match,
        priority=rule.priority,
        _compiled=rule._compiled,
    )


def build_runtime_rules(settings_obj) -> list[RouteRule]:
    """Build effective rules from defaults plus optional config hooks.

    Config hooks are intentionally generic so future phases/endpoints can be
    added without changing middleware code.
    """
    rules = list(default_policy_rules())

    # Configured read-category limits override the centralized defaults.
    read_limits = getattr(settings_obj, "RATE_LIMIT_READ_CATEGORY_LIMITS", None) or {}
    if read_limits:
        rules = [_apply_read_limit_config(rule, read_limits) for rule in rules]

    # Configured write-category limits override only the opt-in categories.
    write_limits = getattr(settings_obj, "RATE_LIMIT_CATEGORY_DEFAULTS", None) or {}
    write_categories = set(
        getattr(settings_obj, "RATE_LIMIT_WRITE_LIMIT_CONFIG_CATEGORIES", []) or []
    )
    if write_limits and write_categories:
        rules = [
            _apply_write_limit_config(rule, write_limits, write_categories)
            for rule in rules
        ]

    # P7: per-operation student/mock-test limits are operator-tunable.
    p7_limits = getattr(settings_obj, "RATE_LIMIT_P7_STUDENT_LIMITS", None) or {}
    if p7_limits:
        rules = [_apply_p7_limit_config(rule, p7_limits) for rule in rules]

    # P8: per-operation CRM/enquiry/blog-view limits are operator-tunable.
    p8_limits = getattr(settings_obj, "RATE_LIMIT_P8_CRM_LIMITS", None) or {}
    if p8_limits:
        rules = [_apply_p8_limit_config(rule, p8_limits) for rule in rules]

    # P9: general admin role/base tiers and sensitive-operation ceilings are
    # operator-tunable. Non-positive/malformed entries keep the defaults.
    p9_role_limits = getattr(settings_obj, "RATE_LIMIT_P9_ROLE_LIMITS", None) or {}
    p9_sensitive_limits = (
        getattr(settings_obj, "RATE_LIMIT_P9_SENSITIVE_LIMITS", None) or {}
    )
    p9_unauthenticated = (
        getattr(settings_obj, "RATE_LIMIT_P9_UNAUTHENTICATED_ADMIN", None) or {}
    )
    if p9_role_limits or p9_sensitive_limits or p9_unauthenticated:
        rules = [
            _apply_p9_limit_config(
                rule,
                p9_role_limits,
                p9_sensitive_limits,
                p9_unauthenticated,
            )
            for rule in rules
        ]

    # Optional exact overrides: {"/path": {"limit":..,"window_seconds":..,"methods":[..],"category":..,"namespace":..,"enabled":..,"fail_closed":..}}
    overrides = getattr(settings_obj, "RATE_LIMIT_EXACT_OVERRIDES", None) or {}
    for pattern, cfg in overrides.items():
        if not isinstance(cfg, dict):
            continue
        methods = frozenset(m.upper() for m in cfg.get("methods", list(WRITE_METHODS)))
        policy = RateLimitPolicy(
            category=str(cfg.get("category", "override")),
            namespace=str(cfg.get("namespace", pattern)),
            limit=int(cfg.get("limit", 0)),
            window_seconds=int(cfg.get("window_seconds", 60)),
            methods=methods or WRITE_METHODS,
            enabled=bool(cfg.get("enabled", True)),
            fail_closed=cfg.get("fail_closed"),
            exempt=bool(cfg.get("exempt", False)),
            dimensions=tuple(cfg.get("dimensions", ()) or ()),
            key_dimension=str(cfg.get("key_dimension", "ip")),
        )
        rules.append(RouteRule(pattern=str(pattern), policy=policy, match=str(cfg.get("match", "exact")), priority=int(cfg.get("priority", 400))))

    # Optional prefix overrides list: [{"pattern":..., "limit":..., "window_seconds":..., "methods":[...], ...}]
    prefix_overrides = getattr(settings_obj, "RATE_LIMIT_PREFIX_OVERRIDES", None) or []
    for cfg in prefix_overrides:
        if not isinstance(cfg, dict) or not cfg.get("pattern"):
            continue
        methods = frozenset(m.upper() for m in cfg.get("methods", list(WRITE_METHODS)))
        pattern = str(cfg["pattern"])
        policy = RateLimitPolicy(
            category=str(cfg.get("category", "override")),
            namespace=str(cfg.get("namespace", pattern)),
            limit=int(cfg.get("limit", 0)),
            window_seconds=int(cfg.get("window_seconds", 60)),
            methods=methods or WRITE_METHODS,
            enabled=bool(cfg.get("enabled", True)),
            fail_closed=cfg.get("fail_closed"),
            exempt=bool(cfg.get("exempt", False)),
            dimensions=tuple(cfg.get("dimensions", ()) or ()),
            key_dimension=str(cfg.get("key_dimension", "ip")),
        )
        rules.append(RouteRule(pattern=pattern, policy=policy, match=str(cfg.get("match", "prefix")), priority=int(cfg.get("priority", 350))))

    # Validate/conflict guard: same exact (pattern, match, sorted methods) keep highest priority rule only.
    dedup: dict[tuple[str, str, tuple[str, ...]], RouteRule] = {}
    for rule in sorted(rules, key=lambda r: (r.priority, len(r.pattern))):
        key = (rule.pattern, rule.match, tuple(sorted((rule.methods or rule.policy.methods))))
        dedup[key] = rule
    resolved = list(dedup.values())
    resolved.sort(key=lambda r: (r.priority, len(r.pattern)), reverse=True)
    return resolved


def _default_fallback_policy(settings_obj) -> RateLimitPolicy | None:
    """Default fallback for unclassified requests.

    P2 keeps effective coverage unchanged by default (no new endpoint limits).
    Architecture supports a configured fallback policy for future phases.
    """
    enabled = bool(getattr(settings_obj, "RATE_LIMIT_DEFAULT_FALLBACK_ENABLED", False))
    if not enabled:
        return None
    methods = frozenset(getattr(settings_obj, "RATE_LIMIT_DEFAULT_FALLBACK_METHODS", list(WRITE_METHODS)))
    return RateLimitPolicy(
        category=str(getattr(settings_obj, "RATE_LIMIT_DEFAULT_FALLBACK_CATEGORY", "anonymous_api")),
        namespace=str(getattr(settings_obj, "RATE_LIMIT_DEFAULT_FALLBACK_NAMESPACE", "default")),
        limit=int(getattr(settings_obj, "RATE_LIMIT_DEFAULT_FALLBACK_LIMIT", 60)),
        window_seconds=int(getattr(settings_obj, "RATE_LIMIT_DEFAULT_FALLBACK_WINDOW_SECONDS", 60)),
        methods=methods or WRITE_METHODS,
        enabled=True,
        fail_closed=getattr(settings_obj, "RATE_LIMIT_DEFAULT_FALLBACK_FAIL_CLOSED", None),
    )


def resolve_rate_limit(request: Request, settings_obj) -> ResolvedRateLimit | None:
    method = request.method.upper()

    # Safe CORS preflight handling is explicit and preserved.
    exempt_methods = {m.upper() for m in getattr(settings_obj, "RATE_LIMIT_EXEMPT_METHODS", ["OPTIONS"])}
    if method in exempt_methods:
        return None

    if not bool(getattr(settings_obj, "RATE_LIMIT_POLICY_ENGINE_ENABLED", True)):
        return None

    path = request.url.path
    template = resolve_route_template(request)
    rules = build_runtime_rules(settings_obj)

    for rule in rules:
        if rule.matches(method, path, template):
            policy = rule.policy
            if not policy.applies_to_method(method):
                continue
            if policy.exempt or not policy.enabled:
                return None
            if not policy.is_active:
                return None
            bucket_path = template or policy.route_template or path
            return ResolvedRateLimit(
                namespace=policy.namespace,
                limit=policy.limit,
                window_seconds=policy.window_seconds,
                bucket_path=bucket_path,
                category=policy.category,
                fail_closed=policy.fail_closed,
                dimensions=getattr(policy, "dimensions", ()) or (),
                path=path,
                key_dimension=getattr(policy, "key_dimension", "ip"),
                role_limits=getattr(policy, "role_limits", ()) or (),
                body_tiers=getattr(policy, "body_tiers", ()) or (),
                route_template=template or policy.route_template,
            )

    fallback = _default_fallback_policy(settings_obj)
    if fallback and fallback.applies_to_method(method) and fallback.is_active:
        return ResolvedRateLimit(
            namespace=fallback.namespace,
            limit=fallback.limit,
            window_seconds=fallback.window_seconds,
            bucket_path=template or path,
            category=fallback.category,
            fail_closed=fallback.fail_closed,
            dimensions=getattr(fallback, "dimensions", ()) or (),
            path=path,
            key_dimension=getattr(fallback, "key_dimension", "ip"),
            role_limits=getattr(fallback, "role_limits", ()) or (),
            body_tiers=getattr(fallback, "body_tiers", ()) or (),
            route_template=template,
        )

    return None
