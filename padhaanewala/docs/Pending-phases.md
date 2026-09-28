# Padhaanewala — Security & Deployment Phase Tracker

> **Status as of 29 September 2026**
> Branch `main` · HEAD `96589ab` (work-tree changes since)
> **Phases 0, 1 and 6 complete and verified. Phase 5 complete and verified —
> security headers, CSP, ISR preserved, and real error reporting. Phases 2, 7, 8,
> 9 not started (Phase 2 files exist in the work tree, unverified).**
> **BUG-01 (Critical), BUG-02 (High), BUG-03 (Medium) and the Phase-4 data-leakage
> defects are FIXED — see the Bug register. Backend suite re-measured at
> **315 passed, 1 failed (BUG-06), 1 skipped** — see the second-pass note.
> **Phase 3 security is implemented (backend; frontend 3.6/3.8 remain).**

This document is the working tracker for taking Padhaanewala from a local
development checkout to a publicly deployable, security-audited product.

## What this document is, and is not

It records **only work that was actually executed and verified in the session of
27–28 September 2026**. A checkbox here means a command was run and produced the
stated result. Nothing is checked off on the basis of a claim in a previous
document, a commit message, or an existing test that nobody re-ran.

Three earlier documents exist in this directory and are **not** used as
evidence here:

| Document | Why it is not trusted as a status source |
|---|---|
| `padhaanewala-phase-checklist.md` | Superseded. It predates the code it describes; the remote commit `69a8c64` re-audited it, but the audit is itself a claim rather than a run. |
| `phase-verification.md` | Stale. It states there is no CI configuration of any kind, that `/privacy-policy` and `/terms` do not exist, and that the test count is 165. All three are now false. |
| `session-log-2026-09-27.md` | A narrative of intent, not a test run. |

`logs/backend.log` contained a single Windows CMD parse error and no uvicorn
output at all, so the backend had never been started on this machine before this
session. "The build passed" was likewise only true because the database was
empty, which made `generateStaticParams` return zero slugs. Both facts mattered
for what follows.

---

## Legend

| Mark | Meaning |
|---|---|
| `[x]` | Done and verified in this session. The evidence column says how. |
| `[ ]` | Not started. |
| `[~]` | Partially done. |

---

# Phase 0 — Make it run at all

**Status: COMPLETE** · 8 of 8 sub-tasks

The precondition for every later phase. Nothing in this repository had been
installed, migrated or executed before this phase.

## 0.1 Toolchain

- [x] **Python 3.14.7 installed.** The machine had only 3.12.10. This was not
      cosmetic: `requirements.txt` pins `cryptography==50.0.1`, which publishes
      `cp314` wheels only. On 3.12 pip attempts a **Rust source build**.
      Evidence: `py -0p` lists `-V:3.14`; `py -3.14 -m venv venv` created the
      virtualenv.
- [x] **Virtualenv created** at `padhaanewala/backend/venv`.
      Evidence: `venv/Scripts/python.exe --version` → `Python 3.14.7`.
- [x] **All 39 runtime dependencies installed from binary wheels**, no compiler
      invoked. Evidence: pip output shows `cp314-cp314-win_amd64.whl` for
      `pyyaml` and `SQLAlchemy`; `pip list --format=freeze` counts 49 packages
      including dev extras.
- [x] **Dev dependencies installed** — `pytest==9.1.1`, `httpx==0.28.1`.
- [x] **Node dependencies installed** — 373 packages, `npm audit` reports
      **0 vulnerabilities**.
- [x] **Docker Desktop 29.7.2 started.** The engine was not running; the first
      `docker compose up` failed with
      `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`.
- [x] **Hardened PostgreSQL image built.** `docker/db/Dockerfile` rebuilds
      `gosu` 1.19 from source against a patched `golang.org/x/sys`, then
      flattens the image through a `scratch` stage. Build completed in ~50s.
- [x] **Containers healthy.** Evidence: `pg_isready` →
      `/var/run/postgresql:5432 - accepting connections`; `redis-cli ping` →
      `PONG`.

## 0.2 Database

- [x] **All 9 Alembic migrations applied** to head.
- [x] **Head verified as `f1a7c9e2d3b4`** at the time of this phase, 41 tables
      in `public`. *(The head has since advanced to `b4e91d7a2c58` because the
      remote added an `otp_records` migration — see "Post-phase note".)*
- [x] **All six seed scripts run in order**, each idempotent.
- [x] **Row counts confirmed by direct SQL**, not by trusting the seed scripts'
      own output.

| Table | Rows |
|---|---|
| colleges | 341 |
| universities | 168 |
| courses | 22 |
| college_courses | 345 |
| states | 36 |
| districts | 755 |
| cities | 105 |
| roles | 14 |
| scholarships | 6 |
| exams | 6 |

> **These counts no longer describe this machine's database. Re-measured
> 28 September 2026, `public` schema, 41 tables, `alembic` head `9f3c2a7e8d21`:**
>
> | Table | Was | **Is now** |
> |---|---|---|
> | colleges | 341 | **10** |
> | universities | 168 | **155** |
> | courses | 22 | **20** |
> | college_courses | 345 | **15** |
> | states / districts / cities | 36 / 755 / 105 | 36 / 755 / 105 ✅ unchanged |
> | roles / exams / scholarships | 14 / 6 / 6 | 14 / 6 / 6 ✅ unchanged |
>
> `cutoffs`, `placement_records`, `nirf_rankings`, `seat_matrix`, `fees`,
> `admissions`, `faqs`, `banners`, `blogs`, `mock_tests`, `test_questions`,
> `reviews`, `enquiries` and `leads` are all **0 rows**. The geographic and role
> reference data survived; the college catalogue and every enrichment table did
> not. **Do not quote the 341 figure in any planning, marketing or capacity
> context** — the live number is 10, which is 1% of the 1000-college gate in
> Phase 59.
>
> Cause not established in this pass. The 341→10 drop is consistent with the
> 0.2 seed scripts having been re-run against a different database, or with
> `scripts/purge_demo_data.py` having been executed against `public` — that
> script's docstring describes deleting "every `colleges` row" and is itself
> stale (it assumes every `users` row is a test account, which is no longer
> true). **Investigate before running any seed or purge script again.**

## 0.3 Configuration corrections

`.env.example` contained values that made the application fail to start if
copied verbatim. Both were corrected.

- [x] **`DATABASE_URL` driver fixed.** It declared
      `postgresql+asyncpg://…:5432/…` but `app/config.py` defaults to
      `postgresql+psycopg2://…:5433/…`, and `asyncpg` is **not** in
      `requirements.txt`. Following the template produced an unimportable
      driver.
- [x] **`DB_PORT` corrected** from `5432` to `5433` to match
      `docker-compose.dev.yml`, which publishes `5433:5432`.
      > **Superseded 28 September 2026 — this correction is now the wrong way
      > round for this machine.** The native Windows PostgreSQL 16 service owns
      > **5432** and holds the only populated database; Docker is not running and
      > **5433 refuses connections**. `backend/.env.development` was changed back
      > to `5432` (`DB_PORT` and `DATABASE_URL` together), with a comment
      > recording that the two must be swapped if the container is used instead.
      >
      > The failure this produces when the value is wrong is a **500 on every
      > login**, not a startup error:
      > `psycopg2.OperationalError: connection to server at "localhost", port
      > 5433 failed: Connection refused`.
      >
      > One extra trap worth recording: **`--reload` does not watch `.env`.** The
      > process started before the file was edited kept serving 5433 until it was
      > manually restarted, and the log line gave no hint that a stale config was
      > the cause — it read as a database problem. Phase 8.2 should treat "the
      > env file changed" as requiring a restart.
- [x] **`BACKEND_URL` documented and added.** `lib/api-server.ts` and the
      `/api/v1` rewrite in `next.config.ts` read it; it was absent from the
      template entirely.
- [x] **`NEXT_PUBLIC_API_URL` guidance corrected.** It shipped
      `http://localhost:8000` with no `/api/v1` suffix. `lib/api.ts` uses the
      value verbatim while `next.config.ts` *strips* a trailing `/api/v1` before
      proxying, so the two consumers wanted opposite forms and every
      authenticated call 404'd. Now documented: leave unset, or include the
      suffix.
- [x] **`backend/.env.development` created** with randomly generated 64-character
      secrets, not placeholders. Confirmed ignored by `.gitignore` rule
      `.env*` before anything was staged.

## 0.4 Verification gates

- [x] **`npm run build` exits 0.** 33 routes. *At this point, only because the
      database was empty — see Phase 1.6 for what that was hiding.*
- [x] **Full test suite passes: 186 passed, 1 skipped** across 11 files.
- [x] **`GET /health` returns 200** with a genuine `SELECT 1` round trip, not a
      hardcoded literal. Response body confirmed:
      `PostgreSQL answered SELECT 1 in 76.1 ms`.
- [x] **`npm run typecheck` clean.**
- [x] **`npm run lint` clean.** Both scripts existed in `package.json` but no CI
      job ran them, so these baselines had to be captured manually before any
      code was changed.

## 0.5 Clean re-verification

Every gate above was re-run from a wiped state to confirm it was reproducible
rather than incidental.

- [x] **`.next` deleted and rebuilt** — 33 routes regenerated successfully.
- [x] **Test suite re-run** — 186 passed, 1 skipped (2m11s).
- [x] **10-endpoint API smoke test** — all statuses correct, including
      `/api/v1/roles` → 401 and `/api/v1/seo` → 401, which independently confirms
      the RBAC remediation is live rather than merely documented.

**Phase 0 exit criteria: met.**

---

# Phase 1 — P0 security, no architectural change

**Status: COMPLETE** · 6 of 6 sub-tasks

Everything in this phase is a small, independently reversible change. No data
model, no session architecture, no deployment shape.

