# Fix 02 T3.1 — Stakeholder Approval Register & Gate 0 Verification

**Status:** DOCUMENTATION & SINGLE-OWNER GOVERNANCE RECORD.
**Branch:** `security/H-08-pii-encryption`  
**Verified HEAD:** `5049ab1425a00bd31382ab21af472d36bf21ee57`  
**Proposed first cohort:** `lead_notes.note` only.

**Gate 0 status:** **BLOCKED — NOT SATISFIED.**  
**Owner Decision Counts for Gate 0:** `OWNER_APPROVED` 5 · `OWNER_REJECTED` 0 · `OWNER_CONDITIONAL` 0 · `OWNER_OPEN / PENDING` 1 (D-15).  
**Independent Review Counts for Gate 0:** `REVIEWED_APPROVED` 0 · `REVIEW_PENDING` 4 (A-01, D-01, D-02, D-03) · `REVIEW_NOT_REQUIRED` 2 (D-15, D-16).

> [!IMPORTANT]
> **Single-Owner Governance Standard:** The project owner (Adnaan) acts as the sole decision-maker for project scope, application architecture, technical implementation, release baseline, and project risk acceptance. Owner approval is **NOT** equivalent to an independent security review, independent privacy review, legal counsel advice, or formal regulatory compliance certification. Independent reviews for Security Architect and DPO/Legal remain explicitly marked `REVIEW_PENDING`. Gate 0 remains **BLOCKED**; zero source code changes, destructive actions, production key deployments, migrations, or production rollouts are permitted.

---

## 1. Evidence standard and search scope

### 1.1 Approval evidence standard

Per `docs/fix-02-pii-t3.0-approval-gate-packet.md` §5 and single-owner governance directives:
- Owner decisions may only be recorded where the owner has direct authority (Product Scope, Architecture, Technical Strategy, Baseline, and Risk Acceptance).
- Independent reviews (Security Architect, DPO/Legal, Cryptographic Evaluation) must remain `REVIEW_PENDING` unless separate genuine written evidence exists.
- D-15 (Database Migration) requires comprehensive schema, lock, timeout, rollback, and staging verification before owner approval; pending this evaluation, it remains `OWNER_OPEN / PENDING OWNER REVIEW`.
- Gate 0 remains **BLOCKED** from production implementation and code alteration until all prerequisite gates and reviews are fully satisfied.

### 1.2 Documents read and verified

- `docs/fix-02-pii-t3.0-approval-gate-packet.md`
- `docs/fix-02-pii-t2.3-approval-readiness.md`
- `docs/fix-02-pii-architecture-approval-matrix.md`
- `docs/fix-02-pii-encryption-final-plan-revision.md`
- `docs/adr-0009-pii-at-rest.md`
- `docs/fix-02-pii-encryption-primitives.md`
- `backend/app/models/enquiry.py` (verified table `lead_notes`, column `note: Text`)
- `backend/app/utils/pii_crypto.py` and `backend/tests/test_pii_crypto.py` (verified 41 tests passing)

---

## 2. Gate 0 decision register (Single-Owner Governance)

### 2.1 Summary table

| Decision ID | Required Role / Domain | Owner Decision | Owner Status | Independent Review Status | Gate Status |
|---|---|---|---|---|---|
| **A-01** | Scope: `lead_notes.note` single-cohort | Adnaan (Project & Product Owner) | `OWNER_APPROVED` | `REVIEW_PENDING` (DPO/Legal & Security Architect) | `CONDITIONAL / BLOCKED` |
| **D-01** | ADR-0009 scoped amendment | Adnaan (Application Architecture Owner) | `OWNER_APPROVED` | `REVIEW_PENDING` (Security Architect) | `CONDITIONAL / BLOCKED` |
| **D-02** | Service-layer crypto (reject TypeDecorator) | Adnaan (Technical Lead / Developer) | `OWNER_APPROVED` | `REVIEW_PENDING` (Security Architect) | `CONDITIONAL / BLOCKED` |
| **D-03** | `pe1` envelope and fixed AAD contract | Adnaan (Technical Lead & Risk Acceptor) | `OWNER_APPROVED` | `REVIEW_PENDING` (Cryptographic Specialist) | `CONDITIONAL / BLOCKED` |
| **D-15** | Expand-only migration (`note_enc`, etc.) | Adnaan (DB Operations Owner) | `OWNER_OPEN` | `REVIEW_NOT_REQUIRED` (Self-managed DB Ops) | `BLOCKED` |
| **D-16** | Baseline freeze at commit `5049ab1` | Adnaan (Release Owner / Operations) | `OWNER_APPROVED` | `REVIEW_NOT_REQUIRED` (Operational control) | `CONDITIONAL / BLOCKED` |

