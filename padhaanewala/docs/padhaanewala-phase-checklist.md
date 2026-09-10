# PADHAANEWALA — MASTER PHASE CHECKLIST + MANDATORY PREREQUISITES
Generated from: `padhaanewala-complete.md` (Master Plan V5.0)

## STATUS UPDATE — Last reviewed: 11 September 2026 (re-verified against project code)

**Current progress: 1 of 105 phases (Phase 1 is ~90% complete). All development blocks B–P not started.**

> Re-verified 11 Sep 2026: Docker stack live (PostgreSQL 15 on host port 5433 + Redis 7), `alembic upgrade head` applied against Docker PG, `/health` → 200. Homepage built with placeholder data (Phase 16 workfront, API-swap later). Backend has `/health` endpoint only (no models/routers/tables yet). Blocks B–P confirmed NOT STARTED.

### Completed so far
- ☑ **M1 (GitHub account)** — private repo `Padhaanewala_Education` created, connected, code pushed. Other accounts (AWS, OpenAI, MSG91, SendGrid, Sentry, Cloudflare, GA4, Search Console) **PENDING**.
- ☑ **M3 (Developer engaged)** — developer working; master doc handed over; repo `main` + `develop` branches active.
- ◐ **Phase 1 (Setup Environment) — PARTIAL (~90%)**

### Recently added (design/dev prep for upcoming phases — no phase gates passed)
- ☑ `DESIGN.md` added — frontend design system reference (colors, typography) for Phase 16 (homepage/layout)
- ☑ Tailwind 4 docs + web-design-guidelines skills added — dev tooling prep for Phase 16–18 (frontend build)
- ☑ Docker Desktop installed (v29.7.2) + WSL2/Virtual Machine Platform enabled — verified running 11 Sep 2026
- ☑ **Port conflict resolved** — native Windows PostgreSQL 16 owns port 5432, so Docker PG 15 now publishes on host port **5433** (docker-compose.dev.yml, `.env.development`, `config.py` updated to match)

### Phase 1 — what's DONE ✅
- ☑ Folder structure: `frontend/`, `backend/`, `docs/`, `scripts/` created
- ☑ `docker-compose.dev.yml` created (PostgreSQL 15 + Redis 7)
- ☑ `.env.example` written (139-env template: DB, Redis, JWT, email, SMS, S3, AI, proctoring)
- ☑ `.gitignore` created
- ☑ `README.md` with setup instructions
- ☑ Frontend scaffolded: Next.js + React + TypeScript + Tailwind (stock `create-next-app`)
- ☑ Backend scaffolded: FastAPI + `main.py` `/health` endpoint + `config.py` + `database.py`
- ☑ `requirements.txt` (35 packages) + Alembic initialized (`alembic.ini`, `env.py`)
- ☑ Git repo initialized, `main`/`develop` branches, code pushed to GitHub
- ✅ `npm install` / `node_modules` — DONE (358 packages, 0 vulnerabilities; `next build` passes)
- ✅ `.env.development` — DONE (created, settings load from it, dev DB/Redis creds match docker-compose)
- ✅ Python `venv` + backend deps — DONE (venv created, requirements installed, uvicorn serves `GET /health` → HTTP 200 `{"status":"ok"}`)
- ✅ `alembic/versions/` — DONE (base revision `80137954d5c1` created AND applied)
- ✅ **Homepage built** — stock "Create Next App" page replaced with a full Padhaanewala homepage: hero + search bar, quick-action cards, popular courses, featured colleges (fee/placement), scholarships, upcoming exams, mock tests, why-us, reviews, articles, admission CTA, WhatsApp button, sticky header + mobile menu, footer. Placeholder data in `frontend/src/data/home.ts` (will switch to APIs at Phases 11–16). `next build` + ESLint pass; renders HTTP 200.
- ✅ **Docker stack verified against real PostgreSQL/Redis** — `docker compose up -d` runs `postgres:15` (host port 5433) + `redis:7-alpine` (6379, `PONG`); `alembic upgrade head` + `alembic current` = `80137954d5c1` (head) on Docker PG; DB `alembic_version` = `80137954d5c1`; node v24.20.0 / Python 3.12.10 / git 2.55.0 / Docker 29.7.2 confirmed.

### Phase 1 — what's REMAINING ❌ (blocks completion gate)
- ❌ **Code not yet pushed to `develop`** — homepage (`frontend/src/app/page.tsx`, `layout.tsx`, `frontend/src/components/`, `frontend/src/data/`), `backend/alembic/versions/`, port-remap changes (`docker-compose.dev.yml`, `.env.development`, `backend/app/config.py`), and updated `docs/` are UNCOMMITTED on `main`. Stage + commit → push to `develop`.
- ❌ Completion Gate not confirmed → **do not proceed to Phase 2 until verified**

### Next action
- ⛔ Phase 2 (Users, Auth, Roles) is BLOCKED until Phase 1 Completion Gate = YES.

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
| 1 | Setup Environment [BOTH] | **M1 (GitHub), M3** + Node 18, Python 3.11, Docker, Git, VS Code installed. Domain NOT required yet. | ◐ PARTIAL (~65%) — see Status Update above |

**Completion Gate:** node/python/git/docker verified ✅; private GitHub repo `padhaanewala` ✅; `docker compose up` runs PostgreSQL+Redis ✅; backend `/health` returns OK ✅; frontend loads at localhost:3000 ✅; code pushed to `develop` ❌ **PENDING COMMIT+PUSH**. → **NOT YET PASSED — Phase 2 is BLOCKED.**

