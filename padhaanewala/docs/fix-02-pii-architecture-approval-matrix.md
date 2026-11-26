# Fix 02 T2.2 — PII Architecture & Approval Matrix

**Status:** INVESTIGATION AND PROPOSAL ONLY. This document converts the completed T2.1 read-only PII inventory into a decision-ready architecture and approval register. It does **not** implement encryption, HMAC tokens, restricted search, migrations, key rotation, browser-clearing, retention changes, or deployment changes.

**Source of truth:** the T2.1 PII inventory delivered for this branch, cross-checked against:

- `docs/fix-02-pii-encryption-final-plan-revision.md`
- `docs/adr-0009-pii-at-rest.md`
- `docs/fix-02-pii-encryption-primitives.md`
- `backend/app/utils/pii_crypto.py`
- model, migration, router, service, schema, frontend, test, and retention-sweep files inspected during T2.1

**Branch:** `security/H-08-pii-encryption`  
**Baseline HEAD:** `5049ab1425a00bd31382ab21af472d36bf21ee57`

**Approval evidence:** none found in the repository. No item in this document is marked `APPROVED`.

---

## 0. Treatment definitions and notation

### 0.1 Required treatments

| Treatment | Meaning |
|---|---|
| `ENCRYPT` | Store T1 AES-256-GCM envelope ciphertext in the authoritative field after a separately approved integration. A companion lookup token may be required by the HMAC matrix. |
| `REMAIN PLAINTEXT` | Field stays in clear text because it is an access-control state, lifecycle flag, FK, internal ID, timestamp, public value, high-entropy opaque token, or policy gate where encryption would break required behaviour without material confidentiality benefit. Documented reason and access controls are mandatory. |
| `HASH` | Field remains a one-way credential digest and must not be AES-encrypted or used as a reversible identifier. |
| `DEFER` | No implementation treatment is authorised yet because the AAD purpose, search model, legal basis, secondary-copy design, or owner approval is unresolved. |
| `NOT PERSONAL DATA` | Public catalogue/organisational value, capacity flag, or other value reviewed in T2.1 and excluded from PII scope. |

### 0.2 Constraint notation

`NN` = non-nullable; `NULL` = nullable; `PK` = primary key; `U` = unique; `I` = indexed; `FK` = foreign key; `composite-U` = composite unique constraint.

### 0.3 Approval owner notation

| Code | Exact approver |
|---|---|
| `SA` | Security Architect |
| `DPO` | DPO/legal |
| `DBA` | DBA owner |
| `PO` | Product owner |
| `OPS` | Operations/key custodian |

Combined owners mean all named owners must approve before implementation.

### 0.4 Secondary-copy codes

| Code | Location/mechanism |
|---|---|
| `AUDIT` | Audit log `old_value` / `new_value` JSON and audit search |
| `NOTIF` | Notification `title`, `message`, `data` and notification UI |
| `BROWSER` | `cp_user`, `cp_profile`, `cp_enquiries`, `cp_reviews`, `cp_recent_searches`, `cp_recent_locations` |
| `EXPORT` | Lead and audit CSV exports |
| `URL` | Query strings, token links, `source_url` |
| `EMAIL` | Email bodies, console/provider logs |
| `SMS` | SMS bodies, console/provider logs |
| `REDIS` | Rate-limit keys |
| `OBS` | Frontend/backend observability payloads |
| `OTPLOG` | OTP service logs |
| `AI` | AI chat free-text proxy |

### 0.5 Test-code catalogue

| Code | Required test |
|---|---|
| `T-CRYPT` | Envelope round-trip, fresh nonce, malformed envelope, wrong key, tag/nonce/ciphertext tamper |
| `T-AAD` | Correct table/column/context/purpose binding; wrong-context and substitution failures |
| `T-HMAC` | Lookup-token parity, normalization, domain separation, token version compatibility, no token leakage |
| `T-UNIQ` | Unique constraint, concurrent duplicate writes, atomic rollback, generic conflict response |
| `T-SEARCH` | Restricted candidate selection, RBAC/counsellor scope, cursor integrity, pagination completeness, result caps |
| `T-WF` | Existing create/read/update/delete workflow regression |
| `T-AUDIT` | Audit redaction, audit search, JSON nested-depth behaviour |
| `T-SECOND` | No PII in notifications, browser storage, exports, URLs, logs, Redis, observability, email/SMS |
| `T-RET` | Retention, erasure, guardian-consent lifecycle, DSAR evidence |
| `T-KEY` | Key version selection, read-only previous keys, unknown version failure, rotation rehearsal |

---

## 1. Field treatment matrix

Every field identified in T2.1 is mapped below to one explicit treatment. Grouped rows apply the same treatment to each listed column.

### 1.1 Identity, profile, staff, auth, compliance and audit

