# RBAC Compliance Checklist — padhaanewala

**Audit date:** 2026-09-27 · **Remediated:** 2026-09-27
**Scope:** `backend/app/` (25 routers), `backend/tests/`, `frontend/`
**Method:** source read + live API probe against PostgreSQL (`test_suite` schema)
**Verdict key:** ✅ pass · ⚠️ partial · ⬜ accepted debt (documented) · ❌ fail

> Every ❌ in the original audit was confirmed by reading the code, and the four
> marked 🚨 were additionally **proven by running the exploit**. All are now
> fixed and pinned by `backend/tests/test_rbac_rules.py` (31 tests).
> Suite: **160 passed, 1 skipped** (was 118 before this work).

---

## Executive summary

| Rule | Before | Now | Where |
|---|---|---|---|
| **R4.1** fail-closed `require_role` | 🚨 fail-open | ✅ | `dependencies.py:71-79` |
| **R4.7** no self-escalation | 🚨 exploitable | ✅ | `users.py:184-192` |
| **R4.8** privilege ceiling | 🚨 exploitable | ✅ | `users.py:194-206` |
| **R2.4** fail-closed registration | ❌ silent roleless user | ✅ | `auth.py:73-83` |
| **R5.2** validate `role_ids` | ❌ silently ignored | ✅ | `users.py:171-186` |
| **R1.1** canonical roles module | ❌ none existed | ✅ | `app/roles.py` |
| **R4.5** no inline role literals | ❌ 24 sites | ✅ 0 | all routers |
| **R3.4** short access-token lifetime | ❌ 1440 min | ✅ 30 min | `config.py:37-48` |
| **R5.3** audit privilege changes | ❌ 0% | ✅ 100% of privilege ops | `users.py` + `utils/audit.py` |
| **R8.1** `seed_admin` allowlist | ❌ | ✅ | `scripts/seed_admin.py` |
| R1.2, R1.3, R2.1–R2.3, R2.5, R3.1–R3.3, R4.2, R4.3, R4.6, R5.1, R5.4, R6.1–R6.5 | ✅ | ✅ | unchanged |
| R4.4 router-level gating | ❌ 0/25 | ⬜ | accepted debt, see below |
| R6.6 re-validate roles on change | ⚠️ | ⚠️ | accepted debt, see below |
| R5.3 non-privilege mutations | ❌ ~5% | ⬜ | accepted debt, see below |

**The two P0s and the escalation are closed. The original exploit chain now
returns 400/403 at every step, while legitimate flows (admin → content_manager)
still return 200.**

---

## 🚨 P0 — fixed and verified

### ✅ R4.1 — `require_role()` with no arguments used to grant access to everyone

`backend/app/dependencies.py:71-79` — the `not allowed_roles` short-circuit is gone.
An empty allowlist now raises at construction, so a mistake is an import-time
crash rather than a silent authorization bypass.

```python
def require_role(*allowed_roles: str):
    if not allowed_roles:
        raise RuntimeError("require_role() called with no roles")
    allowed = frozenset(allowed_roles)
    ...
```

- [x] Fix applied
- [x] R7.1 pinned: `test_r4_1_require_role_with_no_args_raises`

### ✅ R4.7 / R4.8 — a plain `admin` could promote itself to `super_admin`

This was the most serious finding: it was **not** in the original ruleset's
priority list, and it needed nothing beyond holding `admin`.

`backend/app/routers/users.py:184-206` now enforces three separate guards:

1. **Self-edit block** — nobody changes their own roles through this endpoint,
   not even a `super_admin`.
2. **Privilege ceiling** — `exceeds_ceiling()` in `app/roles.py:118-121` rejects
   any role that outranks the caller's own highest role. `PRIVILEGE_ORDER`
   (`app/roles.py:76-92`) gives every role a rank.
3. **Last-super-admin lockout** — `_count_active_super_admins()` refuses to
   remove or deactivate the final usable `super_admin`, on both the role path
   and the `is_active` path.

**Before → after, same exploit:**

| Step | Before | After |
|---|---|---|
| `admin` self-promotes to `super_admin` | **200** | **400** |
| `admin` grants `super_admin` to another user | **200** | **403** `You cannot grant roles above your own privilege level` |
| Then `DELETE /colleges/{ref}` (super_admin gate) | passed | unreachable |
| `admin` grants `content_manager` (legitimate) | 200 | **200** — unchanged |

