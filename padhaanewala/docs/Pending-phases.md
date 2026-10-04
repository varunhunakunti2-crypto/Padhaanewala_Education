# Padhaanewala — Security & Deployment Phase Tracker

> **Status as of 4 October 2026 (completion pass)**
> Branch `main`
> **Phases 0–7 complete. Phase 9 complete except 9.2, which the owner has
> decided to skip rather than block on. Phase 8 (deploy) has been formally
> descoped by decision — it is not started and will not be. Repository hygiene
> stands at 3 of 5 with both remaining deletions declined by decision, so those
> two are closed as won't-do rather than left open.**
>
> **Test counts measured today: backend 561 passed, 1 skipped (Redis *up*, so
> all 11 live rate-limiter tests ran rather than skipped; the 1 skip is the
> pre-existing `test_rbac_rules.py` demotion case). Frontend 413 passed (17
> files). Typecheck, lint and `next build` all clean.**
>
> **Three things were closed in this pass, none of them in the register:**
>
> 1. **Every admin mutation is now audited** (Phase 4.4). The register listed
>    enrichment, lead assignment, banner/FAQ/media/SEO and blog create; the
>    catalog routers nobody had listed — courses, exams, universities,
>    scholarships, notifications, review delete, mock-test paper and question
>    CRUD — were equally bare. 40 handlers in, one shape each.
> 2. **An essay can now be marked.** `pending_review_count` had no write path
>    behind it, so a written answer stayed at zero marks for the life of the
>    account. Migration `c2a7e9f4b613`, a grading endpoint, a review queue and
>    13 tests.
> 3. **The admission-status filter on list pages works.** `/colleges` carried
>    no dates, so `mapCollegeListItem` passed `admissions: []` and every row
>    reported `"upcoming"` — filtering by "open" or "closed" matched nothing.
>
> **One defect was found by running the suite in the CI configuration**, and it
> is the most expensive bug in the register: see **BUG-13**.
>
> **Four entries in this tracker were stale and are corrected below.** Each was
> checked against the source, not against the tick-box:
>
> | Entry | Was recorded as | Actually |
> |---|---|---|
> | 4.3 async Redis | "synchronous client blocks the event loop" | **Already fixed.** `redis.asyncio` throughout (`app/services/redis_client.py`), awaited at `app/middleware/ratelimit.py:148` |
> | non-MCQ always graded incorrect | "essays/numerics always score zero" | **Was never true.** `numeric` is auto-graded with tolerance (`mock_tests.py:267`); `essay` returns `None` → *pending review*, not incorrect (`:201-208`). No short/long-answer types exist. |
> | BUG-05 | open | Closed in the 29 Sep pass, and now structurally guarded: `tests/page-size-contract.test.ts` reads the Python `le=` bounds and fails if the frontend's declared page sizes exceed them |
> | BUG-09 | open | Closed in the 28 Sep pass |
>
> **One genuine defect was found and fixed today**, and it was not in the
> register: all eight enrichment foreign keys (cutoff, NIRF/other rankings,
> placements, seat matrix × college and course) were `ON DELETE CASCADE` while
> nullable, so deleting one college destroyed a decade of published rank history
> via the database. Now `ON DELETE SET NULL` (migration `b4e8f2a71d09`), with a
> 409 rather than a 500 when a detach would collide with an already-unattributed
> cutoff. See Phase 4.
>
> **The bug register carries one open entry, BUG-13, and it is closed in the
> same section it was found.** BUG-01 through BUG-12 are all resolved; BUG-04
> is a testing-environment caveat, not an application defect.

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

**Status: COMPLETE** · 6 of 6 sub-tasks

Executed and verified on 29 September 2026 by building both images and driving
the running stack. Four of the six sub-tasks had been drafted in the working tree
but **never executed**; three of those four were broken, and the build passing is
what hid them. See "Found by running it".

Target topology, as built:

```
Internet ──:443──> Caddy (automatic TLS)
                     ├── /*          → frontend:3000  (Next.js standalone)
                     ├── /health    → backend:8000   (the one direct hop)
                     └── /api/v1/*   → frontend:3000  → Next's own rewrite
                                        → backend:8000  (internal only)
```

## Sub-tasks

- [x] **2.1** **`output: "standalone"` added** to `next.config.ts`. This was the
      only genuinely missing piece of the six; everything else existed but could
      not have worked without it, because the frontend Dockerfile's runtime stage
      copies `.next/standalone` and that directory did not exist.
      *Verified:* `npm run build` exits 0 and `.next/standalone/server.js` is
      emitted. Two consequences recorded in the file: `next start` stops working
      (standalone is served by `node server.js`), and `public/` and
      `.next/static/` are deliberately not in `standalone`, so the Dockerfile
      copies both explicitly.

- [x] **2.2** **`backend/Dockerfile`.** `python:3.14-slim` pinned by
      linux/amd64 digest, non-root `appuser` (uid 1001) with `/usr/sbin/nologin`
      and no home directory, app code owned `root:root` and read-only to the app
      user, healthcheck on `/health`.
      *Verified in the built image:* `uid=1001(appuser)`; `/usr/sbin/nologin`
      present; **no `gcc` and no `cc`**, so a missing wheel is a fast failure
      rather than a slow Rust build (the Phase 0.1 trap); `tests/`, `venv/` and
      `.env.development` all absent; `scripts/purge_demo_data.py` excluded while
      the eight seed loaders are present. 84.6 MB.

- [x] **2.3** **`frontend/Dockerfile`.** Three stages; the runtime image copies
      the standalone output only.
      *Verified in the built image:* no `/app/app` (no source tree), no
      `node_modules/typescript` or `node_modules/eslint` (no dev deps), while
      `/app/.next/static` and `/app/public` **are** present — their absence is
      what produces a site serving HTML with every stylesheet and script 404ing.
      86.6 MB, against 478 MB of host `node_modules`: a 5.5x reduction, and the
      35 MB of traced `standalone` output against 478 MB is 13x.

- [x] **2.4** **`docker-compose.prod.yml`.** All five services, no obsolete
      `version:` key, `restart: unless-stopped` throughout, and
      `depends_on: condition: service_healthy` chaining db+redis → backend →
      frontend → caddy.
      *Verified from `docker compose config --format json`:*

      | service | published on the host |
      |---|---|
      | `caddy` | 80, 443/tcp, 443/udp |
      | `backend` | **(none)** |
      | `db` | **(none)** |
      | `redis` | **(none)** |
      | `frontend` | **(none)** |

      That is the property the whole phase exists to enforce, and it holds:
      `docker ps` shows `8000/tcp`, `5432/tcp`, `6379/tcp` and `3000/tcp` for the
      other four — exposed on the Compose network, never on the host.

- [x] **2.5** **`docker/Caddyfile`.** Automatic TLS via the ACME HTTP-01
      challenge (port 80 published for exactly that reason and answered before
      the 443 listener exists), `encode zstd gzip`, `-Server` banner strip.
      *Verified:* `Content-Encoding: gzip` on a gzip-accepting request; neither
      `Server` nor `X-Powered-By` present in the response.

      **HSTS is now set at the edge as well as in `proxy.ts`.** The Caddyfile had
      been written to defer every security header to the application, on the
      reasoning that `Permissions-Policy` is per-path and the browser intersects
      policies. That reasoning is correct for `Permissions-Policy` and wrong for
      HSTS: HSTS is the one header that must not depend on the application being
      up and correct, because a 500 from a bad deploy is precisely when a browser
      should be recording that the host is HTTPS-only. It also covers the
      responses Caddy generates itself and never forwards. Browsers take the
      strictest HSTS they are offered and the two values are identical, so there
      is nothing to intersect. CSP, `X-Frame-Options`,
      `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy` remain
      app-only, for the reason the Caddyfile already gave.
      *Verified on a live response:* all six headers present, with
      `Permissions-Policy` denying `camera=()` site-wide.

- [x] **2.6** **`.dockerignore` for both contexts.** `frontend/` and `backend/`
      both exclude `.env*`, `*.log`/`*.err`/`*.out`, virtualenvs, build output
      and `node_modules`. The `bot_robot.glb` duplicate needs no entry: it lives
      one level *above* both build contexts, so it cannot be sent to the daemon.
      The duplicate is still worth deleting from the repository — see
      "Repository hygiene".
      *Verified:* the built images contain no `.env.development`, no `tests/`,
      no `venv/`.

## Verification

The production Caddyfile cannot be exercised on a laptop: it requests a
certificate for `SITE_ADDRESS`, and a dev machine has no public DNS record and
cannot answer the challenge. `docker-compose.localtest.yml` was added to close
that gap — it changes **only** the host-side port numbers and the project name,
and it mounts the real `docker/Caddyfile` unmodified.

An earlier draft of that file also mounted a duplicate `Caddyfile.localtest` with
`tls internal`, on the assumption that a public CA could not issue for
`localhost`. **That assumption was wrong** — Caddy already special-cases
`localhost`/`.localhost` and issues from its own internal CA automatically — so
the duplicate was deleted. Two Caddyfiles meant to stay in step are a drift risk
with no upside, and the point of the exercise is to test the file that ships.

```
docker compose --env-file .env.localtest \
  -f docker-compose.prod.yml -f docker-compose.localtest.yml up -d
```

`docker compose ps` — **all five healthy**:

| service | status | host ports |
|---|---|---|
| db | healthy | — |
| redis | healthy | — |
| backend | healthy | — |
| frontend | healthy | — |
| caddy | healthy | 18080→80, 18443→443 |

Driven end to end against `https://localhost:18443`:

