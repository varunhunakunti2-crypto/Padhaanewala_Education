# PADHAANEWALA — MASTER PHASE CHECKLIST + MANDATORY PREREQUISITES

> **This file was fully rewritten on 2026-09-27.** The previous version (13 Sep 2026)
> claimed *"4 of 105 phases complete"* and cited **~15 files/routes that do not
> exist**, **5 commits absent from git history**, and **7 mutually inconsistent
> test counts**. Every one of those claims has been discarded.
>
> All 105 verdicts below were re-derived from the source tree at commit
> **`8199877`** (clean working tree), cross-checked against
> `docs/phase-verification.md` and `docs/rbac-compliance-checklist.md`.
> Row counts were **queried live** against the dev database, not estimated.

**Spec source:** `docs/padhaanewala-complete.md` (Master Plan V5.0), §C lines 4421–5699.

---

## 1. Headline: how much work is done

| Metric | Value |
|---|---|
| Phases **fully complete** (✅) | **9 of 105** — **8.6 %** |
| Phases **partially done** (🟡) | **40** |
| Phases **render but are stubs** (🔶) | **5** |
| Phases **not started** (⬜) | **50** |
| Not verifiable in-repo (process) (—) | 1 (Phase 99) |
| **Weighted completion** (✅=1.0, 🟡=0.5, 🔶=0.2, ⬜=0) | **30.0 / 105 = 28.6 %** |
| Backend-only weighted completion | **~62 %** |
| Frontend-only weighted completion | **~33 %** |

**Verdict key:** ✅ complete · 🟡 partial · 🔶 stub (renders convincingly, wired to nothing) · ⬜ not started

> ### ⚠️ Correction to `docs/phase-verification.md`
> Its headline table claims **14 ✅ / 26 🟡 / 11 🔶 / 54 ⬜**. I recounted every row
> of its own phase tables and get **9 / 40 / 5 / 50**. The per-phase tables are the
> reliable part; **the headline is from an earlier draft and is wrong.** The numbers
> in this document are the recount.

**The single sentence that matters:** *the backend is roughly twice as far along as
the frontend, and the gap is not cosmetic — a large, tested, correct API surface has
never been connected to the browser.*

---

## 2. Verified code inventory (as of `8199877`)

| Asset | Count | Verified how |
|---|---|---|
| Backend routers | 25 | `backend/app/main.py:61-85` registration |
| Backend endpoints | **149** | grep `@router.(get\|post\|put\|patch\|delete)` |
| Database tables | **40** (39 `__tablename__` + `user_roles` `Table()`) | `models/__init__.py:1-76` |
| Alembic migrations | 9, head **`f1a7c9e2d3b4`** | single linear `down_revision` chain |
| Backend test functions | **166** (165 pass, 1 skip) | `pytest -q` → `165 passed, 1 skipped in 47.69s` |
| Frontend route pages | **24** | `frontend/app/**/page.tsx` |
| Frontend components | **95** | `frontend/frontend/components/**` |
| Frontend lib modules | 20 | `frontend/lib/**` |
| TypeScript | clean | `npx tsc --noEmit` → exit 0 |
| CI pipelines | **0** | `.github/`, `.gitlab-ci.yml`, `Jenkinsfile`, `.circleci` all absent |
| Security headers in code | **0** | only hits are in `docs/` prose |

### Live database reality (queried 2026-09-27, schema `public`)

| Table | Rows | Gate | % |
|---|---|---|---|
| states | 36 | 36 | ✅ 100 % |
| districts | 755 | ~780 | ✅ 97 % |
| cities | 105 | — | — |
| universities | 155 | — | — |
| roles | 14 | 14 | ✅ 100 % |
| users | 1 | — | — |
| **colleges** | **10** | 1000 | ❌ **1 %** |
| courses | 20 | 50 | ❌ 40 % |
| **scholarships** | **6** | 100 | ❌ **6 %** |
| exams | 6 | 50 | ❌ 12 % |
| **test_questions** | **0** | 500 | ❌ **0 %** |
| blogs | 0 | 20 | ❌ 0 % |
| faqs / banners / reviews | 0 / 0 / 0 | — | ❌ 0 % |
| mock_tests | 0 | — | ❌ 0 % |
| **placement_records** | **0** | 500 | ❌ **0 %** |
| **cutoffs** | **0** | — | ❌ **0 %** |
| **nirf_rankings / other_rankings** | **0 / 0** | — | ❌ 0 % |
| **seat_matrix** | **0** | — | ❌ 0 %** |
| fees / admissions | 0 / 0 | — | ❌ 0 % |
| enquiries / leads / lead_notes | 0 / 0 / 0 | — | ❌ 0 % |
| counsellors / consent_records | 0 / 0 | — | ❌ 0 % |
| notifications / audit_logs / media / seo_metadata | all 0 | — | ❌ 0 % |

**`cutoffs` and `seat_matrix` are empty ⇒ `POST /api/v1/predictor` returns the
empty-data path** (`predictor.py:103-111`). Phase 40 is dead at the data layer
regardless of any frontend work.

### Tables the spec requires that do not exist at all

`otp_records` (P3) · `test_configurations` (P7/P54) · `question_options` (P7) ·
`csv_imports` (P56) · `proctoring_sessions` / `proctoring_events` /
`proctoring_evidence` (P49/P52/P53) · `user_activity` (P35) · search-history (P35).

### Services/modules referenced by the spec that do not exist

`sms_service.py` · `email_service.py` · `search_service.py` · `rag_service.py` ·
CSV import router · proctoring router · `middleware.ts` · CI config.

`EMBEDDING_MODEL`, `VECTOR_DIMENSIONS`, `RAG_*`, `SENTRY_DSN`, `CELERY_*`,
`EMAIL_*`, `SMS_*`, `OPENAI_*` all sit unread in `.env.example` — no reader exists.

---

## 3. Blocking correctness bugs — all four still open

These are live defects in committed code, verified at the current HEAD.

| # | Bug | Location | Impact |
|---|---|---|---|
| **B1** | `submit_attempt` never checks test expiry | `backend/app/routers/mock_tests.py:610-611` | A student can let the clock hit zero **and still receive a graded result**. No test covers it. |
| **B2** | `_paginated` calls `order_by(None)`, discarding caller ordering | `backend/app/routers/enrichment.py:910` | Non-deterministic pagination on 8 endpoints. Worse: `GET /rankings` calls `_paginated` **twice** with the same `limit`/`offset` (`:1038-1046` and `:1058-1066`) and concatenates, so `?limit=10` can return **20 rows**. |
| **B3** | `_grade_attempt` marks every non-MCQ answer incorrect | `backend/app/routers/mock_tests.py:120-125` (cause `:151-152`) | `correct_answer` is stored as a string for all types, but `true_false` / `numeric` / `short_answer` were never implemented — `_is_answer_correct` returns `None`, which `if answer.is_correct:` treats as false. A correct non-MCQ answer is counted **incorrect** *and* still counts as answered, so it is double-penalised. |
| **B4** | Predictor confidence uses `hash(str(cid))` | `backend/app/routers/predictor.py:219` | `hash()` is randomised per process, so confidence differs between workers and across restarts — **and confidence is a sort key** (`:250-255`), so row order is non-deterministic too. No `hashlib` anywhere in `app/`. |

