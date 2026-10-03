# Phase Verification — padhaanewala

**Verified:** 2026-09-27 · **Method:** live DB queries + source audit of every phase against `docs/padhaanewala-complete.md` §C (lines 4421–5699)
**Supersedes:** `docs/padhaanewala-phase-checklist.md` (which claimed 4/105 and cited 5 commits not in git history, 7 test counts, and ~15 files/routes that do not exist)

**Verdict key:** ✅ done · 🟡 partial · 🔶 stub (renders, fake/no-op) · ⬜ not started · ⚠️ done but actively misleading

---

## Headline

| | Count |
|---|---|
| ✅ Done | **14** phases |
| 🟡 Partial | **26** phases |
| 🔶 Stub only | **11** phases |
| ⬜ Not started | **54** phases |

**The previous checklist said "4 of 105 complete".** That was wrong in both directions: it *under*-credited the 14 genuinely-done phases, and it did not flag the 11 phases that render convincingly but are wired to nothing.

**Three findings matter more than the counts:**

1. **The backend and frontend are split-brain.** A real, tested mock-test engine, a real cutoff-based predictor, real saved-colleges, real lead notes/assignment, and ~21 real enrichment write endpoints all exist server-side. **The frontend calls none of them.** Roughly 40% of the API surface is dead code from the browser's point of view.
2. **Ten core tables have zero rows**, including every table the spec calls the "core differentiator" (Phase 10). The site builds and renders fully against a dead database because `lib/content.ts:52-58` silently substitutes bundled literals whenever the API returns empty.
3. **`/dashboard` is a mockup of a different product** — brand "EduPath", user "Pushkar", saved items are NerdWallet and Levi's internships. It is behind a login, so it is the first thing every real user sees.

---

## Data reality (queried live, not estimated)

Phase 56–65 gate against these numbers. Nothing is close.

| Table | Actual | Gate | % |
|---|---|---|---|
| states | 36 | 36 | ✅ 100% |
| districts | 755 | ~780 | ✅ 96% |
| universities | 155 | — | — |
| **colleges** | **10** | 1000 | ❌ **1%** |
| courses | 20 | 50 | ❌ 40% |
| **scholarships** | **6** | 100 | ❌ **6%** |
| **exams** | **6** | 50 | ❌ 12% |
| **test_questions** | **0** | 500 | ❌ **0%** |
| blogs | 0 | 20 | ❌ 0% |
| **placement_records** | **0** | 500 | ❌ **0%** |
| **nirf_rankings** | **0** | — | ❌ 0% |
| **cutoffs** | **0** | — | ❌ 0% |
| **seat_matrix** | **0** | — | ❌ 0% |
| **fees** | **0** | — | ❌ 0% |
| **admissions** | **0** | — | ❌ 0% |
| **faqs** | **0** | — | ❌ 0% |
| **banners** | **0** | — | ❌ 0% |
| mock_tests | 0 | — | ❌ 0% |
| reviews | 0 | — | ❌ 0% |

`cutoffs` + `seat_matrix` empty means **`POST /api/v1/predictor` returns the empty-data path** (`predictor.py:103-111`). The predictor cannot work until Phase 63 lands, regardless of the frontend.

Tables the spec implies that **do not exist at all**: `otp_records` (Phase 3), `test_configurations` (Phase 7/54), `question_options` (Phase 7), `csv_imports` (Phase 56), `proctoring_sessions` / `proctoring_events` / `proctoring_evidence` (Phases 49/52/53), `user_activity` / search-history tables (Phase 35).

---

## Phase-by-phase

### Phases 1–10 · Foundation & schema