| Check | Result |
|---|---|
| `/`, `/colleges`, `/about`, `/admission`, `/login`, `/legal/dpdp-notice` | **200** |
| `/health` (Caddy → FastAPI directly) | **200**, `PostgreSQL answered SELECT 1 in 2.3 ms`, `Redis answered PING in 0.6 ms` |
| `/healthz` (Caddy's own route, no proxy) | **200** |
| `/api/v1/roles` unauthenticated | **401** |
| `/api/v1/stats/catalog` | **200** `{"colleges":331,"courses":22,"exams":6,"scholarships":6,...}` |
| `/api/v1/colleges?limit=3` | **200** |
| `POST /api/v1/enquiries` | **201**, row readable back out of the containerised Postgres |
| `/docs`, `/redoc`, `/openapi.json` | **404** — not externally reachable |
| security headers | CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` all present |
| Grievance Officer on `/legal/grievance` | renders the configured name |
| production guards, placeholder secrets | **refused at startup** (`JWT_SECRET_KEY must be set in production`) |
| production guards, empty officer name | **refused at build** (two layers — below) |

`output: "standalone"` did not disturb ISR: revalidation windows are unchanged at
5m/10m/1y.

## Found by running it

Four of the six files were already drafted. Executing them is what found the
defects — which is the same lesson as Phase 0, where a green build only meant the
database was empty.

- [x] **The entrypoint had never run.** `docker-entrypoint.sh` shipped with
      **CRLF** line endings, so its shebang was `#!/bin/sh\r` and the kernel
      looked for an interpreter literally named `sh\r`. Every container
      restart-looped with:

      ```
      exec /usr/local/bin/docker-entrypoint.sh: no such file or directory
      ```

      For a file that was present, present and executable in the image. The
      image built cleanly and `ls -l` showed the file, so neither the build output
      nor an inspection of the image would have caught it. Cause:
      `core.autocrlf=true` is the Windows default and rewrites LF to CRLF on
      checkout, so this recurs on every clone on a dev machine.
      *Fixed three ways:* the file is LF; `.gitattributes` now pins
      `*.sh text eol=lf` (plus Dockerfiles, Caddyfiles, YAML, Python and lockfiles)
      so it survives a re-clone; and the Dockerfile normalises CRLF after `COPY`
      and **fails the build** if the shebang is still unusable, so a checkout that
      predates the `.gitattributes` cannot ship a broken image silently.

- [x] **The entire API answered 400 while every page returned 200.** Next's
      `rewrites()` proxy sets the `Host` header to the rewrite destination, so
      FastAPI saw `Host: backend:8000` and Phase 1's `TrustedHostMiddleware`
      rejected it: `400 Invalid host header`. The site looked alive — pages are
      served by Next and never touch the backend — while the API was entirely
      dead. The tell is `/health`, which the Caddyfile proxies *directly* to the
      backend and so preserves the original Host: 200 there, 400 everywhere else.
      *Fixed:* `ALLOWED_HOSTS` now appends `backend`, which is safe because that
      name is unpublished and unresolvable off the Compose network.

- [x] **`NEXT_PUBLIC_*` cannot be supplied at runtime.** Compose passed the
      Grievance Officer name as a container environment variable, but
      `NEXT_PUBLIC_*` is compiled into the client bundle — so the image would
      have baked `To be designated` into `/legal/grievance` no matter what the
      container's environment said, and Phase 6's guard would have been
      decorative. *Fixed:* declared as `ARG`s in the Dockerfile and passed via
      `build.args`, with `APP_ENV=production` in the builder so the Phase 6 guard
      fires **at image-build time**.
      *Verified both layers:* `docker compose config` refuses an empty value
      (`required variable NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME is required`), and
      forcing past that, `next build` inside the image fails with the statutory
      reason. A rebuild with a different name changes the compiled bundle
      (`/app/.next/server/chunks/ssr/lib_legal_ts_*.js`).

- [x] **`ENV HOSTNAME=0.0.0.0` in the frontend Dockerfile was dead code.**
      Docker injects `HOSTNAME` into every container, overriding the image value,
      so the setting was discarded while its comment claimed to prevent exactly
      the failure it could not prevent. *Fixed:* removed from the Dockerfile
      (with a comment saying why it cannot work there) and set as a runtime
      `environment:` value in Compose, which does win.

Also fixed while executing: a malformed `scripts/!purge_demo_data.py` pattern in
`backend/.dockerignore` (a `!` mid-path is not a negation — negations must lead
the line), and the addition of `SITE_ADDRESS`, `ACME_EMAIL`, `RUN_MIGRATIONS` and
`RUN_SEEDS` to `.env.example`, which `docker-compose.prod.yml` requires and the
template did not document.

## Corrected after measurement

- **`TRUSTED_PROXY_HOPS` stays at `1`.** The compose file's comment claimed "one
  proxy sits in front of the app" while the topology has two, and the obvious
  fix — bump it to 2 — is wrong. Measured by submitting an enquiry through the
  full stack and reading `enquiries.ip_address` back out of the database: XFF
  arrives as a **single entry**, because Next relays the header without appending
  the peer it observed. At `hops=1` the recorded value is the real caller's
  address on the Docker bridge (`172.25.0.1`), not a container address. At
  `hops=2` the index goes negative, `client_ip()` decides the chain is
  untrustworthy, and falls through to the socket peer — which comes out right
  only by accident. A value that is correct for an accidental reason is one edit
  away from silently not working, so the reasoning is now recorded in the file.

- **`--forwarded-allow-ips "*"` in the backend Dockerfile is a coupling, not a
  free choice.** It is safe *only* because the backend publishes no port, so the
  only callers are containers on the private network. Two independent
  implementations of "what is the client IP" are live in that process: uvicorn's
  `ProxyHeadersMiddleware` rewrites `request.client` from the header before any
  application code runs, and `client_ip()` reads the header again. Verified: with
  `TRUSTED_PROXY_HOPS=0` — which should ignore the header entirely — the
  forwarded address is still what gets recorded, because uvicorn has already
  rewritten `request.client`. `app/routers/consent.py:49` reads
  `request.client.host` directly rather than going through `client_ip()`, so it
  depends on the uvicorn half. Recorded in the Dockerfile: do not narrow the `*`
  to a subnet without also moving `consent.py` to `client_ip()`. **Not changed
  here** — it touches Phase 4's consent audit trail, and is a Phase 1/4 item.

- **`tls` is a site-level Caddy directive, not a global one.** The discarded
  `Caddyfile.localtest` put it in the global block, and every container
  restart-looped with `unrecognized global option: tls`. Noted because the
  fixture is gone and the trap is easy to re-introduce.

## Still open

- [ ] **A real ACME issuance is unverified.** Everything above uses Caddy's
      internal CA via the `localhost` special case. Public issuance, a trusted
      chain, the real domain and DNS are Phase 8, and cannot be rehearsed on a
      laptop. Phase 8's evidence should therefore read "deployed and measured",
      not "expected to work".
- [ ] **Real email and SMS delivery is unverified.** The local env file carries
      shape-valid but non-functional provider credentials, because the production
      guards correctly refuse `console`. Sending is Phase 8.
- [ ] **`ALLOWED_HOSTS` now contains `backend`.** Documented and safe under the
      current topology, but it is a real widening of the Phase 1 allowlist and
      should be revisited if the backend is ever published.
- [ ] **Shell environment beats `--env-file`.** Compose gives the shell
      precedence, so a stray exported variable silently overrides the env file.
      Observed directly: exporting `JWT_SECRET_KEY` and
      `JWT_REFRESH_SECRET_KEY` as the same value made the backend refuse to boot
      with `JWT_REFRESH_SECRET_KEY must differ from JWT_SECRET_KEY` even though
      `.env.localtest` set them correctly. Worth stating in the deploy runbook.

---

# Phase 3 — Session security

**Status: COMPLETE** · 8 of 8 sub-tasks

Split across two sessions. On 28–29 September 2026 the backend half landed: the
`refresh_tokens` ledger, rotation, reuse detection, real logout, HttpOnly-cookie
delivery and per-endpoint auth throttling — verified by `tests/test_session_security.py`
(23 tests) and by driving the live API. On 29 September 2026 the frontend half
landed: the access token moved out of `localStorage` and the session is now
re-established by a silent refresh, coordinated across tabs. Evidence below.

**Note on the checkboxes:** 3.2–3.5, 3.7 and 3.8 were left unticked in the
original document even though the prose above them and BUG-01/BUG-03 both recorded
them as fixed. The prose was right and the checkboxes were stale; they are now
ticked to match.

## Sub-tasks

- [x] **3.1** `jti` present in refresh token claims. *(Completed in Phase 1.7 —
      the identifier exists and is now the primary key of the rotation ledger.)*
- [x] **3.2** **`refresh_tokens` table** — hashed token, `family`, `used_at`,
      `rotated_to_jti`, `expires_at`, `revoked_at`, migration `c3f81a4d7e29`.
      *Verified:* two rows after one register + one rotation, correct family.
- [x] **3.3** **Rotation.** Every `/auth/refresh` issues a new access token and
      sets a new cookie. *Verified live:* new access token differs, cookie value
      differs.
- [x] **3.4** **Reuse detection.** *Verified live:* replaying the pre-rotation
      cookie → `401 {"detail":"Invalid or expired refresh token"}`, and the
      backend logged `revoked refresh token family for user_id=1 (detected
      reuse): 2 token(s)`. A direct read of the ledger shows both rows in that
      family `revoked` — including the successor, which had never been used.
- [x] **3.5** **Real `logout`.** Revokes the family, clears the cookie, and
      answers uniformly so the endpoint is not a session oracle.
- [x] **3.6** **HttpOnly cookie migration — DONE, including the frontend half.**
- [x] **3.7** **CSRF protection and refresh-on-401.** `SameSite=Strict` plus an
      `Origin` check server-side; a single-flight 401 interceptor client-side.
- [x] **3.8** **Auth throttling split per endpoint.** 5/60s on `login`,
      `register`, `refresh`, `login/otp/verify`; 20/60s on the rest. See BUG-03.

## 3.6 — the access token is now memory-only

This was the only remaining item and the only "High" row left in the live-risk
table. The refresh token had already moved to an HttpOnly cookie; the **access**
token was still in `localStorage`, where every npm package, every extension with
host permissions and any injected script can read it, and where it survives the
tab closing.

**What changed**

| Before | After |
|---|---|
| `localStorage["cp_access_token"]` | module-level variable in `lib/api.ts` |
| Session restored by reading storage | restored by `POST /auth/refresh` with the cookie |
| `isAuthenticated = Boolean(localStorage[...])` | resolved from whether the refresh succeeded |
| One tab's logout left siblings signed-in-looking | sign-out broadcast to all tabs |
| `logout()` sent `{ refresh_token }` read from storage — always `undefined` | sends no body; the cookie carries it |

**The cost, stated rather than hidden:** a page load no longer restores the
session from storage, so every load costs one extra same-origin round trip before
the app knows whether anyone is signed in. `authReady` now resolves *after* that
exchange rather than on first paint, and `RequireAuth` already had the right gate
("Loading your account…"), so the cost is one spinner rather than a redirect flash
for a signed-in user.

**This does not prevent XSS.** An injected script can still call the API as the
user while the page is open. What it removes is the durable copy — the thing that
turns one bad page into a credential that keeps working for 30 minutes after the
tab is gone, and 30 days if the refresh token went with it.

### The trap in this sub-task

Rotation is single-use with reuse detection and **no grace window**
(`session_service.rotate` raises the moment a consumed token is presented again,
and the family dies). That was survivable while the access token lived in
`localStorage`, because a page reload did *not* refresh — rotation happened only
on a 401, roughly once every half hour.

Making the token memory-only means **every page load rotates**, which turns a rare
race into a routine one. Two tabs loading together both send the same cookie, one
wins, the other presents an already-rotated token, and the user is signed out of
every tab on every device in that family for doing nothing.

So the coordination has to arrive with the change. `withRefreshLock` serialises
rotation across tabs with the Web Locks API, and the winner's token is
distributed over a `BroadcastChannel`. `ifAvailable: true` is deliberate: a
queued lock could block forever if the holding tab is frozen or backgrounded, and
a page stuck at "checking your session" is worse than one that refreshes and risks
a rare re-login.

### Verification

Frontend gates: `typecheck` clean, `lint` exit 0, `build` exit 0.

**Proven from the shipped image, not from the source.** Grepping the built
container's client bundle:

- every `localStorage.setItem` call in the client is either `cp_theme` or the
  generic `load`/`save` helper behind the preference keys — **no token**;
- `cp_access_token` occurs exactly **once** in the whole bundle, inside
  `["cp_access_token","cp_refresh_token"]` — the removal list. It is never read
  and never written.

**Upgrade path.** `purgeLegacyTokenStorage()` deletes the old keys on boot.
Without it, stopping the *new* write is only half the fix: a browser that signed
in before this change still carries a readable, still-valid 30-minute JWT in
storage, forever, because nothing would ever remove it.

Backend suite: **336 passed, 1 failed, 1 skipped.** The failure is
`test_pagination_and_predictor_stability.py::test_catalog_cutoffs_paging_walks_every_row_exactly_once`,
a `uq_cutoff_identity_coalesce` unique-constraint collision in Phase 4's cutoff
fixtures. Pre-existing and unrelated — this change touches three frontend files
and no backend file.

## Also corrected

- [x] **The Cookie Policy and Privacy Policy were asserting something 3.6 made
      false.** Both stated "we set no cookies" and listed `cp_access_token` and
      `cp_refresh_token` as stored keys, with the Cookie Policy explicitly
      warning that the tokens were "readable by any script that runs on our
      pages" — the precise property this sub-task removes. All four passages now
      describe the real design: one `pdw_refresh` cookie, HttpOnly/Secure/
      SameSite=Strict/path-scoped, access token in memory, preference keys
      enumerated. A legal page that misstates the product is a written
      representation to users, and this one had become wrong in the same commit
      that made it wrong.
- [x] **Vestigial `getRefreshToken()` and the refresh-token storage path removed.**
      `logout()` was building a body from them that could only ever serialise to
      `{}`, which read as though the client needed a credential it does not have.

## Accepted, and worth stating

- **Reuse detection revokes refresh, not outstanding access tokens.** In the live
  test, after the family was revoked, an already-issued access token still
  returned `200` from `/users/me`. That is inherent to stateless JWTs, and it is
  why the access window is 30 minutes and why `MAX_ACCESS_TOKEN_EXPIRE_MINUTES`
  caps it at 60. Theft detection bounds the attacker's window rather than
  eliminating it.
- **The multi-tab lock does not cover a second device**, nor a tab reopened while
  a live one is mid-rotation. The worst case there is a spurious re-login, which
  is the right side to fail on. Closing it properly would mean a server-side grace
  window, which trades real theft detection for tab-tolerance and is not a change
  to make unilaterally.

---

# Phase 4 — Data leakage

**Status: COMPLETE** · 10 of 10 sub-tasks (4.1–4.10, all `[x]`) · closed
4 October 2026. The section header previously read "5 of 8" while the summary
table read "8 / 8"; both were wrong — there are ten sub-tasks here, because 4.9
and 4.10 were added after the original eight were written.

Targeted specifically at preventing personal data reaching unauthorised parties.

## Sub-tasks

- [x] **4.1** **`POST /api/v1/enquiries` must derive `ip_address` server-side.**
      The field was removed from `EnquiryCreate` — a client-supplied `ip_address`
      now 422s (the model is `extra="forbid"`) — and the server derives it from
      the connection, honouring `X-Forwarded-For` only when `TRUSTED_PROXY_HOPS`
      declares a real proxy topology.
- [x] **4.2** **Rate limiter fails closed on `/auth`.** `FAIL_CLOSED_NAMESPACES =
      frozenset({"auth"})` at `app/middleware/ratelimit.py:47`, enforced at
      `:157-166`. *Re-verified 2 Oct 2026: the description above was stale; this
      was already implemented and only the tick-box was missing.*
- [x] **4.3** **Async Redis client.** `redis.asyncio` throughout, constructed
      once in `app/services/redis_client.py:41` and awaited at
      `app/middleware/ratelimit.py:148`. No synchronous `redis.Redis` remains
      anywhere in `app/`. *Re-verified 2 Oct 2026: the description above was
      stale and described a bug that no longer existed.*
- [x] **4.4** **Audit every mutation.** Completed 4 October 2026 — the entry
      previously read "(partial)" while carrying a tick, which is the same
      stale-checkbox class as 4.2 and 4.3. College delete, blog update/delete,
      review moderation and password change were already audited. **40 handlers
      added in this pass**, covering the register's own list (enrichment ×21,
      lead assignment, banner/FAQ/media/SEO, blog create) *and* the catalog
      routers nobody had listed: courses, exams, universities, scholarships,
      notification create/delete, review delete, and mock-test paper and
      question CRUD. One shape throughout: creates flush before recording so
      `entity_id` is populated, updates capture `old_value` before the setattr
      loop, deletes read the identifying fields first, and the actor comes from
      a param-form `require_role` matching the tuple the decorator already
      declares. Deliberately not audited: GETs, self-service writes (own
      profile, saved colleges, reading one's own notifications), and
      `media/upload`, which is multipart and carries a comment naming the gap.
- [x] **4.5** **Include `ip_address` in audit rows.** All writers now go through
      `audit.record()` with the `Request`, so the source IP is stamped.
- [x] **4.6** **Fix `GET /blogs/{ref}` mutating `view_count`.** GET no longer
      mutates. A dedicated `POST /blogs/{ref}/view` owns the counter, is a
      single atomic `UPDATE`, answers 204 for unknown slugs, and cannot count an
      unpublished blog.
- [x] **4.7** **Harden `/api/ai`.** 500-character cap, 12 requests/minute, and a
      15s `AbortController` timeout in `frontend/app/api/ai/route.ts`. *Re-verified
      2 Oct 2026: the description above was stale; this was already implemented.*
- [x] **4.8** **Rate-limit or authenticate `/api/stats`** (`/api/v1/stats/catalog`
      is now a registered throttle target).
- [x] **4.9** **CASCADE on nullable enrichment foreign keys (found 2 Oct 2026, not
      previously in this register).** `cutoffs`, `nirf_rankings`,
      `other_rankings`, `placement_records` and `seat_matrix` all declared
      `college_id` (and, for three of them, `course_id`) as nullable *and*
      `ondelete="CASCADE"`. Because the ORM holds no `back_populates` for those
      relationships, the database cascade was the only deletion path: deleting a
      single college silently destroyed every historical cutoff, rank, placement
      and seat row referencing it, with no way back. An audit row recording the
      count is not a backup. Migration `b4e8f2a71d09` switches all eight to
      `ON DELETE SET NULL`, matching `Enquiry.college_id`. `delete_college` now
      refuses with a **409** when a detach would collide with an
      already-unattributed cutoff on `uq_cutoff_identity_coalesce`, rather than
      letting PostgreSQL raise `UniqueViolation` as a 500. Pinned by
      `tests/test_data_integrity.py::test_delete_college_preserves_historical_cutoffs_and_rankings`.
- [x] **4.10** **N+1 in the audit list and the enrichment serializers (found
      2 Oct 2026).** `_course_name` cost one SELECT per row, so a catalogue page
      at the routers' 500-row cap could issue 501 queries; `list_audit_logs` did
      `db.get(User, ...)` per row. Both batched. Eager-loading `AuditLog.user`
      alone was **not** sufficient — `User.display_name` is a property that reads
      `self.student_profile`, so the N+1 moved a level down (25 rows written by
      25 different actors: 53 SELECTs before, 9 after) until that was
      eager-loaded too. Pinned by `tests/test_query_counts.py`, which asserts the
      query count does not *scale* with row count rather than pinning a budget.

## Also outstanding from the original audit

- [x] `submit_attempt` did not enforce exam expiry. `_finalize_if_expired()` at
      `app/routers/mock_tests.py:163`, called on submit at `:764`. *Re-verified
      2 Oct 2026: already implemented.*
- [x] Non-MCQ questions are always graded incorrect. **This claim was false and
      has been refuted against the source.** There are no short/long-answer
      types; `QuestionType` is `mcq | numeric | essay` (`app/question_types.py:50`,
      with a matching DB CHECK constraint). `numeric` is auto-graded with
      `Decimal` parsing and an absolute tolerance (`mock_tests.py:267-311`).
      `essay` returns `None`, which `_grade_attempt` counts as *pending review*
      (`:201-208, :221`) and excludes from both `incorrect` and `unanswered`.
      Pinned by `test_ungradable_answers_are_not_counted_incorrect` and
      `test_essay_is_routed_to_manual_review`.

  A real gap sat behind the false claim, and **is now closed (4 Oct 2026)**:
  there was no manual-grading write endpoint, so `pending_review_count` was
  recorded and nothing ever flipped an essay from `None` to a verdict — essays
  were permanently unscored. `POST /api/v1/mock-tests/admin/review-attempts/
  {attempt_id}/answers/{question_id}/grade` writes the verdict (partial credit
  required, because 3-of-5 is not correct/incorrect), records `graded_by` /
  `graded_at` (migration `c2a7e9f4b613`), and returns the attempt's recounted
  totals; `GET …/admin/review-attempts` is the queue, oldest first. The tally
  recount lives in `_recompute_attempt_totals` and deliberately does **not**
  re-run the autograder, which would discard a grader's partial credit on the
  next recount. Pinned by `tests/test_manual_grading.py` (13 tests).
- [x] `cutoffs` had an 8-column unique constraint containing 5 **nullable**
      columns. PostgreSQL treats NULLs as distinct, so it never fired in the case
      that mattered and duplicate cutoffs were possible — which then skewed the
      predictor's average. Replaced by the functional index
      `uq_cutoff_identity_coalesce` (migration `9f3c2a7e8d21`), which collapses
      NULL to unreachable sentinels. The legacy constraint is retained for
      downgrade compatibility.
- [x] `CASCADE` on a **nullable** `college_id` across five enrichment models
      meant deleting one college silently destroyed a decade of cutoff, ranking
      and placement data. **Fixed 2 Oct 2026** — see sub-task 4.9 above. The
      auditing added earlier was mitigation, not a fix; the rows were still
      destroyed.
- [x] `CollegeDetailResponse` was constructed in four places and had drifted.
      **Two** places, not four: `get_college` assembled `courses` as unvalidated
      dicts while `_get_detail` used `CollegeCourseResponse`. Fixed 2 Oct 2026 —
      `_get_detail` is now the only builder and GET/POST/PUT all route through
      it, pinned by `test_every_college_detail_path_returns_the_same_shape`.
- [x] N+1 queries in the audit log list and in every enrichment serializer.
      **Fixed 2 Oct 2026** — see sub-task 4.10 above.

## Two frontend defects found in the same pass (2 Oct 2026)

Neither was in the register; both were in code that had no tests.

- `deriveAdmissionStatus` in `frontend/lib/mappers.ts` was a stub that ignored its
  argument and returned `"upcoming"` unconditionally, via a line assigning
  `detail.courses.length ? null : null`. That value is what the college card
  renders and what `frontend/lib/data/index.ts:43` filters on, so **every college
  claimed to have upcoming admissions, and filtering the list by "open" or
  "closed" returned nothing at all.** It now derives from the published
  application windows, with three states: a window that has not opened yet is
  `"upcoming"`, not `"closed"`.
  *Closed 4 Oct 2026 — this was a known limit, not a defect to accept.*
  `CollegeListItemResponse` now carries `admissions` as a trimmed window (two
  dates plus the entrance exam), read in **one** batch query per request rather
  than per row, and `mapCollegeListItem` derives the status from it. The card's
  admissions *section* still comes from the detail fan-out — listing 10 colleges
  must not fire 90 requests — but the status is one field the card and the
  filter both key off, and the list projection now carries enough to compute it.
  Pinned by `test_list_projection_carries_admission_windows` on the backend and
  by a date-relative case in `tests/mappers.test.ts`, which is the test that
  was written to be updated when this landed.
- `frontend/lib/mappers.ts` had **no tests at all** — sixteen exported pure
  functions. `tests/mappers.test.ts` is the first coverage and concentrates on
  the functions that make decisions rather than the ones that copy fields.

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

**Status: COMPLETE** · 6 of 6 sub-tasks

Closed on 29 September 2026. The frontend went from **no automated check of any
kind** to four, and `pip-audit`/`npm audit` are real gates that pass.

**7.6 was already done** and is recorded here for completeness: 3.2–3.5, 3.7 and
3.8 landed with the backend work on 28–29 September, and the gap BUG-01 exposed
is closed by `tests/test_session_security.py` (23 tests). One of the six
assertions 7.6 listed is **not satisfiable and was deliberately not written** —
see the end of this section.

## Sub-tasks

- [x] **7.1** **Frontend CI job** — `.github/workflows/frontend.yml`, one job
      running `typecheck` → `lint` → `test` → `build` on Node 24, the version
      `frontend/Dockerfile` actually builds against, so CI and the shipped image
      agree. `npm ci`, never `npm install`: the former installs the lockfile
      exactly and fails when the manifests disagree.

- [x] **7.2** **`pip-audit` and `npm audit` as gating steps.** `npm audit
      --audit-level=moderate` in the frontend job; a separate `python-audit` job
      in `backend-tests.yml` rather than a trailing step, because it needs no
      database, so it runs in parallel and an advisory is its own named failure
      rather than something a job timeout would skip. `pip-audit --strict`,
      because without `--strict` it exits 0 on some failure paths — which is how
      an audit gate quietly stops gating.
      *Both pass:* `npm audit` → **0 vulnerabilities**; `pip-audit` → **No known
      vulnerabilities found**, exit 0.

- [x] **7.3** **`.env.example` is executable, not documentation** —
      `backend/tests/test_env_example.py`, 9 tests. The Phase 0 breakage was an
      unedited copy of the template producing an application that could not
      start, and nothing read the file to notice. These assert that it parses,
      that `Settings()` **accepts** it, and — the assertion that actually bites —
      that every variable it documents is either a real `Settings` field or a
      documented non-`Settings` consumer. A variable nothing reads is a lie to
      the operator, and Phase 5.5's 45 deletions need something to stop them
      coming back.

- [x] **7.4** **The page manifest cannot leak** — `frontend/tests/nav-manifest.test.ts`,
      21 tests. `leakedManifestHrefs()` returns `[]`, and a second test asserts
      that is not vacuously empty. Also covered: `/mock-tests/jee-main-2026` is
      hidden and not merely `/mock-tests`; `/planner` is **not** hidden (the
      `startsWith` trap); `DASHBOARD_NAV` still derives from the header arrays;
      and no sitemap page is disallowed in `robots.ts`.

- [x] **7.5** **Frontend test infrastructure** — Vitest 5, `vitest.config.mts`,
      `tests/setup.ts`, and `test` / `test:watch` / `test:coverage` scripts.
      **45 tests** across two files, each written because it corresponds to a
      defect that got through: the manifest guard, and the auth token layer.

- [x] **7.6** **The BUG-01 gap** — pre-existing; all five satisfiable assertions
      are in `tests/test_session_security.py` and pass.

## The audit gate found a real vulnerability, and fixing it found two more

This is the argument for 7.2 existing, so it is worth stating plainly.

`pip-audit` failed on its first run: **ecdsa 0.19.2, PYSEC-2026-1325, no fixed
version published.** It was not a risk in this codebase but an *unreachable* one —
`ecdsa` exists in `python-jose` solely to implement ES256/ES384, and `config.py`
refuses to boot on any algorithm outside `("HS256", "HS384", "HS512")`. The
vulnerable path cannot be reached by any configuration the application accepts.

That is still not good enough. "Unreachable because a validation guard says so" is
one edit to a whitelist away from becoming load-bearing, and with no fix published
there is no upgrade to migrate to. So the package was removed rather than the
finding documented:

| Removed | Why |
|---|---|
| `python-jose==3.5.0` | pulls `ecdsa` unconditionally; the only JWT library in use |
| `ecdsa==0.19.2` | PYSEC-2026-1325, no fix published |
| `pyasn1==0.6.4`, `rsa==4.9.1` | python-jose's other unconditional requirements, imported nowhere |
| **Added** `PyJWT==2.15.1` | HMAC-only, and no `ecdsa` |

Two follow-on problems, both surfaced by the gate and the suite rather than by
inspection:

- **PyJWT 2.10.1 has five advisories of its own** (PYSEC-2026-175 through -179),
  fixed in 2.13.0. Pinned to 2.15.1. A gate satisfied by "the old vulnerable
  package is gone" would have shipped this instead.
- **The migration was not the one-import job it looked.** `app/dependencies.py`
  caught `jose.exceptions.JWTError`, which is `jwt.exceptions.InvalidTokenError`
  in PyJWT; `ExpiredSignatureError` keeps its name in both. The exception
  *ordering* matters and is now commented: `ExpiredSignatureError` subclasses
  `InvalidTokenError`, so catching the base first would report every expired
  token as "Invalid token".

  An earlier comment claimed "nothing imports a jose-specific exception". That was
  **wrong** — it came from a PowerShell `Select-String` with a `**` glob that is
  not recursive, and it under-reported by three files. Found by re-checking with
  a recursive search after the suite failed to collect.

*Verified:* **345 passed, 1 failed, 1 skipped** — the single failure is the
pre-existing Phase 4 `uq_cutoff_identity_coalesce` collision, unrelated.

## What the frontend tests caught, in the code they were written for

The new suite found two live bugs in the Phase 3 token layer on its first run.
Neither was theoretical, and the second was the worse of the two.

- **`broadcastSignOut()` did not clear the local token.** It posted to sibling
  tabs and left `accessToken` in place, so after a refused refresh
  `getAccessToken()` kept returning a credential the server had just rejected.
- **The "reuse a token we already hold" shortcut was applied to the 401-repair
  path too.** This is the serious one: a 401 means *our* token is known-bad, and
  the refresh was returning that same token, so the request was retried with it,
  401'd again, and the user got an error while a dead token stayed in memory for
  every subsequent request. Silent, and the same shape as BUG-01. Fixed by
  distinguishing the two callers: `AppContext`'s boot path asks "do I have a
  token, from anywhere?" and may reuse one; `apiFetchImpl`'s repair path passes
  `force: true` and must actually rotate.

Both now have explicit regression tests, because the first version of the test
that caught the second only did so by accident.

A third finding was mine and is worth recording too: `test_env_example.py`
originally cleared `os.environ` by hand, which removed `PADHAANEWALA_SCHEMA` —
set once by `conftest` at import — and broke `test_mock_test_engine` in a way
unrelated to either module. Rewritten on `monkeypatch`.

## One assertion deliberately not written

7.6 listed "logout, then assert the access token is rejected". **It is not
satisfiable, and writing it would have produced a test that eventually had to be
deleted.**

Logout revokes the refresh family server-side. It cannot invalidate an
already-issued access token, because that is a stateless JWT whose only
revocation mechanism is expiry. Observed directly while testing: after the family
was revoked and reuse detection fired, an outstanding access token still returned
`200` from `/users/me`.

That is why the access window is 30 minutes and why
`MAX_ACCESS_TOKEN_EXPIRE_MINUTES` caps it at 60. The correct assertions are the
ones that exist: logout revokes the family, the cookie is cleared, and the token
cannot be reused. Asserting that logout kills outstanding access tokens would
have encoded a property the architecture does not have, and someone would
eventually have "fixed" the test rather than the code.

## Still open

- [ ] **7.5 coverage is deliberately thin** — 45 tests over two files, with
      thresholds set low (40% lines) as a floor to catch a new untested file
      rather than as a quality score. `lib/api-server.ts` — the BUG-05 site — and
      `lib/mappers.ts` remain untested. The frontend has a runner now; it does
      not have a suite. BUG-05's two suggested tests (distinguishable 4xx vs
      transport failure, and `PAGE_SIZE` not exceeding the per-router `le=` bound)
      are the obvious next pair.