**Partially fixed since last review:** the *answer-saving* path **does** enforce
expiry (`mock_tests.py:452`, `:562-564` via `_finalize_if_expired`). Only the
canonical `/attempts/{id}/submit` route is still open. Fixing B1/B5/B6 requires a
**new revision on top of `f1a7c9e2d3b4`**.

---

## 4. User-visible misinformation — nothing has been removed

Commit `0ffe97e` is titled *"remove fabricated data"*. **It removed some of it.**
Every high-risk item below is still live and reachable by users.

| Shown to users | Source | Reality |
|---|---|---|
| `/dashboard` = brand **"EduPath"**, user **"Pushkar"**, saved items = **NerdWallet / Levi's / NY Times** internships, a **"NASA Fellowship"** | `components/dashboard/DashboardExplorer.tsx:41,55,62,71,100,108,237` | A mockup of a *different product*, behind a login — the first screen every signed-in user sees |
| 14 testimonials about **"Sheryians Coding School"** | `components/reviews/AnimatedRatingMarquee.tsx:17-148` | Copied from another company's site; rendered on the homepage |
| **"12K+ Colleges · 500+ Courses · 2.4M+ Students · 98% Satisfaction — From verified reviews"** | `components/home/hero/HeroStats.tsx:5-10` | 10 colleges, 1 user, 0 reviews |
| **"12,000+ colleges"** | `components/home/QuickActions.tsx:19`, `components/home/WhyChooseSection.tsx:9` | Only **partially** removed — 2 of 4 call sites changed, 2 survive |
| "240+ / 320+ / 180+ colleges" per course tile | `components/home/PopularCourses.tsx:20,30,40` | Invented per tile |
| "Colleges listed **1,400+**", "Students/month **2.4 lakh+**" | `app/about/page.tsx:143-144`, `app/login/page.tsx:103` | Invented |
| Analytics: 184.2K views, 6.2 % conversion, 4m 32s session, 4-stage funnel | `components/admin/sections/AnalyticsSection.tsx:14-40` | **All invented.** Nothing is tracked |
| SEO: 6 audit scores, 142 indexed pages, 1.2K backlinks, 0.9 s CWV | `components/admin/sections/SeoSection.tsx:12-26` | **All invented** |
| "PostgreSQL — connectivity **verified** — Healthy" | `components/admin/sections/DashboardSection.tsx:149` | Hardcoded `ok: true`; never checked |
| "REST API: healthy" | `app/api/stats/route.ts:36-44` | Returns `ok: true` **unconditionally**; all 6 fetches can fail |
| "Registered students **12,480**" | `components/admin/sections/DashboardSection.tsx:58` | A literal |
| "Top colleges by **views**" | `components/admin/sections/DashboardSection.tsx:126-141` | Bundled colleges sorted by **review count** |
| "Synced 2 min ago" | `components/admin/AdminDashboard.tsx:64` | Literal; nothing syncs |
| "Ask AI: Which is better?" | `components/ai/MiniChat.tsx:8-17` | `setTimeout(800)` returning a template string |
| **"server-authoritative timer and autosaved answers… your results follow you across devices"** | `components/mocktests/MockTestEngine.tsx:80-84` | **False.** Local `setInterval` + `useState` + localStorage. Zero network calls in the whole file |
| Percentile on mock-test results | `lib/data/mockTests.ts:466-470` | Fabricated formula `min(99.997, (pct*0.92 + 8))` — a 92 % scale with an 8-point floor, presented as a real percentile |
| Predictor returns 3 colleges when nothing matches | `lib/data/predictor.ts:119` | Falls back to `COLLEGES.slice(0,3)` and presents them as predictions |
| Terms **and** Privacy links both → `/about` | `app/login/page.tsx:266-271` | **Neither document exists** |
| `attempts` counts (4821, 12654, 9801…) | `MockTestsSection.tsx:33`, `MockTestEngine.tsx:40` | Bundled literals, not `test_attempts` rows |

**One genuinely honest metric:** `strengthScore` (`lib/utils.ts:76-102`) is a real
weighted function of the record. Keep it.

### New defects found in this review (not in `phase-verification.md`)

| # | Defect | Location |
|---|---|---|
| **N1** | **NIRF rankings can never render.** `api-server.ts:400-404` calls `GET /colleges/{slug}/rankings/nirf` and `.../rankings/other`. **Neither route exists.** The backend has a single `GET /{college_ref}/rankings?ranking_type=nirf\|other` (`enrichment.py:515`); `nirf`/`other` exist only as POST/PUT/DELETE. Both calls 404 → `serverGet` returns `null` → silently `[]`. |
| **N2** | `12,000+ colleges` claim only half-removed (see table above). |
| **N3** | `predictor.ts:119` fabricates fallback predictions. |
| **N4** | `mockTests.ts:466-470` fabricates percentiles. |
| **N5** | Dead surface: 5 never-referenced auth/token exports and 5 never-referenced `adminApi` members in `lib/api.ts`; `resolveFeaturedColleges` and `resolveScholarship` in `lib/content.ts` have **0 callers**. |
| **N6** | `GET /colleges/search` (`colleges.py:84`) is a real server-side search endpoint that the frontend never calls — `/colleges` filters client-side instead. |
| **N7** | `package.json:2` is still named **`campus-pulse`**, and every `cp_*` localStorage key is that pre-rebrand prefix. |

---

## 5. Three structural root causes

These explain nearly every 🔶 verdict. Fixing them is worth more than patching
individual panels.

### 5.1 The frontend was never wired to ~40 % of the API

**Real, tested, and completely unused from the browser:**

| Backend surface | Backend | Frontend |
|---|---|---|
| Mock-test attempt engine (start / save / submit / resume) | `mock_tests.py:326,404,470,495,540,594,615` — 13 passing tests | **never called** |
| `POST /predictor` (4 buckets, confidence, disclaimer) | `predictor.py:69` | **never called** — client-side heuristic instead |
| `/saved-colleges` GET / POST / DELETE | `saved_colleges.py:55,83,118` | **never called** — localStorage only |
| `POST/PUT/DELETE /reviews` | `reviews.py:109,142,200` | **never called** — localStorage only |
| `PUT /users/me`, `PUT /users/me/password` | `users.py:63,93` | **never called** |
| `PATCH /users/{id}` (role / activate) | `users.py:179` | **never called** — `StudentsSection.tsx:54-61` is a toast stub |
| Lead notes / assign / follow-up | `leads.py:146,197,234` | **never called** |
| `POST/PUT/DELETE /colleges` | `colleges.py:242,302,336` | **never called** — `CollegesSection.tsx:34` is a toast stub |
| **21 × `/enrichment/*` writes** | `enrichment.py` | **zero exposed in the UI** |
| `GET /colleges/search` | `colleges.py:84` | **never called** |

166 backend tests pass. **The browser sees none of this.**

### 5.2 The admin panel has no write path