| Table.column | Treatment | Reason / access controls | Proposed AAD purpose | T1 allowlist supports? | Exact lookup dependency | Partial search dependency | Constraints | Secondary copies | Required tests | Approver |
|---|---|---|---|---|---|---|---|---|---|---|
| `users.id` | REMAIN PLAINTEXT | Internal PK; required by all FK/authorization paths; not independently identifying without joined account data; DB/RBAC-restricted | `user_identity` | Yes | Yes, by authenticated services | No | Integer PK | `AUDIT`, `BROWSER` | `T-WF`, `T-SEARCH` | `SA` |
| `users.email` | ENCRYPT | Direct identifier and login key; must use HMAC token for exact lookup and uniqueness; API responses remain authorization-gated | `user_identity` | Yes | Yes: registration, login, resend, forgot-password | Yes: admin `ILIKE` | String(255) NN U/I | `AUDIT`, `BROWSER`, `EMAIL`, `EXPORT`, `URL`, `OBS` | `T-CRYPT`, `T-AAD`, `T-HMAC`, `T-UNIQ`, `T-SEARCH`, `T-SECOND`, `T-WF` | `SA` + `DPO` |
| `users.mobile` | ENCRYPT | Direct identifier and login/OTP key; must use HMAC token for exact lookup and uniqueness | `user_identity` | Yes | Yes: registration, login, OTP, mobile verification | Yes: admin `ILIKE` | String(20) NN U/I | `AUDIT`, `BROWSER`, `SMS`, `EXPORT`, `OBS` | `T-CRYPT`, `T-AAD`, `T-HMAC`, `T-UNIQ`, `T-SEARCH`, `T-SECOND`, `T-WF` | `SA` + `DPO` |
| `users.password_hash` | HASH | Existing bcrypt credential digest; reversible encryption would not improve authentication security; no lookup/search; DB and auth-service access only | `UNCERTAIN` — no credential purpose | No | No | No | String(255) NN | None | `T-WF`, `T-SECOND`, `T-RET` | `SA` |
| `users.is_active`, `is_email_verified`, `is_mobile_verified` | REMAIN PLAINTEXT | Authorization/verification gates; indexed or branch-critical; no personal content; role-gated APIs and consent checks only | `user_identity` | Yes | Yes, internal policy checks | No | Boolean NN | `AUDIT` | `T-WF`, `T-SEARCH` | `SA` + `PO` |
| `users.age_band` | REMAIN PLAINTEXT | Minor-policy gate; indexed; not a DOB; encrypting would break indexed policy decisions; authenticated own-profile, admin, consent gate only | `user_identity` | Yes | Yes, internal policy checks | No | String(20) NULL I | `AUDIT`, `BROWSER` | `T-WF`, `T-RET`, `T-SEARCH` | `DPO` + `PO` |
| `users.is_minor` | REMAIN PLAINTEXT | Derived minor flag; indexed gate for guardian consent; encrypting would break policy branch; consent-service access only | `user_identity` | Yes | Yes, internal policy checks | No | Boolean NN I | `AUDIT`, `BROWSER` | `T-WF`, `T-RET`, `T-SEARCH` | `DPO` + `PO` |
| `users.last_login_at` | REMAIN PLAINTEXT | Account audit metadata; no direct identity value; admin/security access only | `user_identity` | Yes | No | No | DateTimeTZ NULL | `AUDIT` | `T-WF`, `T-AUDIT` | `SA` |
| `users.created_at`, `users.updated_at` | REMAIN PLAINTEXT | Lifecycle timestamps required for retention and DSAR ordering; no direct identifier | `user_identity` | Yes | No | No | DateTimeTZ NN | `AUDIT` | `T-RET`, `T-WF` | `DPO` |
| `User.display_name` property | DEFER | Derived from `student_profiles.name` or falls back to `users.email`; treatment follows source fields; audit/admin serialization must be redesigned before source fields are encrypted | `student_profile` / `user_identity` | Yes | No | Yes in admin/audit search | Derived property | `AUDIT`, `BROWSER`, `EXPORT` | `T-SEARCH`, `T-SECOND`, `T-WF` | `SA` + `DPO` + `PO` |
| `user_roles.user_id`, `user_roles.role_id` | REMAIN PLAINTEXT | Authorization mapping; PK/FK and role checks; role-gated only | `user_identity` / `UNCERTAIN` for role | Partial for role | No | No | Integer composite PK/FK | `AUDIT` | `T-WF`, `T-SEARCH` | `SA` |
| `student_profiles.id`, `student_profiles.user_id` | REMAIN PLAINTEXT | Internal PK/FK; profile is fetched by `user_id`; no personal content; authenticated owner/admin only | `student_profile` | Yes | Yes, exact by `user_id` | No | Integer PK/U/FK | `AUDIT`, `BROWSER` | `T-WF` | `SA` |
| `student_profiles.name` | ENCRYPT | Direct student/minor name; decrypt only for authorized profile, admin, review, audit and manual-grading displays | `student_profile` | Yes | No current exact lookup | Yes: admin user search, audit `q` | String(255) NN | `AUDIT`, `BROWSER`, `EXPORT`, `NOTIF` | `T-CRYPT`, `T-AAD`, `T-SEARCH`, `T-SECOND`, `T-WF` | `SA` + `DPO` + `PO` |
| `student_profiles.education_level`, `course_interest`, `preferred_state`, `preferred_city`, `budget_min`, `budget_max` | ENCRYPT | Student profile preferences and financial metadata; display/write only; authenticated owner/admin access | `student_profile` | Yes | No | No | String/Numeric NULL | `BROWSER` | `T-CRYPT`, `T-AAD`, `T-WF`, `T-SECOND` | `SA` + `DPO` |
| `student_profiles.created_at`, `updated_at` | REMAIN PLAINTEXT | Profile lifecycle timestamps; required for ordering/retention | `student_profile` | Yes | No | No | DateTimeTZ NN | None | `T-RET`, `T-WF` | `DPO` |
| `admins.id`, `admins.user_id`, `created_at` | REMAIN PLAINTEXT | Staff record identifiers and audit timestamp; role-gated | `admin_staff` | Yes | Yes, internal staff link | No | Integer PK/U/FK, DateTimeTZ NN | `AUDIT` | `T-WF` | `SA` |
| `admins.name` | ENCRYPT | Staff direct identifier; decrypt only for staff-facing display and audit attribution | `admin_staff` | Yes | No current lookup | No | String(255) NN | `AUDIT`, `BROWSER` | `T-CRYPT`, `T-AAD`, `T-WF`, `T-SECOND` | `SA` + `PO` |
| `admins.department` | ENCRYPT | Staff metadata; admin-only display | `admin_staff` | Yes | No | No | String(255) NULL | `AUDIT`, `BROWSER` | `T-CRYPT`, `T-AAD`, `T-WF` | `SA` + `PO` |
| `counsellors.id`, `counsellors.user_id`, `created_at` | REMAIN PLAINTEXT | Staff record identifiers and assignment FK; counsellor scope depends on them | `counsellor_staff` | Yes | Yes, assignment and scope checks | No | Integer PK/U/FK, DateTimeTZ NN | `AUDIT` | `T-WF`, `T-SEARCH` | `SA` + `PO` |
| `counsellors.name` | ENCRYPT | Staff direct identifier; ordering by encrypted name is not possible; restricted search must handle staff display separately | `counsellor_staff` | Yes | No | No current substring search; list ordered by name | String(255) NN | `AUDIT`, `EXPORT` | `T-CRYPT`, `T-AAD`, `T-SEARCH`, `T-WF` | `SA` + `PO` |
| `counsellors.specialization` | ENCRYPT | Staff metadata; staff-facing display only | `counsellor_staff` | Yes | No | No | String(255) NULL | `BROWSER` | `T-CRYPT`, `T-AAD`, `T-WF` | `SA` + `PO` |
| `counsellors.max_leads`, `counsellors.is_active` | REMAIN PLAINTEXT | Capacity/availability flags; no personal content; used by assignment logic | `NONE` | N/A | Yes, assignment filter | No | Integer/Boolean NN | None | `T-WF`, `T-SEARCH` | `PO` |
| `saved_colleges.student_id`, `college_id`, `created_at` | REMAIN PLAINTEXT | Behavioural links by IDs; profile-scoped; no direct PII in row | `student_profile` | Yes | Yes, owner-scoped | No | Integer NN I/FK/composite-U | `BROWSER` | `T-WF` | `SA` + `PO` |
| `consent_records.id`, `user_id`, `consent_type`, `consent_version`, `granted`, `created_at` | REMAIN PLAINTEXT | Consent state and lifecycle metadata; indexed; consent gate and DSAR access only | `consent_record` | Yes | Yes, latest-by-user/type | No | Integer/String/Boolean, I/FK | `AUDIT` | `T-WF`, `T-RET`, `T-SEARCH` | `DPO` |
| `consent_records.consent_text` | ENCRYPT | Verbatim consent text can contain personal statements; no search; return only to authorized DSAR/consent views | `consent_record` | Yes | No | No | Text NN | `AUDIT`, `BROWSER` | `T-CRYPT`, `T-AAD`, `T-WF`, `T-RET` | `DPO` + `SA` |
| `consent_records.ip_address` | ENCRYPT | IP address; write-only in current workflow; no index/search; audit/admin access only | `audit_ip` | Yes | No | No | String(45) NULL | `AUDIT`, `OBS` | `T-CRYPT`, `T-AAD`, `T-RET`, `T-SECOND` | `DPO` + `SA` |
| `guardian_consents.id`, `user_id` | REMAIN PLAINTEXT | Consent record identity and minor link; required by consent gate and OTP purpose binding | `guardian_consent` | Yes | Yes, latest-by-user | No | Integer PK/I/FK | `AUDIT` | `T-WF`, `T-RET` | `DPO` + `SA` |
| `guardian_consents.guardian_name` | ENCRYPT | Guardian direct identifier; guardian-consent UI/DSAR access only | `guardian_consent` | Yes | No | No | String(255) NN | `AUDIT` | `T-CRYPT`, `T-AAD`, `T-WF` | `DPO` + `SA` |
| `guardian_consents.guardian_email` | ENCRYPT | Guardian contact; requires normalized HMAC token for child-vs-guardian equality and OTP reconciliation | `guardian_consent` | Yes | Yes, normalized equality | No | String(255) NULL | `AUDIT`, `EMAIL` | `T-CRYPT`, `T-AAD`, `T-HMAC`, `T-UNIQ`, `T-WF` | `DPO` + `SA` |
| `guardian_consents.guardian_mobile` | ENCRYPT | Guardian contact; requires normalized HMAC token | `guardian_consent` | Yes | Yes, normalized equality | No | String(20) NULL | `AUDIT`, `SMS` | `T-CRYPT`, `T-AAD`, `T-HMAC`, `T-UNIQ`, `T-WF` | `DPO` + `SA` |
| `guardian_consents.verification_channel` | REMAIN PLAINTEXT | Channel selector (`sms`/`email`); not personal content; required by OTP routing | `guardian_consent` | Yes | Yes, internal routing | No | String(20) NN | None | `T-WF`, `T-HMAC` | `SA` + `DPO` |
| `guardian_consents.verification_target` | ENCRYPT | Normalized guardian contact actually used for OTP; exact indexed lookup requires HMAC token | `guardian_consent` | Yes | Yes, OTP exact match | No | String(255) NN I | `AUDIT`, `OTPLOG`, `EMAIL`, `SMS` | `T-CRYPT`, `T-AAD`, `T-HMAC`, `T-UNIQ`, `T-WF` | `DPO` + `SA` |
| `guardian_consents.status`, `consent_version`, `requested_at`, `verified_at`, `withdrawn_at`, `expires_at`, `created_at` | REMAIN PLAINTEXT | Consent lifecycle state and timestamps; indexed branch-critical for processing gate; no personal content | `guardian_consent` | Yes | Yes, latest/status checks | No | String/DateTime, I/composite-I | `AUDIT` | `T-WF`, `T-RET`, `T-SEARCH` | `DPO` + `PO` |
| `guardian_consents.consent_text` | ENCRYPT | Verbatim guardian consent evidence; no search; DSAR/auditor access only | `guardian_consent` | Yes | No | No | Text NN | `AUDIT` | `T-CRYPT`, `T-AAD`, `T-WF`, `T-RET` | `DPO` + `SA` |
| `guardian_consents.request_ip` | ENCRYPT | IP attribution; write-only; no search/index | `audit_ip` | Yes | No | No | String(45) NULL | `AUDIT`, `OBS` | `T-CRYPT`, `T-AAD`, `T-RET`, `T-SECOND` | `DPO` + `SA` |
| `data_requests.id`, `user_id`, `request_type`, `status`, `received_at`, `acknowledged_at`, `due_at`, `completed_at`, `handled_by_user_id`, `created_at` | REMAIN PLAINTEXT | DSAR workflow IDs, SLA state and staff link; indexed; DSAR/team access only | `data_request` | Yes | Yes, queue/duplicate checks | No | Integer/String/DateTime, I/FK | `AUDIT`, `BROWSER` | `T-WF`, `T-RET`, `T-SEARCH` | `DPO` + `PO` |
| `data_requests.subject` | ENCRYPT | Free text may contain identifiers; exact duplicate check requires uncertain HMAC decision | `data_request` | Yes | Yes, exact duplicate under same user/type/open status | No | String(255) NULL | `AUDIT`, `BROWSER`, `EXPORT` | `T-CRYPT`, `T-AAD`, `T-HMAC`, `T-WF`, `T-RET` | `DPO` + `SA` |
| `data_requests.details` | ENCRYPT | Sensitive free text; exact duplicate check requires uncertain HMAC decision | `data_request` | Yes | Yes, exact duplicate under same user/type/open status | No | Text NN | `AUDIT`, `BROWSER`, `EXPORT` | `T-CRYPT`, `T-AAD`, `T-HMAC`, `T-WF`, `T-RET` | `DPO` + `SA` |
| `data_requests.resolution` | ENCRYPT | Free-text DSAR outcome; DSAR staff/auditor access only | `data_request` | Yes | No | No | Text NULL | `AUDIT`, `BROWSER`, `EXPORT` | `T-CRYPT`, `T-AAD`, `T-WF`, `T-RET` | `DPO` + `SA` |
| `otp_records.id`, `user_id` | REMAIN PLAINTEXT | OTP record identity and optional user link; OTP service and security access only | `otp` | Yes | Yes, internal lookup | No | Integer PK/I/FK | `OTPLOG` | `T-WF`, `T-RET` | `SA` |
| `otp_records.purpose` | REMAIN PLAINTEXT | Must remain queryable for exact purpose isolation and guardian-purpose prefix; no personal content | `otp` | Yes | Yes, composite `(purpose, identifier)` | No | String(30) NN I/composite-I | `OTPLOG` | `T-HMAC`, `T-WF`, `T-KEY` | `SA` |
| `otp_records.identifier` | ENCRYPT | Normalized email/mobile used pre-auth; exact HMAC token required for rate limit, supersede, prune and latest-live lookup | `otp` | Yes | Yes, exact `(purpose, identifier)` | No | String(255) NN I/composite-I | `OTPLOG`, `EMAIL`, `SMS` | `T-CRYPT`, `T-AAD`, `T-HMAC`, `T-UNIQ`, `T-WF`, `T-RET` | `SA` + `DPO` |
| `otp_records.code_hash` | HASH | Existing bcrypt digest of OTP/link secret; do not encrypt or reverse; OTP service only | `UNCERTAIN` — no credential purpose | No | No | No | String(255) NN | None | `T-WF`, `T-SECOND`, `T-RET` | `SA` |
| `otp_records.attempts`, `is_used`, `expires_at`, `consumed_at`, `created_at` | REMAIN PLAINTEXT | OTP lifecycle and abuse counters; indexed expiry; OTP service/security access only | `otp` | Yes | Yes, lifecycle filters | No | Integer/Boolean/DateTime, I | `OTPLOG` | `T-WF`, `T-RET` | `SA` |
| `otp_records.request_ip` | ENCRYPT | IP attribution; write-only in current workflow; no index/search | `audit_ip` | Yes | No | No | String(45) NULL | `OTPLOG`, `OBS` | `T-CRYPT`, `T-AAD`, `T-RET`, `T-SECOND` | `DPO` + `SA` |
| `refresh_tokens.id`, `user_id` | REMAIN PLAINTEXT | Token ledger identity and owner link; exact session operations depend on them; auth service only | `user_identity` / `UNCERTAIN` for session | Partial | Yes, exact user scans | No | Integer PK/I/FK | `AUDIT` | `T-WF`, `T-RET` | `SA` |
| `refresh_tokens.jti` | REMAIN PLAINTEXT | High-entropy opaque token ID, not personal content; exact ledger key; hashing/encryption would require full session redesign; DB/auth-service access only | `UNCERTAIN` — no session purpose | No | Yes, `find_by_jti` | No | String(64) NN U/I | `AUDIT`, `OBS` | `T-WF`, `T-UNIQ`, `T-KEY` | `SA` |
| `refresh_tokens.family` | REMAIN PLAINTEXT | High-entropy opaque family ID; exact revocation key; same reasoning as `jti` | `UNCERTAIN` — no session purpose | No | Yes, family revocation | No | String(64) NN I/composite-I | `AUDIT` | `T-WF`, `T-UNIQ`, `T-KEY` | `SA` |
| `refresh_tokens.used_at`, `rotated_to_jti`, `expires_at`, `revoked_at`, `created_at` | REMAIN PLAINTEXT | Token lifecycle metadata; exact expiry/revocation scans; auth service only | `UNCERTAIN` | No | Yes, lifecycle filters | No | DateTime/String, I | `AUDIT` | `T-WF`, `T-RET`, `T-KEY` | `SA` |
| `refresh_tokens.request_ip` | ENCRYPT | IP attribution; write-only; no search/index | `refresh_token_ip` | Yes | No | No | String(45) NULL | `AUDIT`, `OBS` | `T-CRYPT`, `T-AAD`, `T-RET`, `T-SECOND` | `DPO` + `SA` |
| `audit_logs.id`, `user_id`, `action`, `entity_type`, `entity_id`, `created_at` | REMAIN PLAINTEXT | Audit metadata and actor link; indexed for forensic query; security/admin access only | `audit_ip` — closest T1 purpose | Yes | Yes, exact filters | Yes, audit `q` over action/entity | Integer/String/DateTime, I/FK | `AUDIT`, `EXPORT` | `T-AUDIT`, `T-SEARCH`, `T-WF` | `SA` + `DPO` |
| `audit_logs.old_value`, `audit_logs.new_value` | DEFER | JSON can contain unredacted names/free text; no T1 audit-payload purpose; remediation plan required before treatment | `UNCERTAIN` — no audit-payload purpose | No | No | No | JSON NULL | `AUDIT`, `EXPORT` | `T-AUDIT`, `T-SECOND`, `T-RET` | `DPO` + `SA` |
| `audit_logs.ip_address` | DEFER | IP is deliberately retained for forensics but is searchable by audit `q`; treatment depends on D-07/D-10 and restricted-search design | `audit_ip` | Yes | No | Yes, `ILIKE` over IP | String(45) NULL | `AUDIT`, `EXPORT`, `OBS`, `REDIS` | `T-CRYPT`, `T-AAD`, `T-SEARCH`, `T-AUDIT`, `T-RET` | `DPO` + `SA` + `PO` |

