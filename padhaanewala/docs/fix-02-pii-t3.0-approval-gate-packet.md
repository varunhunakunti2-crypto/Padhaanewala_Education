# Fix 02 T3.0 — Approval-Gate Packet

**Status:** DOCUMENTATION ONLY — NOT AN APPROVAL. This packet requests decisions from the named owners. It does not approve, reject, defer, implement, migrate, rotate keys, deploy, or alter any decision register.

**Proposed cohort:** `lead_notes.note` only.

**Branch:** `security/H-08-pii-encryption`  
**Baseline HEAD:** `5049ab1425a00bd31382ab21af472d36bf21ee57`

**Decision state:** all D-01–D-18 decisions and architecture decisions A-01–A-06 remain `OPEN`. No approver name, date, signature, decision, or written reference is available in the repository. No value below has been filled in with a fabricated approval.

---

## 1. Decision requested from the approvers

The owners are being asked to decide whether the single-field `lead_notes.note` encryption cohort may proceed through the staged implementation described in `docs/fix-02-pii-t2.3-approval-readiness.md`.

**Implementation is not authorised by this packet.** Source-affecting work must not start until Gate 0 in §3 is complete with written evidence. Encrypted read cutover must not start until D-14 evidence exists. Destructive plaintext removal is excluded and requires D-17.

### 1.1 Gate 0 — required before any source, model, route, test, migration, or config work

| Reference | Decision required | Owner(s) | Requested disposition | Status |
|---|---|---|---|---|
| A-01 / T2.2 field treatment | Accept `lead_notes.note` as the only first-cohort `ENCRYPT` field and reject expansion to other fields | Security Architect + DPO/legal + Product owner | APPROVE or REJECT the narrow field treatment | OPEN |
| D-01 | Supersede or narrowly amend ADR-0009 so integrated field-level encryption is no longer blocked | Security Architect | APPROVE with written scope, or REJECT | OPEN |
| D-02 | Approve explicit service-layer encryption; reject a SQLAlchemy `TypeDecorator` | Security Architect | APPROVE service layer / REJECT `TypeDecorator` | OPEN |
| D-03 | Approve the T1 `pe1` envelope and fixed AAD contract for `lead_notes.note` | Security Architect | APPROVE or REJECT the exact AAD binding | OPEN |
| D-15 | Approve an expand-only migration with no concurrent index for this cohort | DBA owner | APPROVE or REJECT the migration pattern | OPEN |
| D-16 | Formally record acceptance of the reconciled baseline at `5049ab1` | Release owner / product-operations | APPROVE or REJECT the precondition record | OPEN |

### 1.2 Gate 5 — required before encrypted read cutover only

| Reference | Decision required | Owner(s) | Requested disposition | Status |
|---|---|---|---|---|
| D-14 | Confirm backup retention, key custody, restore rehearsal, and isolated smoke-test evidence | Operations/key custodian + DPO/legal | APPROVE or REJECT the restore-readiness evidence | OPEN |

### 1.3 Separate later decision — not part of first-cohort implementation

| Reference | Decision required | Owner(s) | Requested disposition | Status |
|---|---|---|---|---|
| D-17 | Authorise destructive removal of legacy plaintext `note` and fallback code | Security Architect + DPO/legal + DBA owner | DEFER to a separate change; do not bundle with read cutover | OPEN |

### 1.4 Explicitly deferred or not required for this cohort

D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12, D-13, and D-18 remain `OPEN` for later phases. They are not decisions to approve for `lead_notes.note`:

- D-04/D-06: no HMAC lookup token, equality leakage, uniqueness token, or lookup rotation is in scope.
- D-05: no OTP purpose or normalization change is in scope.
- D-07/D-08: no restricted search or counsellor-scope redesign is in scope.
- D-09/D-10/D-11/D-12/D-13: no child-data, consent-text, IP, audit-JSON, browser, email, or SMS processor change is in scope.
- D-18: no production key generation or rotation is in scope.

---

## 2. Exact scope and exclusions

### 2.1 Included scope