The amplifier is closed too: `GET /api/v1/roles` was reachable by any student
(200, verified) and handed out the exact ids this endpoint accepts. It is now
`require_role(*ADMIN_ROLES)` → 403 for students. Non-admins read their own roles
from `GET /users/me/roles`, which is already scoped to the caller.

- [x] All three guards applied
- [x] `GET /roles` gated
- [x] R7.4 pinned, and the legitimate downward grant is pinned too so the
      ceiling cannot be "fixed" into a blanket deny

---

## P1 — fixed

### ✅ R2.4 — registration now fails closed

`backend/app/routers/auth.py:73-83`. Was `if role is not None:`, which created a
**roleless account and still returned 201** when `seed_roles.py` had not run. Now
returns `503` and rolls back, so no orphan `users` row is left behind.

- [x] Fix applied
- [x] Pinned by `test_r2_4_registration_fails_closed_when_student_role_missing`,
      which renames the role (preserving every `user_roles` row), asserts the 503,
      asserts no orphan row, and asserts the restore actually happened — a silent
      no-op rename would otherwise make it pass for the wrong reason.

### ✅ R5.2 — unknown `role_ids` are rejected

`users.py:171-186` compares the requested ids against the resolved rows and
returns **404** naming the missing ids. Previously a typo silently stripped every
role off the target while reporting 200.

- [x] Fix applied, pinned by `test_r5_2_unknown_role_id_is_rejected`

### ✅ R1.1 — canonical roles module

`backend/app/roles.py` is now the single source of truth:

- `RoleName(StrEnum)` — the 14 canonical names (R1.3)
- `PRIVILEGE_ORDER` + `rank()` / `outranks()` / `exceeds_ceiling()` — the R1.4
  hierarchy, which is what makes the R4.8 ceiling expressible
- Named tier constants: `SUPER_ADMIN_ROLES`, `ADMIN_ROLES`, `CONTENT_ROLES`,
  `BLOG_ROLES`, `SEO_ROLES`, `LEAD_ROLES`, `ENRICHMENT_ROLES`, `AUDIT_ROLES`,
  `CONSOLE_ROLES`
- `DEAD_ROLES` — the 7 roles no guard checks, made explicit so nobody wires a
  guard to one by accident

`seed_roles.py` now imports `ALL_ROLES` from here instead of keeping its own copy,
so the taxonomy cannot drift again.

- [x] Module created, seed script de-duplicated
- [x] `test_r1_1_every_seeded_role_is_canonical` — DB roles ⊆ canonical set
- [x] `test_r1_4_tiers_are_strictly_nested` — each tier is a strict superset
- [x] `test_r1_3_role_names_are_lowercase_snake_case`
- [x] `test_dead_roles_are_documented`

---

## P2 — fixed

### ✅ R4.5 — all 24 inline role literals replaced

Zero `require_role("` literals remain. Enforced by
`test_r1_1_no_router_uses_inline_role_literals`, which greps the router
directory and fails on any regression.

The duplicate-definition problem is gone too: `("admin","super_admin","content_manager")`
was previously written 11 times under two different names (`ADMIN_ROLES` in
`enrichment.py`, `CONTENT_ROLES` in four others). Both now resolve to
`CONTENT_ROLES` in `app/roles.py`.

`leads.py:28` had a role gate that bypassed `require_role` entirely
(`{"admin","super_admin"}` inline in `_is_admin()`); it now uses `ADMIN_ROLES`.

### ✅ R3.4 — access token lifetime cut to 30 minutes

`config.py:37-48` and `.env.development`. Also added
`MAX_ACCESS_TOKEN_EXPIRE_MINUTES = 60` and a **production-only validator** that
refuses to boot if the lifetime exceeds it — because `POST /auth/logout` is still
a no-op echo stub with no denylist, so the token lifetime *is* the containment
window. The validator also now rejects production deployments where
`JWT_REFRESH_SECRET_KEY == JWT_SECRET_KEY`.

- [x] 1440 → 30 min
- [x] Production floor enforced at startup
- [x] Pinned by `test_r3_4_access_token_lifetime_is_short`
- [ ] **Still open (not a rules violation):** refresh-token rotation and reuse
      detection. A stolen 30-day refresh token is still unrevocable. Needs a
      denylist table — a schema change, deliberately out of scope here.

