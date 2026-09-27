# Padhaanewala — Security & Deployment Phase Tracker

> **Status as of 28 September 2026**
> Branch `main` · HEAD `719f09d`
> **Phases 0 and 1 complete and verified (47 sub-tasks). Phases 2–9 not started.**
> **1 Critical and 1 High bug confirmed by running the app — see Bug register.**

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

**Status: NOT STARTED** · 1 of 7 sub-tasks

The single highest-severity item outstanding. Today a stolen refresh token is
valid for 30 days with **no revocation path whatsoever**.

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

**Status: NOT STARTED** · 0 of 8 sub-tasks

Targeted specifically at preventing personal data reaching unauthorised parties.

## Sub-tasks

- [ ] **4.1** **`POST /api/v1/enquiries` must derive `ip_address` server-side.**
      The schema accepts it from the client
      (`app/schemas/catalog.py` → `app/routers/enquiries.py`), on an
      *unauthenticated* endpoint. A caller can currently write arbitrary strings
      into the CRM table counsellors work from. `consent.py` already derives it
      correctly — copy that approach.
- [ ] **4.2** **Rate limiter fails closed on `/auth`.** It currently does
      `except redis.RedisError: pass`, so a Redis hiccup removes throttling
      from the login path entirely. That is precisely the moment an attacker
      wants.
- [ ] **4.3** **Async Redis client.** `ratelimit.py` uses the synchronous
      `redis.Redis` inside an async middleware, blocking the event loop on a
      network round trip for every write request.
- [ ] **4.4** **Audit every mutation.** Coverage is roughly 5%: only
      `PATCH /users/{id}`, `PUT /users/me/password`, blog update/delete and
      review moderation. Not logged: college delete, all 21 enrichment writes,
      lead assignment, banner/FAQ/media/SEO writes, blog create.
- [ ] **4.5** **Include `ip_address` in audit rows.** The three existing writers
      build `AuditLog` without it.
- [ ] **4.6** **Fix `GET /blogs/{ref}` mutating `view_count`.** A GET that
      increments a counter and commits is neither safe nor idempotent, and the
      counter is trivially inflatable with a loop.
- [ ] **4.7** **Harden `/api/ai`.** Currently unauthenticated, unthrottled, with
      no input-length cap and no `AbortSignal` timeout. Two risks: direct cost
      exhaustion, and an open prompt-injection relay into the LLM.
- [ ] **4.8** **Rate-limit or authenticate `/api/stats`** (now a single
      `COUNT(*)` request, much cheaper than before, but still unauthenticated).

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
      and placement data. Un-audited, `super_admin`-only.
- [ ] `CollegeDetailResponse` is constructed in four separate places and has
      already drifted in risk.
- [ ] N+1 queries in the audit log list and in every enrichment serializer.

---

# Phase 5 — Security headers and CSP

**Status: NOT STARTED** · 0 of 5 sub-tasks

There are currently **no security headers of any kind**. `next.config.ts` defines
`images`, `rewrites` and `redirects` and nothing else, and there is no
`middleware.ts` anywhere in the frontend. Missing: Content-Security-Policy, HSTS,
`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`.

This matters more than usual because *Security Misconfiguration* moved from #5 to
**#2** in the OWASP Top 10:2025, driven largely by exactly this pattern —
containerised, API-rich deployments where defaults are rarely secure.

## The trap in this phase

Nonce-based CSP forces dynamic rendering, which would **destroy the ISR windows**
across roughly 20 routes (300s and 600s). This must be solved before writing a
single header.

**Solution:** externalise the theme script. `app/layout.tsx` currently injects a
blocking inline `<script>` that reads `cp_theme` from `localStorage` to set the
dark-mode class before paint. Move it to `public/theme-init.js` and load it
synchronously. Then `script-src 'self' 'strict-dynamic'` works with **zero inline
script** and ISR survives.

`style-src` will need `'unsafe-inline'` — Tailwind v4 `@utility` and
`globals.css` depend on it. Styles are the lower-risk half of the policy and the
tradeoff should be recorded rather than hidden.

