# Session Log — 27 Sep 2026

**Project:** padhaanewala (India-wide education discovery platform)
**Branch:** `main` · **HEAD:** `0ffe97e` (unchanged — nothing committed this session)
**Working tree at end:** 33 modified · 11 untracked · **0 commits**

**Test suite:** 118 → **165 passing** (+1 skipped) across 9 files
**Files created:** 9 · **Files modified:** 33 · **Tests updated:** 3 (they asserted insecure behaviour)

---

## Requests in this session (verbatim)

1. `pura project read krr` — sent twice
2. `normal users admin page ka access nahi kr sakte hai`
3. `Ye raha complete RBAC ruleset — aapke codebase ke against, file:line ke saath.` + 36 rules across 8 groups + a priority table
4. `jaldi sab kaam kr`
5. `pura project tune read kiya hai ab bata CRM hai ki nahi`
6. `ik .md file bana or ye jo recent chat hua hai ausme dal de`

---

## 1. Admin access control

**Request:** normal users must not access `/admin`.

**Found:** `/admin` was wrapped in `RequireAuth`, which only checks that a token *exists* — not which roles. Any logged-in student rendered the full admin shell; every data call then 403'd. The header also showed an "Admin" link to every signed-in user.

**Fixed:**
- `frontend/lib/api.ts` — `authApi.myRoles()`, `ADMIN_ROLES`, `hasAdminRole()`, `fetchMyRoles()` (fails closed to `[]`)
- `frontend/lib/context/AppContext.tsx` — `roles` / `rolesReady` / `isAdmin` / `refreshRoles`; fetched on mount and after login; cleared on logout
- **`frontend/frontend/components/layout/RequireAdmin.tsx`** (new) — redirects unauthenticated, shows a 403 panel with a "re-check permissions" button for non-admins
- `frontend/app/admin/page.tsx` — `RequireAuth` → `RequireAdmin`
- `Header.tsx` — Admin link wrapped in `{isAdmin && …}` (desktop dropdown + mobile drawer)
- `backend/scripts/seed_admin.py` (new) — idempotent admin provisioning
- `backend/tests/test_admin_access.py` (new) — 9 tests

**Note:** I cannot create Google/Gmail accounts. What was created is the *in-app* admin user.

---

## 2. RBAC audit + remediation

**Request:** audit the codebase against a 36-rule ruleset (R1–R8), then fix it.

The ruleset was accurate on the one thing it flagged as P0. It **missed a more serious issue** that I found and proved by execution.

### The escalation (was live, now closed)

`users.py:151-177` had no privilege ceiling. A plain `admin` could:

| Step | Before | After |
|---|---|---|
| `PATCH /users/{own_id}` with `role_ids=[super_admin]` | **200** | **400** |
| `DELETE /colleges/{ref}` (super_admin-only gate) | passed | unreachable |
| `admin` grants `super_admin` to another user | **200** | **403** |
| `admin` → `content_manager` (legitimate) | 200 | **200** unchanged |
| `role_ids=[999999]` (typo) | **200**, all roles wiped | **404** |
| `GET /roles` as a student | **200** (handed out the ids) | **403** |

Amplifier: `GET /roles` handed any student the exact ids `PATCH /users/{id}` accepts.

### All rules remediated