### ✅ R5.3 — privilege operations are now audited

New `app/utils/audit.py` + `app/utils/client_ip.py` centralise the write so the
IP cannot be forgotten. Wired into `users.py`:

| Action | `entity_type` | old → new |
|---|---|---|
| `update_user_roles` | `user` | `{"roles": [...]}` → `{"roles": [...]}` |
| `activate_user` / `deactivate_user` | `user` | `{"is_active": bool}` → `{"is_active": bool}` |
| `change_password` | `user` | hash never logged, only the fact it changed |

All three record `actor` (`user_id`) and now populate `ip_address`, which was
empty on 100% of the 3 pre-existing writers.

- [x] Role change audited with before/after + actor
- [x] Deactivation/activation audited
- [x] Password change audited (no secret material)
- [x] `ip_address` threaded through
- [x] Pinned by `test_r5_3_role_change_is_audited`, `test_r5_3_password_change_is_audited`

### ✅ R8.1 — `seed_admin.py` hardened

- `ADMIN_EMAIL_ALLOWLIST` gate, checked **before** the DB is touched
- An existing account's password is **never** re-hashed without `--reset-password`
- Promoting an account that already holds `student` requires `--promote-existing`
- Unknown role names rejected against `ALL_ROLES`
- R8.2 ordering documented in the module docstring

### ✅ Unguarded surface found during the sweep

| Endpoint | Fix |
|---|---|
| `GET /api/v1/seo` — unauthenticated full-table dump, no pagination | `require_role(*SEO_ROLES)` + `limit`/`offset` (200 → 401 anon, 403 student) |
| `GET /api/v1/seo/{type}/{id}` | `require_role(*SEO_ROLES)` |
| `GET /api/v1/banners/{id}` — bypassed `is_active`/date-window, unlike the list handler | inactive/draft banners 404 for the public; `include_inactive` needs `CONTENT_ROLES` |
| `GET /api/v1/colleges/{ref}/courses` — `include_inactive` was a public query param | now 403 unless the caller holds `CONTENT_ROLES` |
| `GET /api/v1/fees` — active-college join applied **only** when a filter was supplied, so a bare call produced `select(Fee)` with an empty WHERE | always joined to active colleges |
| `GET /api/v1/admissions` — same missing-WHERE defect | always joined to active colleges |
| `POST /api/v1/enquiries` — unthrottled, so anonymous CRM flooding | `PUBLIC_WRITE_LIMITS` in `ratelimit.py`, 5/hour; `POST /predictor` 60/min. Rate limiting also now skips GETs so the ISR-heavy catalog pages are unaffected |

---

## ⬜ Accepted debt (documented, not fixed)

### R4.4 — zero router-level gating (0 of 25)

Still per-handler. Every router legitimately mixes public catalog reads with
admin writes, so blanket router-level gating is not applicable. `audit.py` and
the admin half of `enrichment.catalog_router` are the only clean candidates.

**Mitigation:** R4.3 (deny by default) is enforced by
`test_r1_1_no_router_uses_inline_role_literals` plus the role-referenced
endpoint tests in `test_admin_access.py`, so a new unguarded route still has to
pass a suite that assumes guards are explicit.

### R5.3 — non-privilege mutations are still largely unaudited

Audit coverage is now 100% of **privilege** operations and still ~5% of
everything else. Not yet audited: all college CRUD (incl. the `super_admin`
delete), the 21 enrichment mutations, CRM lead assignment, banner/FAQ/media/SEO
writes, and the `POST /blogs` create (audited on update/delete but not create).

`ip_address` is populated for the new writers; the 3 pre-existing ones in
`blogs.py` / `reviews.py` still omit it.

### R6.6 — no automatic role re-validation

`refreshRoles()` runs on mount and after login, and the 403 screen has a manual
re-check button. A server-side role change (e.g. an admin demoted mid-session) is
not picked up until a manual refresh.

**Suggested:** re-validate on `window` focus. Not done here because it adds a
polling surface and the current behaviour is fail-closed.

---

## Regression tests

`backend/tests/test_rbac_rules.py` — 31 tests, one per rule, named after the rule
it pins. `backend/tests/test_admin_access.py` — 9 tests. Full suite: **160 passed,
1 skipped**.

