# PADHAANEWALA — MASTER PHASE CHECKLIST + MANDATORY PREREQUISITES
Generated from: `padhaanewala-complete.md` (Master Plan V5.0)

## STATUS UPDATE — Last reviewed: 28 September 2026 (re-verified against project code)

**Current progress: 7 of 105 phases complete, 6 more code-complete but ungated.** This review was done by *measuring the code*, not by trusting the previous status column: the live OpenAPI schema was dumped (108 paths / 24 tags), every table counted in the dev database, and each previously-"pending" claim re-checked against the source. Several rows below were wrong in the old revision — notably Phases 10, 12, 13 and 14 were marked incomplete but are in fact built.

**Verified inventory, 28 Sep 2026:** 23 routers, 27 models, 10 Alembic migrations (head `b4e91d7a2c58`, single head, applied to the dev database), 13 test files, **225 tests green / 1 skipped**. Database: 42 tables. Seed data: 36 states (28 + 8 UTs), 755 districts, 106 cities, 168 universities, 331 colleges, 22 courses, 6 exams, 6 scholarships, 14 roles.

**Block B seeding gate is now MET** (was listed as unverified): 28 states + 8 UTs present, districts 755 against a ~780 target, and 331 colleges carry real rows. Two content-thin tables remain: `fees` is empty and courses/exams/scholarships sit at 22/6/6 against the Phase 65 targets of 50+/50+/100+.

> Re-verified 28 Sep 2026 (Phase 3 + security review): OTP backend and frontend complete — 8 new endpoints, `otp_records` migration, MSG91/SMTP provider adapters with console fallback, 39 OTP tests. A review pass then found and fixed four real defects: the email gate was **not enforced at all** on the OTP login path (the 403 existed only on `send`); `/login/otp/send` leaked account existence through three separate oracles (a distinct message for unconfirmed addresses, a 429 for rate-limited numbers, a 502 for provider failures); the send rate limit was **not** atomic despite a docstring claiming it was; and the production guard rejected a valid `EMAIL_PROVIDER=smtp` deployment because it demanded an `EMAIL_API_KEY` that SMTP never reads. Legal copy that still claimed "email and mobile are not verified by OTP" was corrected, and MSG91 + the email provider added to the disclosed processor list.

> Re-verified 11 Sep 2026: Docker stack live (PostgreSQL 15 on host port 5433 + Redis 7). Homepage built with placeholder data (API-swap later). **Discovery:** `origin/develop` already contained Phase 2/4/6 code (users/auth/roles `bbe7820`, locations/universities/colleges/courses/fees/scholarships/exams `605b88f`, test fix `bce279f`). Migrations applied to live Docker PG (head `63603ea2106d`), seeds run, and **Phase 11 verified: 37/37 backend tests green + live CRUD smoke test** (fixes: `ErrorDetail` ordering in `schemas/common.py`; Bengaluru city district mapping in `seed_locations.py`).

> Re-verified 12 Sep 2026: backend grew 4 migrations + 10 routers + 2 test files; frontend grew 4 routes. Suite was **52 tests** (auth 14 / catalog 23 / content 15). **Docker Desktop was NOT running at last review** — the 4 new migrations (`4e7270c87f0c` mock tests/questions, `2ce8d337ae09` content & engagement, `8cc76261fbc7` enquiries/leads/saved/consent, `68d5258b08f1` placement/NIRF/cutoff/seat matrix) and the full suite still needed to be applied/re-run live.

> Re-verified 13 Sep 2026 (backend, live PG): Docker is down, so a dedicated **`.env.test`** was added pointing at the **native Windows PostgreSQL 16 (port 5432, `padhaanewala_test` DB)**. Fresh schema → all 8 Alembic migrations applied → all seeds run (36 states / 755 districts / 105 cities, 155 universities, 14 roles, 20 courses + 10 colleges, 6 scholarships, 6 exams). **Phase 2 (auth) completed + tested: 70/70 backend tests green on the live database** — this clears the previously-pending "run full suite against live DB" checklist item.

### Completed so far
- ☑ **M1 (GitHub account)** — private repo `Padhaanewala_Education` created, connected, code pushed. Other accounts (AWS, OpenAI, **MSG91 + SendGrid — approved, expected in ~3 days**, Sentry, Cloudflare, GA4, Search Console) **PENDING**.
- ☑ **M3 (Developer engaged)** — developer working; master doc handed over; repo `main` + `develop` branches active.
- ✅ **Phase 1 (Setup Environment) — COMPLETE — Completion Gate PASSED (11 Sep 2026)**
- ✅ **Phase 2 (Users, Auth, Roles) — COMPLETE — 13 Sep 2026** (register/login/refresh/logout, profile + change-password, roles list, admin user & role management with RBAC, email normalization; verified end-to-end on live PostgreSQL)
- ✅ **Phase 4 (States, Districts, Universities) — COMPLETE — 28 Sep 2026** (`locations` + `universities` routers; 36 states / 755 districts / 106 cities / 168 universities seeded and verified by direct table count)
- ✅ **Phase 8 (Reviews, Blogs, FAQs, Media, SEO, Notifications, Audit) — BACKEND COMPLETE** (all 7 routers present; frontend surface deferred to Blocks E/H)
- ✅ **Phase 11 (College CRUD API) — COMPLETE — verified 11 Sep 2026** (full list/filter/search/detail + admin create/update/delete with RBAC)
- ✅ **Phase 12 (Course, Scholarship, Exam APIs) — BACKEND COMPLETE — 28 Sep 2026** (old revision wrongly said "admin CRUD pending": full POST/PUT/DELETE now exist on all three)
- ✅ **Phase 14 (Placement, Cutoff, NIRF APIs) — BACKEND COMPLETE — 28 Sep 2026** (old revision wrongly said "☐": 6 public `catalog-data` queries + 27 `college-enrichment` endpoints incl. seat matrix, admissions, fees, NIRF and other rankings)
- ✅ **Phase 15 (Login, Register, OTP Pages) — COMPLETE — 28 Sep 2026** (password + mobile-OTP login, `/forgot-password`, `/reset-password`, `/verify-email`; lint/typecheck/395-page build green)
- 🟡 **Phase 3 (Email, SMS, OTP) — CODE COMPLETE, GATE PENDING — 28 Sep 2026.** Backend + frontend done, 39 tests. Gate cannot pass until MSG91 + email credentials land (~3 days). Until then both providers fall back to **console logging**, so no message has reached a real phone or inbox.
- 🟡 **Phase 40 (College Predictor) — CODE COMPLETE, ungated** (`/predictor` POST + exam list; disclaimer copy pending review)
- 🟡 **Phase 7 (Mock Tests, Questions) — PARTIAL** (15 mock-test endpoints incl. start/submit/attempts/result + admin create/update/delete, so Phases 42/44/45/46 are effectively built; **Phase 43 question-bank admin has no endpoints** and `test_questions` is empty)