### 1.2 Enquiries, leads, submissions, reviews and notifications

| Table.column | Treatment | Reason / access controls | Proposed AAD purpose | T1 allowlist supports? | Exact lookup dependency | Partial search dependency | Constraints | Secondary copies | Required tests | Approver |
|---|---|---|---|---|---|---|---|---|---|---|
| `enquiries.id`, `course_id`, `college_id`, `state_id` | REMAIN PLAINTEXT | Internal IDs/FKs used for assignment and CRM filters; admin/counsellor-scoped only | `enquiry` | Yes | Yes, exact filters | No | Integer PK/I/FK | `AUDIT`, `EXPORT` | `T-WF`, `T-SEARCH` | `PO` + `DPO` |
| `enquiries.student_id` | REMAIN PLAINTEXT | Link to student profile; CRM assignment and DSAR lineage; counsellor-scoped | `enquiry` | Yes | Yes, exact by student | No | Integer NULL I/FK | `AUDIT`, `BROWSER` | `T-WF`, `T-SEARCH`, `T-RET` | `DPO` + `PO` |
| `enquiries.name` | ENCRYPT | Direct name; may be a minor; decrypt only in counsellor/admin authorized views | `enquiry` | Yes | No | Yes, lead/enquiry `ILIKE` | String(255) NN | `AUDIT`, `NOTIF`, `BROWSER`, `EXPORT` | `T-CRYPT`, `T-AAD`, `T-SEARCH`, `T-SECOND`, `T-WF` | `DPO` + `PO` + `SA` |
| `enquiries.mobile` | ENCRYPT | Contact detail; CRM search dependency; decrypt only for authorized callbacks | `enquiry` | Yes | Possible future exact dedupe; no current unique constraint | Yes, lead/enquiry `ILIKE` | String(20) NN I | `AUDIT`, `NOTIF`, `BROWSER`, `EXPORT`, `SMS` | `T-CRYPT`, `T-AAD`, `T-HMAC`, `T-SEARCH`, `T-SECOND`, `T-WF` | `DPO` + `PO` + `SA` |
| `enquiries.email` | ENCRYPT | Contact detail; CRM search dependency | `enquiry` | Yes | Possible future exact dedupe; no current unique constraint | Yes, lead `ILIKE` | String(255) NULL I | `AUDIT`, `NOTIF`, `BROWSER`, `EXPORT`, `EMAIL` | `T-CRYPT`, `T-AAD`, `T-HMAC`, `T-SEARCH`, `T-SECOND`, `T-WF` | `DPO` + `PO` + `SA` |
| `enquiries.city`, `enquiries.qualification` | ENCRYPT | Location and education context for a possibly minor lead | `enquiry` | Yes | No | No | String(100) NULL | `AUDIT`, `BROWSER`, `EXPORT` | `T-CRYPT`, `T-AAD`, `T-WF` | `DPO` + `PO` |
| `enquiries.message` | ENCRYPT | Sensitive free text; counsellor/admin only | `enquiry` | Yes | No | No | Text NULL | `AUDIT`, `BROWSER`, `EXPORT` | `T-CRYPT`, `T-AAD`, `T-WF`, `T-SECOND` | `DPO` + `PO` |
| `enquiries.source`, `source_url`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `device_type` | REMAIN PLAINTEXT | Attribution metadata; `source_url` has URL-minimisation remediation; admin analytics only | `enquiry` | Yes | Yes, report grouping | No | String NULL | `URL`, `OBS`, `AUDIT` | `T-SECOND`, `T-WF`, `T-RET` | `PO` + `DPO` |
| `enquiries.ip_address` | ENCRYPT | IP attribution; write-only in current workflow | `audit_ip` | Yes | No | No | String(45) NULL | `AUDIT`, `OBS` | `T-CRYPT`, `T-AAD`, `T-RET`, `T-SECOND` | `DPO` + `SA` |
| `enquiries.age_band` | REMAIN PLAINTEXT | Minor-policy gate; indexed; no DOB; counsellor/admin/consent-service access only | `enquiry` | Yes | Yes, minor filtering | No | String(20) NULL I | `AUDIT`, `BROWSER` | `T-WF`, `T-RET`, `T-SEARCH` | `DPO` + `PO` |
| `enquiries.is_minor` | REMAIN PLAINTEXT | Indexed minor flag used before callbacks; no personal content; counsellor/admin only | `enquiry` | Yes | Yes, minor filtering | No | Boolean NN I | `AUDIT`, `BROWSER` | `T-WF`, `T-RET`, `T-SEARCH` | `DPO` + `PO` |
| `enquiries.guardian_contact` | DEFER | Guardian phone/email for a minor; T1's closest purpose is `guardian_consent`, but D-09 must decide child-data treatment and validation | `guardian_consent` flagged uncertain | Partial | Possible equality to guardian consent target | No | String(255) NULL; no DB CHECK | `AUDIT`, `BROWSER`, `EXPORT`, `EMAIL`, `SMS` | `T-CRYPT`, `T-AAD`, `T-HMAC`, `T-WF`, `T-RET` | `DPO` + `SA` |
| `enquiries.status`, `assigned_counsellor_id`, `follow_up_date`, `created_at`, `updated_at` | REMAIN PLAINTEXT | CRM workflow state, assignment scope and timestamps; indexed; counsellor/admin only | `enquiry` / `counsellor_staff` | Yes | Yes, CRM filters | No | String/Integer/Date/DateTime, I/FK | `AUDIT`, `BROWSER`, `EXPORT` | `T-WF`, `T-SEARCH`, `T-RET` | `PO` + `DPO` |
| `lead_notes.id`, `enquiry_id`, `user_id`, `created_at` | REMAIN PLAINTEXT | Note identity and author/lead links; counsellor-scoped | `lead_note` | Yes | Yes, exact by lead | No | Integer PK/I/FK | `AUDIT` | `T-WF`, `T-SEARCH` | `PO` + `DPO` |
| `lead_notes.note` | ENCRYPT | Sensitive free text; counsellor/admin only | `lead_note` | Yes | No | No | Text NN | `AUDIT`, `EXPORT` | `T-CRYPT`, `T-AAD`, `T-WF`, `T-SECOND` | `DPO` + `PO` |
| `lead_status_history.id`, `enquiry_id`, `old_status`, `new_status`, `changed_by`, `created_at` | REMAIN PLAINTEXT | Lead state history with staff link; indexed; counsellor/admin/audit only | `enquiry` | Yes | Yes, exact by lead | No | Integer/String/DateTime, I/FK | `AUDIT` | `T-WF`, `T-AUDIT`, `T-RET` | `PO` + `DPO` |
| `college_submissions.id`, `submitted_by`, `status`, `reviewer_id`, `college_id`, `possible_duplicate_college_id`, timestamps | REMAIN PLAINTEXT | Submission workflow IDs/state; indexed; submitter/admin reviewer access | `college_submission` | Yes | Yes, owner/status filters | No | Integer/String/DateTime, I/FK | `AUDIT`, `BROWSER`, `EXPORT` | `T-WF`, `T-SEARCH`, `T-RET` | `PO` + `DPO` |
| `college_submissions.proposed_name` | DEFER | Exact duplicate check and advisory fuzzy `ILIKE`; neither randomized encryption nor HMAC alone preserves both behaviours | `college_submission` | Yes | Yes, slug/name duplicate checks | Yes, fuzzy token hints | String(255) NN I | `AUDIT`, `BROWSER`, `EXPORT` | `T-CRYPT`, `T-AAD`, `T-HMAC`, `T-SEARCH`, `T-WF` | `SA` + `PO` + `DBA` |
| `college_submissions.proposed_university_name`, `proposed_official_name`, `proposed_college_type`, `proposed_ownership` | DEFER | Exact lowercase university-name match at approval and fuzzy hints; same dependency as proposed name | `college_submission` | Yes | Yes for university name | Yes for advisory hints | String NULL | `AUDIT`, `BROWSER`, `EXPORT` | `T-HMAC`, `T-SEARCH`, `T-WF` | `SA` + `PO` |
| `college_submissions.proposed_state_id`, `proposed_state_name`, `proposed_city`, `proposed_address` | ENCRYPT | Submission location/address; no current exact lookup on address; admin reviewer only | `college_submission` | Yes | No | No | Integer/String/Text NULL I/FK | `AUDIT`, `BROWSER`, `EXPORT` | `T-CRYPT`, `T-AAD`, `T-WF` | `DPO` + `PO` |
| `college_submissions.proposed_email`, `proposed_phone` | ENCRYPT | Submission contact details; no current lookup/search; admin reviewer only | `college_submission` | Yes | No | No | String NULL | `AUDIT`, `BROWSER`, `EXPORT`, `EMAIL`, `SMS` | `T-CRYPT`, `T-AAD`, `T-WF`, `T-SECOND` | `DPO` + `SA` |
| `college_submissions.proposed_website`, `proposed_overview` | ENCRYPT | Free-text submission content; admin reviewer only | `college_submission` | Yes | No | No | String/Text NULL | `AUDIT`, `BROWSER`, `EXPORT` | `T-CRYPT`, `T-AAD`, `T-WF` | `DPO` + `PO` |
| `college_submissions.submitter_notes` | ENCRYPT | Sensitive free text; submitter/admin reviewer only | `college_submission` | Yes | No | No | Text NULL | `AUDIT`, `BROWSER`, `EXPORT` | `T-CRYPT`, `T-AAD`, `T-WF`, `T-SECOND` | `DPO` + `PO` |
| `college_submissions.reviewer_notes` | ENCRYPT | Sensitive staff free text; reviewer/admin only | `college_submission` | Yes | No | No | Text NULL | `AUDIT`, `BROWSER`, `EXPORT` | `T-CRYPT`, `T-AAD`, `T-WF`, `T-SECOND` | `DPO` + `PO` |
| `reviews.id`, `student_id`, `college_id`, `course_id`, `rating`, `status`, `is_verified`, timestamps | REMAIN PLAINTEXT | Review identity, FK and moderation state; unique `(student_id, college_id)` and indexed status; public/moderation rules apply | `UNCERTAIN` — no review purpose | No | Yes, duplicate check by IDs | No | Integer/Float/String/Boolean, I/FK/composite-U | `AUDIT`, `BROWSER` | `T-WF`, `T-UNIQ`, `T-SEARCH` | `PO` + `SA` |
| `reviews.review_text` | DEFER | Student free text has no T1 purpose; public display and audit/delete copies need policy decision | `UNCERTAIN` — no review/free-text purpose | No | No | No | Text NULL | `AUDIT`, `BROWSER`, `EXPORT` | `T-AUDIT`, `T-SECOND`, `T-WF` | `DPO` + `PO` |
| `reviews.year_of_study` | DEFER | Student-class information; no review-purpose in allowlist; public display decision required | `UNCERTAIN` — no class purpose | No | No | No | String(20) NULL | `AUDIT`, `BROWSER` | `T-WF`, `T-SECOND` | `DPO` + `PO` |
| `reviews.images` | DEFER | JSON may contain photos/identifiers; no review-JSON purpose or storage policy | `UNCERTAIN` | No | No | No | JSON NULL | `AUDIT`, `BROWSER` | `T-SECOND`, `T-WF` | `DPO` + `SA` |
| `reviews.moderation_notes`, `moderated_by`, `moderated_at` | DEFER | Staff free text and moderator identity; no moderation-purpose; copied into audit JSON | `UNCERTAIN` | No | No | No | Text/Integer/DateTime NULL FK | `AUDIT`, `BROWSER`, `EXPORT` | `T-AUDIT`, `T-SECOND`, `T-WF` | `DPO` + `PO` |
| `notifications.id`, `user_id`, `type`, `is_read`, `channel`, `batch_id`, `created_at` | REMAIN PLAINTEXT | Routing/delivery metadata and indexes; user-scoped; notification service only | `UNCERTAIN` — no notification purpose | No | Yes, exact by user/type/read/batch | No | Integer/String/Boolean/DateTime, I/FK | `NOTIF`, `BROWSER` | `T-WF`, `T-RET` | `PO` + `SA` |
| `notifications.title`, `notifications.message` | DEFER | Known plaintext copies of lead name/mobile and admin-entered text; no notification purpose; source remediation preferred | `UNCERTAIN` | No | No | No | String NULL/NN | `NOTIF`, `BROWSER`, `EMAIL`, `EXPORT`, `OBS` | `T-SECOND`, `T-WF`, `T-RET` | `DPO` + `PO` |
| `notifications.data` | DEFER | JSON contains mobile and lead reference copies; no notification-JSON purpose | `UNCERTAIN` | No | No | No | JSON NULL | `NOTIF`, `BROWSER`, `EMAIL`, `EXPORT`, `OBS` | `T-SECOND`, `T-WF`, `T-RET` | `DPO` + `SA` |