| Rule | Fix | File |
|---|---|---|
| R4.1 | `require_role()` with no args now raises at construction (was fail-**open**: `not allowed_roles` short-circuited to allow) | `dependencies.py:71-79` |
| R4.7 | Self-edit blocked; last-`super_admin` lockout on both role and deactivation paths | `users.py` |
| R4.8 | Privilege ceiling via `PRIVILEGE_ORDER` / `exceeds_ceiling` / `exceeds_removal_ceiling` | `app/roles.py` |
| R2.4 | Registration returns 503 + rollback when the `student` role is absent (was: silent roleless account + 201) | `auth.py:73-83` |
| R5.2 | Unknown `role_ids` → 404 naming the missing ids | `users.py` |
| R5.3 | Audit rows for role change, activate/deactivate, password change — with actor + **ip_address** (previously 0 of 3 writers populated it) | `app/utils/audit.py`, `app/utils/client_ip.py` |
| R1.1 | Canonical `RoleName` StrEnum + 9 tier constants + `PRIVILEGE_ORDER`; `seed_roles.py` imports from it | `app/roles.py` (new) |
| R4.5 | All 24 inline role literals → constants. Enforced by a test that greps the router directory | all routers |
| R3.4 | Access token 1440 → **30 min**; production-only validator rejects >60 (because logout is stateless) | `config.py` |
| R8.1 | `ADMIN_EMAIL_ALLOWLIST` gate, `--reset-password`, `--promote-existing` | `scripts/seed_admin.py` |

Plus 7 previously-unguarded endpoints: `GET /seo` (unauthenticated full-table dump), `GET /banners/{id}` (draft leak), `include_inactive` as a public query param, `GET /fees` + `/admissions` (missing `WHERE` when called with no filter), `POST /enquiries` (unthrottled CRM injection → now 5/hr).

**Tests:** `backend/tests/test_rbac_rules.py` (new, 37 tests) — one per rule, named after the rule. Highlights: `test_r7_2_forged_role_claim_grants_nothing` forges a correctly-signed token with `role: "super_admin,admin"` for a real student id and asserts 403 everywhere.

**Docs:** `docs/rbac-compliance-checklist.md` (new) — before/after exploit tables, accepted-debt section.

### Two design iterations on R4.8

Worth recording because the first attempt was wrong in both directions:

1. **Removal wasn't checked at all** — ceiling only covered *granting*, so an `admin` could strip `super_admin` from a peer. Added `exceeds_removal_ceiling`.
2. **Strict `<` was too strict** — it meant an `admin` could not grant `admin`, even to a peer who already had it (an operational dead end). Split the semantics:
   - **Grant** → applies to the *delta* only (`newly_added`), strict `<`
   - **Revoke** → `<=`, so `super_admin` can demote another `super_admin`, and `admin` a peer `admin`
   - **Never** leave a user with zero roles (same invariant as R2.4)

---

## 3. Full project read

**Request:** read the complete project.

Dispatched 5 parallel research agents across the data layer, all routers, `app/`, `lib/`, components, and infra/docs.

**Read:** 40 tables · 25 routers / 150 endpoints · 9 Alembic migrations (head `f1a7c9e2d3b4`) · 20 frontend routes · 95 components · ~6,400 lines of `lib/` · docker · docs · 4 agent-skill installs

### Bugs found in my *own* work during the read

1. **`banners.py`** — I gated `get_banner` but left `list_banners` wide open. Same `include_inactive` flag, two opposite policies in one file. Both gated now.
2. **`R4.8` removal gap** — see above.
3. **`conftest.py`** — `pytest.UsageError(...)` was constructed but never `raise`d, so the friendly "schema not migrated" message was discarded in favour of a raw `UndefinedTable` traceback.
4. **`roles.py` docstring** pointed at a `test_roles_canonical.py` that doesn't exist; `BLOG_ROLES` contains `"author"`, which is not in `RoleName` and so is never seeded — now explicitly flagged in a comment.

### Notable project-level findings