### Confirmed NOT started (measured, not assumed)
- **Phase 13 — NLP query parse.** Text/filter search exists (`GET /colleges/search`); no NLP parse endpoint.
- **Phase 25/36 — enquiry hand-off is missing.** `POST /enquiries` creates the enquiry and stops: it never creates a `Lead`, never writes a `Notification`, never emails the student or alerts an admin (`routers/enquiries.py` is 30 lines). The `leads` and `notifications` APIs exist and are unused by this path, so both the Phase 25 gate ("enquiry creates a lead admin can see") and the Phase 36 gate ("enquiry → student email + admin alert") **cannot** pass.
- **Phases 47–55 — Proctored exams.** Effectively zero: "proctor" appears only as a role name and a schema field.
- **Phases 56–64 — Data import.** Zero: no CSV import API, no fuzzy duplicate detection, no data-verification workflow.
- **Phases 76–77 — DPDP parental consent + IT Rules 2021 takedown.** Zero: no parental/guardian or takedown code. The privacy policy openly states there is no age-verification or parental-consent record — a **known, disclosed** legal gap, not an oversight.
- **Phases 78–95 — Monitoring, backup, DNS, analytics, CI/CD, staging, prod, load test, security audit.** Zero.

### Recently added (design/dev prep for upcoming phases — no phase gates passed)
- ☑ `DESIGN.md` added — frontend design system reference (colors, typography) for Phase 16 (homepage/layout)
- ☑ Tailwind 4 docs + web-design-guidelines skills added — dev tooling prep for Phase 16–18 (frontend build)
- ☑ Docker Desktop installed (v29.7.2) + WSL2/Virtual Machine Platform enabled — verified running 11 Sep 2026
- ☑ **Port conflict resolved** — native Windows PostgreSQL 16 owns port 5432, so Docker PG 15 now publishes on host port **5433** (docker-compose.dev.yml, `.env.development`, `config.py` updated to match)
- ℹ️ **Upstream Phase 2/4/6 code present** on `origin/develop` (`bbe7820`, `605b88f`, `bce279f`) — models, routers, schemes, tests, seed scripts, 4 real Alembic migrations (root `8422ac618df6`). Local `develop` merged `main` (homepage + port remap) and removed the collision empty base.

### 12 September 2026 — frontend listing/predictor pages added (placeholder data, dev prep)
- ✅ **Colleges listing** `/colleges` — filterable (state, category, course) college cards with fee/placement/scholarship highlights (`src/data/colleges.ts`; Phase 17 UI surface).
- ✅ **Courses listing** `/courses` — course groups with overview, duration, eligibility, career paths (`src/data/courses.ts`; Phase 19 UI surface).
- ✅ **Jobhire landing** `/jobhire` — standalone job-search landing page with its own layout (`src/app/jobhire/`); marketing sandbox, not a spec phase.
- ✅ **College Predictor page** `/college-predictor` — configurable rules engine (`src/data/predictor.ts`: course→exam mapping, score→rank estimation, per-category rank bands) + form (course, exam, rank|score, category, state, budget, govt/private, hostel) → buckets **Highly Suitable / Possible / Reach / Not eligible** with confidence + reasons + disclaimer (spec §14, Phase 24/40 UI). Placeholder rank bands; Phase 40 will swap in real cutoff data.
- ✅ **Scholarships listing** `/scholarships` — 12 scholarships, search + category/provider filters + deadline/amount sort (Phase 20 UI surface).
- ✅ **Exams listing** `/exams` — 10 exams, type (national/state) + status (open/upcoming/results) filters, date sort (Phase 21 UI surface).
- ✅ **Blog listing** `/blog` — 12 articles, category/search filters + featured-article hero (Phase 65 blog surface).
- ✅ **Mock Tests listing** `/mock-tests` — 12 tests (NEET/JEE/KCET/CUET), exam/mode/difficulty filters, desktop-only note (Phase 42 UI surface).
- ℹ️ All pages run on static TS data under `src/data/` (home, colleges, courses, predictor, scholarships, exams, blog, mockTests) — the existing Header/Footer/QuickActions/home-section links now resolve instead of 404ing. Real API-swap happens at each page's actual phase (16/17/19/20/21/42/65). `next build` + ESLint pass; all routes render.

### 12 September 2026 (later, `9bfaebe`) — detail + static pages kill all 404s; backend auth hardening
- ✅ **Detail pages added** (placeholder data) — `/college/[slug]`, `/courses/[slug]`, `/exams/[slug]`, `/scholarships/[slug]`, `/mock-tests/[slug]`, `/blog/[slug]`; listing pages now link through (Phase 18/19/20/21/42/65 UI surfaces).
- ✅ **Static pages added** — `/about`, `/contact`, `/privacy-policy`, `/terms-conditions` (M5 legal-page drafts, Phase 65/76+97 surface; copy still placeholder).
- ✅ **Login page** `/auth/login` — form UI (Phase 15 surface; real flow waits on Phase 2/3 backend enablement).
- ✅ **Compare page** `/compare` — college comparison UI starter (Phase 24 surface).
- ✅ **Every route renders** — header/menu wired to all pages; quick-action + home sections extended; no 404 routes remain.
- ✅ **Backend auth/token hardening** — refresh tokens signed with dedicated `JWT_REFRESH_SECRET_KEY`; optional-bearer dependency (`get_optional_current_user`) so public endpoints hide drafts from non-content users; malformed-`sub` guards on `get_current_user`/refresh; production config guard rejects dev default JWT/DB creds (`PADHAANEWALA_ENV_FILE` env override added); review rating recalc committed properly; profile auto-fills display name; `TestQuestion.__test__ = False` stops pytest collecting the model. No new tests (still 52).
- ℹ️ Same status as the Sep-12 frontend batch: placeholder data, real API-swap at each page's actual phase.