## Sub-tasks

- [ ] **5.1** Move the theme bootstrap script to `public/theme-init.js`.
- [ ] **5.2** Add `middleware.ts` with CSP, plus HSTS, `nosniff`,
      `X-Frame-Options: DENY`, `Referrer-Policy` and `Permissions-Policy`.
      Account for `worker-src blob:` and `connect-src` required by the
      `three`/GLTF robot.
- [ ] **5.3** Keep ISR working. Verify `generateStaticParams` still prerenders
      and revalidation windows are unchanged after the change.
- [ ] **5.4** **Real error reporting.** `app/error.tsx` renders the literal
      string *"Our team has been notified"* and **notifies no one** — there is no
      Sentry, no `console.error`, no reporting SDK. It also discards the `error`
      and `digest` props entirely, and there is no `app/global-error.tsx`.
- [ ] **5.5** **Prune `.env.example`.** Roughly 56 of its 60 variables are read
      by nothing: Celery, S3/R2, SMS, SMTP, Sentry, GA4, WhatsApp, pgvector,
      proctoring, and every `CACHE_TTL_*` key. They document subsystems that do
      not exist, which is how `.env.example` drifted from the code in Phase 0.

---

# Phase 6 — Enforce the beta scope

**Status: NOT STARTED** · 0 of 7 sub-tasks

Database contents as measured this session:

| Table | Rows | Consequence |
|---|---|---|
| colleges | 341 | usable |
| courses | 22 | usable |
| exams / scholarships | 6 / 6 | usable |
| **mock_tests / test_questions** | **0 / 0** | mock-test runner loads zero questions |
| **cutoffs / seat_matrix** | **0 / 0** | predictor returns the empty-data path |
| **placement_records** | **0** | no placement data anywhere |
| **blogs / faqs / banners / reviews** | **0** | these pages render empty |

The backend is sound. The catalogue is not. Three shipped pages are therefore
structurally incapable of working: `ProctoredMockTest` reads an empty
`QUESTION_BANK` with no server-data escape hatch; `ExamPlanner` maps over an
empty array; `AdmissionForm` renders a required state `<select>` with zero
options, so **the site's primary lead-capture funnel cannot be submitted**.

## Page manifest

| Keep | Hide or remove |
|---|---|
| `/` `/colleges` (+`[slug]`) `/courses` (+`[slug]`) `/exams` (+`[slug]`) `/scholarships` `/about` `/contact` `/legal/*` | `/mock-tests` (0 questions) · `/college-predictor` (0 cutoffs) · `/plan` (dead) · `/dashboard` (see below) · `/ask-ai` (OpenAI cost) |

## Sub-tasks

- [ ] **6.1** Agree and apply the page manifest: remove from navigation, footer,
      `sitemap.ts` and `robots.ts`.
- [ ] **6.2** **Delete fabricated numbers.** `/about` claims "1,400+ colleges" and
      "2.4 lakh+ students/month"; `/login` claims "Join 2.4 lakh+ students". The
      real figure is 341 colleges. A public page understating nothing and
      overstating everything is a reputational and consumer-protection risk.
- [ ] **6.3** **Unify the contact identity.** Three different phone numbers
      across the site, and `.com` email domains while `lib/site.ts` declares the
      domain as `.in`.
- [ ] **6.4** **Make `AdmissionForm` submittable.** It is the lead-capture
      funnel. `ALL_STATES` and `ALL_DEGREES` are derived from the emptied
      `COLLEGES` array and are therefore permanently `[]`; validation requires a
      state that the dropdown cannot offer.
- [ ] **6.5** **Resolve `/dashboard`.** It is a mockup of a different product —
      brand "EduPath", saved items listed as Levi's and New York Times
      internships — and it is the first thing every logged-in user sees. It also
      has **no dark-mode variants** (hardcoded hex, no `dark:` classes), so the
      global theme toggle does nothing on that page.
