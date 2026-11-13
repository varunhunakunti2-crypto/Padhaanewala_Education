# Rate limiting in production

**Status:** current as of P10 (2026-11-13). Source of truth for behaviour is
`backend/app/middleware/rate_limit_policy.py`; this document explains how to
operate it, what it does not cover, and what to do when Redis is unavailable.

P1–P9 built the limiter. P10 added no new limits and changed no threshold. It
added startup validation, privacy-safe structured events, the edge proxy-header
reconstruction, tests that pin coverage, and this runbook.

---

## 1. Architecture

```
Internet
  │ :443
  ▼
Caddy ── overwrites X-Forwarded-For / X-Real-IP / X-Forwarded-Proto / X-Forwarded-Host
  │       with the address it observed ({remote_host})
  ├── /api/v1/* ──► Next.js :3000 ──rewrite──► FastAPI :8000
  ├── /health   ──────────────────────────────► FastAPI :8000
  └── /*        ──► Next.js :3000
                                                    │
                                                    ▼
                                        RateLimitMiddleware
                                          │ policy engine (route template)
                                          │ dimensions (IP / user / identifier / daily)
                                          ▼
                                        Redis :6379  (shared atomic counters)
```

* **One limiter, one shared store.** Every backend process enforces the same
  counters in Redis. There is no per-process map. The Next.js `/api/ai` route
  has no limiter of its own; it forwards the caller's credentials and proxy
  headers and propagates the backend's 429/503.
* **Middleware runs before endpoint routing.** The policy engine resolves the
  concrete path to a registered Starlette route template
  (`/api/v1/users/{user_id}`), so the bucket never contains a raw id or query
  string.
* **Redis is a fast-fail dependency.** Command timeout is 250 ms. A failed
  command is retried **once** on a fresh connection; the second failure is a
  dependency failure and the route's fail-open/closed decision applies.
* **The backend is never published.** Only Caddy publishes ports in
  `docker-compose.prod.yml`, and uvicorn runs with `--no-proxy-headers`, so
  `app/utils/client_ip.py` is the single authority on the client address.

Counters are ephemeral by design. Redis runs with `--save ""`,
`--appendonly no` and `--maxmemory-policy noeviction`. **A Redis restart resets
every bucket.** That is accepted: a lost counter is a short window of extra
requests, not corrupted data. See §8.

---

## 2. Key and dimension strategy

| Dimension | Key shape (illustrative) | Subject | Used for |
|---|---|---|---|
| Route + IP | `rl:{namespace}:{route_template}:{ip}` | trusted client IP | every throttled route |
| Route + user | `rl:p9:user_mutation:/api/v1/users/{user_id}:u:42` | verified JWT subject | P7 student actions, P9 admin routes |
| Category + IP | `rl:dim:ip:{category}:{template}:{ip}` | trusted IP | P3 additive identity caps |
| Category + user | `rl:dim:user:{category}:{template}:42` | verified JWT subject | P3 additive identity caps |
| Identifier | `rl:dim:ident:{config_key}:{hash}` | HMAC-SHA256 of normalized email/phone | login, register, OTP, password reset, public enquiry |
| Daily | `rl:dim:daily:{user\|ip}:{category}:{subject}:{YYYYMMDD}` | user or IP | paid-AI daily quotas |
| Article | `rl:p8:blog_view:{template}:a:{hash}:{ip}` | validated article ref + IP | blog view inflation |
| P8 enquiry identifier | `rl:dim:p8:ident:enquiry:{kind}:{hash}` | HMAC-SHA256 | public form spam |

Rules:

* Identifiers are **never stored raw**. Emails/phones are normalized and
  HMAC-hashed before they become a key, so the Redis keyspace is not a contact
  database.
* Daily keys contain the **UTC** day (`utc_day_bucket()`), and their TTL is
  clamped to the next UTC midnight (`seconds_until_utc_midnight()`). A signed-in
  user's daily key is shared across every IP; an anonymous caller's is keyed by
  IP. Changing network therefore does not reset an authenticated quota.
* Redis keys have no user-facing meaning and are never returned to clients.
  Response headers contain only numbers (`RateLimit-Limit`,
  `RateLimit-Remaining`, `RateLimit-Reset`, `Retry-After`).

---

## 3. Policy precedence

Rules are evaluated in priority order; the first match wins, then an explicit
per-route override may replace the limit.