### 1.3 Assessment, proctoring, media and imports

| Table.column | Treatment | Reason / access controls | Proposed AAD purpose | T1 allowlist supports? | Exact lookup dependency | Partial search dependency | Constraints | Secondary copies | Required tests | Approver |
|---|---|---|---|---|---|---|---|---|---|---|
| `test_attempts.id`, `mock_test_id`, `user_id`, `status`, `started_at`, `expires_at`, `submitted_at`, timestamps | REMAIN PLAINTEXT | Assessment lifecycle IDs/state; indexed; student and grading-role access only | `student_profile` closest | Partial | Yes, by user/attempt/status | No | Integer/String/DateTime, I/FK | `AUDIT` | `T-WF`, `T-SEARCH` | `PO` + `SA` |
| `test_attempts.score`, `total_marks`, `correct_count`, `incorrect_count`, `unanswered_count`, `pending_review_count`, `percentage` | DEFER | Student result data has no T1 result purpose; grading workflow must remain functional | `UNCERTAIN` — no assessment-result purpose | No | No | No | Numeric/Integer NULL | `AUDIT`, `BROWSER` | `T-WF`, `T-SECOND` | `PO` + `DPO` |
| `test_answers.id`, `attempt_id`, `question_id`, timestamps | REMAIN PLAINTEXT | Assessment record links and composite uniqueness; grading access only | `student_profile` closest | Partial | Yes, by attempt/question | No | Integer PK/I/FK/composite-U | `AUDIT` | `T-WF`, `T-UNIQ` | `PO` + `SA` |
| `test_answers.selected_answer` | DEFER | Student free-text answer; no free-answer purpose | `UNCERTAIN` | No | No | No | String(255) NULL | `AUDIT`, `BROWSER` | `T-WF`, `T-SECOND` | `PO` + `DPO` |
| `test_answers.is_correct`, `marks_awarded`, `answered_at`, `graded_by`, `graded_at`, `grader_feedback` | DEFER | Result and grading feedback with staff identity; no result/grading purpose | `UNCERTAIN` | No | No | No | Boolean/Numeric/DateTime/Integer/Text NULL FK | `AUDIT`, `BROWSER` | `T-WF`, `T-SECOND` | `PO` + `DPO` |
| `proctoring_sessions.id`, `attempt_id`, `user_id`, `mock_test_id`, `status`, `started_at`, `ended_at`, timestamps | DEFER | No registered backend workflow; no T1 proctoring purpose; future search behaviour unknown | `UNCERTAIN` | No | Yes, unique attempt and user/test indexes | No | Integer/String/DateTime, U/I/FK | None | `T-WF`, `T-SEARCH`, `T-RET` | `PO` + `SA` + `DPO` |
| `proctoring_sessions.ended_reason` | DEFER | Free text; no proctoring purpose | `UNCERTAIN` | No | No | No | Text NULL | None | `T-WF`, `T-SECOND` | `DPO` + `PO` |
| `proctoring_events.id`, `session_id`, `event_type`, `severity`, `occurred_at`, `remaining_seconds`, `created_at` | DEFER | Student behaviour metadata; no proctoring purpose; no current router | `UNCERTAIN` | No | Yes, by session | No | Integer/String/DateTime, I/FK/CHECK | None | `T-WF`, `T-SEARCH` | `PO` + `SA` |
| `proctoring_events.reason`, `detail` | DEFER | Free text and JSON may contain PII; no proctoring/JSON purpose; no current router | `UNCERTAIN` | No | No | No | Text/JSON NULL | None | `T-SECOND`, `T-WF` | `DPO` + `SA` |
| `media.url`, `file_name`, `alt_text`, `entity_type`, `entity_id` | DEFER | Public/media URL but filenames and alt text may contain personal names; no media-purpose; audit copies exist | `UNCERTAIN` | No | No | No | String/Integer, I | `AUDIT`, `OBS`, `URL` | `T-AUDIT`, `T-SECOND`, `T-WF` | `PO` + `DPO` |
| `question_import_jobs.created_by` | REMAIN PLAINTEXT | Staff FK and operational filter; import-admin access only | `admin_staff` closest | Partial | Yes, exact by creator/status | No | Integer NULL I/FK | `AUDIT` | `T-WF`, `T-SEARCH` | `SA` + `PO` |
| `question_import_jobs.filename` | DEFER | Client-controlled free text may contain PII; no import-purpose | `UNCERTAIN` | No | No | No | String(255) NN | `AUDIT`, `OBS` | `T-AUDIT`, `T-SECOND`, `T-WF` | `DPO` + `PO` |
| `question_import_jobs.error_message` | DEFER | Free-text error may contain personal data; no import-purpose | `UNCERTAIN` | No | No | No | Text NULL | `AUDIT`, `OBS` | `T-AUDIT`, `T-SECOND`, `T-WF` | `DPO` + `PO` |
| `question_import_jobs.status`, counts, timestamps | REMAIN PLAINTEXT | Operational counters and status; no personal content; import-admin access only | `NONE` | N/A | Yes, status filter | No | Integer/String/DateTime, CHECK | `AUDIT` | `T-WF`, `T-RET` | `PO` |