| Item | Exact value or path |
|---|---|
| Table.column | `lead_notes.note` |
| Current storage | `Text`, NOT NULL; no index, unique constraint, FK, partial search, or exact lookup dependency |
| Model | `backend/app/models/enquiry.py`, `LeadNote.note` |
| Write path | `backend/app/routers/leads.py`, `add_lead_note` (`POST /api/v1/leads/{enquiry_id}/notes`) |
| Read mapper | `backend/app/routers/leads.py`, `_lead_query` and `_to_detail` |
| Detail read entry points | `get_lead`, `update_lead_status`, `assign_lead`, `set_follow_up`, `update_lead_details` |
| Schema | `backend/app/schemas/engagement.py`, `AddLeadNoteRequest.note` and `LeadNoteResponse.note`; API remains plaintext to authorised callers |
| Proposed new columns | `note_enc` as `Text`, `pii_context_id` as immutable UUIDv4, `pii_changed_at` as timestamp |
| Primitive | Existing T1 `backend/app/utils/pii_crypto.py`; no T1 source change is proposed |
| AAD | Exactly: `padhaanewala\|pii-aad\|v1\|lead_notes\|note\|{pii_context_id}\|lead_note` |
| Envelope | T1 `pe1.<base64url-no-padding(BODY)>` with key-version byte, 96-bit nonce, ciphertext, and 128-bit tag |
| Migration | Expand-only Alembic revision; nullable columns; no data mutation; no index; no destructive downgrade after dual-write |
| Flags | Field-scoped dual-write, backfill, and read-source flags only |

Exact AAD string, shown outside Markdown table escaping:

```text
padhaanewala|pii-aad|v1|lead_notes|note|{pii_context_id}|lead_note
```

### 2.2 Explicit exclusions

The first cohort must not include:

- Any `users.email`, `users.mobile`, OTP identifier, guardian contact, or HMAC lookup token.
- Any login, password reset, OTP purpose, mobile/email verification, or session/refresh-token change.
- Any student profile, enquiry identity/contact, counsellor identity, consent text, IP address, audit JSON, DSAR field, review, notification, or college-submission field.
- Any `ILIKE`, restricted-search endpoint, cursor, search-session, counsellor-scope, or result-cap work.
- Any UI contract change, ciphertext exposure, token exposure, CSV export of notes, notification copy of notes, or browser `localStorage` write of note text.
- Any plaintext drop, fallback removal, destructive migration, production key generation, production key rotation, secret printing, database access, or deployment.
- Any modification of protected TestSprite reports, T1 files, T2.2/T2.3 reports, ADR-0009, or the final plan.

---

## 3. What each approver is being asked to do

All entries below are requested actions only. No action has been taken by an approver.

### 3.1 Security Architect

| Action | Requested decision |
|---|---|
| APPROVE | D-01 narrow ADR-0009 supersession/amendment; D-02 explicit service-layer encryption; D-03 `pe1` envelope and `lead_notes\|note\|lead_note` AAD; A-01 for this one field. |
| REJECT | SQLAlchemy `TypeDecorator`; arbitrary AAD purposes; HMAC inclusion in this cohort; key material in source, env files, logs, exception text, or repository; custom crypto replacing T1. |
| DEFER | D-04, D-05, D-06, D-11, D-17, and D-18 to their separate phases. |

### 3.2 DPO / legal

| Action | Requested decision |
|---|---|
| APPROVE | A-01 treatment of `lead_notes.note` as low-risk write-only staff free text; D-14 retention/custody evidence before read cutover. |
| REJECT | Expansion to minor data, guardian fields, consent text, IP addresses, browser keys, processor logs, or exported note text. |
| DEFER | D-04 equality-leakage risk, D-09–D-13 secondary-copy/retention decisions, and D-17 destructive removal. |

### 3.3 DBA owner

| Action | Requested decision |
|---|---|
| APPROVE | D-15 expand-only schema pattern for nullable `note_enc`, `pii_context_id`, and `pii_changed_at`; no index and no concurrent-index operation for this cohort. |
| REJECT | Dropping or downgrading new columns after dual-write begins; any destructive table rewrite; any unapproved lock/timeout pattern. |
| DEFER | D-06 lookup-index rotation and D-17 destructive removal. |

### 3.4 Infrastructure / key custodian

| Action | Requested decision |
|---|---|
| APPROVE | D-14 staging-only backup/key custody and restore-rehearsal evidence before read cutover; key-version labels only, never key values. |
| REJECT | Key generation, rotation, printing, sharing, or storage in source, `.env`, tickets, logs, or chat; use of production data or production keys for rehearsal. |
| DEFER | D-18 production key rotation and any production deployment. |

### 3.5 Product / operations

| Action | Requested decision |
|---|---|
| APPROVE | A-01 narrow field scope; D-16 precondition record; no API or UI contract change; notes remain excluded from CSV export and browser storage. |
| REJECT | Adding notes to search, exports, notifications, student-side state, or any other field in the first cohort. |
| DEFER | D-07 search-session semantics, D-08 counsellor-scope redesign, D-12 browser minimisation, secondary-copy remediation, and operational soak thresholds beyond the stated criteria. |

---

## 4. Risks, rollback, backup/restore, and verification

