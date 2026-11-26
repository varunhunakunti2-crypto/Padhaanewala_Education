# Fix 02 T2.3 — Approval Readiness & First Encryption Cohort

**Status:** INVESTIGATION AND DOCUMENTATION ONLY. This report prepares a decision-ready first-cohort recommendation. It does not implement encryption, HMAC, search, migrations, key handling, browser clearing, retention changes, or deployment changes.

**Branch:** `security/H-08-pii-encryption`  
**Baseline HEAD:** `5049ab1425a00bd31382ab21af472d36bf21ee57`

**Approval evidence:** none found in the repository. No decision in this document is marked `APPROVED`.

---

## 0. Required-document review and evidence status

### 0.1 Documents read

| Requested document | Availability | Result |
|---|---|---|
| `docs/fix-02-pii-encryption-final-plan-revision.md` | Found | Read in full. Corrected A–G plan; D-01–D-18 all recorded `[OPEN]`. |
| `docs/fix-02-pii-pii-encryption-primitives.md` | **Not found at this exact path** | The doubled `pii-` path does not exist. Actual file located and read: `docs/fix-02-pii-encryption-primitives.md`. |
| `docs/fix-02-pii-architecture-approval-matrix.md` | Found | Read in full. T2.2 field treatments, HMAC matrix, restricted-search architecture, decision register. |
| `docs/ADR-0009*` | No uppercase-name match | Actual file located and read: `docs/adr-0009-pii-at-rest.md`. ADR status is `IMPLEMENTED (partial, deliberate)`; Decision 2 explicitly did **not** implement field-level encryption for `student_profiles` / `enquiries`. |

### 0.2 Evidence labels

- `CONFIRMED` — observed directly in repository files or read-only command output during T2.3.
- `PROPOSED` — design recommendation; not implemented and not approved.
- `OPEN` — unresolved decision or missing evidence.
- `NOT SAFE TO IMPLEMENT` — blocked by one or more OPEN decisions.

### 0.3 What was and was not available

Available: source models, schemas, routers, services, scripts, migrations, frontend references, existing tests, and the four planning/ADR documents listed above.

Not available: signed approval records, DPO/legal decision register, DBA staging lock metrics, backup/restore rehearsal evidence, secret-manager configuration or key names, vendor DPA/retention evidence, runtime traces, live database schema introspection, production data, deployed logs, and browser runtime traces. These gaps are reported rather than guessed.

---

## 1. Revalidated decision register D-01 to D-18

All eighteen decisions remain `OPEN`. The corrected plan and T2.2 matrix agree on the owners; T2.3 adds an implementation-phase classification. No approval evidence exists in the repository.