### 1.4 Reviewed and excluded as not personal data

These were checked during T2.1 and are explicitly `NOT PERSONAL DATA`:

- Public catalogue identity/location fields in `colleges`, `universities`, `states`, `districts`, `courses`, `exams`, `scholarships`, `fees`, `cutoffs`, `rankings`, `placements`, `seat_matrix`.
- Public organisational contact values such as `colleges.email`, `colleges.phone`, `site_settings.support_email`, `site_settings.contact_phone`, `counselling_hours`, `default_timezone`.
- `roles.name`, capacity flags such as `counsellors.max_leads`, operational counts and non-personal status enums.
- Static/banner/FAQ/blog/SEO content fields, except author/staff links noted above.

Access controls remain the existing public/admin route rules; no encryption or HMAC treatment is proposed.

---

## 2. HMAC lookup matrix

### 2.1 Confirmed cases

These fields require narrow HMAC exact-lookup tokens if their source columns become encrypted. They are **exact equality** mechanisms only and must not be represented as substring-search indexes.

| Source field | Class | Normalization | Domain | Uniqueness / constraint requirement | Tests | Approver |
|---|---|---|---|---|---|---|
| `users.email` | Confirmed | `normalize_email()`: trim + lowercase | `user_email` | Unique lookup index authoritative after cutover; same transaction as insert/update; duplicate maps to generic 409 | `T-HMAC`, `T-UNIQ`, `T-KEY`, `T-WF` | `SA` + `DPO` |
| `users.mobile` | Confirmed | `normalize_mobile()`: 10 national digits | `user_mobile` | Unique lookup index authoritative after cutover; same transaction as insert/update | `T-HMAC`, `T-UNIQ`, `T-KEY`, `T-WF` | `SA` + `DPO` |
| `otp_records.identifier` | Confirmed | Existing `normalize_email()` / `normalize_mobile()` by purpose | `otp_identifier:{base_purpose}` | Composite with purpose and creation/expiry ordering; must preserve rate-limit and supersession semantics | `T-HMAC`, `T-WF`, `T-RET`, `T-KEY` | `SA` |
| `guardian_consents.guardian_email` | Confirmed | Trim + lowercase | `guardian_email` | Non-unique, scoped to user/consent; must support child-vs-guardian equality | `T-HMAC`, `T-WF`, `T-KEY` | `SA` + `DPO` |
| `guardian_consents.guardian_mobile` | Confirmed | 10 national digits | `guardian_mobile` | Non-unique, scoped to user/consent; must support child-vs-guardian equality | `T-HMAC`, `T-WF`, `T-KEY` | `SA` + `DPO` |
| `guardian_consents.verification_target` | Confirmed | Exact normalized channel target | `guardian_verification_target` | Indexed non-unique token; must reconcile with `otp_records.identifier` | `T-HMAC`, `T-WF`, `T-KEY` | `SA` + `DPO` |