- [ ] **6.6** **Decide the double navigation.** The global `Header` and the
      dashboard sidebar duplicate the same links in two independently hardcoded
      arrays, which will drift. Either hide the global header on `/dashboard`
      and `/admin`, or have the sidebar reuse `PRIMARY_NAV`/`MORE_NAV`.
- [ ] **6.7** **Legal completion.** Appoint and publish the **Grievance Officer**
      (already flagged as launch blocker M6); publish a standalone DPDP notice.

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
| 3 | Session security | 1 / 8 | **BLOCKED BY BUG-01** |
| 4 | Data leakage | 0 / 14 | not started — **BUG-02** |
| 5 | Headers + CSP | 0 / 5 | not started |
| 6 | Beta scope | 0 / 7 | not started |
| 7 | CI gate | 0 / 5 | not started |
| 8 | Deploy | 0 / 5 | not started |
| 9 | Legal / DPDP | 0 / 7 | not started |
| — | Repository hygiene | 0 / 5 | not started |

**48 of 109 sub-tasks complete.** Phases 0 and 1 are closed. The critical path
to a deployable, defensible product runs **2 → 3 → 4 → 5 → 7 → 8**. Phase 3 is
the one change that should get its own branch and its own review, because it
rewrites session handling end to end and a mistake there either locks every user
out or, worse, leaves sessions revocable in name only.

**Phase 3 is no longer merely the largest remaining item — it is where the worst
known defect in the project lives.** BUG-01 means that today, logging out does
nothing: the logout endpoint succeeds, the access token keeps working, and the
refresh token mints a brand-new 30-day pair on demand. Nothing built on top of
this should go live before that is fixed.

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

# What the automated checks did and did not prove

| Check | Result | What it does **not** cover |
|---|---|---|
| `pytest` | 225 passed, 1 skipped | BUG-01, BUG-02, BUG-03. All three are *runtime behaviour*; the suite asserts on isolated handler logic and never performs a logout-then-refresh sequence. |
| `npm run typecheck` | clean | Nothing behavioural |
| `npm run lint` | clean | Nothing behavioural |
| `npm run build` | exit 0 | Nothing behavioural |
| Anonymous-access probe | all 401/403 | Nothing about session *termination* |

The lesson is specific and worth carrying into Phase 7: **the highest-severity
defect in the project is invisible to the test suite**, because the suite never
logs out. A three-line test — logout, then assert the refresh token is rejected —
would have caught BUG-01, and the assertion is exactly what Phase 3 must add.

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
| **BUG-01: sessions cannot be ended — logout is a no-op, refresh tokens never rotate, replay undetected** | **Critical** | **Empirically confirmed. Phase 3** |
| Refresh token in `localStorage`, 30-day, unrevocable | **Critical** | Phase 3 |
| **BUG-02: predictor advertises `name` but rejects it; `category` case-sensitive** | **High** | **Empirically confirmed. Phase 4** |
| **BUG-03: auth rate limit 5/60s too low for an 11-endpoint multi-step flow** | **Medium** | **Empirically confirmed. Phase 3.8** |
| No security headers, no CSP | High | Phase 5 |
| No rate limit on `/api/ai`; unbounded OpenAI spend | High | Phase 4 |
| Audit trail covers ~5% of mutations | High | Phase 4 |
| Client-controlled `ip_address` on public endpoint | High | Phase 4 |
| No children's-data controls (DPDP S.9) | High | Phase 9 |
| Duplicate predictor logic in client and server | Medium | Phase 4, with BUG-02 |
| `error.tsx` claims a team was notified; nobody is | Medium | Phase 5.4 |
| Dashboard has no dark mode; duplicate navigation | Medium | Phase 6 |
| Fabricated public metrics | Medium | Phase 6 |
| Dormant DB tables render as broken pages | Medium | Phase 6 |
| 56 of 60 documented env vars are unread | Low | Phase 5.5 |
| 4.6 MB duplicated agent-skill bundles | Low | Hygiene |
| BUG-04: PowerShell misreports error bodies on Windows | Low | Testing only, not application |