`components/admin/primitives.tsx:66-77` (`AddButton`) and `:96-113` (`RowActions`)
are **toast-only stubs** — *"Create flow is a demo action in this build."*
`useAdminResource.ts` is read-only (73 lines, no mutation support). They are reused
by 10 and 11 sections respectively, which is why 14 panels **look** functional.

| Admin section | Read | Write |
|---|---|---|
| Banners | ✅ | ✅ create / update / delete (the *edit pencil* `:206-212` is still a toast) |
| Leads | ✅ | ✅ status only — no notes / assign / follow-up |
| Reviews | ✅ | ✅ approve / reject |
| Notifications | ✅ | ✅ create |
| Students | ✅ | ❌ toggle is a toast |
| Audit | ✅ | ❌ CSV export is client-side |
| **14 others** (Dashboard, Analytics, Colleges, Courses, Scholarships, Exams, MockTests, Questions, Blogs, Faqs, Counsellors, Media, Seo, Settings) | ❌ | ❌ read `lib/data/*` literals |

⇒ **Block G's gate ("add a college from admin without code") is NOT met.**

### 5.3 An empty database is indistinguishable from an outage

`frontend/lib/content.ts:52-58`:

```ts
const isEmpty = api === null || api === undefined
             || (Array.isArray(api) && api.length === 0);
return isEmpty ? { data: fallback, source: "bundled" } : { data: api, source: "api" };
```

`api-server.ts:31-48` returns `null` on **any** non-2xx or throw, and coerces
failures to `[]`. So a dead backend **and** a legitimately-empty table both render
16 bundled colleges. The `source` flag is surfaced in exactly **one** place
(`app/colleges/page.tsx:22-26`); 18 other call sites discard it.

---

## 6. Phase-by-phase (all 105)

### BLOCK A — Foundation (Phase 1)

| # | Phase | Verdict | Evidence / gap |
|---|---|---|---|
| 1 | Setup Environment | ✅ | Docker + backend health + frontend all run. ⚠️ `docker-compose.dev.yml:10` publishes PG on **5433** but `backend/.env.development:10,14` and `.env.example:22,26` point at **5432** — `docker compose up -d db` yields a DB the backend cannot reach. `config.py:26` defaults to 5433 but the env file overrides it. README documents 2 non-existent directories. |

**Weighted: 1.0 / 1 = 100 %**

---

### BLOCK B — Database Layer 1 (Phases 2–10)

| # | Phase | Verdict | Evidence / gap |
|---|---|---|---|
| 2 | Users, Auth, Roles | ✅ | 6 tables, 4 auth endpoints, bcrypt, JWT, rate-limit + error + logging middleware, 33 tests. RBAC fully remediated 27 Sep (`docs/rbac-compliance-checklist.md`). ⚠️ `POST /auth/logout` is still a **no-op echo stub** (`auth.py:147-153`) with **no denylist** — mitigated only by the 30-min access-token TTL. |
| 3 | Email, SMS, OTP | ⬜ | **Nothing exists.** No `otp_records`, no `sms_service.py`, no `email_service.py`, no `/verify-otp`, `/login/otp/*`, `/forgot-password`, `/reset-password`. **0 of 5 dev steps.** `auth.py` has exactly 4 routes. |
| 4 | States / Districts / Universities | ✅ | 36/36 states, 755 districts, 105 cities, 155 universities, 3 endpoints. `seed_locations.py:66-79` has the best debugging comment in the repo. |
| 5 | Colleges, Courses, Fees | 🟡 | Schema ✅ (36-column `colleges`; GIN + trigram indexes from `459f3e0774ed`). Data ❌ 10/1000; `fees` and `admissions` both **0 rows**. |
| 6 | Scholarships, Exams | 🟡 | Schema ✅ + indexed. Data ❌ 6/100 and 6/50. Deviation: spec asked for a separate `exam_dates` table; dates live on `exams` (arguably better). |
| 7 | Mock Tests, Questions | 🟡 | **Schema deviates materially** — spec wanted 7 tables, impl has 4. Missing `test_configurations` (why Phase 54 is unbuildable) and `question_options` (options are JSONB, `mock_test.py:76`). ✅ **Improvement:** `correct_answer` no longer rides the student projection — `schemas/catalog.py:271-281` is a real allowlist, used on all 4 test-taker paths; it reappears only in gated `ResultQuestionResponse` / `AdminQuestionResponse`. ⚠️ No UNIQUE on `test_attempts(user_id, mock_test_id)` in **either** the model (`mock_test.py:97-138`) or the migration (`f1a7c9e2d3b4:23-45`) ⇒ `attempts_allowed` is race-bypassable. Data: 0 questions. |
| 8 | Reviews, Blogs, FAQs, Media, SEO, Notifications, Audit | ✅ | All 9 tables, full CRUD, moderation + rating recalc, 16 tests. Data thin (faqs 0, banners 0, blogs 0, reviews 0). |
| 9 | Enquiries, Leads, Saved, Consent | ✅ | All 5 tables, 8 tests incl. real counsellor scoping and 404-not-403 non-disclosure. ⚠️ `reviews.student_id` → `users.id` but `enquiries.student_id` → `student_profiles.id` — same name, two different parents. All tables 0 rows. |
| 10 | Placement, NIRF, Cutoff, Seat Matrix | 🟡 | Schema ✅ (table-creation gate met). Data ❌ **0 rows in all 5 tables** — the spec's "core differentiator". ⚠️ `cutoffs` unique constraint spans 8 columns of which **5 are nullable**; Postgres treats NULLs as distinct, so it does not prevent duplicates in the common case. |

**Weighted: 6.0 / 9 = 67 %**

---

### BLOCK C — Backend APIs (Phases 11–14)

| # | Phase | Verdict | Evidence / gap |
|---|---|---|---|
| 11 | College CRUD API | ✅ | Full CRUD, slug-or-id refs, filters, pagination, admin/super_admin tiers, 30 tests. ⚠️ Spec says **soft** delete, impl hard-deletes; spec step 5 "audit logging on all writes" is **not** done for colleges. Unvalidated `limit`/`offset` bounds — `limit=-1` reaches Postgres and 500s. |
| 12 | Course, Scholarship, Exam APIs | ✅ | All 3 CRUD + filters + upcoming filtering, tested. |
| 13 | Search Engine | 🟡 | Full-text ✅ and trigram ✅ (`459f3e0774ed`); filters ✅. **`search_service.py` was never created** — logic is inline in routers. **NLP parsing ("BHMS colleges in Karnataka") is MISSING entirely.** Redis caching of popular searches ⬜. Search rate limit ⬜. Sort-by-relevance ⬜. Also: the frontend never calls `GET /colleges/search` (N6). |
| 14 | Placement, Cutoff, NIRF APIs | 🟡 | 33 enrichment endpoints, nested + global, admin-gated, tested. Branch-wise queries 🟡 (`course_id` yes, `branch` no). 5-year trend query ⬜. ⚠️ N+1 in enrichment: `_course_name` queries **per row** for Fee/Admission. All return empty because the tables are empty. |

**Weighted: 3.0 / 4 = 75 %**

---

### BLOCK D — Frontend Core (Phases 15–18)