Domain-separation string proposed by the corrected plan:

```text
padhaanewala|pii-lookup|v1|{domain}|{key_version}|{normalized_value}
```

Token format proposed by the corrected plan:

```text
v<n>$<base64url(hmac)>
```

### 2.2 Uncertain cases

| Source field | Why uncertain | Required decision before any token work | Tests | Approver |
|---|---|---|---|---|
| `data_requests.subject`, `data_requests.details` | Exact duplicate detection exists, but values are free text; HMAC supports only exact equality, not DSAR search or review | Decide whether exact duplicate key is necessary after encryption and whether token equality leakage is acceptable | `T-HMAC`, `T-WF`, `T-RET` | `SA` + `DPO` |
| `college_submissions.proposed_name`, `proposed_university_name` | Exact slug/name checks plus advisory fuzzy `ILIKE` hint; HMAC cannot support fuzzy matching | Decide split between exact token, restricted search and plaintext public-name comparison | `T-HMAC`, `T-SEARCH`, `T-WF` | `SA` + `PO` + `DBA` |
| `enquiries.mobile`, `enquiries.email` | No current uniqueness, but CRM partial search exists; future exact dedupe is possible | Decide if exact dedupe requirement exists; do not use HMAC for `ILIKE` | `T-HMAC`, `T-SEARCH`, `T-WF` | `SA` + `PO` + `DPO` |
| `refresh_tokens.jti`, `refresh_tokens.family` | High-entropy opaque identifiers, not personal data; tokenization would require session redesign | Decide whether to reclassify as sensitive; otherwise retain as plaintext opaque IDs | `T-WF`, `T-UNIQ`, `T-KEY` | `SA` |
| Audit `username` / email / IP query fields | Audit `q` uses substring matching | HMAC is insufficient; restricted-search design and D-10/D-11 must decide | `T-SEARCH`, `T-AUDIT`, `T-SECOND` | `SA` + `DPO` + `PO` |

### 2.3 Unnecessary cases

HMAC lookup tokens are **unnecessary** for:

- `users.password_hash`, `otp_records.code_hash` — existing one-way bcrypt digests.
- Internal PK/FK columns, status flags, timestamps and counters.
- Write-only free text with no exact lookup: `lead_notes.note`, `consent_records.consent_text`, `guardian_consents.consent_text`, `data_requests.resolution`, `college_submissions.submitter_notes`, `reviewer_notes`.
- Write-only IP fields: `consent_records.ip_address`, `guardian_consents.request_ip`, `otp_records.request_ip`, `refresh_tokens.request_ip`, `enquiries.ip_address`.
- Public catalogue/organisational contact fields.
- Notification copies that should be redesigned to carry references instead of PII.
- Proctoring fields until a router and actual lookup requirements exist.

### 2.4 HMAC operational contract

1. **Normalization must not change.** Reuse current email/mobile normalization and OTP `base_purpose()` behaviour. Any change is D-05 and requires compatibility sign-off.
2. **Uniqueness is database-enforced.** Pre-checks improve UX only. Authoritative uniqueness comes from unique indexes on lookup columns after cutover.
3. **Concurrent writes are transactional.** Registration and email/mobile updates write ciphertext, lookup token and key-version metadata in one transaction. A unique violation rolls back the whole operation and maps to the existing generic conflict response without naming the colliding field.
4. **Collision policy.** A true HMAC collision is an integrity incident and is rejected. A duplicate normalized business value is a duplicate record, not a crypto collision.
5. **Key versioning.** Lookup token version is distinct from AES envelope format and AES key version. Writes produce only the authoritative version. Reads accept configured versions. Unknown versions fail closed.
6. **Rotation.** Add shadow lookup columns and indexes; deploy dual-write; backfill; verify 100% parity; flip `PII_LOOKUP_VERSION`; retain old columns and keys for rollback; retire only under D-17-equivalent separate approval.
7. **Mixed-version deployment.** During rollout, old application instances may write/read v1 while new instances dual-write v1 and v2 or write v2 according to flags. All instances must read both configured versions. No instance may reject a configured old version while `PII_LOOKUP_READ_VERSIONS` includes it.
8. **No leakage.** Tokens, normalized values, plaintext and key material must never appear in logs, exception messages, cursor payloads, URLs or observability events.

---

## 3. Restricted partial-search architecture decision

**Status:** `PROPOSED`. This is required before any `ILIKE`-based PII field is encrypted or any plaintext search is disabled.

### 3.1 Core decision

HMAC lookup tokens are **not** a solution for substring search. They support exact equality only.

The proposed architecture is restricted backend search:

1. Use non-sensitive indexed columns for candidate selection.
2. Decrypt only bounded candidate rows inside an authorized backend request.
3. Apply substring matching in memory over decrypted fields.
4. Return page results from a short-lived, integrity-protected search session.
5. Never expose ciphertext, tokens, raw queries, decrypted non-returned values, exact totals on incomplete searches, or cross-scope rows.

### 3.2 RBAC and counsellor scope

| Search surface | Allowed roles | Scope rule |
|---|---|---|
| Admin user search | `admin` only | No counsellor access |
| Lead/CRM search | `admin` or active `counsellor` | Counsellors restricted to `enquiries.assigned_counsellor_id == current_counsellor.id`; admins may search all approved scopes |
| Audit search | `admin` / security role only | No counsellor access; action/entity/date filters first |
| College submission hints | `admin` only | Advisory results only; never authoritative duplicate check |
| DSAR queue | DSAR/admin role only | No counsellor access |

Counsellor scope must be revalidated on every cursor continuation. A role change, deactivation or reassignment invalidates the search session. Cross-counsellor results are a zero-tolerance gate.

### 3.3 Candidate selection

Allowed first-stage filters:

- IDs and FKs: `assigned_counsellor_id`, `student_id`, `college_id`, `user_id`.
- Lifecycle state: `status`, `is_active`, `is_read`, `is_verified`.
- Non-encrypted minor/policy flags: `is_minor`, `age_band`.
- Time windows: `created_at`, `due_at`, `expires_at`.
- Approved exact lookup tokens where HMAC is authorised.

Prohibited first-stage filters after encryption:

- DB `ILIKE` / `LIKE` over encrypted PII columns.
- DB substring matching over lookup tokens.
- Full-table scans with decryption of all rows.
- Plaintext client-side search over exported data.

### 3.4 Decryption limits

Proposed defaults, subject to product/DBA approval:

| Limit | Proposed value |
|---|---:|
| Default page size | 25 |
| Maximum page size | 100 |
| Maximum decrypted candidates per search session | 1,000 |
| Maximum pages per session | 40 |
| Search-session TTL | 15 minutes |
| Concurrent sessions per user | 5 |
| Search rate limit per user | 30 requests/minute |
| Search rate limit per client IP | 120 requests/minute |

Decryption happens only for fields needed to evaluate the query and render returned rows. Decrypted values must not be cached in Redis, browser storage, logs or application globals.

### 3.5 Pagination and cursor/session integrity

- A search creates a server-side candidate snapshot containing immutable candidate IDs and filter metadata.
- The cursor must be opaque, HMAC-signed, and bound to:
  - search session ID,
  - authenticated user ID and role set,
  - counsellor scope where applicable,
  - normalized filter hash,
  - page position,
  - expiry timestamp.
- Every continuation verifies the cursor signature, TTL, role, scope and filter hash before decrypting any row.
- Client-supplied offsets and raw candidate IDs are not trusted.
- Pagination must guarantee zero duplicates and zero silently omitted rows within a valid session.

### 3.6 Consistency semantics

- Search results are point-in-time relative to the candidate snapshot.
- Rows created after snapshot creation are not included in that search.
- Rows updated after snapshot creation are evaluated using their state at decryption time; if the update changes scope or role eligibility, the row is skipped.
- Rows deleted after snapshot creation are skipped and do not fail the whole request.
- Decrypt failures or AAD failures are skipped, counted as integrity events, and never surfaced as ciphertext or raw errors.
- Exact total counts are returned only when the candidate set is complete and no skip/truncation occurred; otherwise `total` is omitted and `complete=false`.