### 13 September 2026 — frontend polish batch (no phase gates passed, dev prep for Blocks D/F)
- ✅ **Theme toggle + dark mode** (`8990dae`) — global theme switch persisted to localStorage with OS-preference default; dark-mode remap of hardcoded light utility classes in `globals.css`; **View Transitions** wipe animation on theme change; no-JS boot script in `<head>` prevents flash (`(site)/layout.tsx`).
- ✅ **Hero background image** — `public/dreamlike-surrealistic-landscape.jpg` behind the homepage hero, with overlay treatment.
- ✅ **Browse Colleges button** — animated CTA (`BrowseCollegesButton.tsx`) with gradient hover + sparkle side-effect; wired on the homepage hero.
- ✅ **Header refinements** — signature pill/glass navbar (framer-motion scroll-responsive), device breakpoints, mobile menu, "Get Started" CTA; the header was already reworked in earlier commits (`303084f`, `e3c7f77`).
- ✅ **Floating AI chat assistant widget** — `AIFloatingAssistant.tsx` on all site pages (rule-based Q&A over local data; real AI swap at Phase 41).
- ✅ **Pricing page** built (static tiers). `next build` + ESLint pass against Next.js 16.3.4 (project already on Next 16 / React 19 / Tailwind 4).
- ℹ️ Frontend remains a high-fidelity static prototype on `src/data/*.ts` — real API-swap happens at each page's actual phase (16/17/19/20/21/42/65).

### 13 September 2026 (later, `daa1ac2`) — premium UX upgrade: animations, lead form, SEO (no phase gates passed, dev prep for Blocks D/F + Phase 26)
- ✅ **Shared motion system** — `src/components/motion.tsx` (`Reveal`, `StaggerGroup`, `StaggerItem`) with one easing/duration token set; scroll reveals are `once: true`, transform/opacity only, negative viewport margin. **No new animation library added** (reused existing `framer-motion`).
- ✅ **Reduced-motion respected globally** — `<MotionConfig reducedMotion="user">` in `(site)/layout.tsx` disables transform animations for users who request it (Framer) + CSS smooth-scroll gated on `prefers-reduced-motion`.
- ✅ **Hero entrance + trust strip** — staggered fade/rise for badge → H1 → subcopy → search → CTAs; white legibility overlay on hero image; "1,000+ verified colleges · 100+ scholarships · Free admission counselling" trust row.
- ✅ **Section/card staggers** — popular courses, featured colleges, scholarships, exams, mock tests, why-us, latest articles grids now reveal with ~80ms card stagger; footer entrance; header active-link highlight (`aria-current`) + keyboard focus rings.
- ✅ **Lead capture (Phase 26 surface → wired to Phase 9 backend)** — new `ContactForm.tsx` on `/contact` posts to existing `POST /api/v1/enquiries` (name/mobile required, email optional, interest/message, UTMs, device, honeypot spam bait); validation, inline errors, success + error states with WhatsApp/email fallbacks; trust badges; **WhatsApp number unified** across the site.
- ✅ **Mobile sticky counselling CTA** — `StickyCta.tsx`, mobile-only pill ("Get Free Counselling" → `/contact`) appears after hero scroll, hides near page bottom.
- ✅ **SEO/technical** — `robots.ts`, `sitemap.xml` (89 URLs incl. dynamic detail pages), `Organization` JSON-LD in layout head, `metadataBase`, Twitter + OG locale metadata, `robots: index/follow`; SSR HTML keeps visible headings/copy (content not hidden behind animation).
- ✅ **Accessibility/performance** — global keyboard `:focus-visible` outline, brand `::selection`, lazy `img` decoding on review avatars, cards fill grid rows (`h-full`). `next build` + ESLint + `tsc` pass; smoke-tested `/`, `/contact`, `/colleges`, `/sitemap.xml`, `/robots.txt` all HTTP 200.
- ℹ️ Contact form needs the FastAPI backend reachable (API base from `NEXT_PUBLIC_API_BASE_URL`); gracefully suggests WhatsApp/email if the API is down. WhatsApp number is still a placeholder (`919000000000`) — client must supply the real number.

### 11–12 September 2026 — backend Phase 7/8/9/10 models + migrations, Phase 8 routers, 52-test suite
- ✅ **Phase 8 routers + tests** (`0a9decf`) — reviews (submit + admin moderation + moderation queue), blog (categories + CRUD), FAQs (CRUD), media (CRUD), SEO (entity-scoped upsert/list), notifications (per-user inbox, unread count, mark read/all), audit logs (admin list), banners (CRUD) — all RBAC-guarded; 15 content tests in `tests/test_content.py`.
- ✅ **Phase 7 models + migration** — mock tests + questions (`4e7270c87f0c_add_mock_tests_and_questions`) + read APIs (`/mock-tests`, `/mock-tests/{id}`); question-bank admin is Phase 43.
- ✅ **Phase 9 models + migration** — enquiries, leads, saved colleges, consent (`8cc76261fbc7_add_enquiries_leads_saved_colleges_`) + enquiry submit API; lead/saved/consent routers pending.
- ✅ **Phase 10 models + migration** — placements, NIRF/rankings, cutoffs, seat matrix (`68d5258b08f1_add_placement_nirf_cutoff_seat_matrix`); query APIs pending (Phase 14).
- ✅ **Phase 12 backend READ surface** — scholarship list/detail + exam list/upcoming/detail + course search already live and covered in `tests/test_catalog.py`; admin CRUD for courses/scholarships/exams is the remaining Phase 12 work.
- ℹ️ Suite = **52 tests** (auth 14 / catalog 23 / content 15) — Phase 11's 37 (auth+catalog) + 15 new content tests. **Applying the 4 new migrations + re-running the full suite against live Docker PG still pending (Docker Desktop was off at last review).**