### BLOCK B — Database Layer 1 (Phases 2–10)
| # | Phase | Mandatory before | Done |
|---|---|---|---|
| 2 | Users, Auth, Roles [DEV] | Phase 1 | ☐ |
| 3 | Email, SMS, OTP [BOTH] | Phase 2 + **M1 (MSG91 + SendGrid/SES credentials BEFORE developer starts)** | ☐ |
| 4 | States, Districts, Universities [DEV] | Phase 1 (*parallel* with 2, 3) | ☐ |
| 5 | Colleges, Courses, Fees [DEV] | Phase 4 (college → state/district/university FK) | ☐ |
| 6 | Scholarships, Exams [DEV] | Phase 4 (*parallel* with 5) | ☐ |
| 7 | Mock Tests, Questions [DEV] | Phase 5 (→course) + Phase 6 (→exam) | ☐ |
| 8 | Reviews, Blogs, FAQs, Media, SEO, Notif., Audit [DEV] | Phase 2 + Phase 5 | ☐ |
| 9 | Enquiries, Leads, Saved, Consent [DEV] | Phase 2 + Phase 5 | ☐ |
| 10 | Placement, NIRF, Cutoff, Seat Matrix [DEV] | Phase 5 + Phase 6 | ☐ |

**Completion Gate:** all tables migrated via Alembic; user/login works at API level; OTP arrives on a real phone; 28 states + 8 UTs + ~780 districts seeded; college/scholarship/exam tables accept sample data.

### BLOCK C — Backend APIs (Phases 11–14)
| # | Phase | Mandatory before | Done |
|---|---|---|---|
| 11 | College CRUD API [DEV] | Phase 2 + Phase 5 | ☐ |
| 12 | Course, Scholarship, Exam APIs [DEV] | Phase 6 (+ Phase 11 patterns) | ☐ |
| 13 | Search Engine (text + filters + NLP) [DEV] | Phase 11 | ☐ |
| 14 | Placement, Cutoff, NIRF APIs [DEV] | Phase 10 | ☐ |

**Completion Gate:** admin can create colleges; public search with filters works; NLP parse works; placement/cutoff/NIRF queryable; templates passed.

### BLOCK D — Frontend Core (Phases 15–18)
| # | Phase | Mandatory before | Done |
|---|---|---|---|
| 15 | Login, Register, OTP Pages [DEV] | Phase 2 + Phase 3 | ☐ |
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
| 25 | Enquiry, Lead APIs [DEV] | Phase 9 | ☐ |
| 26 | Enquiry Form, WhatsApp, Static Pages [DEV] | Phase 25 + Phase 16 | ☐ |

**Completion Gate:** dashboard shows saved colleges/tests/enquiries; compare 2–4 colleges works; predictor shows Dream/Safe/Moderate with disclaimer; enquiry creates a lead admin can see.

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
| 36 | Notifications, Email, SMS [DEV] | Phase 3 + Phase 9 + Phase 25 | ☐ |
| 37 | SEO: sitemap, robots, structured data [DEV] | Public pages live (Block D + E) | ☐ |

**Completion Gate:** enquiry → student email + admin alert; notification bell shows unread; sitemap validates; structured data passes Google Rich Results test.

### BLOCK I — AI System (Phases 38–41)
| # | Phase | Mandatory before | Done |
|---|---|---|---|
| 38 | RAG Knowledge Pipeline [DEV] | Phase 5 + Phase 6 (data sources) | ☐ |
| 39 | AI Chat API + Safety [DEV] | Phase 38 + **M1 (OpenAI key)** | ☐ |
| 40 | College Predictor (cutoff-based) [DEV] | Phase 10 (cutoffs) + Phase 38/39 | ☐ |
| 41 | Frontend AI Chat Widget [DEV] | Phase 39 | ☐ |

**Completion Gate:** "What is BHMS?" answers with source; "BHMS colleges in Karnataka" lists DB colleges with sources; predictor categorized with disclaimer; AI never invents data.

### BLOCK J — Mock Test System (Phases 42–46)
| # | Phase | Mandatory before | Done |
|---|---|---|---|
| 42 | Test listing + instructions [DEV] | Phase 7 + Phase 2 | ☐ |
| 43 | Question bank admin [DEV] | Phase 42 | ☐ |
| 44 | Test interface — DESKTOP ONLY [DEV] | Phase 43 | ☐ |
| 45 | Results page [DEV] | Phase 44 | ☐ |
| 46 | Test admin (create test) [DEV] | Phase 43 | ☐ |

**Completion Gate:** full test completes end-to-end; answers auto-save; auto-submit on timeout; mobile shows "desktop only" message.

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

### BLOCK M — Security, Performance, Testing (Phases 66–75)
| # | Phase | Mandatory before | Done |
|---|---|---|---|
| 66–75 | Security headers, rate limiting, validation, error handling, DB perf, Redis cache, Lighthouse >90, mobile audit, WCAG 2.1 AA, cross-browser | **Blocks A–L COMPLETE (hardens everything)** | ☐ |

**Completion Gate:** Lighthouse >90; no horizontal scroll; security headers active; rate limits on all endpoints; accessibility checklist passes.

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

---

## QUICK-REFERENCE: What MUST be done before each phase
| To start phase | You MUST already have |
|---|---|
| Phase 1 | M1 (GitHub), M3, dev tools installed |
| Phase 2 | Phase 1 |
| Phase 3 | Phases 1–2 + MSG91 & SendGrid credentials (M1) |
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