## 1.1 Dependency patching and automation

- [x] **`next` upgraded 16.3.5 → 16.3.6.** Next.js moved to a pre-announced
      monthly security cadence in 2026. 16.3.5 predated the 16.3.6 critical
      upstream fix. A related advisory, `CVE-2026-75604` (CVSS 9.0, unauthenticated
      RCE on Windows deployments), has a public proof-of-concept.
- [x] **`npm audit` clean** after the upgrade.
- [x] **`.github/dependabot.yml` added.** npm checked daily, pip weekly.
      `next`, `@next/*`, `eslint-config-next` and `eslint-plugin-next` are grouped
      because bumping one without the others breaks builds. The Python
      requirements are treated as a single freeze because `requirements.txt` is a
      fully-pinned freeze *including transitive dependencies*.

**Why this was necessary:** `package.json` pins `next` to an exact version
deliberately, which is correct practice but means **nothing upgrades itself**.
That is how two security releases were missed in the first place.

## 1.2 Unauthenticated information disclosure

- [x] **`/docs`, `/redoc` and `/openapi.json` disabled when `APP_ENV=production`.**
      Previously public in every environment. Measured before the fix:
      `GET /openapi.json` returned **201,673 bytes** — a complete, clickable map
      of all 129 endpoints, every request schema, every enum value. Swagger UI
      cannot be protected with credentials, because it must load the spec
      *before* it can send an `Authorization` header.

## 1.3 Cross-origin policy

- [x] **Wildcard CORS origin refused at startup** outside development.
      `allow_credentials=True` combined with a `*` origin lets any website read
      authenticated API responses out of a logged-in visitor's browser. There is
      no safe way to combine the two.
- [x] **Methods and headers pinned.** `allow_methods=["*"]` and
      `allow_headers=["*"]` replaced with an explicit list, plus `max_age=600`.
- [x] **Evidence:** `APP_ENV=production` with `CORS_ORIGINS=*` →
      `ValidationError: CORS_ORIGINS must not contain '*' outside development`.

## 1.4 Host header validation

- [x] **`TrustedHostMiddleware` added.** The `Host` header is attacker-controlled
      and is used to build absolute URLs and cache keys.
- [x] **`ALLOWED_HOSTS` setting added and required in production.** Unset, it
      falls back to the hostnames of `APP_URL`/`API_URL`, which is not the public
      domain when the app is behind a proxy.
- [x] **Evidence:** request with `Host: evil.example.com` → **400**; request with
      `Host: localhost` → **200**.

## 1.5 Proxy trust and client IP

`X-Forwarded-For` is a plain client-controlled header. The previous code read
its first entry unconditionally, in two places.

- [x] **`TRUSTED_PROXY_HOPS` setting added.** At `0` the header is ignored
      entirely and the socket peer is used. A non-zero value takes the entry that
      many positions from the **right** of the list, because each proxy appends
      the peer it observed.
- [x] **`client_ip()` rewritten** with input sanitisation, and
      **`ratelimit.py` now calls it** instead of maintaining its own reader.
- [x] **Impact closed:** a caller could previously mint a fresh rate-limit
      bucket per request by forging the header, and write arbitrary strings into
      `audit_logs.ip_address` and `enquiries.ip_address` — a rate-limit bypass
      *and* a corrupted forensic record.

## 1.6 Resource limits and data exposure

`?limit=1000000` on any public list endpoint returned the entire table.

- [x] **`Query(le=…)` added to every unbounded `limit` parameter** across 7
      files and 8 endpoints: `colleges.py`, `courses.py`, `exams.py`,
      `scholarships.py`, `mock_tests.py` (×2), `media.py`, `blogs.py`.
- [x] **Evidence:** `?limit=1000000` → **422**; `?limit=101` → **422** on
      colleges, exams, mock-tests and media; `?limit=51` → **422** on blogs.

**This change caused two regressions, both found and fixed during the same phase.**

**(a) Silent truncation of the catalogue.** `lib/api-server.ts` requested
`?limit=1000`, so once the cap was in place `resolveColleges()` returned **100 of
341 colleges** — and several `?limit=200` calls would have 422'd into an empty
exam list. A short result is indistinguishable from real data.
*Fixed* by adding a paged walk (`serverGetAllPaged`, 100 per page, memoised per
process) so the abuse cap and the real catalogue size stop being the same number.
*Evidence:* a four-page walk returns **341 of 341** rows.

**(b) The build was already broken.** `/colleges/[slug]` fans out to
`getCollegeBundle` (9 requests) plus the full college list, so prerendering 341
colleges meant roughly 4,000 build-time requests. Pages exceeded the 60-second
budget and the build **exited 1**. It had only ever passed because the database
held zero rows.
*Fixed* by capping `generateStaticParams` to a 25-record seed per section and
letting ISR render the remainder on demand, while `app/sitemap.ts` still
enumerates every slug so nothing becomes undiscoverable.
*Evidence:* build went from **exit 1, 402 pages** to **exit 0, 33 pages**.

## 1.7 Cryptographic configuration drift

- [x] **`BCRYPT_ROUNDS` wired through** to `CryptContext`. It was declared in
      `Settings` and never passed, so passlib silently used its own default of 12
      and raising the setting did nothing. A production floor of 12 is now
      enforced.
- [x] **`JWT_ALGORITHM` wired through.** The module constant
      `ALGORITHM = "HS256"` shadowed the configured value entirely. The constant
      is retained because the RBAC suite signs forged tokens with it, but it is
      now *derived* from `Settings`. Production refuses any non-HMAC algorithm.
- [x] **`jti` added to refresh tokens.** Without a unique identifier a refresh
      token is indistinguishable from every other token issued to that user, so
      logout and rotation have nothing to act on. This is the prerequisite for
      Phase 3.

## 1.8 Connection pool

- [x] **`pool_size` / `max_overflow` / `pool_timeout` made configurable**
      (20 / 20 / 10s), plus `pool_recycle=280`.

This was not theoretical. While verifying 1.6, the backend threw:

```
sqlalchemy.exc.TimeoutError: QueuePool limit of size 5 overflow 10
reached, connection timed out, timeout 30.00
```

with one request logged as running for **700,494 ms** — 11 minutes 40 seconds —
before failing. The 5/10 values were the SQLAlchemy defaults, never sized for a
process that also serves a Next.js server.

## 1.9 Statistics integrity

- [x] **New `GET /api/v1/stats/catalog` endpoint** using `COUNT(*)`, applying
      the same visibility rule as each list endpoint (`is_active`, and
      `status == "published"` for blogs).
- [x] **`frontend/app/api/stats/route.ts` rewritten** to read it.

`/api/stats` previously counted rows by requesting `?limit=10000` and reporting
`data.length` — conflating a page size with a population size. Once the cap
existed it would have returned **HTTP 200 with every count silently truncated**:
a dashboard that looks real and is wrong. At 341 colleges and a 1000+ target this
would have failed quietly.
*Evidence:* `{"colleges":341,"courses":22,"exams":6,"scholarships":6,"blogs":0,"mock_tests":0}`.

## 1.10 Repository hygiene

- [x] **`.gitignore` extended with `*.err` and `*.out`.** `*.log` does not match
      uvicorn stderr captures, and a SQLAlchemy error message can embed the
      connection string and credentials.

## Phase 1 exit criteria: met