| ID | Decision | Required approver | Revalidated status | Evidence found | T2.3 classification | First-cohort impact |
|---|---|---|---|---|---|---|
| D-01 | Supersede ADR-0009 partial-encryption decision | Security Architect | OPEN | None. ADR-0009 still says Decision 2 was not implemented and gives conditions to revisit it. | **Critical blocker — all integrated encryption** | Blocks any encrypted storage integration, including the recommended cohort. T1 primitives do not supersede the ADR. |
| D-02 | Explicit service-layer encryption over SQLAlchemy `TypeDecorator` | Security Architect | OPEN | None. T1 primitives exist but are unused by application code. | **Critical blocker — all integrated encryption** | Blocks the field service/mapper design needed for the cohort. |
| D-03 | AES envelope format and fixed AAD allowlist | Security Architect | OPEN | T1 documents `pe1` envelope and allowlist, but records production integration as blocked. | **Critical blocker — all integrated encryption** | Must explicitly approve `lead_notes` / `note` / `lead_note` AAD binding before coding. |
| D-04 | HMAC exact-lookup tokens and equality leakage | Security Architect + DPO/legal | OPEN | None. No application HMAC lookup-token implementation found. | HMAC blocker / later phase | **Not needed by recommended cohort**; required before `users.email`, `users.mobile`, OTP identifier, or guardian contact fields are encrypted. |
| D-05 | Preserve OTP purpose handling and normalization | Security Architect | OPEN | Current OTP normalizers exist; no compatibility sign-off found. | HMAC/OTP blocker / later phase | No first-cohort impact; preserved by not touching OTP paths. |
| D-06 | Lookup-key rotation with shadow columns | Security Architect + DBA owner | OPEN | None. No rotation rehearsal evidence found. | HMAC blocker / later phase | No first-cohort impact; cohort has no lookup columns. |
| D-07 | Search session/cursor semantics | Product owner | OPEN | Restricted-search endpoints not found in source; only planning documents describe them. | Search blocker / later phase | No first-cohort impact because lead notes are not searchable today and are not proposed for substring search. |
| D-08 | Counsellor scope rules | Product owner + DPO/legal | OPEN | Existing `_can_access` uses `assigned_counsellor_id`; no new scope approval found. | Search/CRM blocker / later phase | First cohort must preserve current `_can_access` behaviour exactly; no scope redesign allowed. |
| D-09 | Child-data plaintext exceptions | DPO/legal | OPEN | None. ADR records minors/enquiries as residual risk; no new legal decision found. | Later-phase data-classification blocker | No first-cohort impact unless a later cohort includes minor/student/enquiry identity fields. |
| D-10 | Consent text and audit IP retention | DPO/legal | OPEN | None. `audit_logs.ip_address` remains deliberately retained in ADR-0009. | Later-phase consent/audit blocker | No first-cohort impact; consent text and IP fields are rejected from the first cohort. |
| D-11 | Legacy audit JSON remediation | DPO/legal + Security Architect | OPEN | `app/utils/audit.py` redacts named keys to depth 3; no scan/backfill decision found. | Later-phase audit blocker | Lead-note writes do not call `audit.record`; still a risk if future code passes a `note` payload to audit. |
| D-12 | Browser `localStorage` minimisation | DPO/legal + Product owner | OPEN | `cp_*` keys are listed in frontend legal text; no new approval found. | Later-phase browser-copy blocker | No admin lead-note `localStorage` key was observed; runtime confirmation unavailable. |
| D-13 | Email/SMS processor retention | Legal/vendor owner (with Operations + DPO/legal for log remediation) | OPEN | No DPA/vendor retention evidence found. | Later-phase processor-log blocker | No lead-note email/SMS path found. |
| D-14 | Backup key custody and retention | Operations/key custodian + DPO/legal | OPEN | No rehearsal evidence or approved secret-manager names found. | **Read-cutover blocker** | Dual-write/backfill may be designed, but encrypted read cutover must not proceed until custody and restore evidence exist. |
| D-15 | Concurrent-index pattern and thresholds | DBA owner | OPEN | Corrected plan requires DBA approval; no staging lock metrics found. | **Schema/migration blocker** | Recommended cohort adds no index, but DBA approval is still required before its expand migration. |
| D-16 | Branch reconciliation execution | Release owner / product-operations | OPEN in register | Factual state: current HEAD is `5049ab1`; formal sign-off evidence not found. | Precondition, factually complete but not formally approved | Does not block documentation; should be recorded before implementation gate. |
| D-17 | Destructive plaintext removal | Security Architect + DPO/legal + DBA owner | OPEN | None. | Separate destructive-change blocker | Explicitly excluded. Plaintext `lead_notes.note` must remain until separate approval. |
| D-18 | Production key rotation | Security Architect + Operations/key custodian | OPEN | None. T1 explicitly rotates nothing. | Later-phase production-secret blocker | No first-cohort impact; use staged/disposable keys only when implementation is authorised. |

**APPROVED count: 0. OPEN count: 18.**

### 1.1 Critical blockers

1. D-01 — ADR-0009 supersession by Security Architect.
2. D-02 — service-layer encryption architecture sign-off by Security Architect.
3. D-03 — envelope and AAD design review by Security Architect.
4. D-15 — migration pattern approval by DBA owner before schema work.
5. D-14 — backup/key custody and restore evidence before encrypted read cutover.

### 1.2 First-cohort blockers

For the recommended single-field cohort, the blockers are D-01, D-02, D-03, D-15, and the field-treatment sign-off described in T2.2 A-01 (Security Architect + DPO/legal + Product owner). D-14 blocks the later read-cutover step, not the design/expand stage.

### 1.3 Later-phase decisions

D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12, D-13, D-17, and D-18 are later-phase decisions. They are not required for the recommended cohort because it has no HMAC lookup, substring search, OTP, guardian, consent-text, IP, browser, processor-log, destructive, or production-rotation dependency.

---

## 2. Candidate evaluation

### 2.1 Selection rule

A first-cohort candidate must satisfy all of the following:

- No exact lookup, unique index, HMAC, or authentication dependency.
- No `ILIKE` / partial-search dependency.
- No OTP, guardian-consent, child-policy, or restricted-search dependency.
- A single, enumerable write path and a single, enumerable read path where possible.
- A T1 purpose allowlist value already exists for the field.
- Secondary copies are understood, or absent.
- Rollback is a flag flip while plaintext remains authoritative.

