# Padhaanewala — Collegedunia-Parity Production Plan

**Status:** `PLANNING ONLY — NOT APPROVAL — NOT IMPLEMENTATION`  
**Benchmark reviewed:** `https://collegedunia.com/`  
**Review date:** 2026-11-27  
**Canonical domain decision currently recorded in runbook:** `padhaanewala.com`  
**Conflict to resolve:** `docs/hh.md` says `padhaanewala.in` is the production domain.

This document defines what is required to make Padhaanewala comparable to a large production education portal like Collegedunia. It does not deploy anything, copy anything, or authorise code, database, secret, migration, or infrastructure changes.

---

## 1. Benchmark observations

The public Collegedunia homepage shows a mature content/data platform, not a simple website.

Observed sections include:

- global search for colleges, exams, courses and locations;
- large college catalogue claims: **19,000+ colleges**;
- study-goal groups with thousands of colleges per group;
- course pages with college counts and average fees;
- exam pages, exam dates, application process, syllabus, results and practice material;
- college predictor for JEE Main, JEE Advanced, CUET, CAT, NEET, GATE, NMAT, TS EAMCET and AYUSH counselling;
- college comparison;
- course finder;
- ranking tables from many agencies;
- large review corpus with ratings and review counts;
- news, article and admission-alert publishing;
- scholarship content;
- study-abroad country sections;
- Q&A and test series;
- newsletter;
- mobile app links;
- legal/footer infrastructure.

The key lesson: **data depth and freshness matter more than UI alone**.

---

## 2. Current Padhaanewala position

The repository already has the right platform shape:

- Next.js frontend;
- FastAPI backend;
- PostgreSQL;
- Redis;
- admin panel;
- RBAC;
- college/course/exam/scholarship structures;
- enquiry and counsellor lead flows;
- mock tests;
- AI endpoints;
- SEO basics;
- legal/DPDP scaffolding;
- audit logging;
- Docker production topology.

But the recorded live data position is far below the benchmark:

| Area | Benchmark | Current recorded position |
|---|---|---|
| Colleges | 19,000+ claimed | Around 10 in tracker |
| Reviews | Thousands | Feature exists, volume not ready |
| Rankings | Many agencies | Partial schema, data incomplete |
| Predictor | Many exams | Basic foundation |
| News/articles | Daily publishing | CMS needed at scale |
| Study abroad | Full country hubs | Not part of current launch scope |
| Programmatic SEO | Very large | Basic only |
| Infrastructure | CDN, caching, search, scale | Staging Compose only |

---

## 3. Critical rule

Build a **Padhaanewala equivalent category platform**, not a copy of Collegedunia.

Do not copy:

- their logo;
- their site design assets;
- their articles;
- their images;
- their data dumps;
- their reviews;
- their rankings text;
- their metadata;
- their code.

Use original design, original copy, and verified data from legitimate sources.

---

## 4. Parity workstreams

### Workstream A — Domain and launch decisions

Required before public launch:

```text
Canonical domain: padhaanewala.com or padhaanewala.in
Secondary domain redirects
SEO canonical base URL
Cookie domain
Sitemap base URL
Legal entity name
Named Grievance Officer
Data owner / DPO contact
Production owner
```

Current blockers:

- `hh.md` says `.in`;
- deployment runbook uses `.com`;
- no written reconciliation exists.

### Workstream B — Data foundation

Target sequence:

```text
1,000 verified colleges
→ 3,000 verified colleges
→ 5,000 verified colleges
→ 10,000+ verified colleges
→ 19,000+ only with long-term verification process
```

Do not chase the count first. Chase verified, useful records.

Minimum college record quality:

- unique college ID;
- official name;
- common name;
- university;
- state/district/city;
- address and pincode;
- official website;
- official email/phone where available;
- courses;
- fees with period;
- eligibility;
- admission process;
- entrance exams;
- cutoffs;
- rankings;
- facilities;
- hostel;
- images with source and licence;
- data source;
- verification status;
- last verified date;
- verified by.

### Workstream C — Course and exam data

Required for parity:

- engineering, management, medical, law, commerce, science, arts, pharmacy, nursing, paramedical;
- exam pages for JEE, NEET, CUET, CAT, GATE, CLAT, MAT, XAT, NMAT, state entrances;
- application dates;
- admit card/result dates;
- syllabus;
- official links;
- FAQs;
- eligibility;
- participating colleges;
- cutoff history.

### Workstream D — SEO architecture

Required:

- clean slug structure;
- canonical URL on every indexable page;
- meta title and description;
- Open Graph metadata;
- structured data;
- XML sitemap;
- robots.txt;
- internal linking;
- breadcrumb structure;
- no thin/duplicate programmatic pages;
- indexable pages only when they contain genuinely useful data.

Recommended page families:

```text
/college/{slug}
/university/{slug}
/courses/{course-slug}
/{course}-colleges
/{course}-colleges-in-{state}
/{course}-colleges-in-{city}
/exams/{exam-slug}
/scholarships/{slug}
/articles/{slug}
/college-compare/{slug-a}-vs-{slug-b}
```

### Workstream E — Product parity modules

Existing foundation should be hardened and expanded:

- global search;
- advanced college filters;
- natural-language search mapped to structured filters;
- save college;
- compare college;
- AI college predictor;
- AI education assistant;
- review submission and moderation;
- scholarship finder;
- exam hub;
- mock tests;
- admission enquiry;
- counsellor lead management;
- admin CMS;
- analytics;
- newsletter/subscription;
- Q&A.

Explicitly not first-launch parity items unless separately approved:

- paid counselling;
- payments;
- study abroad country hubs;
- mobile app;
- push notifications;
- multilingual support.

### Workstream F — Production infrastructure

For 50k+ students and Collegedunia-like traffic growth:

```text
Cloudflare CDN/WAF
AWS ALB
ECS Fargate or EKS
RDS PostgreSQL Multi-AZ
ElastiCache Redis
S3 + CloudFront for images/media
OpenSearch only when PostgreSQL search is no longer enough
Secrets Manager / SSM
CloudWatch alarms and dashboards
Automated backups + restore rehearsal
CI/CD with protected production release
```

Single EC2 + Docker Compose is acceptable for staging, not final scale.

### Workstream G — Security and compliance

Cannot be skipped:

- Fix 02 Gate 0 closure;
- T2–T5 completion;
- Cloudflare real-client-IP handling;
- secrets injection;
- WAF/rate limits;
- backup/restore evidence;
- no PII in logs;
- admin 2FA where possible;
- audit logs;
- legal pages with real information;
- named Grievance Officer;
- production go/no-go approval.

---

## 5. Phased rollout

### Phase CD-0 — Decisions

Exit when:

- domain decision is written;
- data sources are approved;
- content ownership is assigned;
- production owner is named;
- security gate owner evidence is filed.

### Phase CD-1 — Staging launch

Exit when:

- staging deployed;
- synthetic users can register/login;
- admin can create content;
- sample college/course/exam pages render;
- no secrets in logs;
- DNS-only Cloudflare verified.

### Phase CD-2 — 1,000-college data foundation

Exit when:

- 1,000 colleges have source and verification metadata;
- duplicate detection passes;
- search/filter pages work;
- college pages have useful content;
- no thin indexable pages.

### Phase CD-3 — SEO and content engine

Exit when:

- sitemap generated;
- canonical URLs correct;
- structured data valid;
- article workflow verified;
- review moderation verified;
- internal link graph exists.

### Phase CD-4 — Predictor and exam expansion

Exit when:

- predictor has verified cutoff/rank data for approved exams;
- estimate disclaimers are displayed;
- exam hub dates are maintained through admin;
- AI does not invent factual college data.

### Phase CD-5 — Scale infrastructure

Exit when:

- managed DB and cache are live;
- autoscaling verified;
- media served from object storage/CDN;
- monitoring/alerts tested;
- load test passed.

### Phase CD-6 — Production go-live

Exit when:

- all security gates are closed;
- restore rehearsal passed;
- production smoke tests passed;
- rollback tested;
- written go/no-go approval recorded.

---

## 6. Acceptance criteria for “Collegedunia-like enough”

Do not claim parity until all are true:

- [ ] at least 1,000 verified college records;
- [ ] clean course taxonomy;
- [ ] exam hub with verified dates;
- [ ] college compare;
- [ ] scholarship finder;
- [ ] review moderation;
- [ ] predictor with transparent estimates;
- [ ] programmatic SEO with no thin pages;
- [ ] sitemap and structured data;
- [ ] admin-managed content;
- [ ] lead enquiry funnel;
- [ ] counsellor dashboard;
- [ ] mobile responsiveness;
- [ ] fast Core Web Vitals;
- [ ] WAF, rate limits and monitoring;
- [ ] backup/restore rehearsal;
- [ ] no unresolved Fix 02 production blockers.

---

## 7. Current action

This document is created as a planning artifact only.

No source code, database records, migrations, secrets, deployment configuration, AWS resources, Cloudflare settings, or production changes were created by this document.

Created file:

```text
docs/collegedunia-parity-production-plan.md
```
