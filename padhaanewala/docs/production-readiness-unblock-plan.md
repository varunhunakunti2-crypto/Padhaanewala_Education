# Padhaanewala — Production Readiness Unblock Plan

**Status:** `BLOCKING — NOT AN APPROVAL — DOCUMENTATION ONLY`  
**Purpose:** Define the exact evidence required to move from:

```text
Ready production path — no
Safe to write production implementation — not yet
```

to:

```text
Ready production path — yes
Safe to write production implementation — yes
```

This document does **not** approve any decision. It does not authorise source, test, model, route, schema, migration, config, env, secret, key, database, backfill, cutover, deletion, deployment, or production changes.

---

## 1. Current verified position

| Item | Current value |
|---|---|
| Branch | `security/H-08-pii-encryption` |
| HEAD | `5049ab1425a00bd31382ab21af472d36bf21ee57` |
| Alembic head | `f4a1c6d8e902` — single head |
| Fix 02 master status | `BLOCKED` |
| T0 / T0.1 / T1 | `COMPLETE` |
| T2 / T3 / T4 / T5 | `BLOCKED` |
| Backend full suite (last recorded) | `920 passed, 1 skipped, 3 warnings` |
| T1 primitive suite | `41 passed` |
| Deployment state | Not deployed; Phase 8 in `Pending-phases.md` is recorded as descoped/not started |

### 1.1 Evidence conflict that must be reconciled

Three documents do not agree about Gate 0:

| Document | Current claim |
|---|---|
| `docs/fix-02-master-completion-report.md` | Approval register hash `236199A8...`; Gate 0 `APPROVED 0 · OPEN 6` |
| `docs/fix-02-pii-t3.0-approval-gate-packet.md` | All decisions `OPEN` |
| `docs/fix-02-pii-t2.3-approval-readiness.md` | All eighteen D-decisions `OPEN` |
| `docs/fix-02-pii-t3.1-approval-register.md` | Owner decisions: 5 recorded `OWNER_APPROVED`; D-15 `OWNER_OPEN`; independent reviews pending |

Current SHA-256 of `docs/fix-02-pii-t3.1-approval-register.md`:

```text
7F67C3BB7D4ACBDA6DA1A706DA2928672D0CFDDC97CD533EC3E253819EB1923E
```

This differs from the hash recorded in the master report. The conflict must be resolved by verifying written evidence, not by choosing whichever document is more convenient. No existing report may be overwritten; a new reconciliation report must be created after verification.

### 1.2 Current Gate 0 determination

Under the current T3.1 register:

```text
Gate 0: BLOCKED — NOT SATISFIED
Owner decisions: OWNER_APPROVED 5 · OWNER_OPEN 1
Independent reviews: REVIEWED_APPROVED 0 · REVIEW_PENDING 4
```

Blocked items:

| Decision | Blocker |
|---|---|
| A-01 | Independent DPO/legal and Security Architect review pending |
| D-01 | Independent Security Architect review pending |
| D-02 | Independent Security Architect review pending |
| D-03 | Independent cryptographic/security review pending |
| D-15 | Owner decision open/pending; no expand-only migration evidence |
| D-16 | Recorded owner-approved, but master report conflict remains unresolved |

Therefore, integrated encryption, schema work, migrations, key deployment, backfill, read cutover, plaintext deletion, and production deployment remain unauthorised.

---

## 2. What “make it” actually requires

Production readiness is not a single code change. It is a set of gates. Each gate needs written evidence from the required approver.

### 2.1 Gate 0 — required before any source/model/route/test/schema/migration/config work