### 2.2 Candidate dossier

| Candidate | Model / field and current storage | Read/write paths observed | Secondary copies | Migration implications | Required tests | First-cohort decision |
|---|---|---|---|---|---|---|
| `lead_notes.note` | `backend/app/models/enquiry.py:91-104`; `Text`, NOT NULL; no index, unique, FK, or search dependency; T1 purpose `lead_note` already allowlisted. Migration origin: `backend/alembic/versions/8cc76261fbc7_add_enquiries_leads_saved_colleges_.py:87-97`. | Write: `backend/app/routers/leads.py:156-173` (`POST /leads/{id}/notes`) directly creates `LeadNote`; no service/CRUD layer and no `audit.record` call. Reads: `_lead_query:55-63` (`selectinload`), `_to_detail:77-100`, `get_lead:143-154`, and all detail-returning PATCH routes at `leads.py:175-312`. Frontend: `frontend/lib/api.ts:2311-2316`; `frontend/frontend/components/admin/sections/LeadsSection.tsx:1002,1369-1377`. | No audit copy on note write; `delete_lead` audit at `leads.py:330-338` copies only name/mobile/status. Lead CSV export at `LeadsSection.tsx:251-278` excludes notes. No notification service reference found. Admin note state is React state; no `cp_*` localStorage key was observed for admin notes. Runtime logs not inspected. | Add nullable `note_enc` (Text, sized for ciphertext expansion), immutable `pii_context_id` (UUIDv4), and `pii_changed_at`; no lookup columns and no concurrent index. Keep `note` authoritative during dual-write. No destructive drop. | T-CRYPT, T-AAD, T-WF, T-SECOND, T-RET. Existing: `backend/tests/test_phase9.py:210-255`, `test_rbac_rules.py:448`, `test_admin_access.py:90`. Proposed: dedicated lead-note encryption regression file. | **RECOMMENDED — PROPOSED, NOT SAFE TO IMPLEMENT until D-01/D-02/D-03/D-15 and field-treatment sign-off.** |
| `consent_records.consent_text` | `backend/app/models/consent.py:9-18`; `Text`, NOT NULL; purpose `consent_record` allowlisted. | Writes: `auth.py:238-249`, `consent.py:49-55`, `compliance.py:157-161,376-384,435-439`. Reads: `consent.py:28-33`, DSAR/consent views via `_consent_response`. Frontend `consent_text` references in `frontend/lib/api.ts` and consent UI. | T2.2 lists `AUDIT` and `BROWSER`; exact runtime copy set not fully traceable from static review. | No lookup column needed, but multiple writers and DSAR/consent retention semantics must be reconciled. | T-WF, T-AUDIT, T-RET, T-SECOND. | **REJECT for first cohort.** Multiple writers and unresolved D-10 retention decision. |
| `guardian_consents.consent_text` | `backend/app/models/guardian_consent.py:65`; `Text`, NOT NULL; purpose `guardian_consent` allowlisted. | Writes: `compliance.py:274` and `compliance.py:381`. Read through `_consent_response` and guardian/DSAR views. | `AUDIT`; guardian workflow copies possible. | No lookup column, but guardian lifecycle and child-data classification are unresolved. | T-WF, T-RET, T-AUDIT. | **REJECT for first cohort.** Guardian workflow and D-09/D-10 dependency. |
| `data_requests.resolution` | `backend/app/models/data_request.py:84`; `Text`, NULL; purpose `data_request` allowlisted. | Read: `compliance.py:89-115` (`_request_response`), `/requests`, `/requests/{id}`, `/admin/requests`. Write: `compliance.py:648-698` (`PATCH /admin/requests/{id}` sets `resolution`). Frontend: `DataRequestsSection.tsx:82-118,266-279`; `api.ts:3144,3213`. | Staff React state; audit row at `compliance.py:686-695` records only status. T2.2 lists `BROWSER` and `EXPORT` for DSAR rows. | No lookup/index needed, but DSAR SLA and staff-queue behaviour must be preserved. | T-WF, T-RET, T-SECOND. | **REJECT for first cohort.** DSAR workflow is explicitly in scope for preservation and should move only as a dedicated cohort. |
| `student_profiles.education_level`, `course_interest`, `preferred_state`, `preferred_city`, `budget_min`, `budget_max` | `backend/app/models/user.py:122-127`; `String`/`Numeric`, NULL; purpose `student_profile` allowlisted. | Writes: `users.py:70-101` (`PUT /me`), `auth.py:231-232` at registration (name only for profile), `scripts/retention_sweep.py:280-285` anonymisation. Reads: `users.py:51-67`, `frontend/lib/api.ts:1265-1272`. Admin user search `users.py:172-181` uses email/mobile/profile name, not these fields. | T2.2 lists `BROWSER`; ADR-0009 explicitly says `preferred_state` was filtered on when deciding against deterministic encryption. | Would need context/ciphertext fields and a verified decision about any historical filtering behaviour; retention sweep writes would need decryption-safe anonymisation. | T-WF, T-RET, T-SEARCH, T-SECOND. | **REJECT for first cohort.** ADR-0009 records a filter dependency not fully reconciled by the current code; dependencies are not understood well enough. |
| `enquiries.city`, `qualification`, `message` | `backend/app/models/enquiry.py:39-41`; `String(100)`/`Text`, NULL; purpose `enquiry` allowlisted. | Writes: `enquiries.py:50` and `leads.py:285-312`. Reads: `leads.py:36-53`, `_to_detail`, and frontend lead/admin views. | T2.2 lists `AUDIT`, `BROWSER`, `EXPORT`, `NOTIF`; notification copies are known plaintext. | No lookup on these columns, but CRM/counsellor workflow and notification-copy remediation are unresolved. | T-WF, T-SEARCH, T-SECOND. | **REJECT for first cohort.** CRM/notification dependency and D-08/D-12 boundary. |
| `college_submissions.submitter_notes`, `reviewer_notes` | `backend/app/models/college_submission.py`; `Text`, NULL; purpose `college_submission` allowlisted. | Writes/reads in `backend/app/routers/college_submissions.py`; frontend `SuggestCollegePanel.tsx` and `CollegeSubmissionsSection.tsx`; tests `test_college_submissions.py`. | T2.2 lists `AUDIT`, `BROWSER`, `EXPORT`; reviewer decisions and duplicate hints surround the same workflow. | No lookup on notes themselves, but submission fuzzy/exact-duplicate redesign (D-04/D-07) is unresolved. | T-WF, T-SEARCH, T-SECOND. | **REJECT for first cohort.** Workflow sits next to unresolved duplicate/fuzzy-search design. |
| Write-only IP fields (`consent_records.ip_address`, `guardian_consents.request_ip`, `otp_records.request_ip`, `refresh_tokens.request_ip`, `enquiries.ip_address`) | `String(45)`, NULL; purposes `audit_ip` / `refresh_token_ip` allowlisted. | Written through shared `client_ip(request)` helpers in auth/consent/OTP/leads/compliance paths; generally not returned except audit/IP views. | `AUDIT`, `OTPLOG`, `OBS`, `REDIS` per T2.2. | No lookup needed, but each belongs to an auth, OTP, guardian, audit, or CRM workflow with unresolved retention/forensics decisions. | T-CRYPT, T-AAD, T-RET, T-SECOND. | **REJECT for first cohort.** Sits inside workflows the objective explicitly says to preserve; D-10/D-11 unresolved. |
| `admins.department`, `counsellors.specialization` | `backend/app/models/user.py:146,160`; `String(255)`, NULL. | `department`: model + seed script only (`seed_admin.py:145`); no application read path found. `specialization`: read at `counsellors.py:45` and `CounsellorsSection.tsx:146`; write path not fully traced in application code. | T2.2 lists `AUDIT`/`BROWSER`/`EXPORT` for staff records. | Complete write-path mapping is unavailable from static review; treatment cannot be validated by workflow tests. | T-WF, T-SEARCH, T-SECOND. | **REJECT for first cohort.** Dependencies/read-write paths are not fully understood. |
| `notifications.title`, `message`, `data` | `backend/app/models/notification.py`; no T1 notification purpose in allowlist. | Notification service/router writes and frontend inbox reads. | `NOTIF`, `BROWSER`, `EMAIL`, `EXPORT`, `OBS`. | Would require source-copy redesign rather than field encryption; no approved AAD purpose. | T-SECOND, T-WF. | **REJECT for first cohort.** DEFER treatment; no allowlisted purpose. |