| # | Phase | Verdict | Evidence / gap |
|---|---|---|---|
| 15 | Login / Register / OTP | 🟡 | 6 of 12 done (form, API integration, redirect, error handling, mobile, loading). **No OTP tab, no `/verify-otp`, no `/forgot-password`, no `/reset-password`.** ⚠️ Spec says JWT in **httpOnly cookie or memory**; impl uses `localStorage` (`api.ts:5-7`) — XSS-exfiltratable. No Zod; all validation is hand-rolled regex. |
| 16 | Header / Footer / Homepage | 🟡 | Header ✅ (nav, sticky, hamburger) but "Get Admission Help" is missing from desktop nav. Footer 🔶 — **no legal block, no contact block**; social URLs are generic `instagram.com`, not `SITE.social`. Homepage 🔶 — **5 of 12 sections from API, 7 hardcoded** with invented numbers. `GET /homepage/sections` ⬜. Organization/WebSite JSON-LD ⬜. |
| 17 | College Listing | ✅ | **Strongest page in the app.** All 13 filter groups, cards, sort, pagination + count, URL-bookmarkable filters with back/forward, mobile drawer, empty state. Deviations: client-side not server-side filtering; no "verified" badge; no NIRF sort; placement filter is a hardcoded `>= 85` boolean (`lib/data/index.ts:71`). |
| 18 | College Detail | 🟡 | ~55 %. Done: header, overview, courses table, eligibility/admission/cutoff/facilities/hostel, reviews/FAQs/similar, `CollegeOrUniversity` JSON-LD. 🔶 "Apply Now" is a **toast**; "Book a free call" is `href="#"`. ⬜ gallery, branch-wise placement table, year trend, WhatsApp CTA. ⚠️ **N1: the NIRF section can never populate.** `mappers.ts:214-231` still drops `score` and `rank_change`. ⚠️ `getFees()` fetches a full fee breakdown on every page load and `mapCollege` never reads it. |

**Weighted: 2.5 / 4 = 63 %**

---

### BLOCK E — Content Pages (Phases 19–22)

| # | Phase | Verdict | Evidence / gap |
|---|---|---|---|
| 19 | Course pages | 🟡 | `/courses` grid ✅ (improved — live `resolveCourse` + `collegesOffering`). But `getCourseDetail` at `app/courses/[slug]/page.tsx:74` is still bundled-only, so an API-only course slug renders empty sections. ⚠️ `avgFeeYear` hardcoded `0` (`mappers.ts:664`) → every API-backed course shows "₹0/yr". |
| 20 | Scholarship pages | 🟡 | List ✅. **`/scholarships/[slug]` route does not exist** — detail is a `<Modal>`, so it is not linkable or SEO-indexable, and `resolveScholarship()` has 0 callers. `href={sch.website ?? "#"}` silently dead-links. "Official" is a button label, not a verification badge. |
| 21 | Exam pages | 🟡 | List + detail ✅ and genuinely API-backed. ⬜ **No countdown** (an explicit gate item) — dates render as text + a past/future icon. Search box is inert when the server passes `list` (`ExamComponents.tsx:78`). ⚠️ 6 fields hardcoded to placeholders in API mode (`mappers.ts:510-520`) → detail renders "—" and empty lists. |
| 22 | Mobile responsive audit | 🟡 | Genuinely responsive overall. But `DashboardExplorer.tsx:292,309` uses `grid-cols-[1fr_150px_1fr_44px]` with **no responsive variant** → horizontal overflow on phones. No audit artifact exists. |

**Weighted: 2.0 / 4 = 50 %**

---

### BLOCK F — Student Features (Phases 23–26)

| # | Phase | Verdict | Evidence / gap |
|---|---|---|---|
| 23 | Student Dashboard | 🔶⚠️ | **4 of 5 routes do not exist**: `/dashboard/profile`, `/dashboard/saved-colleges`, `/dashboard/test-history`, `/dashboard/enquiries`. The one route that exists is a **mockup of a different product** — see §4. Backend `/saved-colleges` exists and is **never called**; everything is `localStorage`. This is the first screen every logged-in user sees. |
| 24 | Comparison + Predictor | 🟡 | Compare 🟡: table works, but no NIRF row, no median, no cutoff, facilities reduced to one hostel boolean. ⬜ share via WhatsApp/copy-link. 🔶 "Ask AI: Which is better?" is `MiniChat` — an 800 ms `setTimeout` returning a template string. Predictor 🔶: **never calls `POST /api/v1/predictor`**; 3 buckets not 4 (no "Not Eligible"); no confidence %; hand-rolled weights instead of `closing_rank`; **fabricates 3 fallback colleges when nothing matches** (N3). The real endpoint is correct and unused. |
| 25 | Enquiry / Lead APIs | 🟡 | Backend: public rate-limited POST, admin list, status update, status history, counsellor scoping ✅. ⬜ UTM capture (frontend never sends; columns exist), ⬜ IP capture (backend never sets it despite `utils/client_ip.py` existing), ⬜ admin notification trigger (**a new lead notifies nobody**). Rate limit is 5/hr, spec says 3/10 min. ⚠️ A `counsellor` **cannot open `/admin` at all** (`ADMIN_ROLES = ["admin","super_admin"]`, `api.ts:202`), so the scoping feature is unreachable from the UI. |
| 26 | Enquiry Form / WhatsApp / Static Pages | 🟡 | 9-field form + modal + success ✅. ⬜ prefill from college/course page. ⬜ **`/privacy-policy`, `/terms-conditions`, `/disclaimer` — none exist** (legal blocker). ⬜ admin editor for legal pages. ⬜ map on `/contact`. ⚠️ `college_id` is **never sent** — the user's stated college is silently discarded (`AdmissionForm.tsx:68-80`). ⚠️ Terms and Privacy both link to `/about`. ⚠️ WhatsApp number hardcoded (`WhatsAppFab.tsx:6`), not from settings. ⚠️ Contact details contradict each other in 6 places. |

**Weighted: 1.7 / 4 = 43 %**

---

### BLOCK G — Admin Panel (Phases 27–35)