### 3.7 Result caps and incomplete-result behavior

When a candidate cap, page cap, TTL, rate limit or integrity skip threshold is reached:

```json
{
  "items": ["..."],
  "next_cursor": null,
  "complete": false,
  "truncated": true,
  "reason_code": "CANDIDATE_CAP_REACHED"
}
```

Allowed reason codes are non-sensitive: `CANDIDATE_CAP_REACHED`, `PAGE_CAP_REACHED`, `SESSION_EXPIRED`, `SCOPE_CHANGED`, `INTEGRITY_SKIP`, `RATE_LIMITED`.

The UI must show “refine search” behaviour and must not present an exact total.

### 3.8 Audit search

Audit search follows the same model:

- first-stage filters: action, entity type, entity ID, user ID, date range;
- decrypt actor display and IP only for bounded candidates;
- no raw query logging;
- no decrypted old/new JSON in search results;
- audit JSON remediation must land before encrypted audit IP search is enabled.

---

## 4. Secondary-copy remediation plans

### 4.1 Audit JSON

**Problem:** `audit_logs.old_value` / `new_value` can contain names, free text, guardian contact, titles, messages and file names. Current redaction is key-name based and stops at depth 3.

**Plan:**

1. Extend redaction to recursive traversal with no silent depth cutoff; handle lists of dicts.
2. Replace free-text values with field-name-plus-marker unless an explicit allowlist approves the value.
3. Stop writing actor display name/email into audit payloads; store stable user IDs and render display names through authorized views.
4. Back-scan legacy rows under D-11 after DPO/security decision; do not rewrite historical evidence without approval.
5. Define a future `audit_payload` AAD purpose before encrypting retained JSON.
6. Tests: `T-AUDIT`, `T-SECOND`, `T-RET`.

**Owner:** `DPO` + `SA`. **Status:** `PROPOSED`.

### 4.2 Notifications

**Problem:** lead handoff copies name/mobile into `title`, `message` and `data`.

**Plan:**

1. Replace PII strings with references: `enquiry_id`, `lead_id`, generic text “New enquiry assigned”.
2. Render recipient-visible details only through authorized lead endpoints.
3. Remove mobile from notification JSON; keep non-sensitive IDs.
4. Define retention for read notifications under D-10/D-13.
5. Do not encrypt notification copies until source-copy redesign is approved.

**Owner:** `DPO` + `PO`. **Status:** `PROPOSED`.

### 4.3 Browser `localStorage`

**Problem:** `cp_user`, `cp_profile`, `cp_enquiries`, `cp_reviews`, `cp_recent_searches`, `cp_recent_locations` retain contact data, messages and query history. Some keys are not cleared on logout.

**Plan:**

1. Persist only IDs, roles and non-sensitive preferences.
2. Keep email/mobile/name in memory or server state; refetch after login.
3. Remove `source_url` and raw query strings from stored enquiry drafts.
4. Clear all PII-bearing keys on logout after D-12 approval; production clearing is currently prohibited without separate approval.
5. Update cookie/privacy policy to match actual keys and clearing behaviour.

**Owner:** `DPO` + `PO`. **Status:** `PROPOSED`.

### 4.4 CSV exports

**Problem:** lead export contains name/mobile/email and audit export contains actor/IP.

**Plan:**

1. Default exports to IDs and non-sensitive workflow fields.
2. Add role-gated, audited “include contact details” only if DPO/product approve.
3. Mask mobile/email and IP by default.
4. Log export metadata only: actor ID, resource type, row count, timestamp — never exported values.
5. No decrypted bulk export before D-07/D-12 decisions.

**Owner:** `DPO` + `PO`. **Status:** `PROPOSED`.

### 4.5 URLs and query strings

**Problem:** token URLs and `source_url` can carry credentials or user-entered PII; proxy logs do not filter query strings.

**Plan:**

1. Store path/origin only in `source_url`; strip query values.
2. Keep `noindex` and client-side token stripping.
3. Move one-time tokens out of URLs to POST body or fragment where protocol allows.
4. Add proxy log query-filter rule for `token`, `email`, `mobile`, `q`.
5. Add tests that no token or PII appears in stored URLs or logs.

**Owner:** `SA` + `PO` + `OPS`. **Status:** `PROPOSED`.

### 4.6 Email/SMS logs

**Problem:** console fallback logs recipient, body, mobile and OTP; provider retention is unknown.

**Plan:**

1. Log only message type, recipient reference ID, provider status and error class.
2. Never log recipient address/mobile, OTP secret, reset link or full body.
3. Obtain DPA/vendor retention evidence under D-13.
4. Add redaction tests for console and failure paths.
5. Keep masked last-four response only where currently approved.

**Owner:** `OPS` + `DPO`. **Status:** `PROPOSED`.

### 4.7 Redis

**Problem:** rate-limit keys contain raw client IP.

**Plan:**

1. Replace raw IP in `rl:{namespace}:{path}:{client_ip}` with a short-lived HMAC or opaque hash of IP plus purpose.
2. Keep TTLs short and persistence disabled.
3. Never store normalized email/mobile, search queries or decrypted values in Redis.
4. Log only counter namespace and outcome.

**Owner:** `SA` + `OPS`. **Status:** `PROPOSED`.

### 4.8 Observability

**Problem:** frontend error payloads send raw `message` and `stack`; backend logs method/path and traceback. Free text may contain PII.

**Plan:**

1. Add allowlist plus PII scrubbing for error messages and stacks.
2. Drop query strings and authorization headers from all events.
3. Cap lengths and reject keys matching email/mobile/token/password patterns.
4. No Sentry/analytics SDK or tracking cookie until DPO/legal approve vendor retention.
5. Tests assert no fixture PII appears in captured events.

**Owner:** `SA` + `OPS` + `DPO`. **Status:** `PROPOSED`.

---

## 5. Decision register D-01 to D-18

No approval evidence was found. All decisions remain `OPEN`. The disposition column is this document's proposal, not an approval.

| ID | Decision | Exact approver | Status | T2.2 proposed disposition | Evidence required |
|---|---|---|---|---|---|
| D-01 | Supersede ADR-0009 partial-encryption decision | Security Architect | OPEN | Approve supersession before any integrated encryption; T1 primitives do not supersede it | Signed ADR update |
| D-02 | Explicit service-layer encryption over `TypeDecorator` | Security Architect | OPEN | Approve service-layer integration; keep models/SQLAlchemy-independent primitives | Architecture sign-off |
| D-03 | AES envelope format and AAD allowlist | Security Architect | OPEN | Adopt T1 envelope; add approved purposes for DEFER fields before encrypting them | Crypto design review |
| D-04 | HMAC exact-lookup tokens and equality leakage | Security Architect + DPO | OPEN | Approve confirmed lookup matrix only; reject HMAC for substring search | Written risk acceptance |
| D-05 | Preserve OTP purpose/normalization | Security Architect | OPEN | Freeze current normalization and `base_purpose()` semantics | Compatibility test sign-off |
| D-06 | Lookup-key rotation with shadow columns | Security Architect + DBA | OPEN | Approve shadow lookup columns, dual-write and parity gate before token rollout | Rotation rehearsal evidence |
| D-07 | Search session/cursor semantics | Product owner | OPEN | Adopt restricted search architecture in section 3 | UX and API contract approval |
| D-08 | Counsellor scope rules | Product owner + DPO | OPEN | Confirm assigned-counsellor-only scope and revalidation on every page | RBAC approval |
| D-09 | Child-data plaintext exceptions | DPO/legal | OPEN | Decide minor fields, guardian contact and notification/CRM exceptions | Legal decision register sign-off |
| D-10 | Consent text and audit IP retention | DPO/legal | OPEN | Decide retention for consent text, audit IP and notification copies | Legal rationale |
| D-11 | Legacy audit JSON remediation | DPO + Security Architect | OPEN | Approve scan and remediation/back-scan policy | Scan results and decision |
| D-12 | Browser localStorage minimisation | DPO + Product owner | OPEN | Approve key minimisation and logout clearing; no production clearing before approval | Updated policy approval |
| D-13 | Email/SMS processor retention | Legal/vendor owner | OPEN | Obtain DPA evidence; redact console/provider logs | DPA/vendor evidence |
| D-14 | Backup key custody and retention | Operations/key custodian + DPO | OPEN | Approve custody before encrypted backups/restore rehearsal | Rehearsal evidence |
| D-15 | Concurrent-index pattern and thresholds | DBA owner | OPEN | Approve index build pattern, thresholds and lock monitoring before schema work | Staging lock metrics |
| D-16 | Branch reconciliation execution | Release owner | OPEN | T0 already executed to HEAD `5049ab1`; formal evidence must still be recorded/approved | Precondition checklist |
| D-17 | Destructive plaintext removal | Security Architect + DPO + DBA | OPEN | Keep separate; never bundled with read cutover | Separate approval |
| D-18 | Production key rotation | Security Architect + Operations/key custodian | OPEN | Staging rehearsal first; no production rotation in T2.2 | Separate approval |