### Phase 1 — what's DONE ✅
- ☑ Folder structure: `frontend/`, `backend/`, `docs/`, `scripts/` created
- ☑ `docker-compose.dev.yml` created (PostgreSQL 15 + Redis 7)
- ☑ `.env.example` written (139-env template: DB, Redis, JWT, email, SMS, S3, AI, proctoring)
- ☑ `.gitignore` created
- ☑ `README.md` with setup instructions
- ☑ Frontend scaffolded: Next.js + React + TypeScript + Tailwind (stock `create-next-app`)
- ☑ Backend scaffolded with Phase 2/4/6 additions: `/health` endpoint + `config.py` + `database.py` + models/routers/schemas/tests
- ☑ `requirements.txt` + Alembic initialized (`alembic.ini`, `env.py`)
- ☑ Git repo initialized, `main`/`develop` branches, code pushed to GitHub
- ✅ `npm install` / `node_modules` — DONE (358 packages, 0 vulnerabilities; `next build` passes)
- ✅ `.env.development` — DONE (created, settings load from it, dev DB/Redis creds match docker-compose)
- ✅ Python `venv` + backend deps — DONE (venv created, requirements installed, uvicorn serves `GET /health` → HTTP 200 `{"status":"ok"}`)
- ✅ **Homepage built** — stock "Create Next App" page replaced with a full Padhaanewala homepage: hero + search bar, quick-action cards, popular courses, featured colleges (fee/placement), scholarships, upcoming exams, mock tests, why-us, reviews, articles, admission CTA, WhatsApp button, sticky header + mobile menu, footer. Placeholder data in `frontend/src/data/home.ts` (will switch to APIs at Phases 11–16). `next build` + ESLint pass; renders HTTP 200.
- ✅ **Docker stack verified against real PostgreSQL/Redis** — `docker compose up -d` runs `postgres:15` (host port 5433) + `redis:7-alpine` (6379, `PONG`); node v24.20.0 / Python 3.12.10 / git 2.55.0 / Docker 29.7.2 confirmed.

### Phase 1 — what's REMAINING ❌ (blocks completion gate)
- none — Phase 1 Completion Gate ✅ PASSED.

### Phase 1 — post-gate verification done 11 Sep 2026
- ✅ **Pushed to `develop`** — homepage, port-remap, docs, base-revision removal pushed (`bce279f..b884b84`).
- ✅ **Real migration chain applied to live Docker PG** — `alembic current` = `63603ea2106d` (head); 18 tables created (`users`, locations/resgions/universities/colleges/courses/fees, scholarships/exams, + search indexes). Chain: `8422ac618df6` → `926c62eec261` → `459f3e0774ed` → `63603ea2106d`.
- ⏳ **Block B follow-ups (not Phase 1 gate):** run backend test suite (`pytest`) against live DB; seed roles/locations/universities; verify auth API works end-to-end.

---

## How to use
1. Do all **Manual Gates (M1–M10)** in order below — nothing starts without them.
2. Follow phase blocks **A–P** in order. The "Mandatory before" list for each block is a HARD gate — do not start that block until every listed prerequisite is complete (verified).
3. Within a block, phases run as listed; phases noted as *parallel* may run together.
4. After each phase block, complete the **Completion Gate** checks before moving to the next block.

---

## MANUAL GATES (Class 1 — [YOU] tasks)

| # | Task | Mandatory before | Done |
|---|---|---|---|
| M1 | Create accounts: GitHub, AWS, OpenAI/Anthropic, MSG91, SendGrid/AWS SES, Sentry, Cloudflare, GA4, Search Console | GitHub → Phase 1; MSG91+SendGrid → Phase 3; OpenAI → Phase 38–41; S3 → Phase 47–55; Sentry → Phase 78; GA4 → Phase 83; Cloudflare → Phase 85 | ☑ GitHub only — others PENDING |
| M2 | Buy `padhaanewala.in`, point nameservers to Cloudflare, DNS records | Phase 82 / Phase 90 (production DNS) / Phase 96 (launch) | ☐ |
| M3 | Engage developer, give them this single doc | Phase 1 | ☑ |
| M4 | Compile data: Colleges CSV (1000+), Courses (50+), Scholarships (100+), Exams (50+), Questions (500+), Placement (top 500), Cutoff CSVs, 20+ blog articles | Phase 56–65 (Data Import) | ☐ |
| M5 | Write legal pages: Privacy Policy (English AND Hindi), Terms, Disclaimer, Cookie Policy | Phase 76, Phase 96–97 | ☐ |
| M6 | Appoint Grievance Officer (name/email/phone), define 24h ack / 15-day resolution | Phase 76, Phase 96–97 (legally required BEFORE launch) | ☐ |
| M7 | Configure services on demand: MSG91 (P3), SendGrid (P3), AI key (P38–41), S3 bucket (P52), GA4 ID (P83), Search Console (P84), WAF (P85) | As noted per phase | ☐ |
| M8 | Prepare content: college photos/logos (Phase 35), blog + legal text (Phase 56–65) | Phase 35, Phase 56–65 | ☐ |
| M9 | Verify every phase (live demo, tests green, mobile check, your approval) | ALL phases | ☐ |
| M10 | Launch prep: UAT with 5 friends, test phone + laptop, collect ALL credentials (AWS/Cloudflare/GitHub/DB/admin), backup verified | Phase 96 | ☐ |

---

## PHASE BLOCKS — Checklist + Mandatory Prerequisites

### BLOCK A — Foundation
| # | Phase | Prerequisites aIready met | Done |
|---|---|---|---|
| 1 | Setup Environment [BOTH] | **M1 (GitHub), M3** + Node 18, Python 3.11, Docker, Git, VS Code installed. Domain NOT required yet. | ◐ PARTIAL (~95%) — see Status Update above |

**Completion Gate:** node/python/git/docker verified ✅; private GitHub repo `padhaanewala` ✅; `docker compose up` runs PostgreSQL+Redis ✅; backend `/health` returns OK ✅; frontend loads at localhost:3000 ✅; code pushed to `develop` ✅ (pushed 11 Sep 2026). → **✅ PASSED — Phase 1 COMPLETE.** Phase 2/4/6 code on `develop` has migrations applied to live Docker PG (head `63603ea2106d`); Block B gate (API login + seeding + tests) still to be verified.