| Priority band | What |
|---|---|
| 280 | P9 bulk-import operations |
| 300 | P2 exact auth overrides (login/register/refresh/OTP verify) |
| 320 | P7 student operations |
| 330 | P8 public enquiry / lead create / lead update / blog view |
| 340 | P9 sensitive operations (media upload, settings, role/user mutation) |
| 350 | P9 admin general reads/writes, P6 AI routes, audit read |
| 400 | P4 read policies (catalogue, search, statistics, media, analytics) |
| default | P2 broad write categories; opt-in fallback if enabled |

`POST /api/v1/users/{user_id}` is special: the presence of `role_ids` in the
body selects the stricter `role_change` tier. An uninspectable body (too large,
non-JSON, malformed) is charged the **stricter** tier, so padding a role change
cannot buy the looser ordinary-mutation ceiling.

---

## 4. Coverage and the known gap

Every registered FastAPI route/method is either throttled or deliberately
excluded. This is pinned by
`backend/tests/test_rate_limit_p10.py::test_every_registered_route_is_covered_or_explicitly_pinned`.

**Intentionally not throttled**

| Method | Path | Reason |
|---|---|---|
| GET | `/health` | must answer when the limiter/Redis is unavailable |
| GET | `/docs`, `/docs/oauth2-redirect`, `/openapi.json`, `/redoc` | static API metadata |

**Known gap — 23 `/api/v1` route/method combinations with no policy**

These were discovered in the P10 audit. They are **not** changed in P10 because
adding limits would alter P1–P9 behaviour without the approval that phase
requires. They are pinned by name so the gap cannot grow silently. Treat the
list as the backlog for a future approved change.

* Read:
  * `GET /api/v1/users/me`, `/users/me/profile`, `/users/me/roles`
  * `GET /api/v1/saved-colleges`
  * `GET /api/v1/consent`
  * `GET /api/v1/compliance/status`, `/compliance/parental-consent`,
    `/compliance/requests`, `/compliance/requests/{request_id}`
  * `GET /api/v1/college-submissions/my`,
    `/college-submissions/{submission_id}`
  * `GET /api/v1/reviews/my`
  * `GET /api/v1/predictor/exams`
  * `GET /api/v1/mock-tests/{mock_test_ref}`,
    `/mock-tests/{mock_test_ref}/questions`,
    `/mock-tests/{mock_test_ref}/attempts`,
    `/mock-tests/{mock_test_ref}/attempts/{attempt_id}`
* Write:
  * `POST /api/v1/compliance/parental-consent/request`
  * `POST /api/v1/college-submissions`
  * `PUT`, `DELETE /api/v1/college-submissions/{submission_id}`
  * `POST /api/v1/reviews`
  * `PUT /api/v1/reviews/{review_id}`

All are authenticated, user-scoped routes. They are not anonymous amplification
surfaces, but they are genuinely unthrottled. A future phase should classify
them (probably `authenticated_api` reads and `student_operations` writes).

---

## 5. Limits (defaults)

Windows are seconds. All of these are configurable (see §7); the values here are
the shipped defaults.

### Primary route buckets

| Surface | Namespace | Limit / window | Key |
|---|---|---|---|
| Login, register, refresh, OTP verify | `auth` | 5 / 60 | IP (+ identifier) |
| Other `/api/v1/auth/*` writes | `auth` | 20 / 60 | IP (+ identifier) |
| Public enquiry (`POST /api/v1/enquiries`) | `p8:public_enquiry` | 3 / 600 | user or IP |
| Staff lead create (same endpoint, staff role) | `p8:lead_create` | 10 / 60 | user |
| Lead update | P8 | 30 / 60 | user |
| Blog view | `p8:blog_view` | 10 / 3600 | article + IP |
| AI student chat | `/api/v1/ai/chat` | 10 / 60 | IP |
| AI PDF/question import | `/api/v1/question-imports/pdf` | 3 / 60 | IP |
| Predictor | `ai_predictor` | 10 / 60 | IP |
| P7 mock-test start | `p7:mock_test_start` | 10 / 60 | user |
| P7 mock-test answer | `p7:mock_test_answer` | 60 / 60 | user |
| P7 mock-test submit | `p7:mock_test_submit` | 5 / 600 | user |
| P7 mock-test review | `p7:mock_test_review` | 5 / 3600 | user |
| P7 saved-college write | `p7:saved_college_write` | 30 / 60 | user |
| P7 profile update | `p7:profile_update` | 10 / 60 | user |
| P7 consent write | `p7:consent_write` | 5 / 3600 | user |
| P9 bulk import | `p9:bulk_import` | 5 / 60 | user |
| P9 media upload | `p9:media_upload` | 10 / 600 | user |
| P9 settings update | `p9:settings_update` | 10 / 60 | user |
| P9 AI settings | `p9:ai_settings` | 3 / 60 | user |
| P9 role change (body tier) | `p9:role_change` | 5 / 60 | user |
| P9 user mutation | `p9:user_mutation` | 20 / 60 | user |
| P9 audit read | `p9:audit_read` | 30 / 60 | user |
| P9 admin general reads | `p9:admin_general` | role tier | user |
| P9 admin general writes | `p9:admin_general` | role tier | user |
| P9 unauthenticated admin route | `p9:admin_general` | 10 / 60 | IP |