| Phase | Verdict | Evidence / gap |
|---|---|---|
| **1** Setup | ✅ | Docker + backend health + frontend all run. ⚠️ `docker-compose.dev.yml:10` publishes PG on **5433** but `backend/.env.development:10,14` points at **5432** — `docker compose up -d db` yields a DB the backend cannot reach. README lists `proctoring-service/` and `.github/workflows/` (neither exists). |
| **2** Users/auth/roles | ✅ | All 6 tables, 4 auth endpoints, bcrypt, JWT, rate-limit + error + logging middleware. 33 tests. ⚠️ `POST /auth/logout` is a **no-op echo stub** — spec step 6 says "invalidate token". |
| **3** Email/SMS/OTP | ⬜ | **Nothing exists.** No `otp_records` table, no `sms_service.py`, no `email_service.py`, no `/verify-otp`, `/login/otp/send`, `/login/otp/verify`, `/forgot-password`, `/reset-password`. 0 of 5 dev steps. |
| **4** States/districts/universities | ✅ | 36/36 states, 755 districts, 155 universities, 3 API endpoints. `seed_locations.py:66-79` has the best debugging comment in the repo. |
| **5** Colleges/courses/fees | 🟡 | Schema ✅ (36-column `colleges`, GIN+trgm indexes from migration `459f3e0774ed`). Data ❌ 10 colleges vs 1000; `fees` and `admissions` have **0 rows** despite the tables existing. |
| **6** Scholarships/exams | 🟡 | Schema ✅ + indexed. Data ❌ 6/100 and 6/50. Deviation: spec asked for a separate `exam_dates` table; dates live on `exams` (arguably better). |
| **7** Mock tests/questions | 🟡 | **Schema deviates materially.** Spec wanted 7 tables; impl has 4. Missing `test_configurations` (which is why Phase 54 is unbuildable), `question_options` (options are JSONB), and a separate `questions` table. ⚠️ `test_questions.correct_answer` is co-located with the question served to test-takers — safety depends entirely on the router picking the right projection. `test_attempts` has no unique on `(user_id, mock_test_id)`, so `attempts_allowed` is bypassable by concurrent requests. Data: 0 questions. |
| **8** Content tables | ✅ | All 9 tables, full CRUD, moderation + rating recalc, 16 tests. Data thin (faqs 0, banners 0). |
| **9** Enquiries/leads/saved/consent | ✅ | All 5 tables, 8 tests incl. real counsellor scoping (`test_phase9.py`). |
| **10** Placement/NIRF/cutoff/seat-matrix | 🟡 | Schema ✅ ("tables created" gate met). Data ❌ **0 rows in all 5 tables** — the spec's "core differentiator". ⚠️ `cutoffs`' 8-column unique constraint includes 4 nullable columns; Postgres treats NULLs as distinct, so it does not prevent duplicates in the common case. |

### Phases 11–14 · Backend APIs

| Phase | Verdict | Evidence / gap |
|---|---|---|
| **11** College CRUD | ✅ | Full CRUD, slug-or-id refs, filters, pagination, admin/super_admin tiers, 30 tests. ⚠️ Two deviations: spec says **soft** delete, impl does hard delete; spec step 5 "audit logging on all writes" is **not** done for colleges. Unvalidated `limit`/`offset` bounds (style B) — `limit=-1` reaches Postgres and 500s. |
| **12** Course/scholarship/exam APIs | ✅ | All 3 CRUD + filters + upcoming filtering, tested. |
| **13** Search engine | 🟡 | Full-text ✅ and trigram ✅ (migration `459f3e0774ed`); filters ✅. **`search_service.py` was never created** — logic is inline in routers. **NLP parsing ("BHMS colleges in Karnataka") MISSING entirely.** Redis caching of popular searches ⬜. Search rate limit ⬜ (there is no search endpoint to limit). Sort-by-relevance ⬜. |
| **14** Placement/cutoff/NIRF APIs | 🟡 | 33 enrichment endpoints, nested + global, admin-gated, tested. Branch-wise queries 🟡 (`course_id` yes, `branch` no). 5-year trend query ⬜ (year filter exists, no trend endpoint). All return empty because the tables are empty. |

### Phases 15–26 · Public frontend