### BLOCK B — Database Layer 1 (Phases 2–10)
| # | Phase | Mandatory before | Done |
|---|---|---|---|
| 2 | Users, Auth, Roles [DEV] | Phase 1 | ✅ **COMPLETE 13 Sep 2026** — register/login/refresh/logout, profile + change-password, roles list, admin user list/search/detail + activate/deactivate + role assignment (`require_role` RBAC), email-normalization hardening; suite now **70 tests** green on live PG (see 13 Sep status) |
| 3 | Email, SMS, OTP [BOTH] | Phase 2 + **M1 (MSG91 + SendGrid/SES credentials BEFORE developer starts)** | 🟡 **CODE COMPLETE 28 Sep — GATE PENDING.** 8 endpoints + `otp_records` (`b4e91d7a2c58`), MSG91/SMTP adapters w/ console fallback, 39 tests. **Gate blocked on paid credentials (~3 days out).** |
| 4 | States, Districts, Universities [DEV] | Phase 1 (*parallel* with 2, 3) | ✅ **COMPLETE 28 Sep** — `locations` + `universities` routers; seed verified by table count (36 states / 755 districts / 106 cities / 168 universities) |
| 5 | Colleges, Courses, Fees [DEV] | Phase 4 (college → state/district/university FK) | 🟡 PARTIAL — 331 colleges + 22 courses seeded, full CRUD live; **`fees` table empty (0 rows)** |
| 6 | Scholarships, Exams [DEV] | Phase 4 (*parallel* with 5) | 🟡 PARTIAL — full CRUD live; only 6 scholarships / 6 exams against Phase 65 targets of 100+ / 50+ |
| 7 | Mock Tests, Questions [DEV] | Phase 5 (→course) + Phase 6 (→exam) | 🟡 PARTIAL — 15 endpoints incl. full attempt lifecycle + admin CRUD (⇒ Phases 42/44/45/46 effectively built); **Phase 43 question-bank admin missing**, `mock_tests` + `test_questions` both empty |
| 8 | Reviews, Blogs, FAQs, Media, SEO, Notif., Audit [DEV] | Phase 2 + Phase 5 | ✅ **BACKEND COMPLETE** — 7 routers (`reviews`/`blogs`/`faqs`/`media`/`seo`/`notifications`/`audit`); all tables empty (no content yet) |
| 9 | Enquiries, Leads, Saved, Consent [DEV] | Phase 2 + Phase 5 | 🟡 PARTIAL — all 4 routers exist (`enquiries`/`leads`/`saved_colleges`/`consent`, 13 endpoints) but **nothing wires them together**: submitting an enquiry creates no lead. See Block F. |
| 10 | Placement, NIRF, Cutoff, Seat Matrix [DEV] | Phase 5 + Phase 6 | ✅ **COMPLETE 28 Sep** (old revision said "models only, APIs → Phase 14") — `placement_records`/`cutoffs`/`nirf_rankings`/`seat_matrix` + 6 public queries + 27 enrichment endpoints. All currently **0 rows**. |

**Completion Gate:** all tables migrated via Alembic ✅; user/login works at API level ✅; ~~OTP arrives on a real phone~~ ⛔ **BLOCKED on M1 credentials**; 28 states + 8 UTs + ~780 districts seeded ✅ (755); college/scholarship/exam tables accept sample data ✅ (331/6/6).

### BLOCK C — Backend APIs (Phases 11–14)
| # | Phase | Mandatory before | Done |
|---|---|---|---|
| 11 | College CRUD API [DEV] | Phase 2 + Phase 5 | ✅ **VERIFIED 11 Sep 2026** — list/filter/search/detail + admin create/update/delete (RBAC) live |
| 12 | Course, Scholarship, Exam APIs [DEV] | Phase 6 (+ Phase 11 patterns) | ✅ **BACKEND COMPLETE 28 Sep 2026** (old revision said "admin CRUD pending" — POST/PUT/DELETE now exist on all three) |
| 13 | Search Engine (text + filters + NLP) [DEV] | Phase 11 | 🟡 PARTIAL — text/filter search ✅ (`GET /colleges/search`); **NLP parse ☐ not built** |
| 14 | Placement, Cutoff, NIRF APIs [DEV] | Phase 10 | ✅ **BACKEND COMPLETE 28 Sep 2026** (old revision said "☐") — 6 `catalog-data` queries (placements, cutoffs, rankings, seat-matrix, fees, admissions) + 27 `college-enrichment` endpoints |

**Completion Gate:** admin can create colleges ✅; public search with filters works ✅; **NLP parse ☐**; placement/cutoff/NIRF queryable ✅ (endpoints exist, **0 rows of data**); templates passed ☐.

### BLOCK D — Frontend Core (Phases 15–18)
| # | Phase | Mandatory before | Done |
|---|---|---|---|
| 15 | Login, Register, OTP Pages [DEV] | Phase 2 + Phase 3 | ✅ **COMPLETE 28 Sep 2026** — password + mobile-OTP login, forgot/reset password, verify-email; lint + typecheck + 395-page build green |
| 16 | Header, Footer, Homepage [DEV] | Phase 11 + Phase 12 (sections API) | ☐ |
| 17 | College Listing [DEV] | Phase 13 (search API) | ☐ |
| 18 | College Detail Page [DEV] | Phase 11 + Phase 14 (placement/cutoff/NIRF) | ☐ |

**Completion Gate:** registration works on your real phone; homepage loads all sections from database, not hardcoded; filters work; college page shows placement + NIRF.

### BLOCK E — Content Pages (Phases 19–22)
| # | Phase | Mandatory before | Done |
|---|---|---|---|
| 19 | Course pages [DEV] | Phase 12 + Phase 16 | ☐ |
| 20 | Scholarship pages [DEV] | Phase 12 + Phase 16 | ☐ |
| 21 | Exam pages [DEV] | Phase 12 + Phase 16 | ☐ |
| 22 | Mobile responsive audit [DEV] | Phases 19–21 live | ☐ |

**Completion Gate:** course/scholarship/exam pages render with data; official links clearly marked; exam countdowns work; no mobile breakage.