| Gate | Result |
|---|---|
| `pytest` | 186 passed, 1 skipped |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run build` | exit 0, 33 routes |
| `GET /health` | 200, genuine `SELECT 1` |
| Production guards | CORS `*`, missing `ALLOWED_HOSTS`, `BCRYPT_ROUNDS=4` all **refused at startup** |
| Valid production config | **passes** |

## Post-phase note — remote work merged in

The first `git push` was **rejected**: the remote had advanced by two commits
while this phase was in progress, one of which was a substantial feature
(`feat(auth): add email, SMS and OTP verification with password reset`).

The push was **not** forced. The branch was rebased instead. Two files overlapped:

| File | Remote | Local | Resolution |
|---|---|---|---|
| `backend/app/config.py` | production guards for email/SMS/OTP providers | guards for `ALLOWED_HOSTS`, `BCRYPT_ROUNDS`, `JWT_ALGORITHM` | manual merge, all 8 guards of both retained |
| `frontend/lib/api.ts` | +152 lines of OTP/verification API | paged `courseLookup` | auto-merged |

The first merge resolution silently dropped six of the remote's email/SMS
guards. This was caught by re-reading the merged result rather than trusting the
resolution, and all were restored before pushing.

Post-merge verification: migration advanced to `b4e91d7a2c58` (`otp_records`);
**225 tests pass** (186 + 39 new OTP tests); typecheck clean; lint clean; build
exit 0 with `/forgot-password`, `/reset-password` and `/verify-email` present.

---

# Phase 2 — Containerisation

**Status: NOT STARTED** · 0 of 6 sub-tasks

Target topology, chosen to match the existing rewrite proxy:

```
Internet ──:443──> Caddy (automatic TLS)
                     ├── /*          → frontend:3000  (Next.js standalone)
                     └── /api/v1/*   → Next's own rewrite
                                        → backend:8000  (internal only)
```

Two consequences simplify the security posture considerably:

1. **Port 8000 is never published.** `next.config.ts` already proxies
   `/api/v1/*` to the backend, so the browser is always same-origin. CORS becomes
   irrelevant for external traffic, and the FastAPI application is not reachable
   from the internet at all.
2. **`output: "standalone"` is required** and does not currently exist in
   `next.config.ts`. Docker will not work without it.

## Sub-tasks

- [ ] **2.1** Add `output: "standalone"` to `next.config.ts`.
- [ ] **2.2** `backend/Dockerfile` — `python:3.14-slim`, non-root user,
      healthcheck against `/health`, pinned base image digest.
- [ ] **2.3** `frontend/Dockerfile` — multi-stage build, non-root, copy the
      standalone output only. Must not ship `node_modules` or the full source
      tree into the runtime image.
- [ ] **2.4** `docker-compose.prod.yml` — services `caddy`, `frontend`,
      `backend`, `db`, `redis`. **Only Caddy publishes a port.** Healthchecks
      and `depends_on: condition: service_healthy` for ordering. No obsolete
      `version:` key. `restart: unless-stopped` on all services.
- [ ] **2.5** `Caddyfile` — automatic TLS, HSTS, compression.
- [ ] **2.6** `.dockerignore` for both contexts. Note
      `padhaanewala/bot_robot.glb` (1,001,448 bytes) is byte-identical to
      `frontend/public/bot_robot.glb` and must be excluded from the build
      context.

**Verification:** `docker compose -f docker-compose.prod.yml up -d` brings the
stack up; `docker compose ps` shows all services healthy; no port other than
80/443 is reachable from outside; `curl https://<domain>/health` returns 200.

---

# Phase 3 — Session security

**Status: IMPLEMENTED (dual-track)** · 6 of 8 sub-tasks

The single highest-severity item is closed. On 28–29 September 2026 the
`refresh_tokens` ledger, rotation, reuse detection, real logout and
HttpOnly-cookie delivery were implemented and verified both by the suite
(`tests/test_session_security.py`, 22 tests) and by driving the live API —
see BUG-01 below. What remains is the frontend migration of the *access* token
out of `localStorage` (3.6/3.7) and failure-aware auth throttling (3.8, already
split per-endpoint — see BUG-03).

`frontend/lib/api.ts` stores both tokens in `localStorage`. The OWASP Session
Management Cheat Sheet states plainly: *"Do not store authentication tokens,
session IDs, JWTs, refresh tokens, or any credential in `localStorage` or
`sessionStorage`. These APIs are accessible to any JavaScript executing in the
origin, so a single XSS vulnerability discloses every token."*

`localStorage` is readable by first-party code, every npm dependency, every
browser extension, and any injected script.

`backend/app/routers/auth.py` implements `POST /auth/logout` as an echo stub that
returns `{"success": true}` without invalidating anything. The 30-minute access
window is therefore the entire containment strategy.

## Sub-tasks

- [x] **3.1** `jti` present in refresh token claims. *(Completed in Phase 1.7 —
      the identifier exists; nothing consumes it yet.)*
- [ ] **3.2** `refresh_tokens` table: hashed token, `family`, `used_at`,
      `expires_at`, `revoked_at`, with a new Alembic migration.
- [ ] **3.3** **Rotation.** Every `/auth/refresh` issues a new refresh token and
      invalidates the presented one. **Confirmed broken — see BUG-01.**
- [ ] **3.4** **Reuse detection.** Presenting an already-rotated token revokes the
      entire rotation family and forces re-authentication. Reuse of a rotated-away
      token is strong evidence of theft, not user error.
      **Confirmed broken — see BUG-01.**
- [ ] **3.5** **Real `logout`.** Revoke the session server-side instead of
      echoing. **Confirmed broken — see BUG-01.**
- [ ] **3.6** **HttpOnly cookie migration.** Refresh token moves to
      `HttpOnly` + `Secure` + `SameSite=Strict`; access token becomes
      **memory-only**. `lib/api.ts` already defines `getRefreshToken()` at
      lines 135-138 and **never calls it** — there is no refresh path at all
      today, so a session silently 401s after 30–60 minutes while
      `isAuthenticated` stays `true` because it only checks token *presence*.
- [ ] **3.7** CSRF protection for the cookie-authenticated refresh endpoint
      (`SameSite` plus an Origin check), and a refresh-on-401 interceptor.
- [ ] **3.8** **Raise the auth rate limit or make it failure-aware.**
      Confirmed while testing BUG-01: the limiter correctly returned 429 after
      five requests to `/api/v1/auth/refresh` inside a minute, which is the
      intended behaviour, but auth now has **eleven** endpoints (OTP send and
      verify, mobile verification, forgot and reset password, verify and resend
      email). A user who retries a login and then requests a password reset can
      lock themselves out. Buckets are per-path, which limits the blast radius,
      but the ceiling is too low for a multi-step authentication flow.

**Verification:** new test file covering rotation, reuse detection, logout
revocation, and the cookie flags (`HttpOnly`, `Secure`, `SameSite`) actually
being set on the response. A test that a stolen-then-replayed refresh token is
rejected and revokes the family.

**This is the only change in the whole plan that should get its own branch and
its own review.** It rewrites session handling end to end.

---

# Phase 4 — Data leakage

**Status: PARTIAL** · 5 of 8 sub-tasks (4.1, 4.4, 4.5, 4.6, 4.8 done) ·
verified by `tests/test_data_integrity.py`

Targeted specifically at preventing personal data reaching unauthorised parties.

## Sub-tasks

- [x] **4.1** **`POST /api/v1/enquiries` must derive `ip_address` server-side.**
      The field was removed from `EnquiryCreate` — a client-supplied `ip_address`
      now 422s (the model is `extra="forbid"`) — and the server derives it from
      the connection, honouring `X-Forwarded-For` only when `TRUSTED_PROXY_HOPS`
      declares a real proxy topology.
- [ ] **4.2** **Rate limiter fails closed on `/auth`.** It currently does
      `except redis.RedisError: pass`, so a Redis hiccup removes throttling
      from the login path entirely. That is precisely the moment an attacker
      wants.
- [ ] **4.3** **Async Redis client.** `ratelimit.py` uses the synchronous
      `redis.Redis` inside an async middleware, blocking the event loop on a
      network round trip for every write request.
- [x] **4.4** **Audit every mutation (partial).** College delete now writes an
      audit row with per-table cascade counts; blog update/delete, review
      moderation and password change were already audited. Remaining gaps:
      enrichment writes (21), lead assignment, banner/FAQ/media/SEO writes,
      blog create.
- [x] **4.5** **Include `ip_address` in audit rows.** All writers now go through
      `audit.record()` with the `Request`, so the source IP is stamped.
- [x] **4.6** **Fix `GET /blogs/{ref}` mutating `view_count`.** GET no longer
      mutates. A dedicated `POST /blogs/{ref}/view` owns the counter, is a
      single atomic `UPDATE`, answers 204 for unknown slugs, and cannot count an
      unpublished blog.
- [ ] **4.7** **Harden `/api/ai`.** Currently unauthenticated, unthrottled, with
      no input-length cap and no `AbortSignal` timeout. Two risks: direct cost
      exhaustion, and an open prompt-injection relay into the LLM.
- [x] **4.8** **Rate-limit or authenticate `/api/stats`** (`/api/v1/stats/catalog`
      is now a registered throttle target).

## Also outstanding from the original audit

- [ ] `submit_attempt` does not enforce exam expiry — a student can let the clock
      run out and still receive a graded result.
- [ ] Non-MCQ questions are always graded incorrect.
- [ ] `cutoffs` has an 8-column unique constraint containing 4 **nullable**
      columns. PostgreSQL treats NULLs as distinct, so the constraint never fires
      in the case that matters and duplicate cutoffs are possible — which then
      skews the predictor's average.
- [ ] `CASCADE` on a **nullable** `college_id` across five enrichment models
      means deleting one college silently destroys a decade of cutoff, ranking
      and placement data. *(Now audited: `delete_college` records per-table
      cascade counts and the source IP before the commit. The data-destruction
      semantics are unchanged and remain `super_admin`-only.)*
- [ ] `CollegeDetailResponse` is constructed in four separate places and has
      already drifted in risk.
- [ ] N+1 queries in the audit log list and in every enrichment serializer.

---

# Phase 5 — Security headers and CSP

**Status: COMPLETE** · 5 of 5 sub-tasks · verified on 29 September 2026

Before this phase there were **no security headers of any kind**. `next.config.ts`
defined `images`, `rewrites` and `redirects` and nothing else, and there was no
`middleware.ts` (now `proxy.ts`) anywhere in the frontend. Missing:
Content-Security-Policy, HSTS, `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy`.

This matters more than usual because *Security Misconfiguration* moved from #5 to
**#2** in the OWASP Top 10:2025, driven largely by exactly this pattern —
containerised, API-rich deployments where defaults are rarely secure.

## The trap in this phase

Nonce-based CSP forces dynamic rendering, which would **destroy the ISR windows**
across roughly 20 routes (300s and 600s). This had to be solved before writing a
single header.

**Solution applied:** the theme script is externalised. `app/layout.tsx` injected
a blocking inline `<script>` reading `cp_theme` from `localStorage`; it now loads
`public/theme-init.js` synchronously as the first thing in `<body>`.

**The tracker's own proposed policy was wrong, and the correction is part of
this phase:**

> *"Then `script-src 'self' 'strict-dynamic'` works with **zero inline script**"*

It does not. In CSP Level 3, `'strict-dynamic'` makes the browser **ignore
`'self'`, every host source, and `'unsafe-inline'`** for script loads, and allows
only scripts carrying a matching nonce or hash. With no nonce or hash anywhere in
the policy — which is exactly what a nonce-free policy looks like — that
combination authorises **no scripts at all**, including Next.js's own framework
bundles. It is a self-inflicted outage, not a policy. `script-src 'self'
'strict-dynamic'` never shipped.

What actually remains inline, and why `'unsafe-inline'` therefore stays:

- Measured on the built `/` HTML: **6 inline `self.__next_f.push` scripts** and
  **0 `integrity` attributes**. The flight-payload bootstrap is dynamically
  generated per page, and Next's `experimental.sri` is explicitly
  *"build-time only — cannot handle dynamically generated scripts"*. SRI was
  trialled (build exited 0 with the flag) and rejected for that reason: a strict
  `script-src 'self'` would block those six inline scripts and hydration would
  fail. The tradeoff is that `script-src` carries `'unsafe-inline'`, and its
  meaning has been narrowed to exactly one thing: Next's own bootstrap. The
  project's only first-party inline script (the theme boot) is gone.
- The two `<script type="application/ld+json">` JSON-LD blocks are data blocks,
  not executed scripts; `script-src` does not govern them.
- `style-src 'unsafe-inline'` is also retained and is not negotiable: Tailwind v4
  `@utility`, `globals.css` and `motion`'s inline `style` attributes depend on it.
  A CSS injection cannot execute script under this policy, so this is the
  accepted lower-risk half of the policy, recorded rather than hidden.

## Sub-tasks

- [x] **5.1** Move the theme bootstrap script to `public/theme-init.js`.
      Loaded with `<script src="/theme-init.js">` as the first element in
      `<body>` — explicitly **not** via `next/script`, which appends
      asynchronously and would reintroduce the dark-mode white flash. Served at
      `/theme-init.js` (200, `application/javascript`); served HTML contains
      **zero** occurrences of the old inline `localStorage` bootstrap. The only
      inline script left anywhere in the document is Next's own
      `self.__next_f.push` payload.
- [x] **5.2** Add the header stack. The file is `proxy.ts`, **not**
      `middleware.ts`: `middleware.ts` is deprecated in Next 16 and renamed
      (`node_modules/next/dist/docs/.../middleware.md`, "deprecated, renamed to
      proxy.js"). A proxy is the right home because `next.config.ts` `headers()`
      is evaluated once at build time and cannot vary per request; the
      `Permissions-Policy` here is deliberately per-path.
      Headers set on every non-asset response:
      `Content-Security-Policy` (default-src 'self'; script-src 'self'
      'unsafe-inline' [+ 'unsafe-eval' in dev only]; style-src 'self'
      'unsafe-inline'; img-src 'self' data: blob: [+ `CSP_IMAGE_HOSTS`];
      font-src 'self' data:; connect-src 'self'; media-src 'self' blob:;
      worker-src 'self' blob: — the `three`/GLTF allowance the phase asked for;
      object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action
      'self'; `upgrade-insecure-requests` in production only),
      `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
      `Referrer-Policy: strict-origin-when-cross-origin`, and
      `Permissions-Policy` that denies camera/microphone/geolocation/payment/USB
      everywhere **except `/mock-tests`**, which runs `ProctoredMockTest`
      (`getUserMedia` + `getDisplayMedia`) — a blanket `camera=()` would leave
      that page inert. HSTS (`max-age=31536000; includeSubDomains`) is sent in
      production only, and the `preload` token is deliberately deferred (a row in
      the top comment explains why). `poweredByHeader: false` added to
      `next.config.ts` (`X-Powered-By` is a free framework advertisement and
      Caddy's `-Server` cannot strip an app-level header for responses the
      browser reads before proxying).
      **Verified live** (`next start -p 3100`, then curl):
      `/` and `/colleges` carry the full stack with all features denied;
      `/mock-tests` carries `camera=(self), microphone=(self),
      display-capture=(self)`; `X-Powered-By` absent.
      **Coordination note:** `docker/Caddyfile` had a global
      `Permissions-Policy "camera=(), microphone=()…"` from the Phase-2 work.
      Browsers intersect every policy they receive and the most restrictive
      wins, so the edge would have silently vetoed the `/mock-tests` grant the
      app computes. The duplicate headers were removed from the Caddyfile; the
      app is now the single source of truth, and the Caddyfile says why.
- [x] **5.3** Keep ISR working. `npm run build` exits **0** (re-run twice after
      the header work). Shared routes are unchanged in kind: `/` revalidates
      every `5m`, `/blog` `10m`, the `[slug]` routes are `●` SSG with mixed
      `5m`/`10m`, and `s-maxage=300, stale-while-revalidate=31535700` is
      confirmed on the live wire alongside `x-nextjs-cache: HIT` and
      `x-nextjs-prerender: 1`. The `generateStaticParams` seed caps for
      `colleges/[slug]` (25 → 10 slugs) and `legal/[slug]` (+`/legal/dpdp-notice`)
      changed during this phase because Phase 6 landed in the same working tree;
      those deltas belong to Phase 6, not here. The proxy adds no `headers()` or
      cookie read, so nothing is forced dynamic.
- [x] **5.4** **Real error reporting.** `app/error.tsx` used to render the
      literal string *"Our team has been notified"* and notify nobody — no
      Sentry, no `console.error`, no SDK, and the `error`/`digest` props were
      destructured away and discarded. Now:
      - `lib/observability.ts` — `reportError()` and `createReference()`.
        Payload is an explicit allowlist (message, digest, stack, pathname,
        user agent, locale, timestamp, reference) with **no storage, cookie, IP
        or request-body access** — recorded on purpose, because the site holds
        children's behavioural data (Phase 9.1) and an error reporter is the
        classic place a `localStorage` dump walks out. Deduped per
        key/30 seconds so a render loop cannot become a request storm. An
        `installGlobalErrorListeners()` hook captures `window.onerror` and
        `unhandledrejection`, which reach no React boundary.
      - `app/api/errors/route.ts` — the sink. 32 KB body cap (413 before the
        buffer is full), process-wide 60/min bucket deliberately **not** keyed
        on `X-Forwarded-For` (that is the Phase 1.5 rate-limit bypass pattern),
        field allowlist that drops anything unnamed, and one JSON line per event
        on stdout for the Phase 8.5 monitor. **Verified live:** well-formed POST
        → 204 and `{"event":"client_error",…}` on the server log; oversized →
        413; a foreign `evil` field is dropped; `{}` → 204 with nulls.
      - `app/global-error.tsx` — new. The root layout has no error boundary
        above it, so the worst failures fell through to Next's unthemed 500 page
        with no report. Renders its own `<html>/<body>` and imports
        `./globals.css` (the layout it replaces is not present to do it).
      - `instrumentation.ts` → `onRequestError` for server-side errors that no
        `error.tsx` can ever see (Server Component render, route handler,
        Server Action), emitting the same `{"event":"server_error",…}` shape and
        the `digest` that ties it to the client report. Verified present in the
        server bundle (`.next/server/…/instrumentation_ts_*.js`); not
        live-triggered, deliberately — inducing a server failure would have meant
        breaking a running stack mid-phase.
      - `instrumentation-client.ts` — installs the global listeners in the
        documented pre-hydration window.
      The UI copy no longer claims a delivery that cannot be promised; it shows
      the locally-generated reference and the server digest, and says "quote the
      reference if you contact us" — true in every outcome.
- [x] **5.5** **Prune `.env.example`.** Every variable in the new file was
      traced to a reader: `app/config.py` (`Settings`), `scripts/seed_admin.py`
      (`ADMIN_*`), the Next **server** (`BACKEND_URL`, `CSP_IMAGE_HOSTS`,
      `OPENAI_*`) and the browser (`NEXT_PUBLIC_*`). 45 variables were removed
      and are listed at the foot of the file with their reason — Celery, S3/R2,
      pgvector, RAG, proctoring, Sentry, GA4, WhatsApp, every `CACHE_TTL_*`
      key, and the dead guards `ADMIN_2FA_REQUIRED`, `COOKIE_SECURE`,
      `APP_NAME`, `TIMEZONE` (the last two are still declared on `Settings` and
      read by nothing). Variables that the code reads but the file was missing
      were added: `JWT_ALGORITHM`, `REFRESH_COOKIE_NAME/_PATH`,
      `MAX_ACTIVE_REFRESH_TOKENS`, `SMS_OTP_*`, `EMAIL_*_TOKEN_TTL_MINUTES`,
      `RATE_LIMIT_ENABLED`, `CSP_IMAGE_HOSTS`, `OPENAI_*` and the two
      `NEXT_PUBLIC_GRIEVANCE_OFFICER_*` values.
      **New finding left in the tracker for Phase 8.2:** `.env.prod.example`
      lists `REFRESH_TOKEN_IN_COOKIE`, `REFRESH_COOKIE_SAMESITE` and
      `REQUIRE_ORIGIN_CHECK_ON_COOKIE_AUTH` and claims production refuses to
      boot without them. **No such settings exist in `app/config.py`** — the
      refresh cookie is unconditional, `SameSite=strict` is a constant, and the
      Origin check is always on. That file's claim is false and is noted in the
      pruned `.env.example`.

## Session note

This phase ran while a second agent was mid-flight on Phases 6 and 9 in the same
working tree (new files every few minutes, 00:00–00:20). Two `next build`
type-checks failed mid-phase on `Footer`/`BottomNav` code that was being edited
by that session — transient, and theirs. Phase 5 paused while the tree was
hot (00:05–00:20), then re-read every file immediately before touching it. Two
Phase-5 files (`app/layout.tsx`, `next.config.ts`) were also edited by the other
session and both edits survived intact. If a Phase 5 change is missing, check
git blame for the 29th before re-implementing it.

---

# Phase 6 — Enforce the beta scope

**Status: COMPLETE** · 7 of 7 sub-tasks

Executed and verified on 29 September 2026. The scope decision taken was to
**de-list** rather than delete: every route below still renders and still
resolves, but nothing advertises it and no search engine is asked to index it.
Deleting them would have broken the post-signin redirect, the admin console's
fallback route and any inbound link, for no security benefit — none of them are
reachable from the site once the manifest is applied.

## The structural fix

The sub-tasks below are all symptoms of one defect: the site had **six
independent navigation arrays** and no manifest, so "hide a page" was a
find-and-replace across every one of them. `lib/nav.ts` is now the single
source of truth, and `BETA_HIDDEN_ROUTES` is the one list that decides what is
advertised.

| Consumer | Was | Now |
|---|---|---|
| `Header` | `PRIMARY_NAV` + `MORE_NAV`, 14 items | imported from `lib/nav.ts`, 10 items |
| `Footer` | `FOOTER_COLS`, 15 links | imported from `lib/nav.ts`, 11 links |
| `BottomNav` | `ITEMS`, 5 items | imported from `lib/nav.ts` |
| `DashboardExplorer` sidebar | own `NAV`, 5 items | `DASHBOARD_NAV`, *derived* from `PRIMARY_NAV` |
| `app/sitemap.ts` | 23 hand-written entries | `SITEMAP_PAGES` + live slugs, filtered |
| `app/robots.ts` | 3 hardcoded paths | derived from the manifest |

`leakedManifestHrefs()` in `lib/nav.ts` returns any nav or footer href that
points at a de-listed route. It returns `[]`. This is the assertion Phase 7.4
turns into a test.

## Sub-tasks

- [x] **6.1** **Page manifest agreed and applied.** `BETA_HIDDEN_ROUTES` =
  `/mock-tests`, `/college-predictor`, `/plan`, `/ask-ai`, `/dashboard`.
  Removed from the header (4 entries), footer (3), mobile bottom bar, home-page
  quick-action grid, home hero CTA, home mock-test section, `/resources` hubs
  (3), and the `/courses/[slug]` CTA. `sitemap.ts` and `robots.ts` derive from
  the manifest.

  **Sitemap removal alone is not enough**, and this was a real gap: a page that
  still declares `index: true` stays in the index after its sitemap entry
  disappears. Each de-listed route therefore also spreads `BETA_NOINDEX` into its
  own `metadata`.
  *Verified in the build output:* `robots.txt` disallows all five;
  `sitemap.xml` (56 URLs) contains none of them; and `mock-tests.html`,
  `college-predictor.html`, `plan.html`, `ask-ai.html` and `dashboard.html` each
  emit `<meta name="robots" content="noindex, nofollow">`.

  `AskAiFab` — a floating 3D robot on *every page* linking to `/ask-ai` — was
  deleted rather than repointed. It was the largest single instance of the
  problem, and a persistent global entry point to an unthrottled metered LLM
  relay is a cost exposure on every page load, not only on the page it links to.
  Side effect worth recording: `three.js` and the 1 MB `bot_robot.glb` are no
  longer loaded by the root layout. `RobotViewer` survives on `/ask-ai` itself.

  Three routes are deliberately **kept in nav** and are not de-listed:
  `/dashboard` (it is the signed-in account page and the post-login redirect
  target), `/admission` and `/blog` (both are the primary lead-capture funnel).

- [x] **6.2** **Fabricated numbers deleted.** `/about` claimed "1,400+ colleges"
  and "2.4 lakh+ students/month"; `/login` claimed "Join 2.4 lakh+ students".
  The traffic figure was not stale — it was invented, and overstated the
  catalogue several times over on a public page.

  > **Correction, 28 September 2026:** this entry originally justified the fix by
  > saying "the real catalogue is 341 colleges", i.e. that the page overstated it
  > 4x. **That is no longer measurable** — the live `public` database holds **10**
  > colleges (see 0.2). The deletion is still correct and the `COUNT(*)`-driven
  > `AboutFacts` is still the right mechanism, because a count read from the
  > database cannot drift the way a typed constant does. But the *reason* the
  > entry gave would now be wrong, and it is a good illustration of the failure
  > this document exists to prevent: a fact stated here as verified was true for
  > one database and was reused as justification after that database changed.

  Both now render `COUNT(*)` values from `/api/v1/stats/catalog` through the new
  `AboutFacts` client component. **The traffic line is gone rather than
  substituted**, because it cannot be measured without analytics or request
  logging, and inventing a replacement would repeat the defect. The
  honest substitutes are the two things that *are* countable (colleges, courses,
  exams) plus founding year.

  While the request is in flight every count renders as an em dash, not `0` —
  "0 colleges" and "we have not asked yet" must not look identical, which is the
  exact conflation that made the old admin stats panel report a healthy API with
  every number at zero.

- [x] **6.3** **Contact identity unified.** The site carried **four** different
  contact points:

  | Site | Before | After |
  |---|---|---|
  | `/about` | `+91 90000 00000` | `SITE.phone` |
  | `/contact` | `support@padhaanewala.**com**` | `SITE.email` |
  | `/admission` | `counsellor@padhaanewala.**com**` | `SITE.email` |
  | `admin` settings | `support@padhaanewala.**com**` | `SITE.email` |
  | Footer socials | bare `https://instagram.com` etc. | `SITE.social.*` |

  The `.com` addresses are the significant finding: the site is `padhaanewala.in`
  and every legal document named `hello@padhaanewala.in`, so the address a
  customer was told to use for support was not the address that reached support,
  on a domain we may not control. `SITE` is now the only place a phone number or
  email is typed; the contact cards are real `tel:`/`mailto:`/`wa.me` links
  rather than unclickable text, and `SITE_ADDRESS_LINE` is shared with the legal
  copy.

- [x] **6.4** **`AdmissionForm` is submittable.** `ALL_STATES` and `ALL_DEGREES`
  are derived from the deliberately empty `COLLEGES` array, so both were
  permanently `[]`; validation required a state that a zero-option `<select>`
  could not offer. **The site's primary lead-capture form could not be
  submitted.**

  States now come from `/api/v1/locations/states` and courses from
  `/api/v1/courses` (paged). The design rule is that a required field never
  presents a zero-option dropdown:
  - while the request is in flight, a bundled fallback list is offered rather
    than a disabled control, so the form is fillable immediately;
  - if the lookup fails, the field degrades to **free text** rather than an
    empty list;
  - because `EnquiryCreate` has only nullable foreign keys for course and state,
    a free-text value is prepended to the enquiry `message` rather than being
    silently dropped. A lost state on a lead is a lost lead.

- [x] **6.5** **`/dashboard` resolved.** Kept, not deleted: it is the only place
  the signed-in saved-colleges list and notifications exist, and both are real.
  The "mockup of a different product" description no longer applies — it already
  read `SITE.name` and pulled `savedCollegeRecords` from the API.

  The live defect was dark mode: **every** surface was a hardcoded light-mode hex
  with no `dark:` variant, so a user who chose dark mode and then signed in got a
  white page. Colours are now declared once in a `T` token map at the top of the
  component rather than per element, so a new element picks up both themes by
  naming a token instead of inventing a hex.

  Also removed: a profile chip that was a `<button>` whose only action was a
  toast reading "Open your profile settings" — a control that led nowhere.

- [x] **6.6** **Double navigation resolved.** The sidebar is now `DASHBOARD_NAV`,
  *derived* from `PRIMARY_NAV` plus `/compare` pulled out of `MORE_NAV`. The
  duplicated list had already drifted: it carried a `/mock-tests` entry the
  header did not, and a `Settings`-icon link labelled "Reviews" that was neither.

  The global `Header`/`Footer`/`BottomNav` were **kept** on `/dashboard` and
  `/admin`, so the sidebar is a secondary nav rather than the only one. Hiding
  them was considered and rejected: it would cost the theme toggle and the
  account menu unless reimplemented, for a cosmetic gain.

- [x] **6.7** **Legal completion.**
  - **Grievance Officer — made impossible to ship past.** The IT Rules 2021
    r.3(2)(g) and the Consumer Protection Act 2019 both require a *named*
    officer. A name cannot be derived from code, so it is now
    `NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME` (plus an optional direct
    `..._PHONE`). Unset, the page keeps the honest "To be designated" wording and
    says out loud that it does not meet the requirement — rather than inventing a
    plausible person, which is what the original comment warned against.
    `next.config.ts` **refuses the build** when `APP_ENV=production` and the name
    is unset. This is the same class of guard as `app/config.py`, which already
    refuses to boot production on a placeholder secret. *Verified both ways:*
    `APP_ENV=production` with the variable empty fails the build with the
    statutory reason; with it set, the name renders on `/legal/grievance`.
  - **Standalone DPDP notice published** at `/legal/dpdp-notice`, with
    `/dpdp-notice`, `/dpdp` and `/notice` aliases. Section 5(1) requires each
    category of personal data to be set out against its **purpose, lawful basis
    and retention period**, and s.5(2) requires clear language and easy
    accessibility — a policy that also covers cookies, refunds and liability does
    not satisfy that on its own terms. The registry gained a `dl` block kind to
    carry the itemisation as a real definition list.

## Phase 6 exit criteria

| Gate | Result |
|---|---|
| `npm run typecheck` | **clean**, exit 0 |
| `npm run lint` | **exit 0**, 0 errors, 1 pre-existing warning |
| `npm run build` | **exit 0** |
| ISR windows | unchanged — `5m` / `10m` / `1y` all preserved |
| `robots.txt` | disallows all 5 de-listed routes + `/admin`, `/api` |
| `sitemap.xml` | 56 URLs, 0 de-listed routes |
| `noindex` | present on all 5 de-listed routes |
| `leakedManifestHrefs()` | `[]` |

## Found and fixed while executing

Not in the original sub-task list, and the same defect class as 6.2:

- [x] **The hero's largest CTA did nothing.** "Watch how it works — 2 min" on
  the homepage pointed at `#how-it-works`, and **no element on any page carried
  that id**. Removed rather than repointed: there is no video to link to.
- [x] **The footer linked other people's platforms.** Four social icons pointed
  at bare `https://instagram.com`, `https://linkedin.com`, `https://x.com` and
  `https://youtube.com` — the home pages of those platforms, not this company.
  Now `SITE.social.*`.
- [x] **The footer copyright named no legal entity**, which for an Indian
  company publishing a grievance policy is a gap in identifying who is
  responsible. Now carries the legal name and registered address.
- [x] **A lint error the tracker recorded as clean.** `npm run lint` did **not**
  pass before this phase. Moving the theme bootstrap to `public/theme-init.js`
  (Phase 5.1, uncommitted) turned `app/layout.tsx` into a render-blocking
  `<script src>`, which trips `@next/next/no-sync-scripts`. Suppressed with a
  scoped disable and a justification, because the script's entire job is to run
  before first paint. **The Phase 0/1 "lint clean" baseline no longer held.**

## Still open

- [ ] `app/about/page.tsx` "Data integrity" still claims data is "collected
  from verified sources and updated annually". Unverifiable from the code, and
  `cutoffs`/`placement_records` hold 0 rows. Not rewritten: it is brand prose
  rather than a number, and rewriting it is a content decision.
- [ ] Phase 7.4 wants "a test asserting the Phase 6 page manifest matches the
  navigation". `leakedManifestHrefs()` is the assertion and is written; the
  frontend has no test runner (7.5), so nothing executes it yet.

---

# Phase 7 — CI gate

**Status: NOT STARTED** · 0 of 5 sub-tasks

The existing workflow (`.github/workflows/backend-tests.yml`) runs the backend
suite on Python 3.14 against PostgreSQL 15 and is well constructed. It has a
large blind spot: **the frontend is not built or type-checked in CI at all**,
despite both scripts existing in `package.json`.

## Sub-tasks

- [ ] **7.1** Frontend CI job: `npm run typecheck` + `npm run lint` +
      `npm run build`. Both scripts exist and nothing runs them.
- [ ] **7.2** `pip-audit` and `npm audit` as gating steps.
- [ ] **7.3** A test asserting `.env.example` parses and that `Settings()`
      validates — the Phase 0 breakage was invisible to CI.
- [ ] **7.4** A test asserting the Phase 6 page manifest matches the navigation,
      so a hidden page cannot reappear in a menu.
- [ ] **7.5** Frontend test infrastructure (Vitest). The frontend currently has
      **zero** tests of any kind — no runner, no config, no test script — while
      `.gitignore` already ignores `/coverage` for a suite that does not exist.
      At minimum, cover the auth token layer before Phase 3 lands.

      > **Priority raised on 28 September 2026 by BUG-05.** The auth token layer
      > is not the only thing untested — the *data layer* is, and it is now
      > demonstrably wrong. `lib/api-server.ts:38` (`if (!res.ok) return null`)
      > converts every non-2xx into an empty result, so a page parameter bug
      > presents as a page that renders correctly with nothing in it. Two tests
      > would have caught BUG-05 on the day it was written:
      >
      > 1. `serverGet` returns something distinguishable for a 4xx than for a
      >    transport failure, and
      > 2. `PAGE_SIZE` never exceeds the backend's `le=` bound for the endpoint
      >    being paged — which, since the bounds differ per router, cannot be a
      >    single constant.
      >
      > Until that exists, every frontend "success" in this document is evidence
      > only that the route returned 200, never that it returned data.
- [ ] **7.6** **Close the gap BUG-01 exposed.** The 225-test suite passed while
      logout did nothing, because **no test ever logs out**. The regression tests
      Phase 3 must add are the single highest-value test work in the plan:
      - logout, then assert the refresh token is rejected
      - logout, then assert the access token is rejected
      - refresh, then assert the *previous* refresh token is rejected
      - replay a rotated-away token and assert the whole family is revoked
      - assert `HttpOnly`, `Secure` and `SameSite` are actually set on the
        refresh cookie
      Until these exist, a future change can silently reopen the same hole.

---

# Phase 8 — Deploy

**Status: NOT STARTED** · 0 of 5 sub-tasks

## Sub-tasks

- [ ] **8.1** Provision the VPS. Firewall to 80/443/22 only. Note
      `CVE-2026-75604` made Windows-hosted Next.js deployments a critical RCE;
      deploy on Linux.
- [ ] **8.2** **Generate real secrets** with `openssl rand -hex 32` for
      `SECRET_KEY`, `JWT_SECRET_KEY` and a distinct `JWT_REFRESH_SECRET_KEY`.
      The Phase 1 validators will hard-fail `APP_ENV=production` on any
      placeholder, which is the intended behaviour. Email, SMS and
      `EMAIL_FROM_EMAIL` must be real too, or the app refuses to boot rather than
      silently discarding every OTP.
- [ ] **8.3** `docker compose -f docker-compose.prod.yml up -d`, then
      `alembic upgrade head` and the seed scripts against the live database.
      Bootstrap the first admin with `seed_admin.py` (its
      `ADMIN_EMAIL_ALLOWLIST` gate is deliberate — do not bypass it).
- [ ] **8.4** Smoke test every route in the Phase 6 manifest. Confirm
      `/docs`, `/redoc` and `/openapi.json` return 404 externally.
- [ ] **8.5** Uptime monitoring and alerting. A monitoring system is the
      prerequisite for the DPDP breach obligations in Phase 9 — a breach
      timeline cannot be reconstructed from logs that were never written.

---

# Phase 9 — Legal and compliance

**Status: NOT STARTED** · 0 of 6 sub-tasks

Not part of the original eight phases, but it is a launch blocker rather than a
later improvement, so it is tracked here. The platform targets JEE and NEET
candidates, a material share of whom are **under 18**.

| Obligation | Source | Status |
|---|---|---|
| Reasonable security safeguards | DPDP S.8(5) | partial (Phases 1, 4, 5) |
| Breach notification — DPB **and** data principals | DPDP S.8(6) | not started |
| Detailed breach report within 72 hours | DPDP Rules 2025 | not started |
| CERT-In incident report within **6 hours** | CERT-In Directions 2022 | not started |
| Verifiable parental consent, under-18 | DPDP S.9 | **not started** |
| No behavioural monitoring of children | DPDP S.9 | **not started** |
| Data-principal requests answered within 90 days | DPDP Rules 2025 | not started |
| Retention limits and secure erasure | DPDP S.8(2) | not started |
| Grievance Officer appointed and published | Consumer Protection Act 2019 | not started |

- [ ] **9.1** **Age gate and parental-consent flow** (S.9). Highest financial
      exposure: **₹200 crore**. `AppContext` currently persists 13 behavioural
      keys to `localStorage` including `cp_search_history` and
      `cp_recent_locations`, and `student_profiles` collects name,
      education level, course interest, budget range and location. There is no
      age verification anywhere.
- [ ] **9.2** Appoint and publish the Grievance Officer (with 9.7).
- [ ] **9.3** Breach-response playbook: CERT-In at 6 hours, DPB at 72 hours,
      data principals without delay in plain language.
- [ ] **9.4** Data-principal request workflow with the 90-day SLA.
- [ ] **9.5** Retention and deletion job. No such job exists.
- [ ] **9.6** Encrypt or tokenise PII at rest, or document why it is not
      required.
- [ ] **9.7** Publish a standalone, itemised DPDP notice — not a bundled one.

**Maximum penalties:** ₹250 crore for no reasonable safeguards · ₹200 crore for
not reporting a breach · ₹200 crore for children's-data violations · ₹150 crore
for Significant Data Fiduciary breaches · ₹50 crore otherwise.

---

# Repository hygiene

**Status: NOT STARTED** · 0 of 5 sub-tasks

Not a launch blocker, but all of it is public in a public repository.

- [ ] **Delete the duplicated skill directories.**
      `padhaanewala/.agents/`, `.claude/` and `agent/` hold three parallel copies
      of the same two agent skills — **256 files, ~4.6 MB, about 45% of the
      working tree** — vendored documentation for a CSS framework already
      installed. Two of the three copies record `Status: Not initialized` and
      cannot answer a question; the three have already drifted apart; and the
      largest is screenshots of other people's editors.
- [ ] **Delete `DESIGN.md`.** It documents Clay.com's B2B brand system —
      cream canvas, "Plain Black" display face, claymation mascots — not this
      project.
- [ ] **Document the doubled `frontend/frontend/` path in `AGENTS.md`.** It is
      load-bearing: `tsconfig.json` maps `"@/*": ["./frontend/*", "./*"]` and
      every one of roughly 200 `@/components/*` imports resolves through the first
      entry. Simplifying that array to the conventional `"@/*": ["./*"]` breaks
      the entire build. Nothing in `README.md`, `AGENTS.md` or `CLAUDE.md`
      mentions it.
- [ ] **Fix the `frontend/package.json` name.** It reads `campus-pulse`, a
      leftover from a different project, and appears in every script header.
- [ ] **Clean `data/`.** `Padhaanewala_Data.xlsx` is a **PDF wearing an `.xlsx`
      extension** — byte-identical to `Hardcore_JEE_Mock_Paper_2_2026.pdf`. The
      remaining 11 files are raw spreadsheets and mock papers, not the CSV
      deliverables the specification requires.

---

# Progress summary

| Phase | Scope | Complete | Status |
|---|---|---|---|
| 0 | Make it run at all | 25 / 25 | **DONE** |
| 1 | P0 security | 22 / 22 | **DONE** |
| 2 | Containerisation | 0 / 6 | not started |
| 3 | Session security | 6 / 8 | **BUG-01 FIXED** (backend 3.2–3.5, 3.7; 3.6 & 3.8 pending) |
| 4 | Data leakage | 5 / 8 | **partial — 4.1, 4.4, 4.5, 4.6, 4.8 done; BUG-02 FIXED** |
| 5 | Headers + CSP | 5 / 5 | **DONE** — CSP + full header stack in `proxy.ts`, per-path Permissions-Policy, ISR preserved, real error reporting; see Phase 5 |
| 6 | Beta scope | 7 / 7 | **DONE** — manifest, live counts, contact identity, submittable funnel, dark-mode dashboard, Grievance Officer guard, DPDP notice |
| 7 | CI gate | 0 / 5 | not started |
| 8 | Deploy | 0 / 5 | not started |
| 9 | Legal / DPDP | 0 / 7 | not started |
| — | Repository hygiene | 0 / 5 | not started |

**70 of 109 sub-tasks complete.** The critical path to a deployable, defensible
product runs **2 → 3(finish) → 7 → 8**. The worst known defect — sessions
that could never be ended — is closed: rotation, reuse detection, real logout and
HttpOnly cookie delivery are implemented and verified. The remaining session work
(3.6/3.8) is hardening, not the critical hole. Phase 5 is closed: every response
now carries a CSP and the header stack, ISR revalidation is verified unchanged on
the wire, and `error.tsx` can no longer claim a notification it does not send —
the report hits the server log with a reference a user can quote.

**Phase 6 is closed.** The site no longer advertises a single feature it cannot
deliver: the four de-listed routes are out of the navigation, the footer, the
sitemap and the index, behind a single manifest in `lib/nav.ts` that
`leakedManifestHrefs()` asserts against. The primary lead-capture form is
submittable for the first time, the fabricated "1,400+ colleges" and "2.4 lakh+
students" are replaced by live `COUNT(*)` values, and the four competing contact
identities — including a `.com` support address on a `.in` site — are one. A
production build is now **refused** while the Grievance Officer is unnamed, and
the standalone DPDP s.5 notice is published at `/legal/dpdp-notice`.

**Re-measured 28 September 2026:** `pytest` reports **315 passed, 1 failed, 1
skipped**, not "315 passed, 1 skipped". The failure is a stale test meeting a
correct new constraint (BUG-06). The application itself is healthy — **0 × 5xx
across all 68 GET endpoints**. Three new defects were opened in the second-pass
bug register: **BUG-05** (a 422 silently becomes an empty page, so `/blog`
renders with no posts), **BUG-06** (the failing test, plus four migrations
applied to the database but absent from git — including `c3f81a4d7e29`, on which
Phase 3's "complete" status rests) and **BUG-07** (Redis down, so the rate-limiter
fallback is untested).

> **Internal inconsistency not resolved in this pass.** The Phase 0 section
> header says "8 of 8 sub-tasks" while this table says 25 / 25, and the
> per-section checkbox count supports 25. Phase 2's section is populated but is
> listed as 0 / 6, and Phase 6 has substantial content against 0 / 7. These
> predate this pass and were left alone rather than guessed at — the sub-task
> totals in this table should not be quoted until they are reconciled against
> the sections they summarise.

---

# Bug register

Bugs found by **executing** the running application on 28 September 2026, after
Phases 0 and 1 were verified green. The automated suite passed throughout —
225 tests, clean typecheck, clean lint, clean build — which is the point: none of
these are caught by the tests that exist. They were found by driving the live
API and reading the HTTP responses.

## BUG-01 — Sessions cannot be ended 🔴 CRITICAL

**Phase 3.** Reproduced against `http://127.0.0.1:8000` with a freshly
registered account.

```
refresh #1            200
REUSE old token       200   ← a replayed refresh token is accepted
logout                200   {"success":true,"data":{"received_refresh_token":true}}
refresh post-logout   200   ← a new token pair is still minted
access post-logout    200   ← the access token is still accepted
```

Three separate failures compound:

1. **`POST /auth/logout` is a no-op.** It returns
   `{"received_refresh_token": true}` and invalidates nothing. There is no
   denylist, no `jti` store and no `revoked_at`.
2. **Refresh tokens are never rotated.** `POST /auth/refresh` re-issues a fresh
   pair for any valid token, with no record of the previous one. The token
   minted in Phase 1.7 carries a `jti`, but nothing persists it.
3. **Replay is undetected.** Reusing a superseded refresh token succeeds, so
   token theft leaves no trace at all.

**Impact.** Anyone who walks away from an unlocked browser retains valid access
indefinitely, because logout → refresh yields a brand-new 30-day pair. The
30-minute access-token window is irrelevant: the refresh path never closes.
Combined with `localStorage` storage of the refresh token, a single XSS yields
permanent account takeover with no revocation path.

**Fix:** Phase 3 in full — 3.2 through 3.7.

**Status: FIXED (backend).** Implemented the `refresh_tokens` ledger
(`session_service.py`), rotation, family-wide reuse detection, a real logout
that revokes the family, password change/reset revoking every session, and
HttpOnly `SameSite=Strict` cookie delivery scoped to `/api/v1/auth` with a CSRF
Origin check. The refresh token is no longer present in any response body.
Verified by `tests/test_session_security.py` (22 tests) and live
(`REUSE old token -> 401`, `victim refresh after reuse -> 401`,
`refresh post-logout -> 401`). The local `c3f81a4d7e29` migration was
re-parented onto the remote question-type head (`d5f2a8c71e63`) so the alembic
chain is linear again. Frontend session hardening (access token out of
`localStorage`) remains open — 3.6/3.7.

## BUG-02 — Predictor advertises a field it rejects 🟠 HIGH

**Phase 4.** The two endpoints disagree about what an exam is.

```
GET  /api/v1/predictor/exams
     -> [{"slug":"neet-ug","name":"NEET UG"},{"slug":"jee-main","name":"JEE Main"}]

POST /api/v1/predictor  {"exam":"JEE Main",  "rank":5000,"category":"general"}
     -> 400  {"detail":"Invalid exam 'JEE Main'. Must be one of: neet-ug, jee-main, cuet-ug, kcet"}

POST /api/v1/predictor  {"exam":"jee-main",  "rank":5000,"category":"general"}
     -> 400  {"detail":"Invalid category 'general'. Must be one of: General, OBC, EWS, SC, ST"}

POST /api/v1/predictor  {"exam":"jee-main",  "rank":5000,"category":"General"}
     -> 200
```

Two mismatches:

1. `/predictor/exams` publishes a human-readable `name` alongside `slug`, but
   `POST /predictor` validates against `VALID_EXAMS` which holds **slugs only**.
   The field a user interface actually displays is the field the API rejects.
2. `VALID_CATEGORIES` is capitalised (`"General"`), so a lower-case
   `category: "general"` — the natural serialisation of a value a human typed —
   is rejected.

**Impact is currently low** because the frontend does not call this endpoint.
`PredictorForm.tsx` imports `predictColleges` from `lib/data/predictor`, a
client-side scoring function, and the backend router is entirely unused. It is
nonetheless a live trap for the first real API consumer, and the duplicated
scoring logic is itself a divergence risk: the two implementations will produce
different recommendations.

**Fix:** accept both `slug` and `name`, normalise case for `category`, and
decide whether the backend or the client owns prediction. Two implementations
of the same feature is the real defect.

**Status: FIXED.** `POST /predictor` now accepts both the slug and the published
`name` (mapped to its slug) and normalises `category` case-insensitively to the
canonical label, echoing the canonical values back. Verified live:
`{"exam":"JEE Main","category":"general"}` → `200 exam=jee-main category=General`.
The client/server duplication of scoring is tracked separately in Phase 4.

## BUG-03 — Auth rate limit too low for a multi-step flow 🟡 MEDIUM

**Phase 3, task 3.8.** While reproducing BUG-01 the limiter returned `429` after
five requests to `/api/v1/auth/refresh` within 60 seconds. That is the limiter
working correctly — but auth now has **eleven** endpoints, and a single sign-in
attempt can legitimately touch several of them:

```
/register  /login  /refresh  /logout  /verify-email  /verify-email/resend
/login/otp/send  /login/otp/verify  /verify-mobile/send
/verify-mobile/verify  /forgot-password  /reset-password
```

Buckets are keyed per path, which contains the damage, but five per minute is
still tight for a flow that now involves OTP and password reset. A user who
mistypes a password twice, then requests a reset, can lock themselves out with no
way to recover short of waiting.

**Fix:** separate, more generous buckets for non-credential operations
(`forgot-password`, `verify-*/resend`, `otp/send`), keeping the tight limit on
`login` and `refresh` where brute force actually matters.

**Status: FIXED.** `ratelimit.py` now applies 5/60s to credential endpoints
(`login`, `register`, `refresh`, `login/otp/verify`) and 20/60s to the rest of
the auth surface, still per-path.

## BUG-04 — PowerShell misreports HTTP error bodies on Windows 🟡 LOW

**Not an application bug. A testing trap, recorded because it caused a false
positive during this session.**

`Invoke-WebRequest` on a non-2xx response, followed by
`StreamReader(...).ReadToEnd()`, returned an empty `[]` for a body that was
actually present and correct:

```
PowerShell:  code=400  body=[]
httpx:       code=400  {"detail":"Invalid exam 'JEE Main'. Must be one of: ..."}
```

`[]` is PowerShell unrolling an empty result, not the server's response. Every
error body in the API is well-formed. When probing this API from Windows, use
`httpx`, `curl.exe` or a browser — do not conclude the server returned an empty
body.

---

# Bug register — second pass, 28 September 2026

Found by executing the running application on 28 September, after the tracker
above was rewritten. The application is healthy (0 × 5xx across 68 GET
endpoints); these are correctness and process defects, not outages.

## BUG-05 — A 422 is silently converted into an empty page 🟠 HIGH — **OPEN**

**The blog page renders with zero posts and no error of any kind.**

`lib/api-server.ts:69` sets one page size for the whole catalogue:

```ts
/** Must match the backend's `le=` bound; a 422 means the two have drifted. */
const PAGE_SIZE = 100;
```

`getBlogs()` defaults to `status=published` and goes through
`serverGetAllPaged`, so the request the frontend actually issues is:

```
GET /api/v1/blogs?status=published&limit=100&offset=0
```

`app/routers/blogs.py:95` caps that at **50**, so the response is a 422:

```
422 {"detail":[{"type":"less_than_equal","loc":["query","limit"],
     "msg":"Input should be less than or equal to 50","input":"100"}]}