- [ ] **The workflows have not run on GitHub.** They are structurally valid and
      every step was executed locally, but CI-execution evidence only exists
      once they are pushed.

---


---

# Phase 8 — Deploy

**Status: DESCOPED by decision, 4 October 2026.** Not started, and not counted
against this project's completion. The owner was asked whether a Linux VPS and
a domain were available for a real deployment and chose to take Phase 8 out of
scope entirely rather than leave it pending.

**What that costs, stated plainly so the decision is auditable:**

- The production Caddyfile has never served a public certificate. Everything
  verified in Phase 2 used Caddy's internal CA via the `localhost` special case.
- Real email and SMS delivery is unverified; the local env carries shape-valid
  but non-functional provider credentials, because the production guards
  correctly refuse `console`.
- There is no uptime monitoring, which is the prerequisite for the DPDP breach
  timelines in Phase 9.3 — `docs/breach-response-playbook.md` records that gap
  as the first thing a first responder will hit.
- The retention sweep (`backend/scripts/retention_sweep.py`) has no cron.

The stack itself is not the blocker: `docker-compose.prod.yml` was built and
driven end-to-end in Phase 2, and the images, guards and runbook all exist.
Reopening this phase means executing 8.1–8.5 below against a real host, and the
evidence column should then read "deployed and measured", not "expected to
work".