| # | Phase | Verdict | Evidence / gap |
|---|---|---|---|
| 27 | Admin foundation | 🟡 | Sidebar + header ✅; reuses `/login` (fine). ⬜ `/admin/login`. ⬜ **breadcrumbs**. ⬜ **role-based menu visibility** — all 20 nav items render unconditionally, so a Content Manager would see every module. |
| 28 | Admin dashboard | 🔶 | 4 of 6 stat types real. ⚠️ "Registered students **12,480**" is a literal. "Admission leads" = this browser's localStorage. "Top colleges by **views**" sorts bundled colleges by **reviewCount**. "PostgreSQL connectivity verified" is hardcoded `ok: true`. ⬜ Enquiries today/week/month, recent activity, top searched courses. |
| 29 | College management | ⬜ | 🔶 `/admin/colleges` reads **bundled literals**. `/admin/colleges/[id]/edit` **route does not exist**. No fee editor, course assignment, gallery upload, FAQ mgmt, SEO editor, preview, draft/publish, rich-text editor. Backend `POST/PUT/DELETE /colleges` all exist, all unused. **Gate "add a college without code" → NO.** |
| 30 | Placement / NIRF / Cutoff admin | ⬜ | **No UI at all.** 21 enrichment write endpoints exist; **zero are exposed.** |
| 31 | Course / Scholarship / Exam admin | 🔶 | All three read bundled literals; all create/edit/delete are toast-only via `AddButton`/`RowActions`. |
| 32 | Blog CMS | 🔶 | Reads bundled `BLOG_POSTS`. No editor, no RTE, no category picker, no draft/publish, no scheduling, not even a status column. `adminApi.blogs` exists, never called. |
| 33 | Review moderation + FAQ + banners | 🟡 | **Review moderation genuinely works** — real queue, real approve/reject (`ReviewsSection.tsx:36,84-111`). Bulk actions ⬜. FAQ mgmt 🔶. Banner mgmt 🟡 — create/toggle/delete real, **edit is a toast** (`:206-212`). |
| 34 | Lead / CRM admin | 🟡 | Leads list + status filter + status update real. ⬜ assign counsellor, ⬜ notes, ⬜ export CSV. 🔶 **Counsellor management is 100 % fixture** — `SAMPLE_COUNSELLORS`, 4 invented people with invented conversion rates. Course/state columns render "—" for API rows. |
| 35 | Sub-users + activity monitoring | ⬜ | **Nothing.** No sub-user UI, no per-module permission model (backend has role-gating only, no permissions table), no activity tables, no search-history table, no student detail tabs. `prefs`/activity state in `AppContext` is dead. |

**Weighted: 2.1 / 9 = 23 %**

---

### BLOCK H — Notifications & SEO (Phases 36–37)

| # | Phase | Verdict | Evidence / gap |
|---|---|---|---|
| 36 | Notifications, Email, SMS | 🟡 | In-app CRUD + admin broadcast ✅. ⬜ email, ⬜ SMS, ⬜ all 4 templates, ⬜ all 3 triggers. 🔶 the notification bell is a **toast with a hardcoded "3"**; `GET /notifications/my/unread-count` is never called. `prefs` state has no consumer. |
| 37 | SEO | 🟡 | sitemap ✅, robots ✅. Structured data **2 of 7 types** — missing Course, Scholarship, Article, FAQPage, BreadcrumbList; exam uses `EducationalOccupationalProgram` not `Event`. Canonical on only **4 of 20** routes. ⬜ programmatic SEO pages. |

**Weighted: 1.0 / 2 = 50 %**

---

### BLOCK I — AI System (Phases 38–41)

| # | Phase | Verdict | Evidence / gap |
|---|---|---|---|
| 38 | RAG Knowledge Pipeline | ⬜ | **No `rag_service.py`.** No pgvector, no embeddings, no chunking, no re-index. `EMBEDDING_MODEL` / `VECTOR_DIMENSIONS` / `RAG_*` sit unread in `.env.example`. |
| 39 | AI Chat API + Safety | ⬜ | ⬜ `POST /api/v1/ai/chat` (no `ai` router exists). ⬜ RAG context, ⬜ sources, ⬜ all 4 safety-prompt rules, ⬜ conversation storage, ⬜ 20/min limit, ⬜ cost tracking, ⬜ AI admin dashboard. The only AI is a **Next.js route calling OpenAI directly** (`app/api/ai/route.ts:25`) — which **contradicts the spec's own §3 "AI keys via backend, never frontend"** and `.env.example:100`. |
| 40 | College Predictor (cutoff-based) | 🟡 | **Backend is real and correct** — rank vs `closing_rank`, 4 buckets, confidence, disclaimer, budget demotion (`predictor.py:69-271`). Frontend never calls it (see Phase 24). Returns empty anyway because `cutoffs` is empty. ⚠️ Bug B4. |
| 41 | Frontend AI Chat Widget | 🟡 | `/ask-ai` page + FAB ✅. FAB is a **link, not a floating overlay**. ⬜ sources shown, ⬜ mobile full-screen. 🔶 `MiniChat` is fake. |

**Weighted: 1.0 / 4 = 25 %**

---

### BLOCK J — Mock Test System (Phases 42–46)

| # | Phase | Verdict | Evidence / gap |
|---|---|---|---|
| 42 | Test listing + instructions | 🟡 | Listing ✅ both sides. ⬜ instructions page. ⚠️ `MockTestEngine.tsx:80-84` makes three false claims (see §4). |
| 43 | Question bank admin | 🔶 | Read-only over **4 invented fixture questions** (`SAMPLE_QUESTIONS`). No create/edit/delete, no CSV import, no true/false type. `test_questions`: 0 rows. |
| 44 | Test interface (desktop only) | 🟡 | Real UI: fullscreen, countdown, question palette, mark-for-review, submit confirm, auto-submit on timer-zero and on violation threshold. ⬜ **server-authoritative timer** (local `setInterval`, `ProctoredMockTest.tsx:207-235`), ⬜ **autosave to backend** (`useState` only), ⬜ **mobile/tablet block** (no device check anywhere), ⬜ tests. The backend engine is real, has 13 passing tests, and is **completely unused**. |
| 45 | Results page | ✅ | Score, %, correct/incorrect/unanswered, time taken, topic breakdown, practice again, view solutions — all rendered. Backend result route unused. |
| 46 | Test admin | 🟡 | Backend full CRUD ✅ (create/edit/delete, exam/course/subject/difficulty/duration/marks/negative marking). Frontend 🔶 fixture table, no create form, no question selection. |

**Weighted: 2.7 / 5 = 54 %**

---

### BLOCK K — Proctored Exams (Phases 47–55) — **entirely absent server-side**

| # | Phase | Verdict | Evidence / gap |
|---|---|---|---|
| 47 | Consent + device check | 🟡 | Permission requests + fullscreen ✅. ⚠️ Consent dialog is **not DPDP-compliant** — no retention period, no "who can access", no privacy link, and it explicitly disclaims uploading. ⬜ **mobile/tablet device check** (a spec gate item). |
| 48 | Client monitoring | 🟡 | `visibilitychange`, `blur`, `contextmenu`, `copy`, fullscreen-exit, screen-share-surface change, `beforeunload` ✅. ⬜ `paste` blocked, ⬜ keyboard-shortcut detection. |
| 49 | Event reporting | ⬜ | **Zero API calls.** Violations are local state only. `TestSetupScreen.tsx:79-82` tells users outright that events are not uploaded. |
| 50 | Auto-submission engine | 🟡 | Timer-zero ✅, violation threshold ✅. ⬜ strict first-violation mode, ⬜ camera-disabled trigger, ⬜ reason persisted. `MAX_VIOLATIONS = 3` is a module constant, not per-test policy. |
| 51 | Proctoring ML service | ⬜ | No `proctoring-service/`, no container, no face detection. `ProctoredMockTest.tsx:127-129` admits it in a comment. |
| 52 | Evidence storage (private S3) | ⬜ | No canvas capture, no snapshot, no upload, no S3 client, no encryption, no retention. Camera stream is a local `<video>` preview only. |
| 53 | Admin proctoring dashboard | ⬜ | No nav entry, no router, no session list, no evidence viewer. |
| 54 | Configurable policies | ⬜ | `MAX_VIOLATIONS` is a const. **No `test_configurations` table** — a direct consequence of the Phase 7 schema deviation. |
| 55 | Proctoring recovery | ⬜ | Answers in `useState`. Backend resume path exists (`mock_tests.py:336-353`); no frontend calls it. |