### 2.3 Explicit rejections due to HMAC or search dependency

The following are **not** first-cohort candidates and must not be opportunistically included:

- `users.email`, `users.mobile` — confirmed HMAC, unique lookup, login, reset, admin `ILIKE`, and secondary-copy dependencies.
- `otp_records.identifier` — OTP rate limit, supersede, prune, and latest-live exact lookup.
- `guardian_consents.guardian_email`, `guardian_mobile`, `verification_target` — guardian/OTP reconciliation and exact equality.
- `data_requests.subject`, `details` — exact duplicate check on free text; HMAC decision is uncertain.
- `college_submissions.proposed_name`, `proposed_university_name` — exact plus fuzzy duplicate behaviour.
- `audit_logs.ip_address`, `audit_logs.old_value`, `new_value` — forensic retention and audit-search dependencies.

HMAC tokens support exact equality only. They must not be represented as substring-search solutions.

---

## 3. Recommended first cohort

### 3.1 Recommendation

**Recommend one field only: `lead_notes.note`.**

Status: `PROPOSED — NOT SAFE TO IMPLEMENT` until the first-cohort blockers in §1.2 are approved with evidence.

### 3.2 Rationale

- It is free-text staff guidance with no exact lookup, uniqueness, FK, OTP, auth, guardian, or DSAR dependency.
- It has one backend write site and one read mapper.
- `lead_note` is already a T1 allowlisted purpose; no allowlist expansion is needed.
- It is not used by admin user search, lead `ILIKE`, audit `q`, college duplicate checks, or any current search endpoint.
- No audit write, CSV export, notification, or admin `localStorage` copy was observed for the note text.
- Rollback can be a flag flip while plaintext remains authoritative.
- Existing workflow tests already cover add-note, detail read, and counsellor scope.