### 4.1 Risks that remain unresolved

1. No approval evidence exists; all decisions remain `OPEN`.
2. ADR-0009 still records field-level encryption as deliberately not implemented.
3. T1 primitives exist but are not integrated into application code.
4. `pii_context_id` generation, immutability, and backfill behaviour must be proven before ciphertext is authoritative.
5. Key custody and secret-manager naming are unresolved; no key material has been requested or accessed.
6. `note` is not currently in audit redaction's sensitive-key list. There is no current note-audit call, but future callers must not copy note text into audit payloads (D-11 remains open for later remediation).
7. Runtime secondary copies cannot be proven absent by static review alone; runtime logs and browser state were not inspected.
8. Plaintext rollback is only available while `lead_notes.note` is retained.
9. No tests were run for this documentation task.

### 4.2 Rollback approach

| Stage | Rollback |
|---|---|
| Expand only | Reverse the nullable-column migration in staging before dual-write. Do not drop columns used by deployed code. |
| Dual-write | Disable the field-scoped dual-write flag; plaintext remains authoritative. |
| Backfill | Pause the job; retain partial ciphertext; do not cut over reads. |
| Verification failure | Keep read flag off; repair context/ciphertext; rerun verification. |
| Read cutover | Flip the field-scoped read flag back to `note` while plaintext is retained. |
| Key-version issue | Revert to the previous configured key version by flag/configuration; never print key values. |
| Destructive removal | No application rollback; approved restore only, and only after D-17. |

### 4.3 Backup and restore implications

- Rehearsal must use staging-like or disposable data and staging/disposable keys only.
- No production dump, production database, production key, or production service may be used.
- Evidence required before read cutover under D-14: encrypted dump checksum, isolated restore log, key custody boundary, key-version labels only, decryptability counts, zero-PII log assertion, and lead-note workflow smoke results.
- Restore smoke tests must prove authorised add/read of lead notes, counsellor/admin scope, assigned-lead access, unassigned denial, and rollback to plaintext.
- No backup or restore operation was performed while preparing this packet.

### 4.4 Verification criteria before read cutover

| Area | Pass criteria |
|---|---|
| Approval evidence | Gate 0 evidence recorded; D-14 evidence recorded before read cutover. |
| Migration | Single Alembic head verified immediately before revision creation; expand/rollback passes in staging. |
| Crypto | T1 suite passes; canonical envelope, fresh nonce, wrong-key, wrong-context, tamper, and unknown-version tests pass. |
| AAD | Correct `lead_notes` / `note` / `lead_note` / immutable context binding succeeds; wrong table, column, purpose, context, or key fails closed. |
| Dual-write | Plaintext and ciphertext consistency verified; plaintext remains authoritative until cutover. |
| Backfill | 100% row coverage; rerun changes zero rows; context IDs present, immutable, and unique. |
| Workflow | Existing `test_pii_crypto.py`, `test_phase9.py` lead lifecycle and counsellor scope, `test_admin_access.py`, `test_rbac_rules.py`, and `test_counsellor_provisioning.py` behaviour preserved. |
| Proposed regression tests | Dedicated lead-note encryption, workflow, backfill, and secondary-copy tests are created and pass after approval. |
| Secondary copies | No note text in audit JSON, CSV export, notification payload, observability event, error text, URL, or browser `localStorage`. |
| Cutover | Zero decrypt/AAD failures; rollback flag tested; zero cross-scope lead-note reads. |
| Soak | No PII leakage, no decrypt failure, no workflow regression, no unapproved field added. |

---

## 5. Evidence required to record any approval

An approval may be recorded only when all of the following are present:

| Field | Required content |
|---|---|
| Approver role | Exact role from D-01–D-18 or A-01, for example Security Architect or DBA owner |
| Approver name | Actual named person; must not be inferred |
| Decision | `APPROVE`, `REJECT`, or `DEFER`, with the exact decision ID and scope |
| Date | Actual decision date |
| Conditions | Explicit conditions or `NONE RECORDED BY APPROVER` |
| Written approval reference | Link, ticket, signed ADR, meeting record, or document path containing the decision |
| Evidence checked by | Reviewer role/name confirming the referenced evidence |
| Recorded status | Must remain `OPEN` until the written reference is verified |

No approver name, decision, date, signature, condition set, or written approval reference was supplied for this packet. None has been invented.

---

## 6. Decision register template — first-cohort view

Status is `OPEN` for every row. Placeholder values are intentionally unfilled.