**Weighted: 1.5 / 9 = 17 %**

---

### BLOCK L — Data Import (Phases 56–65) — **entirely absent**

| # | Phase | Verdict | Evidence / gap |
|---|---|---|---|
| 56 | CSV import API | ⬜ | No import router, no `UploadFile`, no multipart endpoint (`python-multipart` is installed but unused). |
| 57 | Import UI | ⬜ | No import nav entry, no file input, no drag-drop. |
| 58 | Duplicate detection (fuzzy) | ⬜ | No fuzzy matching (`difflib`/`rapidfuzz` → 0 matches). Only exact slug uniqueness. |
| 59 | Import colleges | ⬜ | Hardcoded Python seed only (`SAMPLE_COLLEGES`, 10 rows). 10 vs 1000. |
| 60 | Import courses/scholarships/exams | ⬜ | Hardcoded seeds only. 20/6/6 vs 50/100/50. |
| 61 | Import questions | ⬜ | 0 vs 500. |
| 62 | Import placement data | ⬜ | 0 vs 500. |
| 63 | Import cutoff data | ⬜ | 0 — and this **silently disables the predictor**. |
| 64 | Data verification workflow | ⬜ | `verification_status` is a plain string column. No transitions, no approver identity, no dashboard. |
| 65 | Blog content + legal pages | 🟡 | 12 bundled blogs vs 20 target. **Legal pages entirely absent.** ⚠️ All are untracked subagent output — keep or delete is your call. |

**Weighted: 0.5 / 10 = 5 %**

---

### BLOCK M — Security, Performance, Testing (Phases 66–75)

| # | Phase | Verdict | Evidence / gap |
|---|---|---|---|
| 66 | Security headers / HTTPS | 🟡 | CORS ✅ (`main.py:53-59`). **Zero** security headers repo-wide (no HSTS, CSP, X-Frame-Options, Referrer-Policy, X-Content-Type-Options) — the only hits are in `docs/` prose. No HTTPS redirect, no `headers()` in `next.config.ts`, no `middleware.ts`. |
| 67 | Rate limiting | 🟡 | **3 path prefixes of 149 endpoints** (`ratelimit.py:10-25`). **All GET/HEAD/OPTIONS exempt** (`:57-58`). Fails open on `RedisError` (`:87-89`). ⬜ search limit, ⬜ AI limit. Enquiry 5/hr not 3/10 min. |
| 68 | Input validation | 🟡 | 158 Pydantic `Field()` constraints ✅. ⬜ sanitization layer, ⬜ body-size limit, ⬜ HTML stripping on `BlogCreate.content` / `SeoMetadataUpsert.structured_data`. |
| 69 | Error handling | 🟡 | 500 envelope with `request_id` ✅. 4xx `detail` strings raw and inconsistent — no shared envelope, which §62 requires. |
| 70 | DB optimization | 🟡 | GIN + trigram indexes ✅, `selectinload` used widely ✅. ⬜ no `EXPLAIN` evidence, ⬜ no slow-query log. ⚠️ N+1 in enrichment. ⚠️ **Bug B2.** ⚠️ Models and migrations agree (40/40 tables) but the 4 GIN/trigram indexes are raw SQL, invisible to `Base.metadata`, so `alembic --autogenerate` would emit spurious `drop_index`. |
| 71 | Redis caching | ⬜ | Redis is **only** the rate limiter. All caching is Next.js ISR. `CACHE_TTL_*` keys unread. |
| 72 | Frontend performance | 🟡 | `next/image` in 3 files, `remotePatterns` set. ⬜ no Lighthouse config/report/budget, ⬜ no CI to enforce. |
| 73 | Mobile audit | 🟡 | Responsive prefixes used consistently; `pb-16 lg:pb-0` clears BottomNav. No artifact. Dashboard overflows. |
| 74 | Accessibility | 🟡 | `lang="en-IN"`, focus rings, `Modal` Escape, jsx-a11y via eslint. ⬜ no WCAG/axe/contrast audit. ~20 concrete defects: no focus trap in `Modal` or the filter drawer, `aria-controls` pointing at a non-listbox, `role="checkbox"` where radio is correct, form errors not linked via `aria-describedby`, chat has no `role="log"`. |
| 75 | Cross-browser | ⬜ | No Playwright/Cypress, no `.browserslistrc`, no matrix. |

**Weighted: 4.0 / 10 = 40 %**

---

### BLOCK N — Legal, Monitoring, Backup (Phases 76–85) — **entirely absent**

| # | Phase | Verdict | Evidence / gap |
|---|---|---|---|
| 76 | DPDP compliance | ⬜ | No parental consent, no age gate, no data-deletion endpoint, **no Grievance Officer record or page**. Only a generic `consent_records` table (0 rows). |
| 77 | IT Rules 2021 compliance | ⬜ | No grievance route/model, no 24h/15d/3h clocks, no scheduler. |
| 78 | Sentry | ⬜ | Zero matches; not in `requirements.txt` or `package.json`. `SENTRY_DSN` unread. |
| 79 | Monitoring + alerts | ⬜ | `GET /health` is a static `{"status":"ok"}` that stays green with PG and Redis both down. No metrics, no alerts. |
| 80 | Backup + restore test | ⬜ | No `pg_dump`, no script, no cron, no restore test. |
| 81 | SSL/HTTPS + HSTS | ⬜ | No HSTS, no certbot, no ACM. |
| 82 | DNS | ⬜ | No config, no IaC. |
| 83 | GA4 analytics | ⬜ | Zero `gtag` matches, no events, no GA script in layout. |
| 84 | Search Console | ⬜ | Sitemap URL referenced; no verification, no submission. |
| 85 | WAF | ⬜ | No Cloudflare anything. |

**Weighted: 0 / 10 = 0 %**

---

### BLOCK O — CI/CD, Staging, Production (Phases 86–105) — **entirely absent**