## Sub-tasks (all open, all descoped)

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

**Status: 6 of 7, with 9.2 declined — complete for the agreed scope.**
Re-verified against the source on 3 October 2026; 9.2 was declined by decision
on 4 October (above). Nothing in this phase is unbuilt.

Not part of the original eight phases, but it is a launch blocker rather than a
later improvement, so it is tracked here. The platform targets JEE and NEET
candidates, a material share of whom are **under 18**.

| Obligation | Source | Status |
|---|---|---|
| Reasonable security safeguards | DPDP S.8(5) | partial (Phases 1, 4, 5) |
| Breach notification — DPB **and** data principals | DPDP S.8(6) | **playbook written** (9.3) — contacts and monitoring still TBD |
| Detailed breach report within 72 hours | DPDP Rules 2025 | **playbook written** (9.3) |
| CERT-In incident report within **6 hours** | CERT-In Directions 2022 | **playbook written** (9.3) |
| Verifiable parental consent, under-18 | DPDP S.9 | **done** (9.1) |
| No behavioural monitoring of children | DPDP S.9 | partial — no proctoring yet, so nothing to consent to |
| Data-principal requests answered within 90 days | DPDP Rules 2025 | **done** (9.4) — self-service panel plus the staff queue |
| Retention limits and secure erasure | DPDP S.8(2) | **done** (9.5), needs a cron in Phase 8 |
| Grievance Officer appointed and published | Consumer Protection Act 2019 | **blocked on the client** (9.2) |

- [x] **9.1** **Age gate and parental-consent flow** (S.9). Backend landed in
      `f765369` (`/api/v1/compliance/*`, `GuardianConsent`, OTP-verified guardian
      consent, `require_processing_consent` on every personal-data write). The
      **frontend half was missing entirely** and is what closed this:
      `frontend/components/compliance/AgeGate.tsx` mounted from `Providers`, so
      it covers every authenticated surface rather than each page remembering
      to include it. Blocking on purpose — `Modal` was not used because it binds
      Escape and the backdrop to `onClose`, and a gate whose close control does
      nothing is worse than one with no close control. Phase derivation lives in
      `lib/compliance-gate.ts` so it is testable without mounting anything
      (21 assertions in `tests/compliance-gate.test.ts`).
      **Executing this found two forms that were already broken** — see
      **BUG-12**. Both were 422 on every submission and neither was caught by
      type checking, lint, a production build or the backend suite.
- [ ] **9.2** Appoint and publish the Grievance Officer (with 9.7). **Declined
      by decision on 4 October 2026 — closed as won't-do, not blocked.** This is
      a person, not code: `NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME` is empty,
      `GRIEVANCE_OFFICER.name` still reads "To be designated", and the Phase 6
      guard already refuses a production build until it is set — which is the
      guard doing its job. Everything downstream of the name is built. Note that
      with Phase 8 descoped this never becomes load-bearing, because there is no
      production build to refuse.
- [x] **9.3** Breach-response playbook: CERT-In at 6 hours, DPB at 72 hours,
      data principals without delay in plain language.
      `docs/breach-response-playbook.md` — three parallel clocks with their
      statutory sources, a four-role model, a timed runbook (declare → contain →
      preserve → scope → report → recover), a plain-language data-principal
      template, and an honest inventory of what this codebase gives a first
      responder (`X-Request-ID`, the `audit_logs` ledger, the `refresh_tokens`
      family ledger) **against** the gaps that make the first six hours harder
      (no centralised logging, no log rotation, no uptime monitoring, no
      verified restore). Deliberately records what must *not* be claimed in a
      report. **Caveat:** every contact row in §6 is still `_TBD_`, because
      CERT-In channel, the Board address and the four named roles are client
      decisions — §7 makes filling them the first pre-incident item.
- [x] **9.4** Data-principal request workflow with the 90-day SLA.
      **Backend**: `DataRequest` with `due_at` fixed at intake,
      `/compliance/requests` for the requester, `/compliance/admin/requests`
      ordered soonest-deadline first, terminal statuses cannot be reopened, the
      90-day clock is never re-derived on read, 23 tests in `tests/test_phase9.py`.
      **Frontend**: the dashboard's *Privacy and data* panel
      (`components/compliance/PrivacyPanel.tsx`) is the self-service half —
      raise a request of any of the six types, see `days_remaining` and the
      fixed due date, and withdraw parental consent in one click as s.9(5)
      requires. The staff queue is admin section **Data Requests**
      (`admin/sections/DataRequestsSection.tsx`): open/awaiting/overdue counts,
      status filter, per-row legal transitions only, and a resolution note
      **required** before a request can be closed, so a data principal never
      receives a decision nobody can explain.
- [x] **9.5** Retention and deletion job. `backend/scripts/retention_sweep.py`:
      expired OTPs, expired refresh tokens, stale audit logs, expired guardian
      consents, the 90-day SLA report, `anonymise_erased_users`. Dry-run by
      default, `--apply` required. No scheduler — that is Phase 8's cron.
- [x] **9.6** Encrypt or tokenise PII at rest, **or document why it is not
      required**. `docs/adr-0009-pii-at-rest.md` takes the second option for
      field-level encryption (with recorded reversal triggers and a Phase 8.2
      checklist) and the first for audit-log redaction, which is implemented in
      `app/utils/audit.py`.
- [x] **9.7** Publish a standalone, itemised DPDP notice — not a bundled one.
      `/legal/dpdp-notice`, a closed set of seven documents, and the 16
      conventional legal URLs 308-redirect to `/legal/*` so the notice is
      "easily accessible" under s.5(4). **Caveat:** the Privacy Policy still
      states the product has no age-verification step, which 9.1 has just made
      false — see the follow-up in the hygiene list below.

**Maximum penalties:** ₹250 crore for no reasonable safeguards · ₹200 crore for
not reporting a breach · ₹200 crore for children's-data violations · ₹150 crore
for Significant Data Fiduciary breaches · ₹50 crore otherwise.

---

# Repository hygiene

**Status: PARTIAL** · 3 of 5 sub-tasks, plus 2 found while doing them

Not a launch blocker, but all of it is public in a public repository.

- [ ] **Delete the duplicated skill directories. — DECLINED by decision, 4 Oct
      2026. Closed as won't-do.** The owner was asked directly and chose to keep
      them, so this stays at 3 of 5 rather than being counted as unfinished work.
      The facts below are unchanged and are the reason the option was offered:
      `padhaanewala/.agents/`, `.claude/` and `agent/` hold three parallel copies
      of the same two agent skills — **256 files, ~4.6 MB, about 45% of the
      working tree** — vendored documentation for a CSS framework already
      installed. Two of the three copies record `Status: Not initialized` and
      cannot answer a question; the three have already drifted apart; and the
      largest is screenshots of other people's editors.
      A fourth copy at
      `padhaanewala/frontend/.agents/` is tracked and was not counted above, so
      the real figure is 4 directories / 262 files / ~4.9 MB. Of those, only
      `padhaanewala/.agents/` is functional — it is the sole copy that has the
      `references/docs/` snapshot actually committed; the other three cannot
      answer a question at all. Revisiting this therefore also means removing
      the `Always Use: tailwind-4-docs, web-design-guidelines` lines from
      `frontend/AGENTS.md` and `frontend/CLAUDE.md`, which would otherwise dangle.
- [x] **Delete `DESIGN.md`.** It documents Clay.com's B2B brand system —
      cream canvas, "Plain Black" display face, claymation mascots — not this
      project. Confirmed before deleting: its own frontmatter reads
      `name: Clay-design-analysis`, and nothing in the build, the Compose files
      or the CI workflows referenced it. `git rm padhaanewala/DESIGN.md`.
- [x] **Document the doubled `frontend/frontend/` path in `AGENTS.md`.** It is
      load-bearing: `tsconfig.json` maps `"@/*": ["./frontend/*", "./*"]` and
      every one of roughly 200 `@/components/*` imports resolves through the first
      entry. Simplifying that array to the conventional `"@/*": ["./*"]` breaks
      the entire build. Nothing in `README.md`, `AGENTS.md` or `CLAUDE.md`
      mentions it. Added to `frontend/AGENTS.md`, with the reason
      `vitest.config.mts` cannot use a `resolve.alias` and the warning already
      present in `.dockerignore`. Measured while writing it: 255
      `@/components/*` imports and 504 `@/` imports across 171 source files, so
      the "~200" figure elsewhere in this document understates it.
- [x] **Fix the `frontend/package.json` name.** It read `campus-pulse`, a
      leftover from a different project, and appeared in every script header.
      Now `padhaanewala`, with `package-lock.json` resynced via
      `npm install --package-lock-only`. Verified after: `npm run typecheck`
      clean, `npm run lint` 0 errors, `npm test` 50/50.
- [ ] **Clean `data/`. — DECLINED by decision, 4 Oct 2026. Closed as won't-do.**
      Asked alongside the skill directories and declined with them, so hygiene
      stands at 3 of 5 by choice rather than by omission. `Padhaanewala_Data.xlsx`
      is a **PDF wearing an `.xlsx`
      extension** — byte-identical to `Hardcore_JEE_Mock_Paper_2_2026.pdf`. The
      remaining 11 files are raw spreadsheets and mock papers, not the CSV
      deliverables the specification requires.
      The duplicate was re-confirmed: both files hash to
      `5CDE1505B313DB35890015AB183B4495D426482BBFA9FE653D17E9CD66BD34BA`, and the
      `.xlsx` opens with the bytes `25 50 44 46 2D 31 2E 34` (`%PDF-1.4`).
      The underlying product question — an admin-panel PDF upload path — is still
      open and is recorded at the foot of this section: these are
      the raw authoring sources for the mock-test papers, and the intended route
      for that material is an admin-panel PDF upload (see the open question at
      the foot of this section), not a `data/` directory in the repository.

- [x] **Untrack the committed run logs** *(not in the original five; found
      while verifying the above).** `logs/backend.log` and `logs/frontend.log`
      were both tracked, and `.gitignore` did not stop them — `*.log` is
      declared in `padhaanewala/.gitignore`, which only covers paths beneath
      `padhaanewala/`, so the repository-root `logs/` directory was unprotected.
      `backend.log` contained a local filesystem path
      (`D:\code\Clients\Padhaanewala\Final\New`) and `frontend.log` a LAN
      address (`10.215.86.193`) alongside the `campus-pulse@0.1.0` banner that
      item 4 above removes. Both are now `git rm --cached`, kept on disk, and
      the root `.gitignore` covers `logs/`, `*.err` and `*.out` — `*.err`/`*.out`
      were likewise only declared sub-project-wide, and those are the captures
      that can embed a SQLAlchemy connection string.