| Phase | Verdict | Evidence / gap |
|---|---|---|
| **15** Login/Register/OTP | 🟡 | 6 of 12 done (form, API integration, redirect, error handling, mobile, loading states). **No OTP tab, no `/verify-otp`, no `/forgot-password`, no `/reset-password`.** ⚠️ Spec says JWT in **httpOnly cookie or memory**; impl uses `localStorage` (`api.ts:5-7`) — XSS-exfiltratable. No Zod dependency at all; all validation is hand-rolled regex. |
| **16** Header/Footer/Homepage | 🟡 | Header ✅ (nav, sticky, hamburger) but "Get Admission Help" is missing from desktop nav. Footer 🔶 — **no legal block, no contact block**, social URLs are generic `instagram.com` not `SITE.social`. Homepage 🔶 — **5 of 12 sections from API, 7 hardcoded** with invented numbers ("12K+ Colleges", "2.4M+ Students", "98% Satisfaction"). `GET /api/v1/homepage/sections` ⬜. One global skeleton, not per-section. Organization/WebSite JSON-LD ⬜. |
| **17** College listing | ✅ | **Strongest page in the app.** All 13 filter groups, cards, sort, pagination + count, URL-bookmarkable filters with back/forward, mobile drawer, empty state. Deviations: filtering is client-side not server-side; no "verified" badge; no NIRF sort; placement filter is a hardcoded `>= 85` boolean (`data/index.ts:71`), not a range. |
| **18** College detail | 🟡 | ~55%. Done: header, overview, courses table, eligibility/admission/cutoff/facilities/hostel, reviews/FAQs/similar, CollegeOrUniversity JSON-LD. 🔶 "Apply Now" is a **toast**; "Book a free call" is `href="#"`. ⬜ NIRF section (`mappers.ts:214-231` drops `score` and `rank_change`), gallery, branch-wise placement table, year trend, WhatsApp CTA. ⚠️ `getFees()` fetches a full fee breakdown on every page load and `mapCollege` never reads it. No page-level ISR (600 s via fetch, spec says 300 s). |
| **19** Courses | 🟡 | `/courses` grid ✅. `/courses/{slug}` is ~70% bundled literals — `getCourseDetail`/`collegesOffering`/`getRelatedCourses` all come from `lib/data/*`, so an **API-only course slug renders empty sections**. ⚠️ `avgFeeYear` hardcoded `0` (`mappers.ts:664`) → every API-backed course shows "₹0/yr". |
| **20** Scholarships | 🟡 | List ✅. **`/scholarships/{slug}` route does not exist** — detail is a `<Modal>`, so it is not linkable and not SEO-indexable. `href={sch.website ?? "#"}` silently dead-links. "Official" is a button label, not a verification badge. |
| **21** Exams | 🟡 | List + detail ✅ and genuinely API-backed. ⬜ **No countdown** (spec gate item) — dates render as text + a past/future icon. "upcoming/past tabs" are stage filter chips instead. The search box is inert when the server passes `list` (`ExamComponents.tsx:78`). ⚠️ 6 fields hardcoded to placeholders in API mode (`mappers.ts:510-520`) → detail page renders "—" and empty lists. |
| **22** Mobile audit | 🟡 | Genuinely responsive overall. But `DashboardExplorer.tsx:292,309` uses `grid-cols-[1fr_150px_1fr_44px]` with **no responsive variant** → horizontal overflow on phones. No audit artifact exists. |
| **23** Student dashboard | 🔶⚠️ | **4 of 5 routes do not exist**: `/dashboard/profile`, `/dashboard/saved-colleges`, `/dashboard/test-history`, `/dashboard/enquiries`. The one route that exists is a **mockup of a different product**: brand "EduPath", user "Pushkar", saved items are NerdWallet / Levi's / NY Times internships. Backend `GET/POST/DELETE /saved-colleges` exists and is **never called** — everything is `localStorage`. This is the first thing every logged-in user sees. |
| **24** Compare + Predictor | 🟡 | Compare 🟡: table works, but no NIRF row, no median, no cutoff, facilities reduced to one hostel boolean. ⬜ share via WhatsApp/copy-link. 🔶 "Ask AI: Which is better?" is `MiniChat` — an 800 ms `setTimeout` returning a template string. Predictor 🔶: **never calls `POST /api/v1/predictor`**. Pure client-side heuristic on bundled data, 3 buckets not 4 (no "Not Eligible"), no chance %. The real endpoint is correct and unused. |
| **25** Enquiry/Lead APIs | 🟡 | **Hand-off ✅ 30 Sep 2026** — `services/lead_handoff.py` now runs from the public POST: assigns to the least-loaded active counsellor under `max_leads` (ties on lowest id), overflows to admin when nobody has headroom, and writes a `Notification` to every active admin plus the assignee. Commits separately from the enquiry insert so a failed fan-out cannot lose a student's enquiry. New admin `GET /enquiries` (status/search) and `GET /counsellors` (workload) endpoints. Still ⬜: UTM capture (frontend never sends; columns exist), ⬜ IP capture (backend never sets it despite `utils/client_ip.py` existing), ⬜ student email on submit (Phase 36). Rate limit is 5/hour, spec says 3/10 min. ⚠️ A `counsellor` still cannot open `/admin` (`RequireAdmin` = admin+super_admin), so scoping is unreachable from the UI. |
| **26** Enquiry form/WhatsApp/static | 🟡 | 9-field form + modal + success ✅. ⬜ prefill from college/course page. ⬜ **`/privacy-policy`, `/terms-conditions`, `/disclaimer` — none exist** (legal blocker). ⬜ admin editor for legal pages. ⬜ map on `/contact`. ⚠️ `college_id` is **never sent** — the user's stated college is silently discarded (`AdmissionForm.tsx:68-80`). ⚠️ Login page links Terms *and* Privacy both to `/about`. ⚠️ WhatsApp number hardcoded (`WhatsAppFab.tsx:6`) not from settings. ⚠️ Contact details contradict each other in 6 places. |