### 3.3 Exact treatment

| Item | Value |
|---|---|
| Table / column | `lead_notes.note` |
| Model | `backend/app/models/enquiry.py`, `LeadNote.note` |
| Treatment | `ENCRYPT` after approvals |
| Primitive | T1 `encrypt_text` / `decrypt_text`; no new crypto design |
| AAD | `padhaanewala\|pii-aad\|v1\|lead_notes\|note\|{pii_context_id}\|lead_note` |
| Envelope | T1 `pe1.<base64url-no-padding(BODY)>`; key version byte inside body |
| New columns proposed | `note_enc` (Text), `pii_context_id` (UUIDv4), `pii_changed_at` (timestamp) |
| Lookup / shadow columns | None |
| Indexes | None |
| Plaintext column | `note` retained until separate D-17-equivalent approval |
| Flags | Field-scoped dual-write/backfill/read-source flags; global flags must not affect other fields |

### 3.4 Migration implications

1. Expand-only Alembic migration; no data mutation and no read-path change.
2. New columns are nullable. Existing rows keep plaintext `note`.
3. `pii_context_id` is generated once per row and never changed. Backfill must be idempotent.
4. `note_enc` is Text, not `String(2000)`, because base64 expansion plus envelope overhead exceeds the plaintext schema length.
5. No `CREATE INDEX CONCURRENTLY` is needed for this cohort; DBA approval (D-15) is still required before schema work.
6. No downgrade that drops new columns is permitted after dual-write begins.
7. Destructive removal of `note` is a separate approval under D-17.

---

## 4. Exact implementation file and test mapping

### 4.1 Existing files that would need changes after approval

| Layer | File | Exact location / responsibility |
|---|---|---|
| Model | `backend/app/models/enquiry.py` | `LeadNote` at lines 91-104; add proposed encrypted/context columns. Keep `note` as plaintext authoritative before cutover. |
| Schema | `backend/app/schemas/engagement.py` | `AddLeadNoteRequest.note` at line 90; `LeadNoteResponse.note` at line 69; `LeadDetailResponse.notes` at line 85. Validate plaintext before encryption; decrypt only in response mapping. |
| Route write | `backend/app/routers/leads.py` | `add_lead_note` at lines 156-173; replace direct `LeadNote(note=payload.note)` with approved service-layer encrypted write. |
| Route read mapper | `backend/app/routers/leads.py` | `_lead_query` at lines 55-63; `_to_detail` at lines 77-100. Decrypt only after `_can_access` passes. |
| Route read entry points | `backend/app/routers/leads.py` | `get_lead` 143-154; `update_lead_status` 175-205; `assign_lead` 207-265; `set_follow_up` 267-282; `update_lead_details` 285-312. All return `_to_detail` and therefore inherit note decryption. |
| List route | `backend/app/routers/leads.py` | `list_leads` 102-141 returns `LeadListItem` without notes; no change required to list schema. Existing `ILIKE` at 128-136 targets enquiry name/mobile/email and must remain unchanged in this cohort. |
| Proposed service layer | New module, name to be fixed at implementation (e.g. `backend/app/services/pii_field_service.py`) | Wrap existing `backend/app/utils/pii_crypto.py`; no SQLAlchemy `TypeDecorator`; no HMAC; no key loading from source/env by the primitive. |
| Migration | New Alembic revision under `backend/alembic/versions/` | Expand-only; single head must be re-verified immediately before creation. No migration is created by T2.3. |
| Backfill / verification jobs | Proposed new scripts under `backend/scripts/` | Idempotent batch encryption, decryptability/AAD/context verification, and zero-pii logs. Not created by T2.3. |
| Existing utility | `backend/app/utils/audit.py` | No lead-note audit call exists today. Do not add plaintext note payloads to audit; `note` is not in `SENSITIVE_KEYS`, so future audit callers must use references only. |
| Purge script | `backend/scripts/purge_demo_data.py` | `lead_notes` listed at line 61; table-level purge remains valid because cascade/row deletion does not require decryption. |
| Retention sweep | `backend/scripts/retention_sweep.py` | No `lead_notes` handling found; no change identified for this cohort. |