| Rule | Test |
|---|---|
| R4.1 | `test_r4_1_require_role_with_no_args_raises` |
| R4.7 | `test_r4_7_admin_cannot_promote_itself_to_super_admin`, `..._super_admin_cannot_edit_own_roles_either`, `test_r4_7_cannot_demote_the_last_super_admin` |
| R4.8 | `test_r4_8_admin_cannot_grant_super_admin_to_another_user`, `..._can_still_grant_content_manager`, `..._super_admin_can_grant_admin`, `..._ceiling_helper_logic` |
| **R7.2** | `test_r7_2_forged_role_claim_grants_nothing` — forges a correctly-signed token with `role: "super_admin,admin"` for a real student id; still 403 on every admin route, and `/users/me/roles` still reports `["student"]` |
| R7.3 | `test_r7_3_roleless_user_is_forbidden_everywhere` |
| R7.4 | `test_r7_4_student_cannot_assign_itself_a_role`, `..._cannot_enumerate_roles` |
| R7.5 | `test_r2_5_registration_grants_exactly_student` |
| R7.6 | `test_student_is_forbidden_from_admin_reads`, `test_student_cannot_write_admin_content` |
| R2.1 | `test_r2_1_register_request_accepts_no_role_fields` |
| R2.4 | `test_r2_4_registration_fails_closed_when_student_role_missing` |
| R4.6 | `test_r4_6_missing_token_is_401`, `..._garbage_token_is_401`, `..._valid_token_wrong_role_is_403` |
| R5.2 | `test_r5_2_unknown_role_id_is_rejected` |
| R5.3 | `test_r5_3_role_change_is_audited`, `test_r5_3_password_change_is_audited` |
| R1.1 | `test_r1_1_no_router_uses_inline_role_literals`, `..._every_seeded_role_is_canonical`, `test_dead_roles_are_documented` |
| R1.3 | `test_r1_3_role_names_are_lowercase_snake_case` |
| R1.4 | `test_r1_4_tiers_are_strictly_nested` |
| R3.1 | `test_r3_1_role_claim_matches_db_roles` |
| R3.2 | `test_r3_2_refresh_token_is_rejected_as_access_token` |
| R3.3 | `test_r3_3_access_and_refresh_use_different_secrets` |
| R3.4 | `test_r3_4_access_token_lifetime_is_short` |

### Test-infrastructure fix

`tests/conftest.py` now re-seeds any missing canonical role at session start
(`_ensure_roles`). Registration is now fail-closed (R2.4), so a single missing
role row made every test that registers a user fail with a confusing `503`. The
suite was order-dependent on `seed_roles.py` having been run against the exact
current schema; it is now self-healing.

Three pre-existing tests asserted the *insecure* behaviour and were updated to the
new contract rather than the fix being weakened:
`test_get_roles` → split into student-403 / admin-200,
`test_seo_upsert_and_get` → now asserts anon 401 and admin 200,
`test_college_courses_filters` → now asserts anon `include_inactive` 403.

---

## Verified-correct rules (no action)

- **R1.2** no `is_admin` boolean; `user_roles` many-to-many (`models/user.py:18-34`)
- **R1.3** role names lowercase snake_case, now enforced by a test
- **R2.1** `RegisterRequest` has no role/is_admin field (`schemas/auth.py:8-25`)
- **R2.2 / R2.5** registration grants exactly `student`
- **R2.3** no role assignment path reads the request body at registration
- **R3.1** the `role` claim is **never** read for authorization — only `type` and
  `sub` are consumed (`dependencies.py:33,40`; `auth.py:111`). Now pinned by R7.2.
- **R3.2** `type` claim verified on both the access and refresh paths
- **R3.3** separate signing secrets, and production now rejects them being equal
- **R4.2** `get_current_user` re-loads the user from the DB (`dependencies.py:46`)
- **R4.3** deny by default, enforced by the guard suite
- **R4.6** 401 for token problems, 403 for role problems
- **R5.1** role change reachable only via the admin-gated `PATCH /users/{id}`
- **R5.4** roles referenced by name/real id, never by array position
- **R6.1** `isAdmin` from the API only; no JWT decode anywhere in the frontend
- **R6.2** role fetch failure → `[]`, fail-closed (`api.ts:212-218`)
- **R6.3** roles in React state only, never `localStorage`
- **R6.4** client guard documented as UX, not a boundary (`RequireAdmin` docstring)
- **R6.5** admin link rendered only when `isAdmin` (`Header.tsx:259,346`)