---

### 2.2 Decision A-01 — First-cohort field treatment

- **Decision ID:** A-01 / T2.2 field treatment
- **Decision-Maker:** Adnaan
- **Capacity / Role:** Project Owner & Product Owner
- **Date Recorded:** 2026-11-27
- **Owner Decision:** `OWNER_APPROVED`
- **Independent Review Status:** `REVIEW_PENDING` (No independent DPO, Legal counsel, or Security Architect review available).
- **Exact Decision & Scope:** The first implementation cohort is strictly restricted to `lead_notes.note`. Expansion to all other PII fields (such as `enquiries.mobile`, `enquiries.email`, `student_profiles`, parent data, or authentication tables) is explicitly rejected for this cohort.
- **Rationale:** Restricting to a single text field with no foreign keys, unique constraints, or search indexes provides an isolated, controlled domain to validate encryption/decryption mechanics without disrupting admissions pipelines, parent notifications, or core search filters.
- **Evidence Reviewed:** `docs/fix-02-pii-t3.0-approval-gate-packet.md` §2.1; `docs/fix-02-pii-architecture-approval-matrix.md` §1.2; schema verification of `LeadNote` in `backend/app/models/enquiry.py`.
- **Limitations & Outstanding Reviews:** This is an owner product-scope determination only. It does not certify regulatory compliance under DPDP Act 2023 or Rule 4 DPDP Rules 2025.

---

### 2.3 Decision D-01 — ADR-0009 scoped amendment

- **Decision ID:** D-01
- **Decision-Maker:** Adnaan
- **Capacity / Role:** Application Architecture Owner & Project Owner
- **Date Recorded:** 2026-11-27
- **Owner Decision:** `OWNER_APPROVED`
- **Independent Review Status:** `REVIEW_PENDING` (No external Security Architect review available).
- **Exact Decision & Scope:** Scoped amendment allowing field-level encryption exclusively on `lead_notes.note`. Does not supersede ADR-0009 for any other table or column. ADR-0009 remains fully in effect for all other PII data.
- **Rationale:** ADR-0009 deliberately withheld field encryption due to key management complexity and operational search impact. For counsellor notes, search/indexing is not required, making scoped field encryption viable while maintaining ADR-0009 protections elsewhere.
- **Evidence Reviewed:** `docs/adr-0009-pii-at-rest.md` lines 1–124; `docs/fix-02-pii-encryption-primitives.md` lines 7–11.
- **Limitations & Outstanding Reviews:** Formal independent security architecture sign-off is pending. The original ADR-0009 document is preserved historically.

---

### 2.4 Decision D-02 — Service-layer encryption versus `TypeDecorator`

- **Decision ID:** D-02
- **Decision-Maker:** Adnaan
- **Capacity / Role:** Technical Lead & Developer
- **Date Recorded:** 2026-11-27
- **Owner Decision:** `OWNER_APPROVED`
- **Independent Review Status:** `REVIEW_PENDING` (Security architecture review pending).
- **Exact Decision & Scope:** Encryption and decryption must be explicitly executed within the application service layer (`app/routers/leads.py`). The introduction of an automatic SQLAlchemy `TypeDecorator` or transparent ORM encryption is explicitly rejected. Authorisation and ownership checks must precede all decryption operations.
- **Rationale:** Explicit service-layer calls make cryptographic boundaries visible and testable, eliminate unexpected DB query side-effects, and prevent accidental plaintext leakage into logs or serialisation pipelines.
- **Evidence Reviewed:** `docs/fix-02-pii-encryption-final-plan-revision.md` §1.2; `docs/fix-02-pii-architecture-approval-matrix.md` §5.
- **Limitations & Outstanding Reviews:** Security architecture audit of call-site access control patterns remains pending.

---

### 2.5 Decision D-03 — Encryption envelope and fixed AAD contract

- **Decision ID:** D-03
- **Decision-Maker:** Adnaan
- **Capacity / Role:** Technical Lead & Risk Acceptor
- **Date Recorded:** 2026-11-27
- **Owner Decision:** `OWNER_APPROVED`
- **Independent Review Status:** `REVIEW_PENDING` (Independent cryptographic review pending).
- **Exact Decision & Scope:** Approved technical scheme:
  - Algorithm: AES-256-GCM.
  - Nonce: Fresh 96-bit cryptographically secure random nonce per encryption.
  - Tag: 128-bit authentication tag.
  - Versioned Envelope: `pe1.<base64url-no-padding(BODY)>`
  - Fixed Deterministic AAD: `padhaanewala|pii-aad|v1|lead_notes|note|{pii_context_id}|lead_note`