- [x] **Correct the false claims in `README.md`** *(not in the original five;
      found while checking that `DESIGN.md` was unreferenced).* The README is the
      front door of a public repository and described a stack that is not
      installed. Every correction below was checked against the code, not
      inferred:

| Claim | Reality |
|---|---|
| `proctoring-service/` in the tree | Does not exist — a Phase 47 item, not started |
| `.github/workflows/` inside this directory | It is at the **repository root**, one level up |
| `scripts/` at this level | Only `backend/scripts/` exists |
| "PostgreSQL 15+ (pgvector for embeddings)" | No pgvector, no embedding column. Search is `to_tsvector` + a GIN index |
| "Cache / Queue: Redis 7+, **Celery**" | No Celery, no queue worker anywhere |
| "Storage: AWS S3 / Cloudflare R2" | No `boto3`, no S3 client. `media` rows hold a pasted URL string |
| "AI / LLM: OpenAI / Anthropic (**backend only**)" | Called from the **Next.js** handler at `app/api/ai`, not the backend |
| "Next.js 14+, React 18+" | Next 16.3.6, React 19.2.8 |
| `cp .env.example .env.development` at this level | `Settings` loads the file relative to CWD and the backend runs from `backend/`, so a file created here is read by nothing |
| Connection string on `localhost:5432` | Right for native PostgreSQL, wrong for Docker — `docker-compose.dev.yml` publishes **5433**. A port trap, now called out explicitly |
| Spec lives in `../padhaanewala-complete.md` | It is at `docs/padhaanewala-complete.md` |

      Also added: a Tests section naming the four gates CI runs, and a table
      marking `docs/Pending-phases.md` as the authoritative tracker over the two
      superseded ones. The doubled-path warning was added here too, so it is
      visible from the repository root and not only from `frontend/AGENTS.md`.

      This list matches the corrections proposed in `phase-verification.md`,
      which `Pending-phases.md` explicitly refuses as a status source — the note
      was right and had simply never been executed.

## Open question blocking the `data/` cleanup

The `data/` item is not blocked on effort. It is blocked on a decision that was
asked and not yet answered, and the answer changes what the cleanup should be.

The stated requirement is that a PDF for a mock test should be uploaded from the
admin panel and read back from there. That route does not exist yet, and the gap
is wider than it looks:

| Layer | State, measured 30 September 2026 |
|---|---|
| Backend `UploadFile` / `File()` / `Form()` | **0 occurrences.** `python-multipart` is installed and never imported |
| `media` router | Metadata only. `MediaCreate.url` is a string the admin pastes; no bytes are ever accepted or stored |
| Object storage | No `boto3`, no S3/R2 client. `S3_*` is documented in `.env.example` and read by **no code** — a dead-variable entry of exactly the kind listed in that file's own header |
| Frontend | `FormData` = **0**, `<input type="file">` = **0** |
| `MediaSection.tsx` | The "Upload" button is `<AddButton>`, which only fires a toast: *"Create flow is a demo action in this build."* |

Uploading a PDF would also not by itself create questions: no extraction code
exists, and `seed_mock_tests.py` reads hand-curated
`frontend/lib/data/mockTests.json`. An uploaded PDF becomes an attachment and
nothing more until a parser is written.

**Adjacent finding, recorded because it is a contradiction in the admin UI:**
`QuestionsSection.tsx` states *"There are no question tables in the database and
no importer wired up"*. That is false. `test_questions` exists, with full
question CRUD in `routers/mock_tests.py` under `CONTENT_ROLES` and 29 tests in
`tests/test_mock_test_authoring.py`. The panel is behind its own backend.

Once an upload path exists, the `data/` papers are reachable through the admin
panel and the directory can be dropped from the repository. Until then they are
the only copy of that material, which is why deleting them was not a call worth
making unilaterally.

---

# Progress summary

Per-phase `Complete` column is the authoritative count. It excludes the
supplementary "Found by running it" and "Still open" lists in Phases 2 and 6, so
it is lower than a raw `- [x]` grep of this file, which double-counts them.
Totals: **95 of 104 (91%)** as of 4 October 2026. The nine that are not
counted are Phase 8's five (descoped by decision) and four hygiene items —
two declined by decision, two already counted — see the table. The percentage
is *sub-task* reality, not the same as "deployable", and with Phase 8 descoped
it never will be: nothing in this repository is deployed. The bug register has
one entry, BUG-13, and it is fixed in the section it was found in — BUG-01
through BUG-12 are closed.

| Phase | Scope | Complete | Status |
|---|---|---|---|
| 0 | Make it run at all | 25 / 25 | **DONE** |
| 1 | P0 security | 22 / 22 | **DONE** |
| 2 | Containerisation | 6 / 6 | **DONE** — images built, stack driven, 4 latent defects found by executing it |
| 3 | Session security | 8 / 8 | **DONE** — BUG-01 fixed backend (ledger, rotation, reuse, logout, HttpOnly cookie) and frontend (access token memory-only, cross-tab refresh); BUG-03 fixed |
| 4 | Data leakage | 10 / 10 | **COMPLETE (4 Oct 2026)** — 4.2 and 4.3 were already implemented and only the tick-boxes were missing; 4.9 (CASCADE destroying historical rows) and 4.10 (N+1) were real and are fixed; the "non-MCQ always incorrect" claim was refuted against the source. **4.4 finished 4 Oct: every admin mutation audited (40 handlers).** The essay-grading write path and the list-view admission window closed the same day. BUG-02 FIXED |
| 5 | Headers + CSP | 5 / 5 | **DONE** — CSP + full header stack in `proxy.ts`, per-path Permissions-Policy, ISR preserved, real error reporting; see Phase 5 |
| 6 | Beta scope | 7 / 7 | **DONE** — manifest, live counts, contact identity, submittable funnel, dark-mode dashboard, Grievance Officer guard, DPDP notice |
| 7 | CI gate | 6 / 6 | **DONE** — frontend job (typecheck/lint/test/build on Node 24), npm + pip audit gating and clean, env-example 9/9, nav-manifest 21/21, Vitest suite 50 tests; BUG-08 found by that suite and fixed. Backend job now also runs a real Redis so the rate limiter's atomicity is covered in CI, and fails the job if those tests skip |
| 8 | Deploy | 0 / 5 | **DESCOPED by decision, 4 Oct 2026** — no VPS and no domain; the phase is out of scope rather than pending. Compose stack verified healthy in Phase 2, public TLS/real providers/monitoring/cron all unverified. See Phase 8 for what that costs |
| 9 | Legal / DPDP | 6 / 7 | **9.1, 9.3, 9.4, 9.5, 9.6, 9.7 complete (3 Oct)** — age gate + parental consent on both tracks, breach-response playbook, DSR self-service panel and staff queue, retention sweep, ADR-0009, standalone DPDP notice. **9.2 declined by decision (4 Oct)** — a named officer is a person, not code, and the Phase 6 build guard is what enforces it. **Executing 9.1 found BUG-12** — signup and the admission funnel were 422 on every submission |
| — | Repository hygiene | 3 / 5 | **3 of 5 by choice** — `DESIGN.md` deleted, `package.json` name fixed, the doubled `frontend/frontend/` path documented, plus two found while doing them (run logs untracked, `README.md` false claims corrected). The two deletions — skill bundles and `data/` — were offered on 4 Oct and **declined**, so they are closed as won't-do rather than left open |

**95 of 104 sub-tasks complete (91%)** as of 4 October 2026. The nine that are
not counted: Phase 8's five (descoped), the two hygiene deletions (declined),
and the two hygiene items already counted in their own row. Every phase that is
in scope is complete.

The critical path no longer contains a deploy, because there is no deploy. What
remains outside this document is the two client decisions that were offered and
declined — a Grievance Officer's name and the two repository deletions — plus
the product question behind `data/` (an admin-panel PDF upload path), which
none of them can be answered by code.

Phase 3 is closed on both tracks: the backend's rotation
ledger, reuse detection, real logout and HttpOnly cookie delivery were verified by
the 23-test session suite and by driving the live API, and the frontend half of
3.6 is now closed too — the access token is memory-only, proven by grepping the
built container's client bundle, where it appears exactly once in the removal
list and is never written. Phase 5 is closed: every response
now carries a CSP and the header stack, ISR revalidation is verified unchanged on
the wire, and `error.tsx` can no longer claim a notification it does not send —
the report hits the server log with a reference a user can quote.

The re-check found three live test failures and one dated total. They are in the
bug register as **BUG-08** (frontend auth refresh — deterministic) and
**BUG-09** (backend cutoff-paging vs the new identity constraint — deterministic),
plus two backend failures (numeric grading, OTP resend) that passed in isolation
and looked order-dependent. None of them existed in the totals that were
previously recorded; the suite also grew (344 passed then vs 315 before).

**All of the above is now closed**, and the "order-dependent" label turned out to
be wrong. BUG-08 and BUG-09 were fixed in the pass that found them; BUG-05, BUG-06
and BUG-07 in the pass after, bringing the suite to **440 passed, 1 skipped**,
stable across consecutive full runs and against a schema migrated from empty. The
two order-dependent failures were the same stale-database problem as BUG-06 — the
schema was behind the code — so they needed a migration, not a test ordering. See
"Order-dependent backend failures" in the register for why running them in
isolation was the misleading part.