### 4.2 Frontend mapping

| File | Reference | First-cohort rule |
|---|---|---|
| `frontend/lib/api.ts` | `adminApi.getLead` at 2311; `addLeadNote` at 2314-2316; `AdminLeadNote` at 1431; `AdminLeadDetail.notes` at 1444-1446 | API shape must remain plaintext to authorised UI; no ciphertext or token exposed. |
| `frontend/frontend/components/admin/sections/LeadsSection.tsx` | Add note flow around 1002; note display around 1369-1377 | No UI contract change. Do not persist note text to `localStorage`. |
| `frontend/frontend/components/admin/sections/LeadsSection.tsx` | CSV export at 251-278 | Export currently excludes notes; must continue to exclude them. |
| `frontend/lib/context/AppContext.tsx` | `cp_enquiries` hydration/save at 222,398 | This is the student-side enquiry store; confirm no admin lead-note text is added to it. |

### 4.3 Existing tests to preserve

| Test file | Evidence | Protected behaviour |
|---|---|---|
| `backend/tests/test_pii_crypto.py` | T1 primitive suite already exists; prior run reported 41 passing. | Envelope, nonce, AAD, key-version and failure behaviour. |
| `backend/tests/test_phase9.py` | `test_lead_full_lifecycle` 210-255; `test_counsellor_scoped_to_assigned_leads` 258 onward; `test_leads_forbidden_for_students` 306-310. | Add-note, detail read, assignment scope, role denial. |
| `backend/tests/test_admin_access.py` | `/api/v1/leads` referenced at line 90. | Admin/role access to lead surfaces. |
| `backend/tests/test_rbac_rules.py` | `/api/v1/leads` referenced at line 448. | RBAC denial matrix. |
| `backend/tests/test_counsellor_provisioning.py` | Assign/active-counsellor behaviour throughout. | Counsellor assignment and cap rules must not drift. |
| `backend/tests/test_purge_demo_data_guard.py` | Purge guard suite. | Demo purge remains safe with new nullable columns. |

No tests were run during T2.3 because no source or test files were changed.

### 4.4 Proposed regression tests (not created)

| Proposed file | Cases |
|---|---|
| `backend/tests/test_pii_lead_notes_encryption.py` | Correct AAD table/column/purpose/context; wrong context, wrong column, wrong purpose, wrong key and unknown version fail closed; fresh nonce; canonical envelope; dual-write consistency; prior-key read during rotation rehearsal; no plaintext/key/token in exceptions or logs. |
| `backend/tests/test_lead_notes_workflow_encrypted.py` | Add note returns same plaintext body to authorised actor; detail read by assigned counsellor and admin; unassigned counsellor gets 404; student gets 403; status/assign/follow-up/details responses still include notes in stable order; delete cascade succeeds. |
| `backend/tests/test_lead_notes_backfill.py` | Idempotent backfill; 100% row coverage; rerun changes zero rows; plaintext retained; flag rollback returns plaintext reads; no dropped columns. |
| `backend/tests/test_lead_notes_secondary_copies.py` | No note text in audit JSON, CSV export, notification payload, observability events, error messages, or `localStorage` keys. |
| `frontend/tests/lead-notes-no-localstorage.test.ts` | Add/read note flow stores note only in component state and never in a `cp_*` key. |

---

## 5. Workflow compatibility matrix