| ID | Required approver role | Written decision required | Current state |
|---|---|---|---|
| A-01 | Security Architect + DPO/legal + Product owner | Approve `lead_notes.note` as the only first-cohort `ENCRYPT` field; reject expansion to other fields | Independent reviews pending |
| D-01 | Security Architect | Approve scoped amendment/supersession of ADR-0009 | Independent review pending |
| D-02 | Security Architect | Approve explicit service-layer encryption; reject SQLAlchemy `TypeDecorator` | Independent review pending |
| D-03 | Security Architect / cryptographic reviewer | Approve exact `pe1` envelope and fixed AAD contract | Independent review pending |
| D-15 | DBA owner | Approve expand-only migration pattern with lock/timeout/rollback criteria and staging evidence | Open/pending |
| D-16 | Release owner / Product Operations | Accept baseline at `5049ab1` and reconcile conflicting report hashes | Owner-approved in T3.1, but conflict unresolved in master report |

An approval is valid only when it contains all of:

```text
Decision ID
Exact decision value: APPROVE / REJECT / DEFER
Approver name
Approver role
Date
Rationale and conditions
Traceable written reference
Evidence reviewer/checker
```

The following are **not** approvals:

- task instructions;
- “pass all blocked one”;
- architecture documents;
- ADRs by themselves;
- passing tests;
- silence;
- chat requests;
- this plan;
- a draft register entry filled in by anyone other than the approver.

### 2.2 Gate 5 — required before encrypted read cutover

| ID | Required approver role | Written decision required |
|---|---|---|
| D-14 | Operations/key custodian + DPO/legal | Backup retention, key custody, restore rehearsal, isolated smoke-test evidence, and zero-PII log evidence |

No D-14 evidence is available. Even if Gate 0 is later closed, encrypted reads must not become authoritative until D-14 is satisfied.

### 2.3 Later destructive gate

| ID | Required approver role | Written decision required |
|---|---|---|
| D-17 | Security Architect + DPO/legal + DBA owner | Destructive removal of legacy plaintext `note` and fallback code |

D-17 must remain separate. It must never be bundled with T2.

### 2.4 Production deployment / operations approval

Required before any production rollout:

```text
Named release owner
Named operations owner
Approved production release ref
Production go/no-go decision date
Domain decision
Backup/restore evidence reference
Monitoring/alert evidence reference
Rollback approval
Explicit statement that production data and secrets were not used in chat/test reports
```

This is currently absent.

---

## 3. D-15 closure requirements

D-15 is the database migration gate. It cannot be closed by opinion alone.

Required evidence:

1. Exact expand-only Alembic revision design:
   - nullable `note_enc`;
   - nullable `pii_context_id`;
   - nullable `pii_changed_at`;
   - no index;
   - no concurrent-index operation;
   - no data mutation in the migration;
   - no destructive downgrade after dual-write begins.

2. Single Alembic head verified immediately before revision creation.

3. Isolation statement:
   - local/disposable/staging database only;
   - no production database;
   - no real PII;
   - no production keys.

4. Lock and timeout criteria:
   - statement timeout;
   - lock timeout;
   - expected table size;
   - expected duration;
   - abort/rollback thresholds.

5. Rollback procedure:
   - exact commands;
   - conditions under which rollback is allowed;
   - confirmation that columns are not dropped while deployed code depends on them.

6. Staging verification evidence:
   - migration applied successfully;
   - rollback rehearsed where permitted;
   - schema verified;
   - zero row mutation;
   - application health preserved.

Only after this evidence exists can the DBA owner record a written `APPROVE`.

---

## 4. Product/domain decisions required by `hh.md`

`hh.md` says:

```text
Website: padhaanewala.in
Production domain: padhaanewala.in
```

Your deployment decision was:

```text
padhaanewala.com as canonical
www.padhaanewala.com also served
padhaanewala.in redirects to .com
```

`hh.md` also says architectural deviations affecting SEO, security, data ownership, admin control, or future expansion must be discussed and approved before implementation.

Therefore, a written domain decision is required:

```text
Decision: .com canonical / .in redirect
Approver: Product owner / founder
Date: [actual date]
Rationale: [actual rationale]
SEO canonical URL: https://padhaanewala.com
Cookie domain: [approved value]
Sitemap canonical base: [approved value]
Written reference: [ticket / signed note / document path]
```

After that, update the specification through a new amendment document. Do not silently overwrite `hh.md`.

---