- `test_questions.correct_answer` is co-located with the question served to test-takers; safety depends entirely on the router choosing the right projection
- `test_attempts` has no unique on `(user_id, mock_test_id)` → `attempts_allowed` is bypassable by concurrent requests
- `cutoffs`' 8-column unique constraint includes 4 nullable columns; Postgres treats NULLs as distinct, so it does not prevent duplicates in the common case
- `reviews.student_id` → `users.id` but `enquiries.student_id` → `student_profiles.id` — same logical column, two different parents
- Models and migrations are in **exact** agreement (40/40 tables, 13/13 unique constraints, no nullability drift) — but the 4 GIN/trigram indexes are raw SQL, invisible to `Base.metadata`, so **`alembic --autogenerate` would emit spurious `drop_index` for them**
- `DESIGN.md` documents **Clay.com**, not this project
- `docs/padhaanewala-phase-checklist.md` is badly stale: ~15 references to files/routes that don't exist, 5 commits not in git history, 7 different test counts
- `docker-compose.dev.yml` publishes PG on **5433**; `backend/.env.development` points at **5432** — `docker compose up -d db` produces a DB the backend cannot reach
- `frontend/frontend/` nesting (128 files one level too deep) exists because `tsconfig` aliases `"@/*": ["./frontend/*", "./*"]` — a vestigial Create-Next-App mapping
- 4 agent-skill installs; 3 redundant or broken, and the one that works sits at the repo root while the consumer is in `frontend/`

---

## 4. Phase verification

**Request:** `reverify project phases`

Read the authoritative phase list (master spec §C, lines 4421–5699) and verified all 105 phases against the code, using live DB queries for data gates.

**`docs/phase-verification.md`** (new):

| | Count |
|---|---|
| ✅ Done | **14** |
| 🟡 Partial | **26** |
| 🔶 Stub only | **11** |
| ⬜ Not started | **54** |

The old checklist said "4 of 105" — wrong in both directions.

**Data reality (queried live, dev DB):** colleges 10/1000 · scholarships 6/100 · exams 6/50 · courses 20/50 · **test_questions 0/500** · **placement_records 0/500** · **cutoffs 0** · **seat_matrix 0** · **fees 0** · **admissions 0** · **faqs 0** · **banners 0**

Three structural root causes explain most of the stubs:
1. `lib/content.ts:52-58` silently substitutes bundled literals on empty → a dead backend renders a fully-populated fake site
2. The frontend never wired ~40% of the API (mock-test engine, predictor, saved-colleges, all enrichment writes)
3. Admin has no write path — 6 of 20 panels call the API; `AddButton`/`RowActions` are toast-only and reused by 14 panels, which is why they *look* functional

---

## 5. CRM assessment

**Request:** `pura project tune read kiya hai ab bata CRM hai ki nahi`

**Answer: yes — backend real and well-built, frontend ~20% wired, and the two are disconnected.**

**Backend (genuine):** 4 tables (`enquiries` 22 cols with UTM/IP/device, `lead_notes`, `lead_status_history`, `counsellors`) · 6 endpoints in `leads.py` · 7-state funnel `new → contacted → qualified → proposal → won/lost/closed` · `_can_access` scoping returning **404** rather than 403 (correct non-disclosure) · `max_leads` → 409 · status validation → 422 · history row only on actual change · 8 tests in `test_phase9.py`.

**Frontend (20%):** only leads list + status change are real. Assign counsellor ⬜ · notes 🔶 (toast) · history ⬜ · follow-up ⬜ · export CSV 🔶 (Audit section only) · **counsellor management 🔶 `SAMPLE_COUNSELLORS` — 4 invented people with invented conversion rates** · course/state columns 🔶 hardcoded `"—"`.

**Three structural problems:**
1. A `counsellor` **cannot open `/admin` at all** — `ADMIN_ROLES = ["admin","super_admin"]` (`api.ts:202`) — so the carefully-built backend scoping is unreachable from the UI
2. `adminApi.enquiries()` (`api.ts:382`) calls `GET /api/v1/enquiries`, which **does not exist** (`enquiries.py` has only `POST`) — would 405; never called, so unnoticed
3. A new lead notifies nobody — `POST /enquiries` only does `db.add(); db.commit()`

Plus: UTM columns exist but the frontend never sends them; IP is never set despite `utils/client_ip.py` existing; rate limit is 5/hr vs the spec's 3/10 min.

**All CRM tables are empty in the dev DB** (0 rows).

---

## Mistakes I made and corrected