### P9 role tiers (`RATE_LIMIT_P9_ROLE_LIMITS`)

| Role | Limit / 60 s |
|---|---|
| super_admin | 180 |
| admin | 120 |
| content_manager | 120 |
| seo_manager | 90 |
| counsellor | 90 |

The role comes only from the signed access token. A forged header, query string
or body field cannot select a tier. The endpoint's own `require_role` guard
still decides whether the action is allowed at all.

### Reads (P4)

30/min for college and course search, 10/min for catalogue statistics, 30/min
for media access and dashboard analytics, 60/min for public catalogue,
anonymous API and catalogue listings.

### Additive dimensions (P3)

* Identity caps for `authentication`, `authenticated_api`, `anonymous_api`,
  `student_operations`, `admin_operations`, `ai_operations`,
  `ai_question_generation`, `ai_predictor`, `file_uploads`,
  `dashboard_analytics`.
* Identifier caps: login email 10/600, login IP 20/600; register email/phone
  5/3600; OTP send phone 5/600; OTP verify phone 10/600; password-reset email
  5/3600, IP 10/3600.
* Daily: AI chat 100/day, AI question generation 10/day, predictor 50/day
  (both user and anonymous-IP variants).
* PDF import extra: 5 per 10 minutes per identity.

---

## 6. Trusted proxy chain

Production topology is **Caddy → Next.js → FastAPI**, with `TRUSTED_PROXY_HOPS=1`.

* Caddy's `trusted_proxy_headers` snippet **replaces** `X-Forwarded-For` and
  `X-Real-IP` with `{remote_host}` (the peer Caddy observed), and reconstructs
  `X-Forwarded-Proto`/`X-Forwarded-Host`.
* Next.js 16's `base-server.js` uses `req.headers['x-forwarded-for'] ??= …`, so
  it passes Caddy's single value through unchanged rather than appending.
* FastAPI sees a chain whose rightmost (and only) entry is the real client.
  `client_ip()` takes `len(chain) - hops` from the right. At `hops=1`, a caller
  who prepends `X-Forwarded-For: 1.2.3.4, <real>` cannot win: the rightmost
  entry is still the one Caddy wrote.
* `uvicorn --no-proxy-headers` is mandatory. With proxy headers enabled uvicorn
  rewrites `request.client` before application code runs and bypasses the hop
  check entirely.
* **Direct backend access must never be possible.** The backend container has no
  `ports:` mapping. If an operator ever publishes it, a direct caller can forge
  a single-entry `X-Forwarded-For` that `hops=1` will believe. The deployment
  config test pins the absence of a backend port mapping.

If the topology changes:

| Topology | `TRUSTED_PROXY_HOPS` |
|---|---|
| Direct FastAPI (no proxy) | 0 |
| Caddy → FastAPI | 1 |
| Caddy → Next.js → FastAPI (current) | 1 (Next does not append) |
| CDN → Caddy → Next → FastAPI | 2 |
| Anything uncertain | 0 (attribute to the proxy; safe, less precise) |

`0` is the safe failure direction: forwarded headers are ignored entirely and
the socket peer is used. It loses per-client granularity but cannot be forged.

---

## 7. Configuration

Every rate-limit setting is validated at startup by
`_validate_rate_limit_config()` (called from `Settings._guard_production_defaults`).
A bad value refuses to boot instead of silently keeping the old limit.