## 5. Deployment readiness track

`docs/Pending-phases.md` records Phase 8 as descoped and states that nothing is deployed. To make production ready, Phase 8 must be reopened by written owner decision.

Required evidence before production:

| Area | Required evidence |
|---|---|
| Cloudflare | Real-client-IP handling verified; origin only accepts Cloudflare ranges; Full Strict SSL |
| Secrets | AWS Secrets Manager/SSM injection verified; no secrets in Git/chat/logs |
| Backups | Automated backup + off-host encrypted copy + documented retention |
| Restore | Restore rehearsal completed on isolated environment |
| Monitoring | Uptime, CPU, memory, disk, container restart, backup failure alarms |
| WAF | Managed rules, login/OTP rate limits, bot controls reviewed |
| Email/SMS | Real providers verified with synthetic test recipients |
| Legal | Named Grievance Officer configured; legal pages real, not placeholders |
| Scale | Load test against 50k+ registered-user profile and expected peak concurrency |
| Deployment | Approved release ref, smoke tests, rollback tested |
| Security | Dependency audit, SAST/DAST or equivalent, PII log scan |
| Go/no-go | Named person signs production approval |

Recommended production architecture for the stated scale is not single EC2 + Compose. Use managed services where possible:

```text
Cloudflare WAF/CDN
AWS ALB
ECS Fargate or EKS
RDS PostgreSQL Multi-AZ
ElastiCache Redis
S3 + CloudFront
Secrets Manager / SSM
CloudWatch + alarms
```

---

## 6. Implementation sequence after gates are satisfied

Do not reorder this sequence.

1. Reconcile conflicting approval/report evidence in a new report.
2. Close Gate 0 with verified written evidence.
3. Re-run read-only baseline verification.
4. Create new phase report showing Gate 0 complete; do not overwrite old reports.
5. T2: implement only `lead_notes.note` service-layer encryption.
6. T3: only with separate explicit HMAC/search approvals; exact-match only, never substring search.
7. T4: only with exact expand-only migration and backfill approvals.
8. D-14: prove backup/key custody/restore before encrypted read cutover.
9. T5: only after T2/T3/T4 and D-14; D-17 separately for plaintext removal.
10. Reopen Phase 8, deploy staging, verify, then production go/no-go.

---

## 7. Safe work available now

The following are allowed:

- read-only verification;
- preparing approval requests;
- preparing this closure plan;
- identifying missing evidence;
- preparing written decision templates;
- reconciling document conflicts in a **new** report;
- planning D-15 evidence collection without changing migrations or database.

The following are not allowed yet:

- editing source, tests, models, routes, schemas, migrations, config, env, secrets, keys;
- creating or applying migrations;
- running backfill;
- switching encrypted reads on;
- deleting plaintext;
- deploying;
- changing Cloudflare/AWS live configuration;
- marking T2–T5 complete;
- inventing approval names, dates, decisions, or references.

---

## 8. Decision needed from the owner

To proceed, the owner must supply actual written decisions. A short chat message such as “approve all” is not sufficient under the recorded evidence standard.

Minimum response format for each decision:

```text
Decision ID: [A-01 / D-01 / D-02 / D-03 / D-15 / D-16 / D-14 / D-17 / D-18 / DEPLOY / DOMAIN]
Approver name: [actual name]
Approver role: [actual role]
Decision: APPROVE / REJECT / DEFER
Exact scope approved: [exact wording]
Date: [actual date]
Rationale: [actual rationale]
Conditions: [explicit conditions or NONE RECORDED]
Written reference: [link / ticket / signed document / file path]
Evidence checked by: [name and role]
```

Until those written decisions are supplied and verified, the correct status remains:

```text
Ready production path — no
Safe to write production implementation — not yet
```

---

## 9. Current action taken

Only this new document was created:

```text
docs/production-readiness-unblock-plan.md
```

No source, test, model, route, schema, migration, config, env, secret, key, database, backfill, cutover, deletion, deployment, Cloudflare, or AWS change was made.