### Phases 27–35 · Admin panel

| Phase | Verdict | Evidence / gap |
|---|---|---|
| **27** Admin foundation | 🟡 | Sidebar + header ✅. Reuses `/login` (fine). ⬜ `/admin/login`. ⬜ **breadcrumbs**. ⬜ **role-based menu visibility** — all 20 nav items render unconditionally, so a hypothetical Content Manager would see every module. |
| **28** Admin dashboard | 🔶 | 4 of 6 stat types real. ⚠️ "Registered students **12,480**" is a literal. "Admission leads" = this browser's localStorage. "Top colleges by **views**" sorts bundled colleges by **reviewCount** and labels it views — actively misleading. ⬜ Enquiries today/week/month, recent activity, top searched courses. |
| **29** College management | 🟡 | **Core CRUD 🟢 since 29 Sep 2026.** `CollegesSection` reads the real API and has real create/edit/delete against `POST/PUT/DELETE /colleges`, a feature toggle, role gating, and lazy state/district/university/course lookups; the edit dialog prefetches the record because `exclude_unset=True` would let a blank form clear it. The old `?limit=1000` call 422'd on every load, which is why this read bundled literals. Still ⬜ `/admin/colleges/[id]/edit` as a deep route (it is a modal), fee editor, gallery upload, FAQ mgmt, SEO editor, preview, draft/publish, rich-text editor, and course editing after create (`CollegeUpdate` has no `courses`). **Gate "add a college from admin without code" → YES.** |
| **30** Placement/NIRF/cutoff admin | ⬜ | No UI at all. 21 enrichment write endpoints exist; **zero are exposed**. |
| **31** Course/scholarship/exam admin | 🔶 | All three read bundled literals; all create/edit/delete are **toast-only** (`primitives.tsx:66-77` — "demo action in this build"). |
| **32** Blog CMS | 🔶 | Reads bundled `BLOG_POSTS`. No editor, no RTE, no category picker, no draft/publish, no scheduling, not even a status column. `adminApi.blogs` exists, never called. |
| **33** Review moderation + FAQ + banners | 🟡 | **Review moderation ✅ genuinely works** — real queue, real approve/reject (`ReviewsSection.tsx:36,84-111`). Bulk actions ⬜. FAQ mgmt 🔶 (bundled, toast CRUD). Banner mgmt 🟡 — create/toggle/delete real, **edit is toast** (`:206-212`). |
| **34** Lead/CRM admin | 🟡 | **Assign + notes + follow-up ✅ real as of 30 Sep 2026.** The lead workspace modal (`LeadsSection.tsx`) calls `PATCH /leads/{id}/assign`, `POST /leads/{id}/notes`, `PATCH /leads/{id}/follow-up` and `PATCH /leads/{id}/status`, then re-reads the lead so the panel shows the server's answer; a 409 lead-limit refusal is surfaced verbatim instead of a generic retry. Assignee dropdown reads the new `GET /counsellors` roster with live `active_leads/max_leads`. Course/state/counsellor/follow-up columns now render real values (they were hardcoded "—"). ⬜ export CSV (exists only in the Audit section). 🔶 **Counsellor management is still 100% fixture** — the 4 people with invented conversion rates are not the roster; only assignment is wired. |
| **35** Sub-users + activity monitoring | ⬜ | **Nothing.** No sub-user UI, no per-module permission model (backend has role-gating only, no permissions table), no activity tables, no search-history table, no student detail tabs. `prefs`/activity state in `AppContext` is dead. |

### Phases 36–46 · SEO, AI, mock tests