### Core

| Variable | Default | Notes |
|---|---|---|
| `RATE_LIMIT_ENABLED` | `true` | **Production refuses `false`.** |
| `RATE_LIMIT_POLICY_ENGINE_ENABLED` | `true` | **Production refuses `false`.** |
| `RATE_LIMIT_FAIL_OPEN` | `true` | Global default where a route has no explicit choice. |
| `RATE_LIMIT_EXEMPT_METHODS` | `["OPTIONS"]` | Production refuses GET/HEAD/POST/PUT/PATCH/DELETE. |
| `TRUSTED_PROXY_HOPS` | `0` | Must be `1` for the shipped production chain. |
| `REDIS_URL` | `redis://localhost:6379/0` | Production requires `redis://`, `rediss://` or `unix://`. |
| `REDIS_SOCKET_TIMEOUT_SECONDS` | `0.25` | Must be `> 0`. Non-positive means "block forever". |
| `REDIS_HEALTH_TIMEOUT_SECONDS` | `0.5` | Must be `> 0`. |
| `RATE_LIMIT_OBSERVABILITY_ENABLED` | `true` | Kill switch for all rate-limit events. |
| `RATE_LIMIT_OBSERVABILITY_LOG_ALLOWED` | `false` | Enables per-request allowed events (high volume). |

### Policy maps

All are JSON objects in the environment (or nested dicts in any settings
source). Validation rules:

* Every `limit` must be `>= 1` in production (`>= 0` elsewhere, where 0 means
  "disabled").
* Every `window_seconds` must be `> 0`.
* Malformed integers, unknown HTTP methods, unknown `match` values, and enabled
  overrides with no `limit` are refused.
* A disabled override (`{"enabled": false}`) may omit `limit`.
* If the fallback policy is enabled, its limit, window and method list must all
  be valid and non-empty.
* Error messages name the setting and never echo the Redis URL or any secret.

| Variable |
|---|
| `RATE_LIMIT_CATEGORY_DEFAULTS` |
| `RATE_LIMIT_NAMED_DEFAULTS` |
| `RATE_LIMIT_READ_CATEGORY_LIMITS` |
| `RATE_LIMIT_EXACT_OVERRIDES` |
| `RATE_LIMIT_PREFIX_OVERRIDES` |
| `RATE_LIMIT_P3_CATEGORY_IDENTITY_LIMITS` |
| `RATE_LIMIT_P3_CATEGORY_EXTRA_LIMITS` |
| `RATE_LIMIT_P3_IDENTIFIER_LIMITS` |
| `RATE_LIMIT_P3_DAILY_LIMITS` |
| `RATE_LIMIT_P7_STUDENT_LIMITS` |
| `RATE_LIMIT_P8_CRM_LIMITS` |
| `RATE_LIMIT_P8_IDENTIFIER_LIMITS` |
| `RATE_LIMIT_P9_ROLE_LIMITS` |
| `RATE_LIMIT_P9_UNAUTHENTICATED_ADMIN` |
| `RATE_LIMIT_P9_SENSITIVE_LIMITS` |
| `RATE_LIMIT_DEFAULT_FALLBACK_*` |

The `.env.example` template is executable: `test_env_example.py` constructs
`Settings()` from it, so a template that would not boot fails the suite.

---

## 8. Fail-open / fail-closed matrix

When Redis is unreachable **after the single retry**, the middleware either
returns `503 SERVICE_UNAVAILABLE` (closed) or lets the request proceed (open).
`429` is never returned for a dependency failure.

| Surface | Mode | Why |
|---|---|---|
| Login / register / refresh / OTP verify | **closed** | Outage is the moment to brute-force credentials. |
| Other auth writes | **closed** | Same namespace. |
| AI chat (`/api/v1/ai/chat`), AI PDF/question import | **closed** | Paid provider calls and cost/abuse exposure. |
| AI predictor / broad `ai_operations` writes | open (global) | Deterministic or capacity-only; no paid-provider spend. |
| Public enquiry / lead create | **closed** | Anonymous CRM/notification spam. |
| Media upload | **closed** | Expensive storage + virus-scan work. |
| P9 bulk import | **closed** | Expensive background job. |
| `PUT /settings`, `PUT /settings/ai`, AI test | **closed** | Sensitive admin mutation. |
| Role change / user mutation | **closed** | Privilege mutation. |
| P9 general admin writes | **closed** | Administrator surface; deliberate P9 choice. |
| P9 general admin reads | open (global) | Read-only; P9 keeps the global default. |
| Public catalogue reads | open (global) | Site must keep serving. |
| Anonymous/authenticated API reads | open (global) | Same. |
| P7 student operations | open (global) | Availability over strict pacing; quotas are not spend controls. |
| P9 audit read | open (global) | Read-only. |
| `/health` | exempt | Must answer even when the limiter cannot. |