| ID | Approver | First-cohort question | Requested action | Status | Approver name | Decision | Date | Conditions | Written approval reference |
|---|---|---|---|---|---|---|---|---|---|
| A-01 | Security Architect + DPO/legal + Product owner | Encrypt only `lead_notes.note` | APPROVE or REJECT field treatment | OPEN | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NONE RECORDED]` | `[NOT PROVIDED]` |
| D-01 | Security Architect | Supersede/narrowly amend ADR-0009 | APPROVE or REJECT | OPEN | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NONE RECORDED]` | `[NOT PROVIDED]` |
| D-02 | Security Architect | Use service-layer encryption, not `TypeDecorator` | APPROVE service layer / REJECT `TypeDecorator` | OPEN | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NONE RECORDED]` | `[NOT PROVIDED]` |
| D-03 | Security Architect | Accept T1 envelope and `lead_note` AAD | APPROVE or REJECT | OPEN | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NONE RECORDED]` | `[NOT PROVIDED]` |
| D-04 | Security Architect + DPO/legal | HMAC exact-lookup tokens and equality leakage | DEFER from first cohort | OPEN | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NONE RECORDED]` | `[NOT PROVIDED]` |
| D-05 | Security Architect | Preserve OTP purpose and normalization | DEFER from first cohort | OPEN | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NONE RECORDED]` | `[NOT PROVIDED]` |
| D-06 | Security Architect + DBA owner | Lookup-key rotation with shadow columns | DEFER from first cohort | OPEN | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NONE RECORDED]` | `[NOT PROVIDED]` |
| D-07 | Product owner | Search session and cursor semantics | DEFER from first cohort | OPEN | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NONE RECORDED]` | `[NOT PROVIDED]` |
| D-08 | Product owner + DPO/legal | Counsellor scope rules | DEFER redesign; preserve current behaviour | OPEN | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NONE RECORDED]` | `[NOT PROVIDED]` |
| D-09 | DPO/legal | Child-data plaintext exceptions | DEFER from first cohort | OPEN | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NONE RECORDED]` | `[NOT PROVIDED]` |
| D-10 | DPO/legal | Consent text and audit IP retention | DEFER from first cohort | OPEN | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NONE RECORDED]` | `[NOT PROVIDED]` |
| D-11 | DPO/legal + Security Architect | Legacy audit JSON remediation | DEFER from first cohort | OPEN | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NONE RECORDED]` | `[NOT PROVIDED]` |
| D-12 | DPO/legal + Product owner | Browser `localStorage` minimisation | DEFER from first cohort | OPEN | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NONE RECORDED]` | `[NOT PROVIDED]` |
| D-13 | Legal/vendor owner | Email/SMS processor retention | DEFER from first cohort | OPEN | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NONE RECORDED]` | `[NOT PROVIDED]` |
| D-14 | Operations/key custodian + DPO/legal | Backup key custody and restore evidence | APPROVE or REJECT before read cutover | OPEN | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NONE RECORDED]` | `[NOT PROVIDED]` |
| D-15 | DBA owner | Expand-only migration pattern | APPROVE or REJECT before schema work | OPEN | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NONE RECORDED]` | `[NOT PROVIDED]` |
| D-16 | Release owner / product-operations | Formal reconciliation precondition record | APPROVE or REJECT before implementation | OPEN | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NONE RECORDED]` | `[NOT PROVIDED]` |
| D-17 | Security Architect + DPO/legal + DBA owner | Destructive plaintext removal | DEFER to separate change | OPEN | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NONE RECORDED]` | `[NOT PROVIDED]` |
| D-18 | Security Architect + Operations/key custodian | Production key rotation | DEFER from first cohort | OPEN | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NOT PROVIDED]` | `[NONE RECORDED]` | `[NOT PROVIDED]` |

---

## 7. Stop conditions

Stop and do not begin implementation if any of the following is true:

- Any Gate 0 status remains `OPEN` or lacks written evidence.
- A-01 is expanded beyond `lead_notes.note`.
- D-14 evidence is absent at read cutover.
- D-17 is treated as part of the first cohort.
- Any secret, real PII, production data, production system, or deployed environment is accessed.
- Any HMAC, restricted search, OTP, auth, guardian, DSAR, audit, notification, export, browser, env, deployment, or migration work is added without its own approval.
- Git status changes beyond the single new document created for this task.

---

## 8. Human-review position

- `lead_notes.note` remains the recommended first-cohort candidate.
- The recommendation remains `PROPOSED — NOT SAFE TO IMPLEMENT`.
- All approvals remain `OPEN`.
- This document is an approval-gate packet only and is **not itself an approval**.
- The next safe action is to collect the written decisions listed in §1 and §6, not to change code, migrations, keys, databases, or production systems.