| Workflow | Current code evidence | First-cohort effect | Later-phase blockers |
|---|---|---|---|
| Login and password reset | `auth.py:174-274` register; `auth.py:300-326` login; `auth.py:760-831` forgot/reset; `otp_service.py` lookup helpers. | Unaffected. No auth file, user identifier, credential digest, or session field is in the cohort. | D-04, D-05, D-06 for `users.email` / `users.mobile` / OTP identifier; D-18 for rotation. |
| OTP send / verify / resend | `otp_service.py:63-91` purpose isolation; `160-178` normalization; `211-261` rate/supersede/prune; `306-489` issue/verify. | Unaffected. OTP purpose and normalization are untouched. | D-04, D-05, D-06. |
| Student profiles | `users.py:51-101` read/update; `auth.py:231-232` registration profile; `retention_sweep.py:280-285` anonymisation; admin `ILIKE` at `users.py:172-181`. | Unaffected. Profile fields are rejected from the first cohort. | D-03, D-09, D-10, D-12; ADR-0009 `preferred_state` filter conflict must be resolved. |
| Guardian consent | `compliance.py:240-323` request; `326-385` verify; guardian target equality checks at 243-249; OTP purpose at 351. | Unaffected. Guardian fields are rejected from the first cohort. | D-04, D-09, D-10. |
| Enquiries / leads / counsellor access | `leads.py:68-75` `_can_access`; `102-141` list; `143-154` detail; `156-173` note write; existing `ILIKE` at 128-136. | Preserved by keeping `_can_access`, list filters, and lead identity fields unchanged. Only note storage/read mapping changes after approvals. | D-07, D-08 before any encrypted lead identity or restricted search. |
| Restricted search | No `pii-search` route or session implementation found in source; only plan documents describe it. | Not required: lead notes are not searched and must not become a search field in this cohort. | D-07, D-08. |
| Data requests and retention | `compliance.py:89-115` responses; `462-558` create; `648-698` staff update; `retention_sweep.py:246-291` erasure/anonymisation. | Unaffected. DSAR fields are rejected from the first cohort. | D-10, D-11, D-12; uncertain HMAC decision for `subject` / `details`. |
| Audit | `audit.py:121-188` redaction and record; `leads.py:330-338` delete audit copies name/mobile/status only. | Lead-note write adds no audit copy. Future code must not pass note text into audit payloads. | D-11. |
| CSV export / notifications | `LeadsSection.tsx:251-278` excludes notes; no notification service reference to notes found. | Unchanged. | D-12, D-13 for other PII copies. |

---

## 6. Concise implementation sequence

Every step below remains blocked until the named approvals exist. T2.3 performs none of these steps.

| Stage | Action | Gate |
|---|---|---|
| 0 — Approval gates | Record signed evidence for D-01, D-02, D-03, D-15, field-treatment sign-off; record D-16 precondition checklist. D-14 must be scheduled before read cutover. | No source, migration, key, or database work without evidence. |
| 1 — Expand | Add nullable `note_enc`, `pii_context_id`, `pii_changed_at`; no data rewrite; no read change. | Staging apply/rollback passes; single Alembic head verified. |
| 2 — Dual-write | Approved service layer writes plaintext and ciphertext in one transaction for new/updated lead notes. | 100% sampled consistency; plaintext remains authoritative. |
| 3 — Backfill | Idempotent batch encryption of legacy rows with stable context IDs. | 100% coverage; rerun changes zero rows; no partial transactions. |
| 4 — Verification | Decryptability, AAD, context, key-version, and no-leak checks across all rows. | Zero failures; no PII in logs/errors. |
| 5 — Read cutover | Flip field-scoped read flag to encrypted for authorised detail reads. | D-14 evidence exists; rollback flag tested; zero decrypt failures. |
| 6 — Soak | Monitor workflow tests, RBAC scope, error rates, and observability redaction. | No cross-scope results, no PII leakage, no decrypt failures. |
| 7 — Separate destructive approval | Only under D-17: remove plaintext `note` and legacy fallback code. | Restore proof and explicit approval; never bundled with stage 5 or 6. |

---

## 7. Proposed rollback strategy

| Stage | Rollback |
|---|---|
| Expand only | Reverse migration in staging before dual-write; no production data rewrite. |
| Dual-write | Disable field-scoped dual-write; plaintext remains authoritative. |
| Backfill | Pause job; retain partial ciphertext; no read cutover. |
| Verification failure | Keep flags off; repair context/ciphertext; rerun verification. |
| Read cutover | Flip read flag to plaintext while `note` is retained. |
| Key issue | Flag back to previous configured key version; no key value display. |
| Destructive removal | No application rollback; approved restore only. |

