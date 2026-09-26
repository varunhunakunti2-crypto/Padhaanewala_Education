"""Canonical role vocabulary and privilege tiers.

This module is the single source of truth for role names (rule R1.1). Rules:

* R1.1 — roles come from here or from the DB, never from an inline literal.
  ``require_role("admin", "super_admin")`` is a bug; use ``require_role(*ADMIN_ROLES)``.
* R1.3 — names are lowercase snake_case and match the rows created by
  ``scripts/seed_roles.py``.
* R1.4 — tiers are strictly nested: a higher tier implies every lower one.

The ``Role`` DB model keeps ``name`` as a free-text column for migration safety,
so nothing stops a typo at runtime. ``tests/test_rbac_rules.py`` asserts that
every role referenced by a guard exists here, which turns a silent
403-for-everyone into a loud test failure.
"""

from enum import StrEnum

# --------------------------------------------------------------------------- #
# Canonical names
# --------------------------------------------------------------------------- #


class RoleName(StrEnum):
    """Every role the system recognises. Mirrors ``scripts/seed_roles.py``."""

    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    CONTENT_MANAGER = "content_manager"
    SEO_MANAGER = "seo_manager"
    DATA_MANAGER = "data_manager"
    TEST_ADMIN = "test_admin"
    PROCTOR = "proctor"
    COUNSELLOR_MANAGER = "counsellor_manager"
    COUNSELLOR = "counsellor"
    REVIEWER = "reviewer"
    SUPPORT = "support"
    ANALYTICS = "analytics"
    STUDENT = "student"
    USER = "user"


#: Every role, ordered most-privileged first. Mirrors ``seed_roles.ROLES``.
ALL_ROLES: tuple[str, ...] = tuple(role.value for role in RoleName)

#: Roles that grant no capability anywhere in the authorization layer. They exist
#: so the taxonomy is complete, but holding one is equivalent to being a student.
#: Kept explicit so nobody wires a guard to one by accident.
DEAD_ROLES: frozenset[str] = frozenset(
    {
        RoleName.DATA_MANAGER.value,
        RoleName.TEST_ADMIN.value,
        RoleName.PROCTOR.value,
        RoleName.COUNSELLOR_MANAGER.value,
        RoleName.REVIEWER.value,
        RoleName.SUPPORT.value,
        RoleName.ANALYTICS.value,
        RoleName.USER.value,
    }
)

# --------------------------------------------------------------------------- #
# Privilege tiers (R1.4) — each tier is a strict superset of the one below it
# --------------------------------------------------------------------------- #

#: T1. Destructive catalog operations: deleting a college.
SUPER_ADMIN_ROLES: tuple[str, ...] = (RoleName.SUPER_ADMIN.value,)

#: T2. User management, audit log, all catalog writes.
ADMIN_ROLES: tuple[str, ...] = (RoleName.SUPER_ADMIN.value, RoleName.ADMIN.value)

#: T3. Content lifecycle: colleges, courses, exams, scholarships, cutoffs, fees.
CONTENT_ROLES: tuple[str, ...] = ADMIN_ROLES + (RoleName.CONTENT_MANAGER.value,)

#: T4. Blog authoring on top of T3.
#: NOTE: ``"author"`` is intentionally a bare string and NOT a ``RoleName`` member
#: — ``seed_roles.py`` never creates it, so this branch is currently unreachable.
#: Either add AUTHOR to RoleName or drop it here; do not leave it ambiguous.
BLOG_ROLES: tuple[str, ...] = CONTENT_ROLES + ("author",)

#: T5. SEO metadata on top of T3.
SEO_ROLES: tuple[str, ...] = CONTENT_ROLES + (RoleName.SEO_MANAGER.value,)

#: T6. CRM: leads, scoped to assigned enquiries for counsellors.
LEAD_ROLES: tuple[str, ...] = (RoleName.SUPER_ADMIN.value, RoleName.ADMIN.value, RoleName.COUNSELLOR.value)

#: T2, plus content_manager. Historically named ``ADMIN_ROLES`` in
#: ``routers/enrichment.py`` for the same tuple this module calls CONTENT_ROLES.
ENRICHMENT_ROLES: tuple[str, ...] = CONTENT_ROLES

#: T2 only. Used by ``routers/audit.py``.
AUDIT_ROLES: tuple[str, ...] = ADMIN_ROLES

#: Roles that may open the admin console. Mirrors the frontend
#: ``ADMIN_ROLES`` in ``frontend/lib/api.ts``.
CONSOLE_ROLES: tuple[str, ...] = ADMIN_ROLES

# --------------------------------------------------------------------------- #
# Ordering (R4.8) — used to enforce the privilege ceiling
# --------------------------------------------------------------------------- #

#: Most-privileged first. Index doubles as the privilege rank.
PRIVILEGE_ORDER: tuple[str, ...] = (
    RoleName.SUPER_ADMIN.value,
    RoleName.ADMIN.value,
    RoleName.CONTENT_MANAGER.value,
    RoleName.SEO_MANAGER.value,
    RoleName.DATA_MANAGER.value,
    RoleName.COUNSELLOR_MANAGER.value,
    RoleName.TEST_ADMIN.value,
    RoleName.PROCTOR.value,
    RoleName.REVIEWER.value,
    RoleName.SUPPORT.value,
    RoleName.ANALYTICS.value,
    RoleName.COUNSELLOR.value,
    RoleName.STUDENT.value,
    RoleName.USER.value,
    "author",
)

_RANK: dict[str, int] = {name: rank for rank, name in enumerate(PRIVILEGE_ORDER)}


def rank(role_name: str) -> int:
    """Privilege rank of a role. Unknown roles rank below every known role."""
    return _RANK.get(role_name, len(PRIVILEGE_ORDER) + 1)


def outranks(caller_roles: set[str] | frozenset[str], target_role: str) -> bool:
    """True when every holder of ``caller_roles`` outranks ``target_role``.

    Enforces R4.8: a caller may never grant a role that outranks their own
    highest role. An empty caller set can never outrank anything.
    """
    if not caller_roles:
        return False
    return min(rank(r) for r in caller_roles) < rank(target_role)


def exceeds_ceiling(caller_roles: set[str] | frozenset[str], target_roles: set[str]) -> set[str]:
    """Return the subset of ``target_roles`` the caller is not allowed to grant."""
    return {r for r in target_roles if not outranks(caller_roles, r)}


def can_revoke(caller_roles: set[str] | frozenset[str], target_role: str) -> bool:
    """True when the caller may *remove* ``target_role`` from someone.

    Deliberately looser than :func:`outranks` (uses ``<=`` not ``<``). Granting is
    strictly-above-only, but revocation must also allow a peer at the caller's own
    level to be demoted — otherwise a `super_admin` could never demote another
    `super_admin`, and an `admin` could never demote a peer `admin`. The security
    property that matters is only: nobody may touch a role strictly above them.
    """
    if not caller_roles:
        return False
    return min(rank(r) for r in caller_roles) <= rank(target_role)


def exceeds_removal_ceiling(
    caller_roles: set[str] | frozenset[str], target_roles: set[str]
) -> set[str]:
    """Return the subset of ``target_roles`` the caller may not revoke."""
    return {r for r in target_roles if not can_revoke(caller_roles, r)}