- **Rationale:** The `pe1` envelope binds key version, nonce, ciphertext, and tag in a compact format. Context-binding AAD prevents ciphertext relocation across records or tables.
- **Evidence Reviewed:** `backend/app/utils/pii_crypto.py`; `backend/tests/test_pii_crypto.py` (41/41 unit tests passing); `docs/fix-02-pii-encryption-primitives.md`.
- **Limitations & Outstanding Reviews:** Owner risk acceptance only. No independent formal mathematical or cryptographic proof/audit. Zero production secrets generated; development keys only.

---

### 2.6 Decision D-15 — Database migration pattern

- **Decision ID:** D-15
- **Decision-Maker:** Adnaan
- **Capacity / Role:** Database Operations Owner
- **Date Recorded:** 2026-11-27
- **Owner Decision:** `OWNER_OPEN / PENDING OWNER REVIEW`
- **Independent Review Status:** `REVIEW_NOT_REQUIRED` (Self-managed DB Operations).
- **Exact Decision & Scope:** D-15 is intentionally kept **OPEN / PENDING OWNER REVIEW**.
- **Rationale for Pending Status:** Although an expand-only migration (nullable `note_enc`, `pii_context_id`, and `pii_changed_at`) is conceptually designed:
  - The actual Alembic revision script has not been drafted or tested on an isolated staging database.
  - Lock timeout, statement timeout thresholds, and exact rollback scripts require dedicated pre-migration documentation and verification.
  - As per strict governance directives, D-15 must not be approved prematurely.
- **Evidence Reviewed:** `docs/fix-02-pii-t3.0-approval-gate-packet.md` §3.3; `backend/app/models/enquiry.py`.
- **Requirements to Close D-15:** Draft expand-only migration script, verify zero data mutation, test migration on isolated local database, and document rollback procedure.

---

### 2.7 Decision D-16 — Reconciled baseline acceptance

- **Decision ID:** D-16
- **Decision-Maker:** Adnaan
- **Capacity / Role:** Release Owner & Project Operations
- **Date Recorded:** 2026-11-27
- **Owner Decision:** `OWNER_APPROVED`
- **Independent Review Status:** `REVIEW_NOT_REQUIRED` (Operational control).
- **Exact Decision & Scope:** Acceptance of Git branch `security/H-08-pii-encryption` at commit `5049ab1425a00bd31382ab21af472d36bf21ee57` as the official starting baseline for controlled preparatory work.
- **Rationale:** Verified that local workspace matches the clean candidate commit HEAD with zero untracked production code differences.
- **Evidence Reviewed:** `git branch --show-current` (`security/H-08-pii-encryption`); `git rev-parse HEAD` (`5049ab1425a00bd31382ab21af472d36bf21ee57`).
- **Limitations & Outstanding Reviews:** Baseline acceptance applies exclusively to local development, staging verification, and preparation. It does NOT authorise production release, migration execution, or code merge.

---

## 3. Gate 0 determination

| Required Decision | Owner Decision Status | Independent Review Status | Gate 0 Status |
|---|---|---|---|
| **A-01** | `OWNER_APPROVED` | `REVIEW_PENDING` | `CONDITIONAL / BLOCKED` |
| **D-01** | `OWNER_APPROVED` | `REVIEW_PENDING` | `CONDITIONAL / BLOCKED` |
| **D-02** | `OWNER_APPROVED` | `REVIEW_PENDING` | `CONDITIONAL / BLOCKED` |
| **D-03** | `OWNER_APPROVED` | `REVIEW_PENDING` | `CONDITIONAL / BLOCKED` |
| **D-15** | `OWNER_OPEN / PENDING` | `REVIEW_NOT_REQUIRED` | `BLOCKED` |
| **D-16** | `OWNER_APPROVED` | `REVIEW_NOT_REQUIRED` | `CONDITIONAL / BLOCKED` |

**Gate 0 is BLOCKED and is NOT SATISFIED.**  
Because Decision D-15 remains `OWNER_OPEN / PENDING OWNER REVIEW` and independent reviews for A-01, D-01, D-02, and D-03 remain `REVIEW_PENDING`, the criteria for Gate 0 completion are strictly not met.

### Implementation Consequences:
- **STRICTLY BLOCKED:** No production migrations, no application source alterations in `app/routers/leads.py`, no database schema mutations, no production secret deployment, no plaintext backfills, and no plaintext deletion.
- **PERMITTED (Preparatory & Read-Only):** Non-destructive preparations such as drafting migration scripts for local staging review, preparing rollback checklists, running isolated unit tests, and refining documentation.
- **SEPARATE GATES:** Gate 5 (`D-14` read cutover) and `D-17` (destructive removal) remain separate future gates and are entirely unaffected.