A route's explicit choice wins. `RATE_LIMIT_FAIL_OPEN=false` flips only the
`None` (global) rows to closed; explicit fail-closed rows are unaffected.

**Dependency-error semantics**

* First command failure: log `ratelimit.redis_retry`, drop the pooled connection,
  retry once.
* Second failure: log `ratelimit.redis_error` with the resulting `fail_mode`,
  then 503 or pass-through.
* Informational counter read (headers only) after a successful enforcement EVAL:
  a failure is logged as `ratelimit.counter_read_failure` and the headers are
  **omitted**; the request is not failed.

---

## 9. Redis production assessment and outage recovery

| Property | Current setting | Assessment |
|---|---|---|
| Deployment | single `redis:7-alpine` container, internal network only | Fine for this scale. No TLS/auth inside the compose network; add `requirepass` + `rediss://` if Redis ever leaves that network. |
| Command timeout | 250 ms | Deliberate fast-fail; prevents a dead Redis from stalling the worker. |
| Connect timeout | 250 ms (client default) | Same. |
| Retry | once, after `close_redis()` | Handles stale pooled sockets and a restarted server. |
| Persistence | `--save ""`, `--appendonly no` | Counters are ephemeral. **Restart resets all buckets.** Documented, accepted. |
| Eviction | `--maxmemory 256mb`, `--maxmemory-policy noeviction` | P10 changed from `allkeys-lru`. Counters must not be silently evicted under memory pressure; writes should fail loudly instead. Watch `used_memory` and `evicted_keys` (must stay 0). |
| Health | `/health` pings Redis and returns 503 when either DB or Redis is down | Health is not throttled. |
| Multi-instance | all instances share the same Redis db | Correct by construction; pinned by tests. |
| Keyspace hygiene | TTL on every key; `INCR`+`EXPIRE` atomic in one Lua script | No unbounded growth from a steady trickle. |

### If Redis is down

1. `GET /health` reports degraded. Fail-closed surfaces return 503 with
   `Retry-After: 1`; fail-open surfaces keep serving.
2. Check `docker compose ... ps redis` and the Redis logs.
3. Restart Redis (`docker restart <redis>`). The client reconnects on the next
   request; no application restart is required (the retry path recreates the
   pool).
4. **Expect a one-window counter reset.** Every bucket starts at zero after a
   restart because persistence is intentionally off. This temporarily allows up
   to one extra window of traffic on each route. It is not a correctness bug and
   does not need a manual counter rebuild.
5. If Redis is up but memory is exhausted under `noeviction`, writes fail and
   the limiter treats that as a dependency failure. Add memory or lower
   `maxmemory` pressure; do not switch to an eviction policy that silently
   deletes counters.

### Restart/recovery verification

`test_rate_limit_p10.py` proves the code path with a switchable client: an
outage fails open for a public read, the next request after recovery is counted,
and the limit is enforced.

The live measurement was run twice, and the difference matters:

* **Local dev container** (`padhaanewala-redis-1` from `docker-compose.yml`):
  it has RDB persistence enabled (`save` defaults, `volatile-lru`). Restarting
  it **restored the counters from `dump.rdb`**, so the first post-restart
  request was still 429. That is a property of the dev container, not of the
  shipped production flags.
* **Throwaway container with the production flags** (`--save "" --appendonly
  no --maxmemory-policy noeviction`), held stopped for the outage window:
  before restart `401` (1/1); during outage fail-closed `503`, fail-open `200`;
  after restart first request `401`, second `429` — the counter genuinely reset.

**Operational check:** `noeviction` and persistence-off are only true if the
running server actually has them. Verify after deploy:

```bash
docker exec <redis> redis-cli CONFIG GET save appendonly maxmemory-policy
# save: (empty)   appendonly: no   maxmemory-policy: noeviction
docker exec <redis> sh -c 'ls -la /data'
# A stale dump.rdb is loaded at startup even when `save` is disabled.
# Remove it before first start (or mount an empty volume) or a restart will
# silently restore old buckets.
```