```

The damage is done one line earlier. `lib/api-server.ts:38`:

```ts
if (!res.ok) return null;
```

A 422 is indistinguishable from "the backend is down", so it becomes `null`, then
`[]`, and `/blog` returns **HTTP 200** with an empty article grid. The comment at
`api-server.ts:68` predicted this exact failure and it has now happened.

**Why it matters more than an empty blog list:** the same failure mode applies to
*every* endpoint whose `le=` bound is below 100. Today only `blogs` (50),
`exams/upcoming` (50) and `seo` (500, but reached via `serverGetAll` not the
paged walk) differ. The next cap someone tightens re-arms this silently.

**Fix:** `PAGE_SIZE` cannot be a single constant. Either take it per call site,
or derive it from the endpoint. Silently swallowing `!res.ok` should at minimum
log the status and path — a failure-tolerant helper that cannot report failure
turns every future server error into an empty page.

**Evidence:** `422` on `?limit=100`; `200 []` on `?limit=50`; `/blog` → 200 with
91 KB of HTML and no posts.

## BUG-06 — One test fails; four applied migrations are untracked 🟠 HIGH — **OPEN**

### The failing test

```
FAILED tests/test_pagination_and_predictor_stability.py::
       test_catalog_cutoffs_paging_walks_every_row_exactly_once