### BLOCK F — Student Features (Phases 23–26)
| # | Phase | Mandatory before | Done |
|---|---|---|---|
| 23 | Student Dashboard [DEV] | Phase 15 + Phase 9 | ☐ |
| 24 | Comparison + Predictor [DEV] | Phase 14 (cutoff data) + Phase 13 | ☐ |
| 25 | Enquiry, Lead APIs [DEV] | Phase 9 | 🟡 PARTIAL — both APIs exist (`POST /enquiries`; 6 `leads` endpoints incl. assign/follow-up/status/notes) but **no hand-off**: an enquiry never becomes a lead |
| 26 | Enquiry Form, WhatsApp, Static Pages [DEV] | Phase 25 + Phase 16 | ✅ form live on `/contact`, wired to the Phase 9 enquiry API |

**Completion Gate:** dashboard shows saved colleges/tests/enquiries ☐; compare 2–4 colleges ☐; predictor shows Dream/Safe/Moderate with disclaimer 🟡 (API live, ungated); **enquiry creates a lead admin can see ⛔ FAILS — the hand-off is not implemented.**

### BLOCK G — Admin Panel (Phases 27–35)
| # | Phase | Mandatory before | Done |
|---|---|---|---|
| 27–30 | Admin foundation + dashboard + college mgmt + placement data [DEV] | Phase 2 (RBAC) + Phase 11 + Phase 12 + Phase 14 | ☐ |
| 31–34 | Admin: courses/scholarships/exams/blogs/reviews/leads [DEV] | Phase 27–30 + Phase 25 | ☐ |
| 35 | Admin: sub-users + activity monitoring [DEV] | Phase 27–30 + Phase 8 (audit/activity) | ☐ |

**Completion Gate:** you can add a college from admin without code; reviews can be approved/rejected; leads assignable to counsellors; create a "Content Manager" sub-user and confirm they can only see their modules; you can view any student's full activity.

### BLOCK H — Notifications & SEO (Phases 36–37)
| # | Phase | Mandatory before | Done |
|---|---|---|---|
| 36 | Notifications, Email, SMS [DEV] | Phase 3 + Phase 9 + Phase 25 | 🟡 PARTIAL — notification API complete (6 endpoints: my/unread-count/read/read-all/create/delete) and Phase 3 delivery services exist, but **nothing triggers them on an enquiry** |
| 37 | SEO: sitemap, robots, structured data [DEV] | Public pages live (Block D + E) | ✅ `seo` API + `robots.ts` + `sitemap.xml` + Organization JSON-LD |

**Completion Gate:** **enquiry → student email + admin alert ⛔ FAILS (no dispatch wired)**; notification bell shows unread 🟡 (API only, no trigger); sitemap validates ✅; structured data ☐ (not run through Rich Results).

### BLOCK I — AI System (Phases 38–41)
| # | Phase | Mandatory before | Done |
|---|---|---|---|
| 38 | RAG Knowledge Pipeline [DEV] | Phase 5 + Phase 6 (data sources) | ☐ |
| 39 | AI Chat API + Safety [DEV] | Phase 38 + **M1 (OpenAI key)** | 🟡 PARTIAL — chat route exists on the frontend (`/api/ai`) with canned fallbacks; no RAG |
| 40 | College Predictor (cutoff-based) [DEV] | Phase 10 (cutoffs) + Phase 38/39 | 🟡 **CODE COMPLETE 28 Sep — ungated** (`POST /predictor` + `/predictor/exams`); `test_pagination_and_predictor_stability.py` guards it. Needs the cutoff disclaimer reviewed. |
| 41 | Frontend AI Chat Widget [DEV] | Phase 39 | ☐ |

**Completion Gate:** "What is BHMS?" answers with source; "BHMS colleges in Karnataka" lists DB colleges with sources; predictor categorized with disclaimer; AI never invents data.

### BLOCK J — Mock Test System (Phases 42–46)
| # | Phase | Mandatory before | Done |
|---|---|---|---|
| 42 | Test listing + instructions [DEV] | Phase 7 + Phase 2 | ✅ list + detail live |
| 43 | Question bank admin [DEV] | Phase 42 | ☐ **not built** — no question CRUD endpoints; `test_questions` empty |
| 44 | Test interface — DESKTOP ONLY [DEV] | Phase 43 | ✅ attempt lifecycle live (start/answer autosave/submit) |
| 45 | Results page [DEV] | Phase 44 | ✅ `GET .../attempts/{id}/result` + `test_mock_test_engine.py` |
| 46 | Test admin (create test) [DEV] | Phase 43 | ✅ admin create/update/delete live |

**Completion Gate:** full test completes end-to-end ✅ (engine tested); answers auto-save ✅; auto-submit on timeout ☐ unverified; mobile "desktop only" ☐ unverified. **Note: 0 mock tests and 0 questions exist, so the flow is untested with real data.**

### BLOCK K — Proctored Exams (Phases 47–55)
| # | Phase | Mandatory before | Done |
|---|---|---|---|
| 47 | Consent + pre-test checks [DEV] | **Phase 42–46 COMPLETE (mandatory)** | ☐ |
| 48 | Client-side monitoring (tab/fullscreen/copy) [DEV] | Phase 47 | ☐ |
| 49 | Event reporting [DEV] | Phase 48 | ☐ |
| 50 | Auto-submission engine [DEV] | Phase 49 | ☐ |
| 51 | Proctoring ML service [DEV] | Phase 50 | ☐ |
| 52 | Evidence storage (private S3) [DEV] | Phase 51 + **M1 (S3 bucket)** | ☐ |
| 53 | Admin proctoring dashboard [DEV] | Phase 52 | ☐ |
| 54 | Proctoring policies (configurable) [DEV] | Phase 53 | ☐ |
| 55 | Proctoring recovery [DEV] | Phase 54 | ☐ |

**Completion Gate:** full proctored flow works on your desktop with camera; tab-switch detected; evidence viewable by admin; auto-submit fires per policy.