| # | Phase | Verdict | Evidence / gap |
|---|---|---|---|
| 86 | Git branching | 🟡 | `main` + `develop` ✅, conventional commits ✅. ⬜ no `feature/*` observed, **zero tags**, no CONTRIBUTING/commitlint/husky. |
| 87 | CI pipeline | ⬜ | **No CI config of any kind.** `package.json` has **no `test` and no `typecheck` script** (only `dev`, `build`, `start`, `lint`) and no test runner in devDependencies. **165 backend tests exist and nothing runs them.** |
| 88 | CD pipeline | ⬜ | No CD config, no app Dockerfile (the only Dockerfile is `docker/db/Dockerfile`, DB only). |
| 89 | Staging | ⬜ | No staging config or reference. |
| 90 | Production | ⬜ | No IaC, no `docker-compose.prod.yml`. README only *states* "AWS ap-south-1". |
| 91 | Load test | ⬜ | No k6/locust/JMeter. No perf baseline. |
| 92 | Security audit | ⬜ | No OWASP ZAP config or report. |
| 93 | Final QA | ⬜ | No QA report, no visual baseline, no E2E. |
| 94 | UAT + fixes | ⬜ | No UAT artifact. |
| 95 | SEO verification | ⬜ | No Rich Results report, no Search Console property. |
| 96 | Production deploy | ⬜ | Migrations + seeds exist; no deploy path. |
| 97 | Smoke tests | ⬜ | None. |
| 98 | 24-hour monitoring | ⬜ | None (see 79). |
| 99 | Fix critical bugs | — | Process, not verifiable in-repo. |
| 100 | Documentation | 🟡 | README + `.env.example` ✅. ⬜ admin guide, ⬜ deployment guide. README documents 2 non-existent directories and claims pgvector + Celery + `asyncpg`, none of which exist. |
| 101 | Admin training | ⬜ | None. |
| 102 | Handover | ⬜ | None. |
| 103 | 2-week stabilization | ⬜ | None. |
| 104 | Performance tuning | ⬜ | None. |
| 105 | Final sign-off | ⬜ | None. |

**Weighted: 1.0 / 20 = 5 %**

---

## 7. Block scorecard

| Block | Phases | ✅ | 🟡 | 🔶 | ⬜ | Weighted | % |
|---|---|---|---|---|---|---|---|
| A — Foundation | 1 | 1 | 0 | 0 | 0 | 1.0 | **100 %** |
| B — Database | 9 | 4 | 4 | 0 | 1 | 6.0 | **67 %** |
| C — Backend APIs | 4 | 2 | 2 | 0 | 0 | 3.0 | **75 %** |
| D — Frontend core | 4 | 1 | 3 | 0 | 0 | 2.5 | **63 %** |
| E — Content pages | 4 | 0 | 4 | 0 | 0 | 2.0 | **50 %** |
| F — Student features | 4 | 0 | 3 | 1 | 0 | 1.7 | **43 %** |
| G — Admin panel | 9 | 0 | 3 | 3 | 3 | 2.1 | **23 %** |
| H — Notif. + SEO | 2 | 0 | 2 | 0 | 0 | 1.0 | **50 %** |
| I — AI system | 4 | 0 | 2 | 0 | 2 | 1.0 | **25 %** |
| J — Mock tests | 5 | 1 | 3 | 1 | 0 | 2.7 | **54 %** |
| K — Proctored exams | 9 | 0 | 3 | 0 | 6 | 1.5 | **17 %** |
| L — Data import | 10 | 0 | 1 | 0 | 9 | 0.5 | **5 %** |
| M — Security/perf/test | 10 | 0 | 8 | 0 | 2 | 4.0 | **40 %** |
| N — Legal/monitor/backup | 10 | 0 | 0 | 0 | 10 | 0 | **0 %** |
| O — CI/CD/launch | 20 | 0 | 2 | 0 | 17 | 1.0 | **5 %** |
| **TOTAL** | **105** | **9** | **40** | **5** | **50** | **30.0** | **28.6 %** |

---

## 8. MANUAL GATES (Class 1 — [YOU] tasks)

| # | Task | Mandatory before | Done |
|---|---|---|---|
| M1 | Accounts: GitHub, AWS, OpenAI/Anthropic, MSG91, SendGrid/AWS SES, Sentry, Cloudflare, GA4, Search Console | GitHub → P1; MSG91+SendGrid → P3; OpenAI → P38–41; S3 → P47–55; Sentry → P78; GA4 → P83; Cloudflare → P85 | ☑ GitHub only — 8 others PENDING |
| M2 | Buy `padhaanewala.in`, nameservers → Cloudflare, DNS records | P82 / P90 / P96 | ☐ |
| M3 | Engage developer, hand over this doc | P1 | ☑ |
| M4 | Compile data: Colleges (1000+), Courses (50+), Scholarships (100+), Exams (50+), Questions (500+), Placement (top 500), Cutoff CSVs, 20+ blog articles | P56–65 | ☐ |
| M5 | Legal pages: Privacy Policy (English **and** Hindi), Terms, Disclaimer, Cookie Policy | P76, P96–97 | ☐ — **blocking, and no draft route exists** |
| M6 | Appoint Grievance Officer (name/email/phone), define 24h ack / 15-day resolution | P76, P96–97 | ☐ |
| M7 | Configure services: MSG91 (P3), SendGrid (P3), AI key (P38–41), S3 (P52), GA4 (P83), Search Console (P84), WAF (P85) | per phase | ☐ |
| M8 | Prepare content: college photos/logos (P35), blog + legal text (P56–65) | P35, P56–65 | ☐ |
| M9 | Verify every phase (live demo, tests green, mobile check, approval) | ALL phases | ☐ |
| M10 | Launch prep: UAT with 5 friends, phone + laptop test, collect ALL credentials, backup verified | P96 | ☐ |

**M1 and M5 are the two gates actively costing time today:** Phase 3 cannot start
without MSG91 + SendGrid credentials, and Phase 76/96 cannot proceed without legal copy.

---

## 9. Recommended order of work

### Before anyone sees the site
1. **Fix `/dashboard`** — it is a different product behind a login. Wire it to real
   data or gate it off. (`components/dashboard/DashboardExplorer.tsx`)
2. **Delete or clearly label the fabricated blocks** — Analytics, Seo, System
   status, the 14 Sheryians testimonials, hero stats, per-tile "240+ colleges".
   Full inventory in §4.
3. **Fix `app/api/stats/route.ts`** to report a real `ok`, and make the Admin
   "PostgreSQL verified" line actually check.

### Blocking correctness (small, high-value)
4. `mock_tests.py:610-611` — enforce expiry in `submit_attempt` (B1).
5. `enrichment.py:910` — remove `order_by(None)`; fix the doubled `_paginated` in
   `/rankings` (B2).
6. `mock_tests.py:120-125,151-152` — grade non-MCQ types, or reject them at write
   time (B3).
7. `predictor.py:219` — replace `hash(str(cid))` with `hashlib` (B4).
8. `api-server.ts:400-404` — repoint NIRF/other rankings at the real
   `GET /rankings?ranking_type=` route (N1).

### Closing the biggest spec-vs-build gaps
9. **Phase 3 (OTP)** — blocks password reset and registration quality entirely.
10. **Phase 87 (CI)** — 165 tests that nothing runs; add `pytest` to CI and a
    `typecheck` script to `package.json`.
11. **Phase 29 (college admin)** — without it, "add a college without code" is false.
12. **Phase 63 (cutoffs)** — without it the predictor is dead regardless of
    frontend work.
13. **Phase 40 (wire the predictor)** — the correct endpoint exists; call it.

### Cleanup
14. `docker-compose.dev.yml:10` vs `.env.development:10,14` / `.env.example:22,26`
    — reconcile the 5433/5432 mismatch. Also `.env.example` says `asyncpg`; the
    backend actually uses `psycopg2` (`config.py:31`).
15. Correct `README.md` (remove `proctoring-service/`, `.github/workflows/`, the
    pgvector and Celery claims, the wrong connection string) and `DESIGN.md`
    (documents Clay.com — delete or replace).