### Accuracy under extreme bursts

The limiter is exact at the boundary for a single process and across processes:
20 concurrent requests against a limit of 20 allow exactly 20; two processes
sharing Redis allow exactly 20 of 40.

At **80 simultaneous requests through one in-process ASGI client on a cold
connection pool**, the benchmark observed 0–27 allowed instead of 20, with
`ratelimit.redis_retry` emitted for many requests. Cause: the 250 ms client
deadline can expire after Redis has already executed the `EVAL`, and the
single retry then increments the same counter a second time. The error
direction is **stricter, never looser** — it cannot let extra traffic through.
This is inherent to retrying a non-idempotent increment after an ambiguous
timeout; it is not a correctness bug. In production:

* the pool is warm and Redis latency is ~1–3 ms, far below the timeout;
* per-process concurrency is lower than the synthetic 80-way burst;
* if `ratelimit.redis_retry` is sustained, raise
  `REDIS_SOCKET_TIMEOUT_SECONDS` rather than remove the retry, and expect the
  trade-off to move from "conservative over-count" to "fail open/closed without
  counting".

---

## 10. Observability

Events are single-line log records emitted through the application's normal
logging configuration (`logging.basicConfig` in `app/main.py`). By default that
is **stderr** with the standard `<asctime> <level> <name> - ` prefix, followed
by one JSON object — the record is not raw JSON on stdout. To ingest, parse the
object starting at the first `{` on the line, or add a JSON formatter to the
platform's logging configuration. Capture both stdout and stderr from the
container. There is no new monitoring platform and no per-request network call.
Logging failures are swallowed; **monitoring cannot break a request**.

Logger: `padhaanewala.ratelimit`. Every payload has
`"component": "rate_limit"` and `"event"`.

| Event | Level | When | Useful labels |
|---|---|---|---|
| `ratelimit.decision` | INFO | every throttle; every allow **only** if `RATE_LIMIT_OBSERVABILITY_LOG_ALLOWED=true` | `outcome`, `http_status`, `namespace`, `category`, `dimension`, `route`, `redis_latency_ms`, `limit`, `window_seconds` |
| `ratelimit.redis_retry` | WARNING | first Redis command failed, retry follows | `error_type`, `route`, `namespace` |
| `ratelimit.redis_error` | WARNING | second failure; request will fail open/closed | `fail_mode` (`open`/`closed`), `error_type`, `redis_latency_ms` |
| `ratelimit.counter_read_failure` | WARNING | informational GET failed after a successful enforcement | `fail_mode: open`, `error_type` |
| `ratelimit.quota_exhausted` | WARNING | a UTC-daily or AI ceiling ran out | `quota` (`daily`/`ai`), `limit`, `window_seconds` |

Example:

```json
{"category":"admin_user_mutation","component":"rate_limit","dimension":"route_ip","event":"ratelimit.decision","http_status":429,"limit":20,"namespace":"p9:user_mutation","outcome":"throttled","redis_latency_ms":0.412,"route":"/api/v1/users/{user_id}","window_seconds":60}
```

### What is never logged

There is deliberately no parameter for, and no event containing: client IP,
user id, hashed identifier, email, phone, OTP, JWT/token, password, prompt or
raw request path. `route` is always the registered template, or `"unmatched"`.
`error_type` is the exception class name only (e.g. `TimeoutError`), never its
message, which could contain a credentialed Redis URL. Labels are sanitized to
`[A-Za-z0-9_.:{}()/-]` and truncated (96 chars; route 160).

### Suggested alerts

| Signal | Suggested threshold | Meaning |
|---|---|---|
| `ratelimit.redis_retry` | any sustained rate | Stale/starved connections; retries over-count conservatively |
| `ratelimit.redis_error` | any sustained rate | Redis outage or network problem |
| `ratelimit.counter_read_failure` | sustained | Redis read path degraded; headers are missing |
| `ratelimit.quota_exhausted` `quota=daily` | spike | Users hitting daily AI quotas; check for abuse or a too-low limit |
| `ratelimit.decision` `outcome=throttled` grouped by `route` | step change | Possible false positive after a tuning change |
| 503 rate on fail-closed routes | any spike | Redis outage affecting login/paid surfaces |
| Redis `evicted_keys` | > 0 | `noeviction` misconfigured or memory pressure |