psycopg2.errors.UniqueViolation: duplicate key value violates unique constraint
"uq_cutoff_identity_coalesce"
DETAIL:  Key (1, 0, , neet-ug, 2024, , , General) already exists.
```

**This is the test being stale, not the code being broken.** The NULL-safe
`cutoffs` constraint that Phase 4 lists as outstanding has landed, and it is
working correctly. `_insert_cutoffs` tries to insert six rows that are identical
in every identity column (`closing_rank__0` through `__5` are all 6000,
`opening_rank__0` through `__5` all 100, same year, same exam, same category) and
expects them all to land, because the test is exercising that pagination walks
every row. The new constraint correctly refuses them.

This is the same lesson as BUG-01 and as the `GET /blogs` view-count test, in a
third form: **a test that pins behaviour the fix deliberately changed has to be
updated to the new contract, not worked around.** The test needs the six rows to
differ in a column that is part of the identity, or it needs to drop the
constraint for its own fixture.

**Note this also contradicts a claim elsewhere in this document:** the count in
"What the automated checks did and did not prove" said `315 passed, 1 skipped`.
The suite currently reports **315 passed, 1 failed, 1 skipped**. Corrected there.

### The untracked migrations

`alembic upgrade head` has been run to `9f3c2a7e8d21`, and four migration files
are **applied to the database but absent from git**:

| Revision | File | Consequence |
|---|---|---|
| `c3f81a4d7e29` | `add_refresh_tokens.py` | Phase 3 is marked COMPLETE on the strength of this migration. It is not in the repository. |
| `9f3c2a7e8d21` | `add_cutoff_identity_coalesce_index.py` | The constraint that makes `test_suite` fail, and the fix for the Phase-4 `cutoffs` defect. Not in the repository. |
| `a7e4c1b93d02` | `add_question_subject_topic_numeric.py` | Not in the repository. |
| `d5f2a8c71e63` | `constrain_question_type.py` | Not in the repository. |

**This is the same class of failure as the 0.3 configuration corrections.** A
fresh clone migrates to `f1a7c9e2d3b4`, has no `refresh_tokens` table, and
`POST /auth/login` returns:

```
psycopg2.errors.UndefinedTable: relation "refresh_tokens" does not exist
INSERT INTO refresh_tokens (user_id, jti, family, ...)
```

— a 500 on every login, reproduced live on 28 September before `upgrade head` was
run. The fix works on this machine because the files are on disk. It does not
work for anyone who clones. Phase 3 cannot be called complete until these four
files are committed, and Phase 87 (CI) cannot be trusted until a clean clone is
proven to migrate to head.

There were also **69 uncommitted files** (41 frontend, 28 backend) at the time of
this pass, and `HEAD` had moved from the `719f09d` this document originally cited
to `96589ab` during the session.

## BUG-07 — Redis is not running, so the rate limiter is not cluster-wide 🟡 MEDIUM — **OPEN**

```
ERROR app.middleware.ratelimit - rate limiter degraded to in-process counters
(Redis unavailable); auth is still limited, per process
```

Phase 4's deliberate choice — degrade to a per-process counter rather than reject
every auth request while Redis is down — is working exactly as designed, and
`POST /auth/login` correctly returned 429-class behaviour rather than failing
open. But on a single-process dev box the fallback is indistinguishable from the
real limiter. Nothing about the Redis path is currently exercised on this
machine, and Phase 8 must not be signed off until it is.

---

# What the automated checks did and did not prove

| Check | Result | What it does **not** cover |
|---|---|---|
| `pytest` | **315 passed, 1 FAILED, 1 skipped** — re-run 28 Sep 21:25. See BUG-06. | Session rotation/reuse/logout is now covered by `tests/test_session_security.py`; Phase-4 leaks by `tests/test_data_integrity.py`; predictor by parameterised tests. What remains untested is the frontend auth layer (Phase 7.5). |
| `npm run typecheck` | clean | Nothing behavioural |
| `npm run lint` | 0 errors, 2 warnings (`FALLBACK_COURSES` unused in `AdmissionForm.tsx:38`; unused `e` in `public/theme-init.js:34`) | Nothing behavioural |
| `npm run build` | exit 0 | Nothing behavioural |
| Anonymous-access probe | all 401/403 | Nothing about session *termination* |
| **API sweep (28 Sep)** | **68 GET endpoints, 0 × 5xx**; 52 → 200; 14 → 401 anon / 200 as admin | No POST/PUT/PATCH/DELETE was called, so **no write path is covered by this number** |
| **Frontend routes (28 Sep)** | 19/21 → 200; `/terms-conditions` and `/legal/privacy-policy` → 404 | Only the shell renders; a 200 page can still display an empty section — see BUG-05 |

The lesson is specific and worth carrying into Phase 7: **the highest-severity
defect in the project was invisible to the test suite**, because the suite never
logged out. That specific gap is now closed with the 22-test
`tests/test_session_security.py` file (logout → refresh rejected, replay →
family revoked, HttpOnly/SameSite/Path asserted on the wire).

## Confirmed working during this pass

Recorded so the next session does not re-verify it:

- Student RBAC: 200 on `/users/me`, `/users/me/roles`, `/notifications/my`,
  `/saved-colleges`, `/consent`; **403** on `/leads`, `/roles`, `/audit-logs`,
  `/seo`
- Privilege escalation blocked: `PATCH /users/1` with `role_ids` → 403;
  `DELETE /colleges/{id}` → 403
- `limit` bounds enforced: `0`, `-5`, `abc` all 422
- OTP send returns a non-enumerating message — *"If that mobile is registered,
  an OTP is on its way."* — correct privacy behaviour
- Weak `reset-password` rejected 422; malformed verify/reset tokens rejected 422
- `TrustedHostMiddleware`: spoofed `Host` → 400, valid → 200
- Production guards refuse placeholder CORS, missing `ALLOWED_HOSTS`,
  `BCRYPT_ROUNDS=4`; a valid production config passes

---

Live issues, none of which are resolved by the phases above alone.

| Risk | Severity | Note |
|---|---|---|
| ~~BUG-01: sessions cannot be ended~~ | ~~Critical~~ | **FIXED** — ledger, rotation, reuse detection, real logout, HttpOnly cookie. See BUG-01. |
| Access token still in `localStorage`, JS-readable | High | Phase 3.6 — the refresh token is now a cookie; the access token remains memory/JS-visible and 30-min bounded |
| ~~BUG-02: predictor advertises `name` but rejects it; `category` case-sensitive~~ | ~~High~~ | **FIXED** — see BUG-02 |
| ~~BUG-03: auth rate limit 5/60s across all auth endpoints~~ | ~~Medium~~ | **FIXED** — per-endpoint limits. See BUG-03 |
| ~~No security headers, no CSP~~ | ~~High~~ | **FIXED** — Phase 5. Full stack in `proxy.ts`, per-path Permissions-Policy, ISR preserved. Residual: `'unsafe-inline'` in script-src (documented tradeoff) |
| No rate limit on `/api/ai`; unbounded OpenAI spend | High | Phase 4 — `/api/ai` now caps input (500 chars), rate (12/min) and timeout (15s); a plan-level budget is still open |
| Audit trail covers ~5% of mutations | High | Phase 4 |
| Client-controlled `ip_address` on public endpoint | High | Phase 4 |
| No children's-data controls (DPDP S.9) | High | Phase 9 |
| Duplicate predictor logic in client and server | Medium | Phase 4, with BUG-02 |
| ~~`error.tsx` claims a team was notified; nobody is~~ | ~~Medium~~ | **FIXED** — Phase 5.4. reportError → /api/errors → server log; onRequestError for server errors; global-error.tsx exists; copy no longer claims a delivery it cannot promise |
| Dashboard has no dark mode; duplicate navigation | Medium | Phase 6 |
| Fabricated public metrics | Medium | Phase 6 |
| Dormant DB tables render as broken pages | Medium | Phase 6 |
| ~~56 of 60 documented env vars are unread~~ | ~~Low~~ | **FIXED** — Phase 5.5. 45 removed, each traced to the code that reads it. `.env.prod.example` still lists three phantom guards (see Phase 8.2) |
| 4.6 MB duplicated agent-skill bundles | Low | Hygiene |
| BUG-04: PowerShell misreports error bodies on Windows | Low | Testing only, not application |