| Phase | Verdict | Evidence / gap |
|---|---|---|
| **36** Notifications/email/SMS | 🟡 | In-app CRUD + admin broadcast ✅. ⬜ email, ⬜ SMS, ⬜ all 4 templates, ⬜ all 3 triggers. 🔶 the notification bell is a **toast with a hardcoded "3"**; `GET /notifications/my/unread-count` is never called. `prefs` state has no consumer. |
| **37** SEO | 🟡 | sitemap ✅, robots ✅. Structured data **2 of 7 types** — missing Course, Scholarship, Article, FAQPage, BreadcrumbList; exam uses `EducationalOccupationalProgram` not `Event`. Canonical on only **4 of 20** routes. ⬜ programmatic SEO pages. |
| **38** RAG pipeline | ⬜ | **No `rag_service.py`.** No pgvector, no embeddings, no chunking, no re-index. `EMBEDDING_MODEL` / `VECTOR_DIMENSIONS` / `RAG_CHUNK_SIZE` / `RAG_TOP_K` exist in `.env.example` and are read by nothing. |
| **39** AI Chat API + safety | ⬜ | ⬜ `POST /api/v1/ai/chat`. ⬜ RAG context, ⬜ sources, ⬜ all 4 safety-prompt rules, ⬜ conversation storage, ⬜ 20/min limit, ⬜ cost tracking, ⬜ caching, ⬜ AI admin dashboard. The only AI is a Next.js route calling OpenAI with one generic prompt — **which contradicts the spec's own §3 "AI keys via backend, never frontend"** and `.env.example:100`. |
| **40** College predictor | 🟡 | **Backend is real and correct** — rank vs `closing_rank`, 4 buckets, confidence, disclaimer, budget demotion (`predictor.py:69-271`). Frontend never calls it. Returns empty anyway because `cutoffs` is empty. |
| **41** AI chat widget | 🟡 | `/ask-ai` page + FAB ✅. FAB is a **link, not a floating overlay**. ⬜ sources shown, ⬜ mobile full-screen. 🔶 `MiniChat` is fake. |
| **42** Test listing + instructions | 🟡 | Listing ✅ both sides. ⬜ instructions page. ⚠️ The marketing copy at `MockTestEngine.tsx:80-84` claims "server-authoritative timer and autosaved answers… your results follow you across devices" — **all false** for the shipped client engine. |
| **43** Question bank admin | ✅ | **BUILT (2026-09-30).** Admin `QuestionsSection` with cross-paper browsing, server-side filters (paper/subject/topic/difficulty/type/active/stem search) and computed facets. Create, edit, deactivate/reactivate and soft delete all work. Two read endpoints added — `GET /api/v1/questions`, `GET /api/v1/questions/facets` (`routers/questions.py`) — plus `lib/question-form.ts` for client-side gradeability checks. Writes stay **paper-scoped** on the Phase 7 nested routes; `test_questions.mock_test_id` is `NOT NULL`, so this is a browse-across-papers bank, **not** a reusable question pool (no migration, by decision). 20 backend + 31 frontend tests. `test_questions` seeded with 75 rows. ⬜ CSV import still absent (Phase 61). ⬜ No `true/false` type. Does **not** unblock Phases 47–55: proctoring is independently unstarted. |
| **44** Test interface | 🟡 | Real UI: fullscreen, countdown, question palette, mark-for-review, submit confirm, auto-submit on timer-zero and on violation threshold. ⬜ **server-authoritative timer** (local `setInterval`), ⬜ **autosave to backend** (React state only), ⬜ **mobile/tablet block** (no device check anywhere), ⬜ tests. The backend engine is real, has 13 passing tests, and is **completely unused**. |
| **45** Results page | ✅ | Score, %, correct/incorrect/unanswered, time taken, topic breakdown, practice again, view solutions — all rendered. Backend result route unused. |
| **46** Test admin | 🟡 | Backend full CRUD ✅ (create/edit/delete, exam/course/subject/difficulty/duration/marks/negative marking). Frontend 🔶 fixture table, no create form, no question selection. |

### Phases 47–55 · Proctored exams — **entirely absent server-side**

| Phase | Verdict | Evidence / gap |
|---|---|---|
| **47** Consent + device check | 🟡 | Permission requests + fullscreen ✅. ⚠️ Consent dialog is **not DPDP-compliant** — no retention period, no "who can access", no privacy link, and it explicitly disclaims uploading. ⬜ **mobile/tablet device check** (spec gate item). |
| **48** Client monitoring | 🟡 | `visibilitychange`, `blur`, `contextmenu`, `copy`, fullscreen-exit, screen-share-surface change, `beforeunload` ✅. ⬜ `paste` blocked (only `copy`), ⬜ keyboard-shortcut detection. |
| **49** Event reporting | ⬜ | **Zero API calls.** Violations are local state only. The setup screen tells users outright that events are not uploaded. |
| **50** Auto-submission | 🟡 | Timer-zero ✅, violation threshold ✅. ⬜ strict first-violation mode, ⬜ camera-disabled trigger, ⬜ reason persisted. `MAX_VIOLATIONS = 3` is a module constant, not per-test policy. |
| **51** Proctoring ML service | ⬜ | No `proctoring-service/`, no container, no face detection. `ProctoredMockTest.tsx:127-129` admits it in a comment. |
| **52** Evidence storage | ⬜ | No canvas capture, no snapshot, no upload, no S3 client, no encryption, no retention. Camera stream is a local `<video>` preview only. |
| **53** Admin proctoring dashboard | ⬜ | No nav entry, no router, no session list, no evidence viewer. |
| **54** Configurable policies | ⬜ | `MAX_VIOLATIONS` is a const. No `test_configurations` table — a **direct consequence of the Phase 7 schema deviation**. |
| **55** Proctoring recovery | ⬜ | Answers in `useState`. Backend resume path exists (`mock_tests.py:336-353`); no frontend calls it. |