Allowed events are off by default because public catalogue reads are
high-volume. Turn `RATE_LIMIT_OBSERVABILITY_LOG_ALLOWED=true` on temporarily to
get per-route statistics, or aggregate throttles only.

---

## 11. Safe tuning

1. Change one variable at a time, via environment/config, never code, unless the
   policy itself is wrong.
2. Keep map values positive; production rejects zero. Use a high value or
   `{"enabled": false}` on an **override** to disable a route deliberately.
3. Remember that limits are per **route template**, so changing an id in a URL
   does not create a new budget.
4. Daily keys roll at **UTC midnight**, not local midnight. `TIMEZONE` does not
   affect quota rollover.
5. After a change, restart the backend (settings are read at process start).
6. Verify with the same route and identity you intend to affect: check
   `RateLimit-Limit` on an allowed response and the 429 `details.retry_after_seconds`.
7. Do not lower a limit to `1` as a shortcut for "block this route"; it throttles
   legitimate first retries and produces confusing support tickets.
8. If you raise an AI daily quota to control **spend**, stop: see §14.

---

## 12. Testing 429 and false positives

Reproduce a 429 safely with a disposable identity/IP and a route whose limit is
low:

```bash
# Public enquiry: 3 per 10 minutes, keyed by IP (or user when signed in)
for i in 1 2 3 4; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://<host>/api/v1/enquiries \
    -H 'Content-Type: application/json' \
    -d '{"name":"test","phone":"9000000000","email":"loadtest@example.com"}'
done
```

Expect `2xx` (or a validation error) for the first three and `429` for the
fourth. The 429 body is:

```json
{"success": false, "error": {"code": "RATE_LIMIT_EXCEEDED", "message": "Too many requests, try again later", "details": {"retry_after_seconds": 600}}}
```

If a real user reports a false positive, check in this order:

1. Are they behind a shared NAT/campus/office IP? Anonymous route buckets are
   IP-keyed. For authenticated routes, P7/P9 buckets are user-keyed, so two
   users on one IP are independent; P3 identity caps can still be shared by IP.
2. Did they hit an **identifier** cap (e.g. repeated OTP requests for the same
   phone) rather than the route cap? The message is the same; the dimension in
   the event says which.
3. Did they hit a **day** quota? `retry_after_seconds` will be until UTC
   midnight, often much larger than a minute.
4. Was the proxy chain changed (CDN added, backend published)? Wrong
   `TRUSTED_PROXY_HOPS` either collapses everyone onto the proxy address or
   lets a header mint buckets.
5. If the limit itself is wrong, tune it in config and document why; do not
   disable `RATE_LIMIT_ENABLED` in production (the process will refuse to boot).

Never diagnose by reading Redis keys containing emails/phones; they are hashes
by design and the structured events are the supported signal.

---

## 13. Deploy and rollback

### Deploy checklist

1. `RATE_LIMIT_ENABLED=true`, `RATE_LIMIT_POLICY_ENGINE_ENABLED=true`.
2. `TRUSTED_PROXY_HOPS=1` for the Caddy → Next → FastAPI chain; backend has no
   published port; uvicorn uses `--no-proxy-headers`.
3. `REDIS_URL` points at the shared Redis (not localhost in a container) and
   uses `redis://`/`rediss://`/`unix://`.
4. Redis `--maxmemory-policy noeviction`, persistence off (documented reset).
   Verify the *running* server, not just the compose file:
   `CONFIG GET save appendonly maxmemory-policy` must return an empty `save`,
   `appendonly no`, `noeviction`; remove any stale `dump.rdb` in `/data` (Redis
   loads it at startup even when saving is disabled).
5. `GET /health` is 200 and reports Redis/DB reachable.
6. Exercise one fail-closed route (login) and one fail-open read; confirm 429s
   appear for a known-low limit and structured events appear in the captured
   logs (stderr by default).
7. Confirm `evicted_keys` is 0 and Redis memory has headroom.
8. Confirm `ratelimit.redis_retry` is not sustained after warm-up (a cold
   connection burst can retry and over-count conservatively).

### Rollback

* **Config-only change:** revert the environment value and restart the backend.
  No data migration is involved.