**Phase 2 is closed, and it is the phase that was most nearly believed done.**
Five of its six files already existed in the working tree and four of them were
broken. Building and running them is what found that the entrypoint had never
executed (CRLF shebang, every container restart-looping), that the entire API
answered 400 behind 200 pages (Next's rewrite sets `Host: backend:8000`, which
Phase 1's Host validation rejects), and that the Grievance Officer name was being
passed at runtime to a value that only exists at build time — which would have
made Phase 6's launch blocker decorative. A green image build was never evidence
that a container could start.

**Phase 6 is closed.** The site no longer advertises a single feature it cannot
deliver: the four de-listed routes are out of the navigation, the footer, the
sitemap and the index, behind a single manifest in `lib/nav.ts` that
`leakedManifestHrefs()` asserts against. The primary lead-capture form is
submittable for the first time, the fabricated "1,400+ colleges" and "2.4 lakh+
students" are replaced by live `COUNT(*)` values, and the four competing contact
identities — including a `.com` support address on a `.in` site — are one. A
production build is now **refused** while the Grievance Officer is unnamed, and
the standalone DPDP s.5 notice is published at `/legal/dpdp-notice`.

**Re-measured 28 September 2026:** `pytest` reported **315 passed, 1 failed, 1
skipped**, not "315 passed, 1 skipped". The failure was a stale test meeting a
correct new constraint (BUG-06). The application itself was healthy — **0 × 5xx
across all 68 GET endpoints**. Three defects were opened in the second-pass bug
register: **BUG-05** (a 422 silently becomes an empty page, so `/blog` renders
with no posts), **BUG-06** (the failing test, plus four migrations applied to the
database but absent from git — including `c3f81a4d7e29`, on which Phase 3's
"complete" status rests) and **BUG-07** (Redis down, so the rate-limiter fallback
is untested). **All three are fixed**; see their sections.

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

## BUG-05 — A 422 is silently converted into an empty page 🟠 HIGH — **FIXED**

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

**Status: FIXED.** Both halves of the fix, verified 29 September:

  - **The page size is per endpoint, not one constant.** `DEFAULT_PAGE_SIZE` is
    50 — safe against *every* capped route in the API today, so a newly added
    call site cannot re-arm this — and an endpoint opts up to 100 by naming
    itself in `ENDPOINT_PAGE_SIZES`. `pageSizeFor()` resolves an unknown path to
    the safe default rather than to a guess.
  - **Failures are reported, not swallowed.** `reportFailure()` logs each
    distinct `status path` once per process, and a transport failure is now
    logged separately from an HTTP error status, because "the request was wrong"
    and "the backend is unreachable" need different responses and both used to
    collapse into the same `null`.

The fix is not just the constant. `tests/page-size-contract.test.ts` reads the
`le=` bounds **out of the Python routers** and holds the frontend's declared
sizes against them, so tightening a backend cap without updating the frontend
fails a test instead of emptying a page. It also asserts it can read the
routers at all (`> 15` routes, `> 10` with bounds), so a moved directory cannot
turn every comparison into a silent skip. 50 tests, green.

## BUG-06 — One test fails; four applied migrations are untracked 🟠 HIGH — **FIXED**

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

**Status: FIXED (verified 29 September 2026).** Both halves:

  - **All four migration files are tracked.** `c3f81a4d7e29`,
    `9f3c2a7e8d21`, `a7e4c1b93d02` and `d5f2a8c71e63` are in `git ls-files`, and
    the chain is a single linear head at `9f3c2a7e8d21` with no branches.
  - **A clean clone migrates to head.** Proven rather than assumed: a throwaway
    schema (`fresh_clone_probe`) was created and `alembic upgrade head` run
    against it from empty. It reached `9f3c2a7e8d21`, `refresh_tokens` exists,
    and the whole seed chain runs — 36 states, 155 universities, 331 colleges,
    6 scholarships, 6 exams, 1 mock paper. The full suite then passed against
    that fresh schema: **429 passed, 1 skipped**.

The failing test was BUG-09 and is fixed below.

One correction to the record, from this verification: the claim in the older
table that the suite reported `315 passed, 1 skipped` was wrong twice over. It is
**440 passed, 1 skipped** now, and the 429-test figure is what the suite reports
against a schema built from scratch.

## BUG-07 — Redis is not running, so the rate limiter is not cluster-wide 🟡 MEDIUM — **FIXED**

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

**Status: FIXED (29 September 2026).** Two parts, and the second is the one that
mattered.

**Redis is running.** `docker compose -f docker-compose.dev.yml up -d redis`
brings up `redis:7-alpine`; `PING` answers `PONG`, and the limiter's Lua script
evaluates correctly (`{1, 60}` on a fresh key).

**The real path is now exercised, which it never was.** The reason nothing
caught this is worth recording: `tests/conftest.py` stubs Redis suite-wide, so
*every* limiter test ran against `FakeRedis`, a Python dict that reimplements the
script's semantics. That fake is single-threaded and sequential, so it cannot
distinguish one atomic `EVAL` from the old non-atomic `GET`-then-`INCR`. The
properties that need a real server were unverified anywhere, in production and
in CI alike.

`tests/test_ratelimit_redis_live.py` closes that — 11 tests against a real
server on database 15:

- `EVAL` of the script is **accepted by Redis at all**, which `FakeRedis.eval`
  never checked because it ignores the body.
- 50 concurrent increments leave the counter at **exactly 50** — the atomicity
  the old implementation lacked.
- **Two independent connections share one counter** (2 and 3 on the same key).
  This is BUG-07's actual property: with Redis down the limiter degrades to
  per-process counters, and only a real server shows the difference.
- The window is set on creation and **not extended by traffic**.
- 20 concurrent HTTP logins produce **exactly 15 throttles** of 20 — the
  security-relevant version of the same property.
- Against a **real closed port**, `/health` returns 503 `degraded` and auth
  fails closed with 503, and the request is bounded by the 250 ms
  `socket_connect_timeout` rather than stalling.

The tests skip when no Redis answers, so a bare checkout still runs, and CI now
gives every test job a `redis:7-alpine` service **plus a step that fails the job
if these tests skip** — a full skip otherwise exits 0 and would reopen the gap
behind a green tick. Suite-wide: **440 passed, 1 skipped**.

---

# Bug register — third pass, 29 September 2026 (re-check by executing)

Found while re-checking the "complete" columns. All three are deterministic and
reproduced; the two order-dependent failures are recorded for root-causing.

## BUG-08 — `refreshAccessToken` returns a dead token when the session is refused 🔴 HIGH — **FIXED**

**Phase 3.6 / 7.5.** New in the memory-only token layer. The 22-test Vitest
suite was written to close the BUG-01 gap on the client, and one test refutes the
implementation on the day it was written:

```
tests/auth-token.test.ts > refreshAccessToken > clears a held token when the refresh is refused
  storeAuth({access_token: ACCESS}); fetch resolves 401;
  await refreshAccessToken();
  expect(getAccessToken()).toBeNull();        // FAILS — still returns ACCESS
```

**Mechanism.** `lib/api.ts:439`, inside `refreshAccessToken`:

```ts
if (accessToken) return accessToken;   // "another tab may have rotated…"
```

The guard is meant for the cross-tab single-flight race, but it fires on every
call, including the one `apiFetchImpl` makes *after the backend has just refused
the held token with a 401*. On the 401-repair path the held token is known-stale,
yet this line makes `refreshAccessToken` return it without touching the network:
`fresh` is truthy, so the caller re-sends the corpse, gets a second 401, and the
session is never actually repaired or cleared. The UI stays signed-in-looking while
every request re-401s — the exact regression the test's comment says it exists to
prevent.

The two behaviours it collides with are both tested and both currently pass:
"skips the network entirely when it already holds a token" (line 439) and this
one (the refresh must go to the server when the caller got a 401). They are
reconcilable — the skip must only apply when the held token arrived via a
cross-tab broadcast very recently, not when a 401 just proved it stale — but the
current code does not distinguish.

**Impact while open:** `npm test` exits non-zero, so `frontend.yml` cannot go
green; and in production, an expired session shows a logged-in-ish UI that keeps
failing rather than signing out cleanly.

**Status: FIXED (29 September 2026).** The two callers now declare which
behaviour they need instead of sharing one guard. `refreshAccessToken` takes
`{ force?: boolean }`:

  - `AppContext` calls it with no options on boot — "do I hold a token, from
    anywhere?". If a sibling tab is mid-rotation, adopt its broadcast and skip
    the round trip, because a second rotation would itself be a reuse.
  - `apiFetchImpl` calls it with `{ force: true }` on the 401-repair path. The
    held token is the one the server *just refused*; reusing it is the bug. The
    shortcut is skipped and a real rotation happens.

A second defect surfaced alongside it: `broadcastSignOut()` posted to sibling
tabs but did not clear the local token, so a refused refresh left a dead
credential in memory. It now clears first.

Both are covered by explicit regression tests rather than by the accidental
refutation that found them. `npm test` is green at 45 tests.

## BUG-09 — Cutoff paging test inserts rows the new identity constraint forbids 🟠 MEDIUM — **FIXED**

**Phase 4 / Phase 7 CI.** After migration `9f3c2a7e8d21` added the
`uq_cutoff_identity_coalesce` unique constraint (the Phase-4 fix for the 4-nullable-
column constraint that never fired), `test_catalog_cutoffs_paging_walks_every_row_exactly_once`
inserts six `cutoffs` rows that all share one identity
(`college_id=1, course_id=NULL, branch='', neet-ug 2024, round='', quota='',
General`) in a single multi-row INSERT. The new constraint is exactly what it is
meant to be, and fires:

```
IntegrityError: duplicate key value violates unique constraint "uq_cutoff_identity_coalesce"
QuickCheck: (college_id=1, course_id=0, branch='', neet-ug, 2024, '', '', 'General')
```

The paging property (walk every row exactly once, no row read twice) does not
need six *identical* rows; the fixture must give each row a distinct identity and
the assertion stays intact. As written, the test passes only against a schema
without the fix — the same shape as BUG-06 (a stale test meeting a correct new
constraint).

**Status: FIXED (29 September 2026).** `_make_cutoffs` now varies `quota` per
row, and the choice is the interesting part: `quota` is inside
`uq_cutoff_identity_coalesce` but **not** in the endpoint's `ORDER BY`, so the
six rows still tie on every sort key and the test still exercises the tiebreaker
it was written for. A column that had been added to the ordering would have
quietly turned a tie test into a non-tie test.

The constraint itself was then verified against a real server rather than trusted,
on a schema migrated from empty:

| Case | Expected | Result |
|---|---|---|
| Two rows identical in every indexed column | rejected | `UniqueViolation` |
| Two rows differing only in `quota` | accepted | accepted |
| Two rows with `course_id = NULL` | rejected | `UniqueViolation` |
| `quota = ''` vs `quota = ' '` | accepted | accepted |

The third row is the one the original `uq_cutoff_identity` constraint silently
allowed, since PostgreSQL treats NULLs as distinct — that is the Phase-4 defect
this index exists to close. The fourth confirms the migration's claim that the
`''` sentinel is safe, since a real space stays a separate identity.

Worth noting for the record: an earlier probe of this ran without setting
`search_path` and reported the constraint as "not firing". It was inserting into
`public.cutoffs` — the developer database, not the schema under test. Every
result above is from a probe with the search path pinned.

`test_pagination_and_predictor_stability.py`: **10 passed**.

## Order-dependent backend failures 🟡 — **RESOLVED**

In the full-suite run of 29 Sep ~02:40 (`344 passed, 2 failed, 1 error`) two
additional failures appeared that **passed in isolation**:

- `test_question_subject_numeric.py::test_mcq_grading_is_unchanged_by_the_numeric_key`
- `test_otp.py::test_resend_supersedes_the_previous_code` (reported as an error)

The hypothesis at the time was cross-test state leakage — the suite shares a
scratch schema and the rate limiter is a per-process store.

**That hypothesis was wrong, and the correct explanation is simpler: they were
never order-dependent.** Both are consumers of the same migrations BUG-06 was
about. The database was at `b7c3d91e5a20` while the code was at head
`9f3c2a7e8d21`, so both tests were being asked to assert behaviour that the
schema in front of them did not have. Running them alone did not fix anything;
running them alone merely hid it, because each one builds less of the state the
others share.

Evidence: after migrating the scratch schema to head, both pass in the full
suite, and the suite also passes against a schema migrated from empty
(`fresh_clone_probe`, BUG-06). Two full runs, **440 passed, 1 skipped** each,
with no ordering change and no `-p no:randomly` needed.

The lesson generalises past these two tests, and it is the one worth keeping from
this whole pass: *passing in isolation is not evidence.* A test that passes alone
and fails in a suite is usually telling you something real about the environment,
not about test order. Chasing ordering — `pytest-randomly`, `--forked`, reordering
— would have hidden a stale database behind a green suite.

**Superseded in part by BUG-12.** This entry resolved *these two tests*, and the
rule it states — check the schema version before blaming ordering — is sound and
was applied correctly when BUG-12 was found. But it should not be read as
"order-dependent failures in this suite are always a stale database". A later
pass produced **48** order-dependent failures with the schema already at head,
and the cause was the connection pool (see BUG-12). The general rule is the one
worth keeping: *a test that passes alone and fails in a suite is reporting on the
environment* — and the environment includes the pool, not only the schema version,
neither of which `alembic current` can see.

---

# Bug register - fourth pass, 29 September 2026 (college admin CRUD)

## BUG-11 - `PUT /colleges/{ref}` answered 200 for a field it never wrote 🟠 HIGH - **FIXED**

### What it was

`accreditation_nba` existed as a column on `College`, was returned by
`CollegeDetailResponse`, and was rendered by the college admin form as an
"NBA accredited" control. It was **absent from both `CollegeCreate` and
`CollegeUpdate`**.

Pydantic drops undeclared keys, and `update_college` is a generic
`setattr` loop over `payload.model_dump(exclude_unset=True)`. So the request
was valid, the handler ran, nothing raised, and the response was the unchanged
record serialised fresh — **200 with no change behind it**. An admin set the
value, saw "Saved", reloaded, and the field was blank again.

The asymmetry was invisible from the schema alone. `CollegeCreate` having no
`accreditation_nba` reads like a deliberate scoping decision; nothing in the
code, the docs or the tests said so. It was an omission in both classes.

### How it was found

Not by a unit test. Both request classes were tested only in the direction the
form happened not to use, and the frontend's own payload tests were asserting
the *builder's* opinion, which agreed with itself.

It was found by replaying the form's real request bodies against the real
route: the builder's `update` payload was written to a file, then `PUT` through
the app. The response came back 200 and `accreditation_nba` was still `null`.

That probe also confirmed three things the unit tests could not, all of which
are now asserted permanently:

- `college_id` (`COLLEGE000380`) is **not** a valid ref — the numeric primary
  key and the slug are. The form sends the primary key, so this is invisible
  until a ref is wrong.
- `DELETE` answers **204**, not 200.
- An empty page of the catalogue is a **normal** result. `list_colleges`
  orders by name and the schema holds 300+ colleges, so a newly created row
  sorts past page 1. The paged walk is load-bearing, not a nicety.

### Fixed

`accreditation_nba: bool | None = None` added to `CollegeCreate` and
`CollegeUpdate`, and mapped in `create_college`. The form shows the control in
both modes. `tests/test_admin_catalog.py` now asserts the round trip
(create → toggle off → clear to `null` → re-read agrees), and
`test_college_update_omitted_keys_are_left_alone` pins the `exclude_unset`
semantics the edit dialog depends on.

### The lesson, which is the same one three times over

BUG-01, BUG-05 and BUG-09 were all **a success signal with nothing behind it**:
a logout that did not end the session, a 422 rendered as an empty page, a
fixture satisfying a constraint for the wrong reason. A field the API does not
accept is the fourth instance, and it is the one a review of the *schema* cannot
catch — the schema was self-consistent, just missing a field the UI used.

The check that finds this class is not "does the model have the field". It is
"does the real request, with the real body, change the row".

---

# Bug register - fifth pass, 3 October 2026 (Phase 9.1)

## BUG-12 - Two forms answered 422 to every submission since `f765369` ?? HIGH - **FIXED**

### What it was

`f765369 feat(compliance): Phase 9 DPDP scaffolding` added `age_band` to two
request models **with no default**, and did not touch the frontend:

| Backend model | Frontend type | Result |
|---|---|---|
| `RegisterRequest.age_band: Literal["under_18", "18_plus"]` | `RegisterPayload` had no such property | **every signup 422** |
| `EnquiryCreate.age_band` (plus `guardian_contact` required when `under_18`) | `EnquiryPayload` had no such property | **every admission enquiry 422** |

Confirmed by constructing both payloads against the real Pydantic models in the
project venv — the new payloads validate, the old ones are refused with
`loc: ['age_band']`, and a minor's enquiry without a guardian is refused by
`require_guardian_for_minors`.

The admission funnel is the primary lead-capture path on the site, and it was
dead. Not degraded: dead.

### Why nothing caught it

Type checking passed, because `RegisterPayload` was the type and the type was
what was wrong — a property a type does not mention cannot be missing from it.
Lint passed. `npm run build` passed. The 502-test backend suite passed, because
it sends `age_band` correctly. The 251-test frontend suite passed, because none
of it POSTs.

This is BUG-05's shape exactly: two contracts in two languages that nothing
holds against each other.

### Fixed

1. `RegisterPayload.age_band` and `EnquiryPayload.age_band` added as **required**
   properties, so the compiler rejects any call site that omits them.
2. Signup asks "Are you under 18?" (`app/login/page.tsx`) — not defaulted, not
   skippable, and placed after the OTP branch which never asks the question.
3. The admission form asks the same question and reveals a parent/guardian
   mobile-or-email field only when the answer is `under_18`, mirroring
   `EnquiryCreate.require_guardian_for_minors` rather than inventing a second
   rule.
4. **`tests/request-contract.test.ts`** reads `RegisterRequest` and
   `EnquiryCreate` out of `backend/app/schemas/` and holds
   `RegisterPayload` / `EnquiryPayload` against them: every required server
   field must be declared, and none may be declared optional in the client.
   Verified by mutation — making `age_band` optional fails 5 of its 10 tests.

### The lesson

BUG-11's lesson was "a schema can be self-consistent and still be missing a
field the UI uses". This is the same sentence with the direction reversed: the
UI type was self-consistent and missing a field the *schema* demands. Reading
either side alone proves nothing. Only the pair does.

---

# Bug register - sixth pass, 4 October 2026 (found by CI's own configuration)

## BUG-13 - A pooled connection silently reverts to the `public` schema ?? HIGH - **FIXED**

### What it was

`app/database.py` sets `search_path` in a `connect` event. psycopg2 opens an
implicit transaction for that statement, and the pool issues `ROLLBACK` when a
connection is returned (`pool_reset_on_return='rollback'`). So a connection
whose only use was a request that ended **without committing** went back into
the pool still pointing at `public`.

### Why it was invisible for weeks

A single request never shows it, because a request that commits takes the `SET`
with it. It needs the pool to hold a rollback-only connection — and the way to
get one is to fire twenty concurrent logins, which is exactly what
`tests/test_ratelimit_redis_live.py` does.

That file **skips when Redis is down**, and Redis was down on this machine
through every earlier pass. With Redis up — which is the CI configuration, and
the one the workflow explicitly enforces by failing the job if those tests
skip — 40 tests failed across `test_rbac_rules.py`, `test_session_security.py`
and others, and the same stash-revert experiment confirmed it reproduced with
**all of this session's changes removed**. Not a regression; a latent defect
that CI was about to meet for the first time.

### The two symptoms, which look unrelated

| Symptom | Mechanism |
|---|---|
| `sqlalchemy.exc.InvalidRequestError: Could not refresh instance '<OtpRecord>'` | `db.commit()` wrote the row through a connection still pointed at `test_suite`; the session released it, `db.refresh()` drew a *different* connection that had reverted, and the `SELECT` looked in `public` and found nothing |
| Test users appearing in `public.users` — **209 rows** in the developer database | The reverted connection was the one that handled `POST /auth/register`, so the writes landed there and were invisible to everything reading `test_suite` |

Neither message mentions `search_path`. The first reads as a database
corruption, the second as ordinary data, and both only appear after the live
Redis file has run.

### Fixed

`dbapi_connection.commit()` after the `SET`, making it session state — which is
what `SET` was always meant to be; PostgreSQL only treats it as
transaction-scoped when it sits inside a transaction that later rolls back.

`tests/test_schema_isolation.py` pins it against the raw DBAPI connection
rather than through a `Session`, because the pool proxy's own `rollback()` does
not reach psycopg2 and a test that goes through it asserts nothing. Verified by
mutation: removing the `commit()` fails it with `reverted to 'public'`. The test
also disposes the pool first, so it always exercises a connection the listener
has not already been through.

### The lesson

This is BUG-06 and BUG-10 again in a new disguise: **a green suite is a
statement about the configuration it ran in.** Every pass until now ran with the
11 live Redis tests skipped, and the skip was recorded honestly in the output —
but "11 skipped" reads as a caveat, not as a warning that the rest of the suite
had never met those conditions. CI was the first thing in this project's life
that would have run them, and it would have failed on an unrelated-looking
`OtpRecord` error.

---


| Check | Result | What it does **not** cover |
|---|---|---|
| `pytest` | **442 passed, 1 skipped** — 29 Sep, two consecutive full runs. The 11 Redis tests ran (not skipped) against `redis:7-alpine`; the 1 skip is pre-existing and unrelated. The same result holds against a schema migrated from empty. | Session rotation/reuse/logout is covered by `tests/test_session_security.py`; Phase-4 leaks by `tests/test_data_integrity.py`. The suite still runs with a **stubbed** Redis, so cross-process limiter behaviour is covered *only* by `test_ratelimit_redis_live.py` — if that file skips, nothing covers it. |
| `pytest`, no Redis running | **11 skipped** for the live file, rest green | This is the shape CI would have had before the service was added: green with the cluster-wide property unverified. The workflow now fails on this. |
| `npm test` (Vitest) | **88 passed (4 files)** — 29 Sep, incl. `page-size-contract.test.ts` and `colleges-admin.test.ts` | Bounded by the four suites the frontend has. The college form's *pure* logic is covered; **no component test renders `CollegesSection`**, so the dialog wiring is verified by typecheck and by the replayed request bodies, not by a DOM assertion |
| `npm run typecheck` | clean | Nothing behavioural |
| `npm run lint` | **clean** (0 errors, 0 warnings) — one stale `eslint-disable` in `api-server.ts` removed after BUG-05 | Nothing behavioural |
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

## Confirmed working during the 29 Sep re-check

- `tests/test_env_example.py` — **9/9**: every documented `.env.example` variable
  maps to a `Settings` field or a known non-Settings consumer; `Settings()`
  accepts the template; the template cannot boot a production app.
- `tests/nav-manifest.test.ts` — **21/21**.
- `npm run typecheck`, `npm run lint`, `npm run build` — clean, clean, exit 0.
- `npm audit` → **0 vulnerabilities**; `pip-audit` → **No known vulnerabilities**.
- Containers: `prod` stack (`backend`, `frontend`, `caddy`, `db`, `redis`) and
  `localtest` stack all **Up / healthy** — corroborates Phase 2's 6/6 claim
  independently of its own narrative.

---

Live issues, none of which are resolved by the phases above alone. Struck-through
rows are closed — **BUG-01 through BUG-14 are all closed**: BUG-12 was fixed the
day it was found, BUG-13 the day after, and BUG-14 (the `X-Real-IP` proxy-gate
defect, found on `develop` during the merge) is closed here. The register has no
open defect. What
remains is not unbuilt work either: Phase 8 was descoped by decision, Phase 9.2
and both hygiene deletions were declined by decision, and the `data/` cleanup
waits on a product answer rather than on code.

| Risk | Severity | Note |
|---|---|---|
| ~~BUG-01: sessions cannot be ended~~ | ~~Critical~~ | **FIXED** — ledger, rotation, reuse detection, real logout, HttpOnly cookie. See BUG-01. |
| ~~Access token in `localStorage`, JS-readable~~ | ~~High~~ | **FIXED** — Phase 3.6. Access token is memory-only, refresh is an HttpOnly cookie, and a page load restores the session by silent refresh serialised across tabs so rotation cannot trip its own reuse detection |
| ~~BUG-02: predictor advertises `name` but rejects it; `category` case-sensitive~~ | ~~High~~ | **FIXED** — see BUG-02 |
| ~~BUG-03: auth rate limit 5/60s across all auth endpoints~~ | ~~Medium~~ | **FIXED** — per-endpoint limits. See BUG-03 |
| ~~No security headers, no CSP~~ | ~~High~~ | **FIXED** — Phase 5. Full stack in `proxy.ts`, per-path Permissions-Policy, ISR preserved. Residual: `'unsafe-inline'` in script-src (documented tradeoff) |
| No rate limit on `/api/ai`; unbounded OpenAI spend | High | Phase 4 — `/api/ai` now caps input (500 chars), rate (12/min) and timeout (15s); a plan-level budget is still open |
| Audit trail covers ~5% of mutations | High | Phase 4 |
| ~~Client-controlled `ip_address` on public endpoint~~ | ~~High~~ | **FIXED** — `X-Forwarded-For` was gated on `TRUSTED_PROXY_HOPS`, but `X-Real-IP` was read *outside* that gate, so at the shipped default of `0` any caller chose its own attribution and could mint a fresh auth rate-limit bucket per request. Both headers now sit inside the gate, and the header path validates with `ip_address` rather than length and character checks alone. Same failure class as BUG-13: the setting that was supposed to hold was the one thing an attacker controlled |
| No children's-data controls (DPDP S.9) | High | **Phase 9.1 done** — age gate, OTP-verified parental consent, `require_processing_consent` on every personal-data write. Remaining S.9 exposure is the absence of proctoring consent (Phase 47) and of a published Grievance Officer (9.2) |
| ~~BUG-12: signup and admission enquiry 422'd on every submission~~ | ~~High~~ | **FIXED** — `age_band` added to both payload types as required, both forms ask the question, and `request-contract.test.ts` reads the Pydantic models so the two sides cannot drift again |
| Duplicate predictor logic in client and server | Medium | Phase 4, with BUG-02 |
| ~~`error.tsx` claims a team was notified; nobody is~~ | ~~Medium~~ | **FIXED** — Phase 5.4. reportError → /api/errors → server log; onRequestError for server errors; global-error.tsx exists; copy no longer claims a delivery it cannot promise |
| Dashboard has no dark mode; duplicate navigation | Medium | Phase 6 |
| Fabricated public metrics | Medium | Phase 6 |
| Dormant DB tables render as broken pages | Medium | Phase 6 |
| ~~56 of 60 documented env vars are unread~~ | ~~Low~~ | **FIXED** — Phase 5.5. 45 removed, each traced to the code that reads it. `.env.prod.example` still lists three phantom guards (see Phase 8.2) |
| ~~BUG-05: a 422 became an empty page with a 200~~ | ~~High~~ | **FIXED** — per-endpoint page sizes, non-silent failures, and `page-size-contract.test.ts` reads the Python `le=` bounds so the two cannot drift again |
| ~~BUG-06: failing test + four untracked migrations~~ | ~~High~~ | **FIXED** — all four tracked, single linear head, and a clean schema migrates to head and passes the suite |
| ~~BUG-07: Redis down, so the limiter was not cluster-wide~~ | ~~Medium~~ | **FIXED** — Redis running, and `test_ratelimit_redis_live.py` (11 tests) exercises atomicity, cross-process sharing and real-connection failure; CI fails the job if those tests skip |
| ~~BUG-08: refresh returns a dead held token on a refused session~~ | ~~High~~ | **FIXED** — `refreshAccessToken({ force })`; the skip applies to a cross-tab broadcast, not to a token the server just refused |
| ~~BUG-09: cutoff-paging test fights the new identity constraint~~ | ~~Medium~~ | **FIXED** — fixture varies `quota` (in the constraint, not in the `ORDER BY`, so the tie the test relies on survives); the index was then verified against a real server |
| ~~BUG-04: PowerShell misreports error bodies on Windows~~ | ~~Low~~ | **NOTED** — a testing trap, not application behaviour. Use `httpx`/`curl.exe` when probing |
| ~~BUG-01/02/03~~ | ~~Critical/High/Medium~~ | **FIXED** — see their sections above |
| ~~Order-dependent numeric-grading / OTP-resend failures~~ | ~~Medium~~ | **RESOLVED** — not order-dependence. The scratch database was behind the code; migrated, both pass in the full suite. Passing in isolation had hidden it |
| BUG-10: stale-database failures present as "passes alone, fails in suite" | Low | **PROCESS** — a now-fixed instance of this, kept as a rule: do not reach for test ordering when a test passes alone and fails in a suite. Check the schema version first |
| ~~BUG-11: `PUT /colleges/{ref}` answered 200 for a field it never wrote~~ | ~~High~~ | **FIXED** — `accreditation_nba` was on the column and the response model but on neither request schema, so the admin form's control saved nothing. Found by replaying the form's real body against the real route, not by a unit test; the round trip is now asserted |
| ~~4.6 MB duplicated agent-skill bundles~~ | ~~Low~~ | **DECLINED** — offered 4 Oct, the owner chose to keep them; closed as won't-do rather than left open |
| ~~`data/` cleanup~~ | ~~Low~~ | **DECLINED** — offered 4 Oct and declined with the skill bundles. `Padhaanewala_Data.xlsx` is still a PDF wearing an `.xlsx` extension; the underlying question (an admin-panel PDF upload path) is a product decision |
| ~~BUG-13: a pooled connection reverts to the `public` schema~~ | ~~High~~ | **FIXED** — the `SET search_path` ran inside the transaction the pool rolls back, so rollback-only connections wrote to the wrong schema. It surfaces as `Could not refresh instance` and as test users in `public.users`, and only appears once the live Redis tests run — i.e. in CI. The statement now runs under autocommit so no transaction is ever opened for it; 3 regression tests in `tests/test_database_schema.py`, each verified to fail with the fix reverted |
| Local development database sits behind the migration head | Low | **PROCESS** — the developer schema was at `b7c3d91e5a20` while the code was at `9f3c2a7e8d21`, which is what produced the "order-dependent" failures. Run `alembic upgrade head` after pulling migrations |
| **Schema isolation depends on `search_path` surviving pool reuse** | **Medium** | **PROCESS** — BUG-12 is fixed, but the failure mode is invisible to `alembic current` and returns if the `connect` listener's statement is ever moved back inside a transaction. The three tests in `tests/test_database_schema.py` are the only guard; treat them as load-bearing rather than incidental |

---

# Bug register - fifth pass, 4 October 2026 (admin console role management, and a silent schema regression)

This pass did two unrelated things: it finished the admin console's role
management, and in the course of establishing a trustworthy test baseline it
found that **48 backend failures and one root cause had been sitting in plain
sight the whole time.** The role-management work is summarised at the end; BUG-13
is the finding that matters.

## BUG-13 - a pooled connection silently lost `search_path` on reuse 🔴 CRITICAL - **FIXED**

> Numbering note: this section and the register's own BUG-13 entry were written
> independently on `develop` and `main` and collided on merge. They are the same
> defect, so they are one bug with one number — the `main` register's BUG-13. The
> `X-Real-IP` finding below, which only `develop` had, is therefore BUG-14.

### What it was

`app/database.py` applies the configured schema from a `connect` event listener,
correctly, for the documented reasons (a transaction-mode pooler rejects
`search_path` as a startup parameter; some managed hosts drop `public` from the
session's default). The listener ran:

```python
with dbapi_connection.cursor() as cursor:
    cursor.execute(f'SET search_path TO "{SCHEMA}", public' if SCHEMA else "SET search_path TO public")
```

**The statement was never made durable.** psycopg2 opens an implicit transaction
for any statement, so that `SET` lived inside it — and `QueuePool` issues
`ROLLBACK` whenever a connection is returned to the pool. The rollback reverted
`search_path` to the server default. The consequence is the whole bug:

- a connection's **first** checkout saw the configured schema;
- **every checkout after that** saw `"$user", public`.

Demonstrated in isolation, outside pytest, with nothing but sequential checkouts
of the one global engine:

```
checkout 1 (fresh)       : test_suite, public
checkout 2 (after close) : "$user", public
checkout 3 (post-rollback): "$user", public
```

Why it was invisible for so long: **with no schema configured the reverted value
is still effectively `public`.** A default deployment was always correct by
accident. Schema isolation only breaks when `PADHAANEWALA_SCHEMA` is set — which
is the entire test suite, and any environment that uses the isolation at all.

### How it was found

The full suite reported **48 failures** (25 failed, 23 errors) that all passed in
isolation. That is BUG-10's exact shape, so BUG-10's rule was applied first: check
the schema version before blaming ordering. The schema was at head. The rule came
up empty, correctly.

The traceback was the informative part:

```
File "app/services/otp_service.py", line 324, in issue
    db.refresh(record)
sqlalchemy.exc.InvalidRequestError: Could not refresh instance '<OtpRecord at 0x...>'
```

A rate-limiter test was the only thing that could precede it. Narrowing by
pairing found a deterministic two-test reproducer, and the culprit was
`test_concurrent_logins_never_exceed_the_limit` **alone** — it passes in
isolation, and the *next* test fails:

```
pytest tests/test_ratelimit_redis_live.py::test_concurrent_logins_never_exceed_the_limit \
       tests/test_rbac_rules.py::test_r2_5_registration_grants_exactly_student
→ 1 passed, 1 error
```

Instrumenting `Session.refresh` ruled out the obvious explanations. The instance
was `persistent: True`, `transient/detached/pending: False`, had an identity, was
not deleted, and its session was `is_active: True` and mid-transaction on an open
connection. Nothing was wrong with the object. Reading SQLAlchemy's `refresh()`
showed the message means `load_on_ident` returned `None` — **the re-`SELECT`
matched no row.**

Querying both schemas for that primary key found the row, in the *other* schema
than the one being searched:

```
search_path        : '"$user", public'
pk_in_test_suite   : [(1, 'student.9540b341@example.com')]
pk_in_public       : []
```

That is the bug, stated in one line: **the row had been written through one pooled
connection and read back through another that was looking in the wrong schema.**

### Why it presented as order-dependent flake

Three things had to line up, and each one disguised the others:

1. **The pool hands out whichever connection is idle.** Whether a given request
   got a correctly-configured connection was a function of arrival order, so
   correctness looked nondeterministic.
2. **The trigger was a concurrency test.** Twenty simultaneous logins grew the
   pool past its warm size, which is why one test appeared to poison the next. The
   test was not leaking anything of its own; it changed *which* connection the
   following request would be given.
3. **The symptom was never a connection error.** Because the failure surfaced as
   `db.refresh()` after a successful `commit()` — and `commit()` is precisely what
   releases the connection, so the re-`SELECT` is the first statement to land on a
   *different* connection than the `INSERT` did — it read as a missing row rather
   than as a misrouted one.

Note that it was never OTP-specific, despite the first traceback pointing at
`OtpRecord`: once that call was instrumented past, the identical failure surfaced
on `db.refresh(user)` in `register`. Anything that writes then re-reads was
affected.

### Fixed

The listener now sets `search_path` under autocommit, so it cannot be rolled back,
and restores the previous mode afterwards:

```python
previous_autocommit = dbapi_connection.autocommit
dbapi_connection.autocommit = True
try:
    with dbapi_connection.cursor() as cursor:
        cursor.execute(statement)
finally:
    dbapi_connection.autocommit = previous_autocommit
```

`tests/test_database_schema.py` pins it with three tests: `search_path` survives
repeated reuse, survives an explicit `ROLLBACK` (the specific trigger), and — the
observable consequence rather than the setting — a bare table name resolves to the
configured schema's owning namespace. The third reads the owner from
`pg_namespace` rather than from `regclass` text, because Postgres omits the schema
qualifier from `regclass` whenever it is visible in `search_path`, which would make
a correct connection indistinguishable from a reverted one.

**Each of the three was verified to fail with the fix reverted and pass with it**,
so they are guards rather than decoration:

| Check | Before | After |
|---|---|---|
| Full suite | 494 passed, 25 failed, 23 errors | **544 passed, 1 skipped** |
| Full suite, second consecutive run | — | **544 passed, 1 skipped** |
| `test_ratelimit_redis_live.py` + `test_rbac_rules.py` | 10 failed, 16 errors | **49 passed, 1 skipped** |
| `tests/test_database_schema.py`, fix reverted | 3 passed | **3 failed** (as required) |

Two consecutive full green runs are the evidence that matters here. One green run
would not have distinguished "fixed" from "re-seeded", which is the specific trap
this bug sets.

`alembic/env.py` was checked for the same pattern and is **not** affected: it
passes `search_path` as a driver startup option via the URL, which is applied at
connection time and is not transactional.

### The lesson, and it is a companion to BUG-10's

BUG-10 says: when a test passes alone and fails in a suite, check the schema
version first. That rule was right, it was followed, and it came up empty — which
is what made this bug findable at all.

The companion rule is: **the environment includes the connection pool, not only
the schema version.** `alembic current` reports what the database is; it cannot
report what a given pooled connection will do. Every session-scoped setting a
connection depends on — `search_path`, `statement_timeout`, a temp table, a
`SET ROLE` — is invisible to it, and every one of them is a candidate for the same
class of failure.

The tell worth remembering is narrow and specific: **`db.refresh()` failing after
a successful `db.commit()` is not a missing row, it is a second connection.** Any
write-then-refresh in this codebase turns pool heterogeneity into a correctness
bug rather than a throughput detail.

The other lesson is about the comments in that file. The block above the listener
explained *why* `search_path` is applied on connect, and it was entirely correct —
PgBouncer really does reject the startup parameter, managed hosts really do drop
`public`. The defect lived in the one dimension nobody had written down: not the
mechanism, but the **durability** of the statement. A file can be thoroughly
documented and still be wrong in the gap between what its comments explain and
what they do not mention. The new comment says "AUTOCOMMIT is load-bearing, not a
convenience" for that reason, because it otherwise reads as removable noise.

---

## Also completed in this pass

Admin console role management, on top of a baseline established by fixing BUG-13:

- `GET /api/v1/users` returns `{items,total,limit,offset}` with server-side
  `search` (email, mobile, `StudentProfile.name`), `role`, `is_active`,
  `limit` and `offset`. Admin users carry a truthful `display_name`.
- `GET /api/v1/roles` returns a server-computed `grantable`, derived from the same
  `outranks()` predicate that `PATCH /users/{id}` enforces, so the console cannot
  offer a grant the write path would refuse. `PRIVILEGE_ORDER` is strongest-first
  and the comparison is strict, so a plain `admin` cannot grant `admin` or
  `super_admin`, and not even `super_admin` can grant `super_admin`.
- `tests/test_auth.py` (40 tests) asserts, for every role, that the advertised
  `grantable` matches what the write path actually accepts — so the two cannot
  drift.
- `StudentsSection.tsx` replaces the hardcoded admin toggle with a real role
  editor over server-side search, filters and pagination, with stale-offset
  protection. `useAdminResource` was generalised to arbitrary payload shapes with
  a `reloadKey`; `lib/user-roles.ts` holds the tested role/page logic.

Full-suite diff against a stashed baseline confirmed **zero new failures** from
this work — the only failures present were the 48 that turned out to be BUG-13.

| Check | Result |
|---|---|
| `backend/tests/test_auth.py` | **40 passed** |
| Full backend suite | **544 passed, 1 skipped** (two consecutive runs) |
| `npm test` (Vitest) | **227 passed** (9 files) |
| `npm run typecheck` / `npm run lint` / `npm run build` | clean / clean / exit 0 |

`POST /api/v1/notifications` was swept for callers of its changed response shape:
one consumer, `adminApi.sendNotification`, already typed
`AdminNotificationBroadcast`. The `cp_notifications` references and
`lib/data/notifications.ts` are unrelated — student local state and the AI-chat
stub respectively.

## Standing note

`frontend/frontend/components/home/SearchBar.tsx` was already modified in the
working tree before this pass and was deliberately not touched.

### BUG-14 - `X-Real-IP` was trusted outside the proxy gate 🔴 HIGH - **FIXED**

Found while verifying whether the risk table's open `Client-controlled ip_address`
row was still accurate. It was not stale, and it was worse than the row said.

`client_ip` gated `X-Forwarded-For` on `TRUSTED_PROXY_HOPS > 0` correctly, then
consulted a **second** forwarded header, `X-Real-IP`, *outside* that gate. At the
shipped default of `TRUSTED_PROXY_HOPS = 0` that let any caller pick its own
attribution:

| Spoofed header | `client_ip` returned, before |
|---|---|
| `X-Real-IP: 1.2.3.4` | `1.2.3.4` |
| `X-Real-IP: 9.9.9.9` | `9.9.9.9` |
| `X-Real-IP: attacker-controlled-garbage` | `attacker-controlled-garbage` |

Two impacts:

- **Corrupted forensic record.** `audit_logs.ip_address` and
  `enquiries.ip_address` accepted arbitrary text, not addresses — the exact
  outcome the function's own docstring says it exists to prevent.
- **Auth rate-limit bypass.** `_client_key` derives the throttle bucket from this
  value, so varying the header minted a **fresh bucket per request**. The limiter
  was cluster-wide (BUG-07) while its key was attacker-controlled.

The docstring claimed *"At 0 the header is ignored entirely and the socket peer is
authoritative"*, which was false for `X-Real-IP`.

**Why the existing test missed it.** `test_data_integrity.py` asserts an
`X-Forwarded-For` spoof is ignored at `hops = 0` — the header the code *did*
ignore, so the test agreed with itself while the other header went untested. That
is BUG-01, BUG-05, BUG-09 and BUG-11 again: a green assertion with nothing behind
it. The defect was only ever visible at the boundary between the extractor and its
two callers, and nothing covered that boundary.

**Fixed** in two independent layers, because one is not enough:

1. `X-Real-IP` now sits inside the `hops > 0` gate alongside `X-Forwarded-For`.
2. Header candidates must parse as an IP address (`ipaddress.ip_address`).
   Cleaning the text was never sufficient — `not-an-ip` is short, quote-free and
   whitespace-free, and would still have been stored as an attribution.

The socket peer is deliberately held to the **looser** standard, and enforcing
strict validation there caused a real regression worth recording: `TestClient`
presents itself as the string `testclient`, so seven audit-trail tests failed
with `ip_address` recorded as `None`. Requiring a parseable IP on a value the
caller cannot choose buys no security and destroys attribution, collapsing every
such caller onto the single `unknown` throttle bucket. `_sanitize_peer` therefore
keeps only the length and character checks.

`tests/test_client_ip.py` (20 tests) covers both headers, both settings, and the
rate-limit key. Each layer was verified to be independently load-bearing: removing
the gate fails 4 tests, removing the IP validation fails 1 more.

| Check | Result |
|---|---|
| Full backend suite | **564 passed, 1 skipped** |
| `tests/test_client_ip.py`, gate removed | **4 failed** (as required) |
| `tests/test_client_ip.py`, IP validation removed | **1 failed** (as required) |
| Spoof probe at `hops = 0`, after | every spoof resolves to the socket peer; one bucket key |

**Operational change:** behind a proxy with the default of `0`, requests are now
attributed to the proxy rather than read from `X-Real-IP`. That is the safe
direction to fail — set `TRUSTED_PROXY_HOPS` to the real hop count to restore
attribution. Documented in `.env.example`.

**The lesson:** a fix applied to the header the tests covered was mistaken for a
fix applied to the behaviour. `X-Forwarded-For` was safe, the docstring said so,
a test asserted so, and the risk table was marked done — while a second header
sat three lines below the gate carrying the identical vulnerability.