### Phases 56–65 · Data import — **entirely absent**

| Phase | Verdict | Evidence / gap |
|---|---|---|
| **56** CSV import API | ⬜ | No import router, no `UploadFile`, no multipart endpoint. |
| **57** Import UI | ⬜ | No import nav entry, no file input, no drag-drop. |
| **58** Duplicate detection | ⬜ | No fuzzy matching (`difflib`/`rapidfuzz` → 0 matches). Only exact slug uniqueness. |
| **59** Import colleges | ⬜ | Hardcoded Python seed only. 10 vs 1000. |
| **60** Import courses/scholarships/exams | ⬜ | Hardcoded seeds only. 20/6/6 vs 50/100/50. |
| **61** Import questions | ⬜ | 0 vs 500. |
| **62** Import placements | ⬜ | 0 vs 500. |
| **63** Import cutoffs | ⬜ | 0 — and this **silently disables the predictor**. |
| **64** Verification workflow | ⬜ | `verification_status` is a plain string column. No transitions, no approver identity, no dashboard. |
| **65** Blog + legal pages | 🟡 | 12 bundled blogs vs 20 target. **Legal pages entirely absent.** |

### Phases 66–75 · Security, performance, testing

| Phase | Verdict | Evidence / gap |
|---|---|---|
| **66** Security headers / HTTPS | 🟡 | CORS ✅. **Zero** security headers repo-wide (no HSTS, CSP, X-Frame-Options, Referrer-Policy), no HTTPS redirect, no `headers()` in `next.config.ts`, no `middleware.ts`. |
| **67** Rate limiting | 🟡 | 3 paths of ~200 endpoints. **All GET/HEAD/OPTIONS exempt** (`ratelimit.py:57-58`). ⬜ search limit (no search endpoint), ⬜ AI limit. Enquiry 5/hr not 3/10 min. |
| **68** Input validation | 🟡 | 158 Pydantic `Field()` constraints ✅. ⬜ no sanitization layer, ⬜ no body-size limit, ⬜ no HTML stripping on `BlogCreate.content` / `SeoMetadataUpsert.structured_data`. |
| **69** Error handling | 🟡 | 500 envelope with `request_id` ✅. 4xx `detail` strings raw and inconsistent — no shared envelope, which the spec's §62 requires. |
| **70** DB optimization | 🟡 | GIN + trigram indexes ✅, `selectinload` used widely ✅. ⬜ no `EXPLAIN` evidence, ⬜ no slow-query log. ⚠️ N+1 in enrichment: `_course_name` issues a query **per row** for Fee/Admission. ⚠️ `_paginated` calls `order_by(None)`, discarding caller ordering → non-deterministic pagination, and `/rankings` can return 2× the requested limit. |
| **71** Redis caching | ⬜ | Redis is **only** the rate limiter. All caching is Next.js ISR. `CACHE_TTL_*` keys unread. |
| **72** Frontend performance | 🟡 | `next/image` in 3 files, `remotePatterns` set. ⬜ no Lighthouse config/report/budget, ⬜ no CI to enforce. |
| **73** Mobile audit | 🟡 | Responsive prefixes used consistently; `pb-16 lg:pb-0` clears BottomNav. No artifact. Dashboard overflows. |
| **74** Accessibility | 🟡 | `lang="en-IN"`, focus rings, `Modal` Escape, jsx-a11y via eslint. ⬜ no WCAG/axe/contrast audit. ~20 concrete defects: no focus trap in `Modal` or the filter drawer, `aria-controls` pointing at a non-listbox, `role="checkbox"` where radio is correct, form errors not linked via `aria-describedby`, chat has no `role="log"`. |
| **75** Cross-browser | ⬜ | No Playwright/Cypress, no `.browserslistrc`, no matrix. |

### Phases 76–85 · Legal, monitoring, backup — **entirely absent**