Recording these because they affected conclusions I stated:

1. **Reported the admin account as working when it later wasn't.** I verified login against the `test_suite` schema in one command while having seeded into the dev DB in another. It was later found **gone from every schema**. Re-created and verified with an explicit dev-DB readback (`public.users` = 1 row, roles `admin,super_admin`, login 200). I flagged this unprompted during the phase verification.
2. **My first `R2.4` test left the `student` role deleted**, breaking the suite with confusing 503s. Fixed by making `conftest.py` self-heal (`_ensure_roles`) and by switching the test to *rename* rather than delete, with `rowcount` assertions so it cannot false-pass.
3. **Left `banners.list_banners` unguarded** — a real miss, caught only by the full re-read.
4. **`R4.8` first attempt was over-strict** in one direction and under-strict in the other (documented above).

## Disclosure: files created without being asked

`docs/PRD.md` (78 KB) and `docs/TRD.md` (85 KB) were written at 02:15 and 02:25 today by a **subagent that I had instructed to be research-only**. I did not request them and have not reviewed them. They are untracked. Decide whether to keep or delete them.

---

## Open items

### Blocking correctness
| | |
|---|---|
| `mock_tests.py:594-613` | `submit_attempt` never enforces expiry — a student can let the clock run out and still get a graded result. Same hole at `:452-466` |
| `enrichment.py:907-915` | `_paginated` calls `order_by(None)`, discarding caller ordering → non-deterministic pagination; `/rankings` can return 2× the requested limit |
| `mock_tests.py:112-125` | non-MCQ questions always graded incorrect |
| `predictor.py:219` | uses `hash(str(cid))` — per-process randomised → confidence scores differ between workers and across restarts |

### User-visible misinformation
`/dashboard` is a mockup of a different product (brand "EduPath", user "Pushkar", saved items = NerdWallet/Levi's/NY Times internships) behind a login. Fabricated blocks: Analytics scores, SEO scores, "PostgreSQL connectivity verified", 14 "Sheryians Coding School" testimonials, hero stats "12K+ colleges / 2.4M+ students", `/api/stats` returns `ok: true` unconditionally. Full inventory in `docs/phase-verification.md`.

### Biggest spec-vs-build gaps
Phase 3 (OTP — 0 of 5 steps) · Phase 29 (college admin — "add without code" is false) · Phase 63 (cutoffs — predictor is dead without it) · Phase 87 (CI — 165 tests that nothing runs)

### Deliberately left undone (documented, not forgotten)
- **Refresh-token rotation / reuse detection** — needs a denylist table (schema change)
- **R4.4 router-level gating** (0 of 25) — most routers legitimately mix public reads with admin writes
- **R5.3 non-privilege audit logging** (~5% coverage) — privilege operations are at 100%
- **R6.6** no automatic role re-validation

### Documentation corrections outstanding
`README.md` (remove `proctoring-service/`, `.github/workflows/`, pgvector and Celery claims, fix the `asyncpg`/5432 connection string) · `DESIGN.md` (documents Clay.com) · `docs/padhaanewala-phase-checklist.md` (superseded by `phase-verification.md`)

---

## Commands used

```powershell
# tests (schema-isolated; conftest self-heals roles)
$env:PADHAANEWALA_SCHEMA = "test_suite"
cd backend; .\venv\Scripts\python.exe -m pytest -q          # 165 passed, 1 skipped

# admin provisioning
$env:ADMIN_EMAIL="contact@padhaanewala.in"
$env:ADMIN_EMAIL_ALLOWLIST="contact@padhaanewala.in"
$env:ADMIN_PASSWORD="<strong-password>"
python scripts/seed_roles.py; python scripts\seed_admin.py

# frontend
cd frontend; npx tsc --noEmit; npm run lint; npm run build   # all clean
```

**Note:** Docker was down throughout; native Windows PostgreSQL 16 on 5432 served the dev database, matching `backend/.env.development`.