Consequences:

- No source, model, route, test, migration, configuration, environment, key, database, HMAC, or deployment work is authorised by this register.
- The first-cohort recommendation remains `PROPOSED — NOT SAFE TO IMPLEMENT`.
- D-14 remains a separate later gate before encrypted read cutover; no approval evidence or rehearsal evidence was found for it.
- D-17 remains a separate destructive-change approval; it is not part of Gate 0 or the first cohort.

---

## 4. Stakeholder response template

Send this template separately to each required approver. Placeholders must be filled by the approver; do not fill them on the approver’s behalf.

```text
Subject: Fix 02 Gate 0 written decision required — [DECISION ID] — lead_notes.note cohort

To: [APPROVER ROLE] ([APPROVER NAME])

Context:
- Repository: Padhaanewala_Education/padhaanewala
- Branch: security/H-08-pii-encryption
- Verified HEAD: 5049ab1425a00bd31382ab21af472d36bf21ee57
- Proposed first cohort: lead_notes.note only
- This request is for a written decision only. No source, migration, key,
  database, or deployment action has been authorised by the request.

Decision requested:
- Decision ID: [A-01 / D-01 / D-02 / D-03 / D-15 / D-16]
- Question: [PASTE EXACT GATE 0 QUESTION FROM T3.0 SECTION 1.1]
- Exact scope: [PASTE EXACT SCOPE, INCLUDING FIELD, ENVELOPE/AAD, OR MIGRATION PATTERN]
- Requested disposition: APPROVE or REJECT. DEFER leaves Gate 0 BLOCKED.

Approver response fields:
- Approver role: [APPROVER ROLE]
- Approver name: [ACTUAL NAME]
- Decision: [APPROVE / REJECT / DEFER]
- Decision ID and scope: [EXACT ID AND SCOPE]
- Date: [ACTUAL DECISION DATE]
- Conditions: [EXPLICIT CONDITIONS OR "NONE RECORDED BY APPROVER"]
- Written reference: [LINK, TICKET, SIGNED ADR, MEETING RECORD, OR DOCUMENT PATH]
- Evidence checked by: [REVIEWER ROLE/NAME]

Important:
- A technical comment, recommendation, meeting note without a decision, or
  this request itself is not approval.
- Do not include key material, real PII, production data, or secrets.
- If any field above is missing, the decision remains OPEN and Gate 0 remains
  BLOCKED.
```

---

## 5. Recommended next action by outstanding approval

| Decision ID | Approver role | Recommended next action |
|---|---|---|
| A-01 | Security Architect + DPO/legal + Product owner | Circulate the exact `lead_notes.note`-only field-treatment request; obtain three written decisions that explicitly approve the single field and reject expansion to all other fields. |
| D-01 | Security Architect | Prepare a superseding ADR or narrow amendment to ADR-0009 for signature; obtain the signed ADR or written decision record before integrated encryption design work. |
| D-02 | Security Architect | Obtain architecture sign-off naming the service/mapper boundary and explicitly prohibiting SQLAlchemy `TypeDecorator`. |
| D-03 | Security Architect | Obtain a crypto design review approving the exact `pe1` envelope and the exact AAD `padhaanewala|pii-aad|v1|lead_notes|note|{pii_context_id}|lead_note`; do not add purposes by inference. |
| D-15 | DBA owner | Obtain written approval of the expand-only migration for nullable `note_enc`, `pii_context_id`, and `pii_changed_at`, with no index and no concurrent-index operation, plus the applicable lock/timeout/rollback criteria and staging evidence. |
| D-16 | Release owner / product-operations | Issue and sign a precondition checklist accepting the reconciled baseline at `5049ab1425a00bd31382ab21af472d36bf21ee57`, with verified HEAD, report hashes, and Alembic head recorded in the written reference. |

After all six written approvals are verified, Gate 0 must be recomputed from the referenced evidence. Until then, the only safe action is collecting approvals.

---

## 6. Coverage limitations and exclusions

- Investigation was read-only; this document is the only new file created by T3.1.
- No source, test, migration, model, route, configuration, environment file, or existing report was modified.
- No database, secret, production system, deployed log, runtime trace, browser state, vendor console, or real PII was accessed.
- No HMAC, encryption integration, key generation, key rotation, migration, or deployment was performed.
- No git staging, commit, push, merge, rebase, reset, stash, or deploy was performed.
- Signed approval records, a DPO/legal decision register, DBA staging lock metrics, backup/restore rehearsal evidence, and secret-manager configuration were not available in the searched project documentation.
- No approver name, date, signature, decision, condition, or written evidence reference was invented.