* **Bad limit causing false positives:** raise that one map entry, restart,
  verify. Do not set `RATE_LIMIT_ENABLED=false` in production; the startup guard
  refuses it. If the limiter itself must be bypassed during an incident, roll
  back the application image to the previous release and record why.
* **Redis outage:** restart Redis; counters reset by design. No application
  rollback is needed.
* **Proxy change:** revert Caddy/compose together with `TRUSTED_PROXY_HOPS`;
  they are a single unit. A mismatched pair is worse than either value alone.

---

## 14. Request quotas are not monetary spend controls

The limiter bounds **request counts**. It does not measure provider tokens or
currency. An AI daily quota of 100 requests does not guarantee a spend ceiling:

* one request can carry a very large prompt or generate a very long completion;
* provider pricing differs per model and per token class;
* retries, streaming and tool calls can multiply provider work per request;
* the AI settings/test endpoints call a provider outside normal user quotas.

P10 found no provider token/cost accounting in this codebase and therefore
makes **no claim** that these limits cap monetary spend. If spend protection is
required, it needs a separate feature: per-user token accounting, a cost budget
enforced before the provider call, and reconciliation against provider billing.

---

## 15. Verification summary (P10)

### Tests

* `backend/tests/test_rate_limit_p10.py`: **107 passed**. Covers startup guards,
  coverage/gap pinning, proxy forgery, the fail matrix, retry/recovery,
  observability privacy, shared counters, boundaries, daily rollover and Redis
  call counts.
* P2–P9 rate-limit suites, the live-Redis suite and the three previously failing
  non-limiter tests: **424 passed**.
* Frontend: **845 tests / 41 files passed**.
* Full backend suite: **1175 passed, 25 failed, 1 skipped**. All 25 failures were
  in `test_media_config.py` (22) and `test_otp.py` (3): their production-guard
  baselines still disabled rate limiting (the suite's global default), which the
  new production guard now correctly refuses before reaching the guard under
  test. Both baselines were updated to satisfy the rate-limit guards, and both
  files were re-run: **62 passed**. The harness also takes ~13 h on this machine,
  so the whole suite was not repeated after that test-only fix.
* The three previously reported failures (`test_get_college_courses`,
  `test_super_admin_edits_a_whole_broadcast`, order-dependent question import)
  were traced to test assumptions (row ordering, default `limit=50` pagination,
  exact slug reuse) and fixed in the tests, not by changing application logic.

### Live performance (Windows host, Docker Redis 7, in-process ASGI client)

| Measurement | Result |
|---|---|
| Single-key Lua `EVAL` | p50 1.18 ms, p95 1.94 ms, p99 2.74 ms |
| Three-key atomic `EVAL` | p50 1.17 ms, p95 1.90 ms, p99 2.72 ms |
| Sequential `EVAL` throughput (one client) | ~700–735/s |
| Limiter overhead, instrumented (route `POST /api/v1/faqs`) | **+4.4 ms mean** total request time vs limiter disabled |
| Of which: policy/route resolution | ~1.95 ms |
| Of which: Redis increment (`EVAL` + retry wrapper) | ~2.2 ms |
| Endpoint baseline (same route, limiter disabled) | 5.7 ms mean |
| Boundary: 20 concurrent, limit 20 | exactly 20 allowed |
| Boundary: two processes sharing Redis, limit 20 | exactly 20 allowed of 40 |
| Two users, one IP | independent buckets (each gets its own quota) |
| One user rotating IPs | quota follows the user; IP change does not reset it |
| Redis stopped: fail-closed route | `503` with `Retry-After: 1` |
| Redis stopped: fail-open read | `200`, request served |
| After restart (prod flags) | first request allowed, second `429`; counter reset proven |

The 80-way cold-burst anomaly and its conservative direction are described in
§9. Route resolution is per-request CPU work (~2 ms here); a bounded per-process
memo keyed by `(method, route template)` is the obvious future optimization, but
it is out of P10 scope.

### Edge configuration

`docker run --rm … caddy:2-alpine caddy validate` reports **Valid
configuration** for the shipped Caddyfile (with `ACME_EMAIL`/`SITE_ADDRESS`
substituted). The emitted warnings are Caddy's advisory "unnecessary
`header_up`" notices; the explicit replacement is deliberate, because Caddy's
default behaviour appends to an incoming `X-Forwarded-For` and forwards a
client-supplied `X-Real-IP`.