> ⛔ **Phases 47–55 NOT STARTED — verified 28 Sep 2026.** The string "proctor" appears in the codebase only as a role name (`app/roles.py`) and a schema field (`app/schemas/engagement.py`). No monitoring, event reporting, auto-submit engine, ML service, evidence storage, admin dashboard, policy config or recovery flow. This is the **single largest unbuilt backend block (9 phases)**, and it is gated behind Phase 42–46 being genuinely complete (they are code-complete but hold no data) plus **M1 S3 bucket** for evidence.

### BLOCK L — Data Import (Phases 56–65)
| # | Phase | Mandatory before | Done |
|---|---|---|---|
| 56 | CSV import API [DEV] | Phase 11–14 + Phase 27–34 | ☐ |
| 57 | Admin import UI [DEV] | Phase 56 | ☐ |
| 58 | Duplicate detection (fuzzy) [DEV] | Phase 56 | ☐ |
| 59 | Import colleges | **M4 college CSV FINALIZED** | ☐ |
| 60 | Import courses/scholarships/exams | **M4 CSVs FINALIZED** | ☐ |
| 61 | Import questions | **M4 question CSV FINALIZED** | ☐ |
| 62 | Import placement data | M4 placement CSV | ☐ |
| 63 | Import cutoff data | M4 cutoff CSV | ☐ |
| 64 | Data verification workflow [DEV] | Phase 59–63 live | ☐ |
| 65 | Blog content + legal pages [BOTH] | M4 blog articles + M5 legal drafts | ☐ |

**Completion Gate:** 1000+ colleges, 50+ courses, 100+ scholarships, 50+ exams, 500+ questions, placement for top 500, cutoff data, 20+ blogs, legal pages ALL live and verified.

> ⛔ **Phases 56–64 NOT STARTED — verified 28 Sep 2026.** Zero matches for a CSV-import API, fuzzy duplicate detection, or a data-verification workflow anywhere in `backend/app`. The gap against the gate is large: **331 / 1000+ colleges, 22 / 50+ courses, 6 / 100+ scholarships, 6 / 50+ exams, 0 / 500+ questions, 0 placement rows, 0 cutoff rows, 0 blog posts.** Legal pages (Phase 65) *are* now done — 6 documents, SSG, sitemap + 13 redirects. Everything else here needs **M4 CSVs**.

### BLOCK M — Security, Performance, Testing (Phases 66–75)
| # | Phase | Mandatory before | Done |
|---|---|---|---|
| 66–75 | Security headers, rate limiting, validation, error handling, DB perf, Redis cache, Lighthouse >90, mobile audit, WCAG 2.1 AA, cross-browser | **Blocks A–L COMPLETE (hardens everything)** | ☐ |

**Completion Gate:** Lighthouse >90; no horizontal scroll; security headers active; rate limits on all endpoints; accessibility checklist passes.

> 🟡 **Phases 66–75 PARTIAL — verified 28 Sep 2026.** Present organically rather than as a phase: RBAC + rate limiting (Redis wired), bcrypt secrets, OTP hashing, structured-error conventions, 225 tests. **Never run:** Lighthouse audit, WCAG 2.1 AA pass, cross-browser pass, DB performance tuning, Redis cache on read paths. Two findings from the Phase 3 review belong to this block: `next build` is **memory-sensitive** (395-page export times out at 60s/page under load — build succeeds with a longer timeout, so it is a resource problem, not a code one), and the production guard was only hardened for email/SMS — **no equivalent guard exists for the remaining production settings.**

### BLOCK N — Legal, Monitoring, Backup (Phases 76–85)
| # | Phase | Mandatory before | Done |
|---|---|---|---|
| 76 | DPDP compliance (parental consent, no child tracking, deletion flow) [DEV] | Block M + **M5 legal pages + M6 Grievance Officer** | ☐ |
| 77 | IT Rules 2021 compliance (grievance page, 3h takedown, 3-month reminders) [DEV] | Phase 76 + M6 | ☐ |
| 78 | Sentry [DEV] | **M1 (Sentry DSN)** | ☐ |
| 79 | Monitoring + alerts [DEV] | Phase 78 | ☐ |
| 80 | Backup + restore test [DEV] | Phase 79 | ☐ |
| 81 | SSL/HTTPS + HSTS [DEV] | Phase 80 | ☐ |
| 82 | DNS (production + www + staging) [YOU/DEV] | **M2 (domain owned + Cloudflare)** | ☐ |
| 83 | GA4 analytics [DEV] | **M1 (GA4 Measurement ID)** | ☐ |
| 84 | Search Console [BOTH] | Phase 83 | ☐ |
| 85 | WAF: Cloudflare rules, DDoS, bot protection [BOTH] | **M1 (Cloudflare)** | ☐ |

**Completion Gate:** Grievance Officer details published; parental consent flow verified; SSL live; analytics events tracked; backups restoring; monitoring alerts active.

> ⛔ **Phases 76–85 NOT STARTED — verified 28 Sep 2026.** No parental-consent, guardian, takedown or DMCA code exists. Phase 76 is the sharpest risk: the **privacy policy now explicitly admits** "no age-verification step and no parental-consent record, so we cannot currently demonstrate that this requirement is met" — a disclosed DPDP exposure that is a deliberate 16+ tradeoff, but must be a conscious decision. Phase 77 also requires the 3-hour takedown and 3-month takedown-reminder flows, both absent. Grievance pages are published, but **`GRIEVANCE_OFFICER.name` is still `"To be designated"`** (M6 outstanding). Sentry/GA4/Cloudflare/DNS all need M1.

### BLOCK O — CI/CD, Staging, Production (Phases 86–95)
| # | Phase | Mandatory before | Done |
|---|---|---|---|
| 86 | Git branching + commit conventions [DEV] | Block N | ☐ |
| 87 | CI pipeline (lint, type check, unit tests, build) [DEV] | Phase 86 | ☐ |
| 88 | CD pipeline (staging auto, prod approved) [DEV] | Phase 87 | ☐ |
| 89 | Staging setup + deploy + verify [BOTH] | **M1 (AWS + staging resources)** | ☐ |
| 90 | Production setup (Mumbai ap-south-1, Multi-AZ) [BOTH] | M1 (AWS prod) + **M2 (DNS)** | ☐ |
| 91 | Load test (50K concurrent target) [DEV] | Phase 90 | ☐ |
| 92 | Security audit (OWASP ZAP, fix critical/high) [DEV] | Phase 91 | ☐ |
| 93 | Final QA [DEV] | Phase 92 | ☐ |
| 94 | UAT + fixes [BOTH] | **M10 (5 friends test)** | ☐ |
| 95 | SEO verification [DEV] | Phase 94 | ☐ |