| Phase | Verdict | Evidence / gap |
|---|---|---|
| **76** DPDP | ⬜ | No parental consent, no age gate, no data-deletion endpoint, **no Grievance Officer record or page**. Only a generic `consent_records` table. |
| **77** IT Rules | ⬜ | No grievance route/model, no 24h/15d/3h clocks, no scheduler. |
| **78** Sentry | ⬜ | Zero matches; not in `requirements.txt` or `package.json`. `SENTRY_DSN` unread. |
| **79** Monitoring | ⬜ | `GET /health` is a static `{"status":"ok"}` that stays green with PG and Redis both down. No metrics, no alerts. |
| **80** Backup | ⬜ | No `pg_dump`, no script, no cron, no restore test. |
| **81** SSL/HTTPS | ⬜ | No HSTS, no certbot, no ACM. |
| **82** DNS | ⬜ | No config, no IaC. |
| **83** GA4 | ⬜ | Zero `gtag` matches, no events, no GA script in layout. |
| **84** Search Console | ⬜ | Sitemap URL referenced; no verification, no submission. |
| **85** WAF | ⬜ | No Cloudflare anything. |

### Phases 86–105 · CI/CD, launch — **entirely absent**

| Phase | Verdict | Evidence / gap |
|---|---|---|
| **86** Git branching | 🟡 | `main` + `develop` ✅, conventional commits ✅. ⬜ no `feature/*` observed, **zero tags**, no CONTRIBUTING/commitlint/husky. |
| **87** CI pipeline | ⬜ | **No CI config of any kind** (searched `.github/`, `.gitlab-ci.yml`, `Jenkinsfile`, `azure-pipelines.yml`, `.circleci`). `package.json` has **no `test` and no `typecheck` script**. 165 backend tests exist and nothing runs them. |
| **88** CD pipeline | ⬜ | No CD config, no app Dockerfile. |
| **89** Staging | ⬜ | No staging config or reference. |
| **90** Production | ⬜ | No IaC, no `docker-compose.prod.yml`. README only *states* "AWS ap-south-1". |
| **91** Load test | ⬜ | No k6/locust/JMeter. No perf baseline. |
| **92** Security audit | ⬜ | No OWASP ZAP config or report. |
| **93** Final QA | ⬜ | No QA report, no visual baseline, no E2E. |
| **94** UAT fixes | ⬜ | No UAT artifact. |
| **95** SEO verification | ⬜ | No Rich Results report, no Search Console property. |
| **96** Production deploy | ⬜ | Migrations + seeds exist; no deploy path. |
| **97** Smoke tests | ⬜ | None. |
| **98** 24h monitoring | ⬜ | None (see 79). |
| **99** Fix critical bugs | — | Process, not verifiable in-repo. |
| **100** Documentation | 🟡 | README + `.env.example` ✅. ⬜ admin guide, ⬜ deployment guide. README documents 2 non-existent directories and claims pgvector + Celery, neither of which exists. |
| **101** Admin training | ⬜ | None. |
| **102** Handover | ⬜ | None. |
| **103** 2-week stabilization | ⬜ | None. |
| **104** Performance tuning | ⬜ | None. |
| **105** Sign-off | ⬜ | None. |

---

## Fabricated data currently reachable by users

Highest-priority cleanup — these render as live facts and are not:

| Shown | Source | Reality |
|---|---|---|
| 14 student testimonials about **"Sheryians Coding School"** | `reviews/AnimatedRatingMarquee.tsx:17-148` | Copied from a different product's site |
| Dashboard brand **"EduPath"**, user **"Pushkar"**, saved = NerdWallet / Levi's / NY Times internships | `dashboard/DashboardExplorer.tsx:35-64,71,100` | Wrong product entirely |
| "12K+ Colleges / 500+ Courses / 2.4M+ Students / **98% Satisfaction — From verified reviews**" | `home/hero/HeroStats.tsx:5-10` | 10 colleges, 0 students, 0 reviews |
| "240+ colleges" per course tile | `home/PopularCourses.tsx:20-70` | Invented per tile |
| "Colleges listed **1,400+**", "Students/month **2.4 lakh+**" | `app/about/page.tsx:143-144` | Invented |
| Analytics: 184.2K page views, 6.2% conversion, 4m 32s session, 4-stage funnel | `admin/sections/AnalyticsSection.tsx:14-40` | **All invented.** Nothing is tracked |
| SEO: 6 audit scores, 142 indexed pages, 1.2K backlinks, 0.9s CWV | `admin/sections/SeoSection.tsx:12-26` | **All invented** |
| "PostgreSQL — connectivity **verified** — Healthy" | `admin/sections/DashboardSection.tsx:149` | Hardcoded `ok: true`; never checked |
| "REST API: healthy" over a dead backend | `app/api/stats/route.ts:36-44` returns `ok: true` unconditionally | All 6 fetches can fail → still "healthy" |
| "Top colleges by **views**" | `admin/sections/DashboardSection.tsx:126-141` | Bundled colleges sorted by **review count** |
| "Registered students 12,480" | `admin/sections/DashboardSection.tsx:58` | Literal |
| "Synced 2 min ago" | `admin/AdminDashboard.tsx:64` | Literal; nothing syncs |
| "Ask AI: Which is better?" answers | `ai/MiniChat.tsx:8-17` | `setTimeout(800)` + template string |
| "server-authoritative timer and autosaved answers… follow you across devices" | `mocktests/MockTestEngine.tsx:80-84` | **False** — local state + localStorage |
| Terms and Privacy links → `/about` | `app/login/page.tsx:268-270` | Neither document exists |