---

## 8. Explicit unresolved risks

1. **No approvals exist.** All D-01–D-18 decisions are OPEN; no item is APPROVED.
2. **ADR-0009 remains in force.** Its Decision 2 was not to implement field-level encryption for `student_profiles` / `enquiries`; T1 primitives did not supersede it.
3. **T2.2 A-01 treatment sign-off is missing.** The field treatment matrix is `PROPOSED`, not approved.
4. **Key custody and secret-manager names are unresolved.** No key values, names, or rotation windows were requested, generated, printed, or accessed.
5. **DBA migration evidence is missing.** No staging lock metrics or approved concurrent-index pattern evidence was found.
6. **Backup/restore rehearsal evidence is missing.** Read cutover must not proceed without it.
7. **`pii_context_id` generation/backfill design is not implemented.** It must be immutable and verified before any ciphertext is authoritative.
8. **Audit redaction does not include `note`.** There is no current note-audit call, but future callers could copy it; D-11 remains relevant.
9. **Runtime secondary copies are not fully verifiable statically.** Browser state, logs, and observability were inspected in source only.
10. **ADR-0009 `preferred_state` filter conflict remains unresolved.** It is a reason to reject the student-profile cohort, not to guess around it.
11. **Restricted search does not exist in source.** Any later search-enabled cohort needs D-07 and D-08 before implementation.
12. **Python drift remains non-blocking.** The isolated backend venv previously reported Python 3.12.10 while project docs expect 3.14; no rebuild was performed.
13. **No tests were run in T2.3.** Existing test names are mapped from static inspection only.

---

## 9. Approvals required before implementation

| Approval | Exact approver | Evidence required |
|---|---|---|
| D-01 ADR-0009 supersession | Security Architect | Signed ADR update or written decision record. |
| D-02 service-layer encryption architecture | Security Architect | Architecture sign-off naming the service/mapper boundary and prohibiting `TypeDecorator`. |
| D-03 envelope and AAD design | Security Architect | Crypto design review accepting T1 envelope and `lead_notes\|note\|lead_note` AAD. |
| Field treatment sign-off (T2.2 A-01) | Security Architect + DPO/legal + Product owner | Written acceptance of `ENCRYPT` for `lead_notes.note` and no expansion to other fields. |
| D-15 migration pattern | DBA owner | Approved expand migration pattern and lock/threshold evidence. |
| D-14 backup/key custody and restore | Operations/key custodian + DPO/legal | Rehearsal evidence and approved custody boundary before read cutover. |
| D-16 precondition record | Release owner / product-operations | Formal record that branch reconciliation to `5049ab1` is accepted. |

Not required for the first cohort, but still OPEN for later phases: D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12, D-13, D-17, D-18.

---

## 10. Next task recommendation

**Recommended next task: T3.0 — Approval Gate Packet for the single-field `lead_notes.note` cohort.**

Scope if authorised as documentation only:

1. Draft the ADR-0009 supersession text for Security Architect review; do not mark it approved.
2. Write the service-layer integration design and exact AAD call site; do not add source files.
3. Prepare DBA migration checklist and D-14 read-cutover checklist.
4. Produce a test-plan acceptance matrix from §4.4.

Do **not** start source changes, migrations, HMAC, restricted search, key handling, or destructive work until the approvals in §9 are supplied.

---

## 11. Coverage limitations

- Read-only static investigation plus this new documentation file only.
- No application source, test, model, route, migration, configuration, environment, or existing report was modified.
- No database was accessed; no migration was created or run.
- No secrets were generated, rotated, printed, requested, or accessed.
- No production data, deployed logs, runtime traces, vendor consoles, or browser runtime state were accessed.
- No actual PII values are reproduced in this document.
- Approval evidence is unavailable; therefore no decision is marked `APPROVED`.
- The requested primitives path with doubled `pii-` was unavailable; the actual primitives document was used and identified above.

---

## 12. Human-review position

- The safest candidate cohort is `lead_notes.note`, one field only.
- The recommendation is `PROPOSED` and is **not safe to implement** while D-01, D-02, D-03, D-15, and field-treatment sign-off remain OPEN.
- No HMAC token, OTP, authentication, guardian, search, DSAR, or audit field is included in the recommended cohort.
- All D-01–D-18 decisions remain `OPEN`; zero decisions are `APPROVED`.
- The next safe step is an approval-gate packet, not implementation.