**Completion Gate:** staging.padhaanewala.in working; CI/CD automatic; load test passed; security scan clean.

> ⛔ **Phases 86–95 NOT STARTED — verified 28 Sep 2026.** No CI pipeline, staging, production, load test or security audit. All of Block O needs **M1 (AWS)** and **M2 (DNS)**, so none of it can start now. The backend is otherwise deployable-shaped: migrations apply cleanly to a single head and 225 tests run green.

### BLOCK P — Launch (Phases 96–105)
| # | Phase | Mandatory before | Done |
|---|---|---|---|
| 96 | Production deployment (migrations, seed, CDN) [DEV] | **Blocks A–O complete + M2 DNS + M5 legal published + M6 grievance officer published + M10 all YES** | ☐ |
| 97 | Smoke tests (homepage, search, college, login, enquiry, AI, mock test, admin) [DEV] | Phase 96 | ☐ |
| 98 | 24-hour monitoring [DEV] | Phase 97 | ☐ |
| 99 | Fix critical bugs [DEV] | Phase 98 | ☐ |
| 100 | Documentation (README, admin guide, deployment, env) [DEV] | Phase 99 | ☐ |
| 101 | Admin training [BOTH] | Phase 100 | ☐ |
| 102 | Handover (source, DB schema, credentials, docs) [DEV] | Phase 101 + **M10 credentials collected** | ☐ |
| 103 | 2-week stabilization [DEV] | Phase 102 | ☐ |
| 104 | Performance tuning [DEV] | Phase 103 | ☐ |
| 105 | Final sign-off [BOTH] | Phase 104 — **PROJECT DONE** | ☐ |

## NEXT ACTIONS — ranked by what actually unblocks the project (28 Sep 2026)

Replaces guesswork with a measured backlog. **Unblocked and small** first, because they are the only things that can progress before credentials land.

| # | Action | Phase | Size | Blocked? |
|---|---|---|---|---|
| 1 | Wire enquiry → lead + notification + student email | 25/36 | ~1 day | **No — do now.** Highest value per line of code: three routers already exist and are unused, and two completion gates fail without it. |
| 2 | Question-bank admin CRUD + seed a real mock test | 43/7 | ~1–2 days | **No — do now.** Without questions the whole mock-test engine is untested with real data. |
| 3 | NLP query parse for college search | 13 | ~2–3 days | No, but needs the 331 colleges to be sane first. |
| 4 | Real MSG91 + email credentials, then manual handset test | 3 | ~1 hour | **YES — M1, ~3 days out.** Also needs DNS SPF/DKIM for the sender domain. |
| 5 | Content: fees, cutoff, placement, NIRF, blog rows | 10/5 | ongoing | **YES — M4 CSVs.** Phase 65 gate is far from met (0 cutoff/placement rows). |
| 6 | Data-import API + fuzzy dedup + verification workflow | 56–64 | ~1 week | **YES — M4 CSVs** + Phases 27–34 admin UI. |
| 7 | Proctored exam system | 47–55 | ~2–3 weeks | **YES — S3 bucket** + genuinely finishing 42–46. Largest unbuilt block. |
| 8 | Parental-consent flow + 3-hour takedown | 76/77 | ~1 week | **YES — M6 Grievance Officer**; also a decision, not just code. |
| 9 | Monitoring, backup, DNS, GA4, WAF | 78–85 | ~1 week | **YES — M1 (Sentry/GA4/Cloudflare) + M2 (domain).** |
| 10 | CI/CD, staging, prod, load test, security audit | 86–95 | ~2 weeks | **YES — M1 AWS.** |

**Total unblocked work available today: ~4–6 days** (items 1–3). Everything else waits on a purchase, a dataset, or a decision.

## QUICK-REFERENCE: What MUST be done before each phase
| To start phase | You MUST already have |
|---|---|
| Phase 1 | M1 (GitHub), M3, dev tools installed |
| Phase 2 | Phase 1 |
| Phase 3 | Phases 1–2 + MSG91 & SendGrid credentials (M1) — **code done, only the credentials are outstanding** |
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
| Phase 27–30 | Phases 2, 11, 12, 14 |
| Phase 31–34 | Phases 27–30 + 25 |
| Phase 35 | Phases 27–30 + 8 |
| Phase 36 | Phases 3, 9, 25 |
| Phase 37 | Public pages live (Blocks D + E) |
| Phase 38–41 | Phases 5, 6, 10 + OpenAI key (M1) |
| Phase 42–46 | Phases 7 + 2 |
| Phase 47–55 | Phases 42–46 COMPLETE + S3 bucket (M1) |
| Phase 56–65 | Phases 11–14 + 27–34 + ALL CSVs ready (M4) |
| Phase 66–75 | Blocks A–L all complete |
| Phase 76–85 | Block M + M5 + M6 + Sentry/GA4/Cloudflare (M1) |
| Phase 86–95 | Blocks M + N + AWS prod access + DNS (M2) |
| Phase 96–105 | Blocks A–O + domain live + legal published + UAT + ALL credentials |

---

## NON-NEGOTIABLE RULES (from Section 109 + doc)
1. [M4] All data CSVs must be ready BEFORE Phase 59 — you cannot start data import without them.
2. [M6] Grievance Officer MUST be appointed + published before Phase 76 and is legally required BEFORE launch.
3. [M5] Legal pages MUST be drafted before Phase 76 and PUBLISHED before Phase 96.
4. Proctored exams (Phase 47) cannot start until standard mock tests (Phase 42–46) are fully working.
5. Predictor (Phase 24/40) cannot be built as "AI guessing" — it needs real cutoff data (Phase 10 table + Phase 56–63 import).
6. [M1] MSG91/SendGrid credentials must exist BEFORE developer starts Phase 3.
7. No phase may be skipped — every block's Completion Gate must be YES before the next block.