One genuinely honest metric: `strengthScore` (`lib/utils.ts:76-102`) is a real weighted function of the record, and the comment documents that a previous `88 + hash(id)%12` version was deliberately removed. Keep it.

---

## Structural root causes

Three decisions explain most of the 🔶 verdicts. Fixing these is higher leverage than patching individual panels.

1. **`lib/content.ts:52-58` silently substitutes bundled literals on empty.** A green build with a completely dead backend renders a fully-populated, fully-fake site. Only `/colleges` surfaces the `source: "api" | "bundled"` flag (`app/colleges/page.tsx:22-26`); every other page discards it. **Worst offender:** an *empty but healthy* live collection is indistinguishable from an outage, so a legitimately empty table swaps in 16 bundled colleges.

2. **The frontend was never wired to ~40% of the API.** Real and unused: the entire mock-test attempt engine, `POST /predictor`, `/saved-colleges`, `POST /reviews`, `PUT /users/me`, `PUT /users/me/password`, `PATCH /users/{id}`, lead notes/assign/follow-up, and all `POST/PUT/DELETE` on `/enrichment/*`. Backend 165 tests pass; the browser sees none of it. *(Updated 29 Sep 2026: the college admin panel is now wired — see item 9 below. `PUT/DELETE /users/{id}` and the rest are still unwired.)*

3. **Admin has no write path.** 20 panels, but only **7** call the API at all, and only **banners** and **colleges** have a full CRUD surface. `AddButton` and `RowActions` in `admin/primitives.tsx` are toast-only and are reused by the remaining non-wired panels — which is why they *look* functional.

---

## Recommended order

**Before anyone sees the site:**
1. Fix `/dashboard` — it is a different product behind a login. Either wire it to real data or gate it off.
2. Delete or clearly label the fabricated blocks (Analytics, SEO, System status, Sheryians testimonials, hero stats). They are the reputational risk.
3. Fix `/api/stats` to report real `ok`, and make the Admin "PostgreSQL verified" line actually check.

**Blocking correctness:**
4. `submit_attempt` never enforces expiry (`mock_tests.py:594-613`) — a student can let the clock run out and still get a graded result. Same hole at `:452-466`.
5. `enrichment._paginated` calls `order_by(None)`, discarding ordering → non-deterministic pagination.
6. `mock_tests` grades non-MCQ as incorrect (`_grade_attempt:112-125`).
7. `predictor.py:219` uses `hash(str(cid))`, which is per-process randomised → confidence scores change between workers and across restarts.

**Closing the biggest spec-vs-build gaps:**
8. Phase 3 (OTP) — blocks registration quality and password reset entirely.
9. ~~Phase 29 (college admin) — without it, "add a college without code" is false.~~ **DONE 29 Sep 2026.** `CollegesSection` now has real create/edit/delete against `POST/PUT/DELETE /colleges`, with the feature toggle, role gating (admin may write, only `super_admin` may delete), and lazy state/district/university/course lookups. The edit dialog fetches `GET /colleges/{id}` before enabling Save, because `exclude_unset=True` plus an explicit `null` means a blank form would clear the record. Building it surfaced **BUG-11**: `accreditation_nba` was on the column and the response model but on neither request schema, so the form's NBA control returned 200 and wrote nothing.
10. Phase 63 (cutoffs) — without it the predictor is dead regardless of frontend work.
11. Phase 87 (CI) — 165 tests that nothing runs. *(Partly done: the backend suite runs in CI, with a Redis service and a hard failure if the live limiter tests skip.)*

**Documentation corrections:** `README.md` (remove `proctoring-service/`, `.github/workflows/`, the pgvector and Celery claims, the `asyncpg`/5432 connection string), `DESIGN.md` (documents Clay.com — delete or replace), and `docs/padhaanewala-phase-checklist.md` (superseded by this file).