### Architecture-level decisions

| ID | Decision | Status | Approver |
|---|---|---|---|
| A-01 | Field treatment matrix in section 1 | PROPOSED | `SA` + `DPO` + `PO` + `DBA` where indexes are affected |
| A-02 | HMAC exact-lookup matrix in section 2 | PROPOSED | `SA` + `DPO` |
| A-03 | Restricted partial-search architecture in section 3 | PROPOSED | `PO` + `SA` + `DPO` |
| A-04 | Secondary-copy remediation plans in section 4 | PROPOSED | `DPO` + `SA` + `PO` + `OPS` |
| A-05 | Staged implementation order in section 6 | PROPOSED | `SA` + `DBA` + `PO` + `OPS` |
| A-06 | Test and rollback strategy in section 7 | PROPOSED | `SA` + `DBA` + `OPS` |

No item is `APPROVED`.

---

## 6. Blocking decisions before implementation

### 6.1 Blocks all source implementation

- D-01: ADR-0009 supersession.
- D-02: service-layer encryption architecture.
- D-03: envelope/AAD allowlist, including new purposes for `DEFER` fields.
- DPO decision on `DEFER` fields where the current allowlist is insufficient.

### 6.2 Blocks HMAC lookup implementation

- D-04: HMAC equality-leakage risk acceptance.
- D-05: OTP purpose and normalization freeze.
- D-06: lookup rotation/shadow-column design and rehearsal.
- DBA approval for lookup indexes and uniqueness cutover.

### 6.3 Blocks search/encryption for CRM, admin user, audit and college-submission flows

- D-07: search session/cursor semantics.
- D-08: counsellor scope rules.
- D-09: child-data plaintext exceptions.
- D-10: consent text and audit IP retention.
- D-11: legacy audit JSON remediation.

### 6.4 Blocks schema/migration work

- D-15: concurrent-index pattern and thresholds.
- Verified single Alembic head before migration creation.
- Backup/restore evidence before read cutover.

### 6.5 Blocks destructive or production-secret work

- D-14: backup key custody.
- D-17: destructive plaintext removal.
- D-18: production key rotation.
- Separate approval for clearing browser `localStorage` keys in production.
- Separate approval for changing email/SMS processor retention.

---

## 7. Staged implementation order

Implementation must preserve existing login, OTP, guardian consent, CRM, audit, DSAR and counsellor functionality at every stage.

| Stage | Action | Safety rule | Go/no-go gate |
|---|---|---|---|
| S0 | Approvals, baseline hashes, context-ID design, inventory sign-off | No source changes | All blocking decisions for the next stage approved |
| S1 | Expand schema: nullable encrypted, lookup, key-version and context columns | No reads switch; plaintext authoritative | Apply/rollback rehearsal passes |
| S2 | Add lookup and shadow columns | No unique cutover yet | Index design approved |
| S3 | Build concurrent indexes | DBA approval; validity checks | No excessive lock wait |
| S4 | Deploy crypto/config with flags off | No workflow change | Crypto tests pass; zero key leakage |
| S5 | Enable transactional dual-write for low-risk fields only | Plaintext remains authoritative | 100% sampled consistency |
| S6 | Enable confirmed HMAC dual-write | All reads still accept old behaviour | Normalization parity and concurrent duplicate tests pass |
| S7 | Idempotent backfill | Pause on any mismatch | 100% row coverage, rerun changes zero |
| S8 | Verification job | No cutover until all checks pass | Decryptability, AAD, token parity, context checks 100% |
| S9 | Restricted search shadow mode | Existing search remains authoritative | RBAC/counsellor/cursor/pagination tests pass |
| S10 | Flip secure search authoritative | Flag rollback retained | Zero cross-scope results; no exact totals on incomplete searches |
| S11 | Flip encrypted reads authoritative | Plaintext columns retained | Zero decrypt failures |
| S12 | Soak and observability review | No PII in logs/events | Zero-leak gate passes |
| S13 | Rotation rehearsal | Use disposable/staging keys | v1/v2 compatibility passes |
| S14 | Secondary-copy remediation | No production browser clearing without approval | No PII in audit JSON, notifications, exports, URLs, logs |
| S15 | Destructive plaintext removal | Separate explicit approval only | Restore proof before removal |

### 7.1 Workflow preservation by stage

| Workflow | Preservation rule |
|---|---|
| Login/register | Plaintext unique indexes authority until HMAC unique indexes are verified; generic 409 preserved |
| OTP | Purpose and normalization unchanged; all configured token versions readable; pre-auth identifier lookup parity required |
| Guardian consent | Child-vs-guardian equality and OTP purpose binding verified before guardian fields cut over |
| CRM/leads | Counsellor scope enforced before any search cutover; assigned-lead filter remains authoritative |
| Audit | Audit write/search remains functional; JSON redaction remediation precedes any encrypted IP search |
| DSAR | Data-request duplicate and queue behaviour preserved; resolution/export paths remain authorized and masked |
| Counsellor operations | Assignment notes, status history and lead detail reads continue to decrypt only within assigned scope |

---

## 8. Proposed test and rollback strategy

### 8.1 Test strategy

1. **Baseline regression:** existing backend and frontend suites must pass before source changes.
2. **Unit crypto:** all T1 `test_pii_crypto.py` cases remain required; no plaintext/key/nonce leakage.
3. **AAD/context:** every encrypted field tested against its exact table, column, context UUID and purpose.
4. **Lookup token:** normalization parity, domain separation, token versions, unknown-version failure, unique constraints, concurrent writes.
5. **Restricted search:** RBAC matrix, counsellor scope, cursor tamper, TTL, filter hash, pagination duplicates/omissions, caps, incomplete-result semantics.
6. **Workflow integration:** every `T-WF` case listed in section 1; auth, OTP, guardian consent, CRM, audit, DSAR and counsellor flows are mandatory.
7. **Secondary leakage:** audit JSON, notification, browser, export, URL, email/SMS, Redis and observability assertions.
8. **Retention/erasure:** OTP, refresh token, consent, guardian consent, DSAR and audit sweeps; dry-run/apply parity.
9. **Migration:** expand/rollback, concurrent index validity, backfill idempotency, dual-write consistency.
10. **Key/rotation:** current write key, previous read keys, unknown version failure, staging rotation rehearsal.
11. **Zero-tolerance gates:** zero PII in logs/errors/URLs/traces; zero cross-counsellor results; zero decrypt failures at cutover; zero omitted/duplicated search rows.

### 8.2 Rollback strategy

| Stage | Rollback |
|---|---|
| Schema expand only | Drop newly added nullable columns/indexes before any dual-write |
| Dual-write | Disable dual-write flag; plaintext remains authoritative; encrypted columns ignored |
| HMAC dual-write | Disable authoritative lookup flag; keep tokens readable; fall back to plaintext lookup columns |
| Backfill | Pause job; retain partial encrypted columns; no read cutover |
| Restricted search shadow | Keep legacy search authoritative; disable shadow flag |
| Secure search cutover | Flip search flag back while plaintext/restricted-search inputs retained |
| Encrypted read cutover | Flip read flag back to plaintext while plaintext columns retained |
| Key rotation | Flag back to previous key version; retain previous keys until rehearsal complete |
| Secondary-copy changes | Flag/revert redaction or reference-only rendering; no production localStorage clearing rollback once cleared |
| Destructive removal | No application rollback; restore from approved backup only |

No destructive rollback is acceptable before D-17 and a restore rehearsal.

---

## 9. Coverage limitations

- This document is architecture/approval work only; no source, test, model, config, migration, or database change was made.
- T2.1 was static code/schema review; no production data, live database, deployed logs, vendor consoles, or runtime traces were accessed.
- No approval evidence was found in the repository; therefore no decision is marked `APPROVED`.
- Proctoring has models/schemas but no registered router, so future search/retention needs remain uncertain.
- Email/SMS, browser, backup and observability behaviour outside the repository cannot be verified here.
- Proposed numeric search limits are design defaults, not approved operational values.
- Secondary-copy remediation depends on D-10 through D-15 evidence that has not been supplied.
- No actual PII values are reproduced in this document.

---

## 10. Human-review position

- The field treatment matrix is complete for the T2.1 inventory.
- The HMAC matrix separates confirmed, uncertain and unnecessary cases and explicitly rejects HMAC as a substring-search solution.
- Restricted partial search is specified with scope, candidate selection, decryption limits, cursors, caps and incomplete-result semantics.
- All D-01 through D-18 decisions remain `OPEN`; no approval is claimed.
- Implementation must not start until the blocking decisions for the relevant stage are approved.