16. Delete the stray `frontend/frontend/` nesting by removing the
    `"@/*": ["./frontend/*", "./*"]` alias in `tsconfig.json:21-23`.
17. Rename `package.json:2` from `campus-pulse` and migrate the `cp_*` localStorage keys.

---

## 10. How to use this document

1. Do all **Manual Gates (M1–M10)** in order — nothing starts without them.
2. Follow blocks **A–P**. The "Mandatory before" list per block is a HARD gate.
3. Phases marked *parallel* may run together.
4. After each block, complete the **Completion Gate** before moving on.

### Completion gates (current status)

| Block | Gate | Met? |
|---|---|---|
| A | node/python/git/docker verified, repo private, compose runs, `/health` OK, frontend loads, code pushed | ✅ **YES** |
| B | all tables migrated, login works at API level, **OTP arrives on a real phone**, 28 states + 8 UTs + ~780 districts seeded | ❌ **NO** — OTP (P3) is 0 of 5 steps |
| C | admin can create colleges; public search with filters works; **NLP parse works**; placement/cutoff/NIRF queryable | ❌ **NO** — NLP missing, tables empty |
| D | registration works on a real phone; homepage loads all sections from DB; filters work; college page shows placement + NIRF | ❌ **NO** — NIRF is broken (N1), tables empty |
| E | course/scholarship/exam pages render with data; official links marked; **exam countdowns work**; no mobile breakage | ❌ **NO** — no countdown, no scholarship detail route |
| F | dashboard shows saved colleges/tests/enquiries; compare 2–4 works; predictor shows buckets with disclaimer; enquiry creates a visible lead | ❌ **NO** — dashboard is a mockup, 4 of 5 routes missing |
| G | add a college from admin without code; reviews approvable; leads assignable; Content Manager sees only their modules; student activity viewable | ❌ **NO** — no write path (5.2) |
| H | enquiry → student email + admin alert; unread bell; sitemap validates; structured data passes Rich Results | ❌ **NO** — 2 of 7 types, no email/SMS |
| I | "What is BHMS?" answers with source; predictor categorised with disclaimer; AI never invents data | ❌ **NO** — 0 of 5 steps |
| J | full test completes end-to-end; answers autosave; auto-submit on timeout; **mobile shows "desktop only"** | ❌ **NO** — local state only, no device check |
| K | full proctored flow works with camera; tab-switch detected; evidence viewable; auto-submit per policy | ❌ **NO** — nothing exists server-side |
| L | 1000+ colleges, 50+ courses, 100+ scholarships, 50+ exams, 500+ questions, placement top 500, cutoffs, 20+ blogs, legal pages all live | ❌ **NO** — 1 %, 6 %, 12 %, 0 %, 0 % |
| M | Lighthouse >90; no horizontal scroll; security headers active; rate limits on all endpoints; accessibility passes | ❌ **NO** — 0 security headers, 3/149 rate limits |
| N | Grievance Officer published; parental consent verified; SSL live; analytics tracked; backups restoring | ❌ **NO** |
| O | staging working; CI/CD automatic; load test passed; security scan clean | ❌ **NO** |
| P | production live, smoke tests pass, 24h monitoring, docs, training, handover, sign-off | ❌ **NO** |

---

## 11. Quick reference: what must exist before each phase

| To start phase | You MUST already have |
|---|---|
| Phase 1 | M1 (GitHub), M3, dev tools installed |
| Phase 2 | Phase 1 |
| Phase 3 | Phases 1–2 + **MSG91 & SendGrid credentials (M1)** |
| Phase 4 | Phase 1 (parallel: 2, 3) |
| Phase 5 | Phase 4 |
| Phase 6 | Phase 4 (parallel: 5) |
| Phase 7 | Phases 5 + 6 |
| Phase 8 | Phases 2 + 5 |
| Phase 9 | Phases 2 + 5 |
| Phase 10 | Phases 5 + 6 |
| Phase 11 | Phases 2 + 5 |
| Phase 12 | Phase 6 |
| Phase 13 | Phase 11 |
| Phase 14 | Phase 10 |
| Phase 15 | Phases 2 + 3 |
| Phase 16 | Phases 11 + 12 |
| Phase 17 | Phase 13 |
| Phase 18 | Phases 11 + 14 |
| Phases 19–22 | Phases 12 + 16 |
| Phase 23 | Phases 15 + 9 |
| Phase 24 | Phases 14 + 13 |
| Phase 25 | Phase 9 |
| Phase 26 | Phases 25 + 16 |
| Phases 27–30 | Phases 2, 11, 12, 14 |
| Phases 31–34 | Phases 27–30 + 25 |
| Phase 35 | Phases 27–30 + 8 |
| Phase 36 | Phases 3, 9, 25 |
| Phase 37 | Public pages live (Blocks D + E) |
| Phases 38–41 | Phases 5, 6, 10 + OpenAI key (M1) |
| Phases 42–46 | Phases 7 + 2 |
| Phases 47–55 | Phases 42–46 **complete** + S3 bucket (M1) |
| Phases 56–65 | Phases 11–14 + 27–34 + ALL CSVs ready (M4) |
| Phases 66–75 | Blocks A–L all complete |
| Phases 76–85 | Block M + M5 + M6 + Sentry/GA4/Cloudflare (M1) |
| Phases 86–95 | Blocks M + N + AWS prod access + DNS (M2) |
| Phases 96–105 | Blocks A–O + domain live + legal published + UAT + ALL credentials |

---

## 12. Non-negotiable rules

1. **[M4]** All data CSVs must be ready **before** Phase 59.
2. **[M6]** Grievance Officer must be appointed + published before Phase 76; legally
   required before launch.
3. **[M5]** Legal pages must be drafted before Phase 76 and **published** before Phase 96.
4. Proctored exams (Phase 47) cannot start until mock tests (Phase 42–46) fully work.
5. Predictor (Phase 24/40) cannot be "AI guessing" — it needs real cutoff data
   (Phase 10 table + Phase 56–63 import). **The correct backend already exists; the
   frontend must call it rather than reimplementing it client-side.**
6. **[M1]** MSG91/SendGrid credentials must exist before Phase 3 starts.
7. No phase may be skipped — every block's Completion Gate must be YES first.
8. **AI keys go through the backend only.** The current Next.js route calling OpenAI
   directly violates the spec's own §3 and must not become a pattern.

---

## 13. Related documents

| File | Purpose | Trust |
|---|---|---|
| `docs/padhaanewala-complete.md` | Master spec V5.0 — authoritative phase list | Authoritative |
| `docs/phase-verification.md` | Detailed 2026-09-27 phase audit | **Accurate in its per-phase tables; its headline counts are wrong (§1)** |
| `docs/rbac-compliance-checklist.md` | RBAC ruleset R1–R8, before/after exploit tables | Authoritative; all P0s closed |
| `docs/session-log-2026-09-27.md` | What was done in that session, including self-reported mistakes | Historical |
| `docs/PRD.md`, `docs/TRD.md` | **Untracked subagent output that was never requested or reviewed** | ⚠️ Unverified — keep or delete is your call |
| `DESIGN.md` | **Documents Clay.com, not this project** | ⚠️ Delete or replace |
