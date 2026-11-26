# Padhaanewala — Fix 02 Final Plan Revision

**Topic:** PII encryption at rest, restricted backend search, HMAC exact-lookup tokens, staged migration, and release gates.

**Status:** PLANNING ONLY. This document is a human-review copy. It does not implement, migrate, rotate keys, approve policy, merge branches, change configuration, alter records, or deploy.

**Previous report preservation:** the earlier Fix 02 plan was delivered in conversation. No existing Fix 02 plan file was found in the repository. This file is a new, separate report. No prior report file was modified.

**Modified report files deliberately left untouched:**

| File | SHA-256 at planning time |
|---|---|
| `padhaanewala/testsprite_tests/antigravity-test-everything-report.md` | `B1C7C2412DBA7E0012AC63E19A22D01EE57373E08D779607D43B8FCC5DE87EEB` |
| `padhaanewala/testsprite_tests/api-connectivity-report.md` | `08598941E00B84529221E73A29DDEDDF43FE8A37D51B266EF3E47C34029B3DAF` |
| `padhaanewala/testsprite_tests/testsprite-mcp-test-report.md` | `D2ACF4D8C4016B5F2B17318F044B00A4DF2AC2869301FF8D6B978438CEF84008` |

Labels used throughout:

- **[CONFIRMED]** — verified from repository state or read-only command output during this review.
- **[PROPOSED]** — design decision for human approval; not implemented.
- **[OPEN]** — unresolved question or approval; must not be treated as complete.

---

## 0. Verified baseline

- **[CONFIRMED]** Current branch: `security/H-08-pii-encryption`.
- **[CONFIRMED]** H-08 HEAD: `70cdb7f`, identical to `main` and `origin/main`.
- **[CONFIRMED]** H-08 has no commits ahead of `main`.
- **[CONFIRMED]** H-07 is `5049ab1425a00bd31382ab21af472d36bf21ee57` on `security/H-07-jwt-key-hardening`; its parent is `70cdb7f`.
- **[CONFIRMED]** H-07 is not an ancestor of H-08.
- **[CONFIRMED]** H-07 changes config, auth, dependencies, env/compose/render files, JWT key rotation helpers, tests, and `docs/jwt-key-rotation.md`; it adds no Alembic migration.
- **[CONFIRMED]** Read-only `alembic -c backend/alembic.ini heads` returned one head: `f4a1c6d8e902`.
- **[CONFIRMED]** Working tree has exactly three modified report files listed above.
- **[CONFIRMED]** No secrets, key values, or personal data were read or printed.

---

## 1. Corrected architecture summary

### 1.1 Architecture flow — [PROPOSED]

```text
Browser
  |
  | HTTPS; no PII in URLs
  v
Caddy
  |
  v
FastAPI
  |
  +-- Auth / OTP exact lookup
  |     -> versioned HMAC lookup tokens
  |     -> users.email_lookup / users.mobile_lookup
  |     -> otp_records.identifier_lookup
  |     -> guardian_*_lookup
  |
  +-- Restricted PII search
  |     -> POST /api/v1/pii-search/{resource}
  |     -> search session, cursor, as_of snapshot
  |     -> require_role + purpose + scope + revalidation
  |     -> counsellor assignment scoping before decryption
  |     -> bounded candidate chunks
  |     -> application-side decryption
  |     -> non-PII audit events only
  |
  +-- Normal authorised reads
  |     -> explicit response mappers decrypt approved fields
  |
  +-- Dual-write / backfill / rotation
        -> AES-256-GCM current + previous keys
        -> versioned HMAC lookup keys
        -> plaintext retained until separate destructive approval

Secret manager
  -> PII_ENCRYPTION_KEY_CURRENT / PREVIOUS
  -> PII_LOOKUP_KEY_CURRENT / PREVIOUS
  -> distinct from JWT current/previous keys, DB credentials, and provider keys

PostgreSQL
  -> plaintext legacy columns retained
  -> *_enc authenticated ciphertext
  -> *_lookup versioned HMAC tokens
  -> *_kv key versions
  -> pii_context_id and pii_changed_at
  -> pii_backfill_progress

Observability
  -> no PII in logs, errors, audit values, traces, or URLs
```

### 1.2 Core design decisions — [PROPOSED]

- **[PROPOSED]** Use explicit service-layer encryption, not a generic SQLAlchemy `TypeDecorator`.
- **[PROPOSED]** Use AES-256-GCM with fresh 96-bit random nonces and 128-bit authentication tags.
- **[PROPOSED]** Bind ciphertext to table, column, stable row context, and fixed purpose via AAD.
- **[PROPOSED]** Use versioned HMAC tokens only for narrow exact-match lookup and uniqueness, never as the primary search strategy.
- **[PROPOSED]** Preserve current OTP purpose handling and normalization unless a separate approval changes them.
- **[PROPOSED]** Preserve existing admin/counsellor workflows through restricted backend search.
- **[PROPOSED]** Keep plaintext removal as a separate destructive change.

---

## 2. Correction A — Search consistency model

### 2.1 Confirmed problem — [CONFIRMED]

- **[CONFIRMED]** Current searches use SQL `ilike` on plaintext in `routers/users.py`, `routers/enquiries.py`, `routers/leads.py`, and `routers/audit.py`.
- **[CONFIRMED]** Encrypted random ciphertext cannot be searched with SQL `ilike`.
- **[CONFIRMED]** Existing counsellor scoping for leads is based on `Enquiry.assigned_counsellor_id`.

### 2.2 Search-session model — [PROPOSED]

A search session is created on the first secure search request and reused by cursor continuation requests.

Session state:

| Field | Purpose |
|---|---|
| `session_id` | Opaque, non-PII identifier. |
| `actor_user_id` | Authenticated actor. |
| `role_snapshot` | Roles captured at session creation, revalidated on every request. |
| `resource` | `users`, `students`, `leads`, `guardians`, or `audit`. |
| `purpose` | Fixed purpose enum. |
| `scope_hash` | Keyed hash of canonical non-PII scope. |
| `query_hash` | Keyed hash of search text; query text is not stored. |
| `as_of` | Database-clock timestamp defining the candidate snapshot. |
| `last_candidate_key` | Last fully processed candidate key. |
| `next_page_offset` | Internal offset already consumed within the current page. |
| `emitted_keys` | Bounded set of already emitted result keys for duplicate prevention. |
| `caps` | Chunk, time, result, and rate limits. |
| `state` | `active`, `expired`, `revoked`, `completed`. |
| `created_at`, `last_accessed_at` | Expiry tracking. |

### 2.3 Candidate snapshot strategy — [PROPOSED]

- **[PROPOSED]** Capture `as_of` from the database clock at session creation.
- **[PROPOSED]** Candidate SQL uses only non-PII predicates:
  - `assigned_counsellor_id`
  - `status`
  - `college_id`
  - `user_id`
  - `role`
  - `is_active`
  - `encryption_id`
  - `pii_changed_at <= as_of`
  - `created_at <= as_of` where appropriate
- **[PROPOSED]** Add `pii_changed_at` to encrypted tables and maintain it whenever encrypted fields change. This allows a row updated after `as_of` to be excluded from an in-flight search session rather than producing a mixed snapshot.
- **[PROPOSED]** Candidate ordering is stable and non-PII:
  - Users: `id ASC`.
  - Leads/enquiries/audit: `created_at DESC, id DESC`.
- **[PROPOSED]** Cursor contains a keyed HMAC of `session_id`, `scope_hash`, `last_candidate_key`, and `next_page_offset`; it contains no PII and cannot be forged or edited.

### 2.4 Behaviour when records change or are deleted — [PROPOSED]

| Event during pagination | Behaviour |
|---|---|
| New row created after `as_of` | Excluded from the session; appears in a later session. |
| Row’s PII changes after `as_of` | `pii_changed_at > as_of`; excluded from the current session. |
| Row’s non-PII scope changes after `as_of`, e.g. counsellor reassignment | Revalidation and scope hash checks prevent continued access if actor authority changed; row may be excluded from next candidate chunk. |
| Row deleted before it is reached | Absent from the snapshot; no duplicate or stale result. Record metric only. |
| Row deleted after it was already returned | No retroactive removal from already delivered page; audit notes deletion state if discovered. |
| Candidate decryption fails | Request fails closed; candidate is not skipped. |
| Session expiry | Cursor invalid; caller must start a new session with a fresh `as_of`. |

### 2.5 Session expiry — [PROPOSED]

- **[PROPOSED]** Idle expiry: 10 minutes.
- **[PROPOSED]** Absolute expiry: 30 minutes.
- **[PROPOSED]** Expired sessions return a generic `410`-equivalent response with no data and require restart.
- **[PROPOSED]** Continuation requests consume the same rate-limit budget as initial searches, preventing pagination from bypassing throttles.

### 2.6 Authorisation revalidation — [PROPOSED]

On every continuation request:

1. **[PROPOSED]** Load current user; deny if inactive.
2. **[PROPOSED]** Recompute roles and require the same role allowlist as the initial request.
3. **[PROPOSED]** Re-check resource-specific scope:
   - Counsellors: current counsellor record still exists and still matches `assigned_counsellor_id`.
   - Admins: purpose and scope still permitted.
   - Audit: actor still holds `AUDIT_ROLES`.
4. **[PROPOSED]** Recompute `scope_hash`; mismatch invalidates the session.
5. **[PROPOSED]** If authorisation changed, return `403`; do not return further candidates.

---

## 3. Correction B — Search pagination and completeness

### 3.1 Response semantics — [PROPOSED]

`complete` is reserved for a fully evaluated authorised candidate set.

| Status | Meaning | `total` | `has_more` | Continuation |
|---|---|---|---|---|
| `complete` | Every candidate in the authorised `as_of` snapshot was evaluated. | Exact total may be returned. | May be `true` or `false`. | Optional if `has_more=true`. |
| `page_complete` | Enough matches were observed to fill the requested page and prove at least one further match, but the full candidate set was not evaluated. | Must be `null`; `total_is_exact=false`. | `true` only; `false` is not allowed. | `next_cursor` required. |
| `partial` | Work budget ended before the page could be completed. Returned rows are a prefix only. | `null`; `total_is_exact=false`. | Must be `unknown`. | `next_cursor` required. |
| `truncated` | A configured result/session cap was reached. Returned rows are a prefix only. | `null`; `total_is_exact=false`. | Must be `unknown`; no false `false`. | Continuation only if policy allows; otherwise caller must narrow scope. |

### 3.2 Rules — [PROPOSED]

- **[PROPOSED]** Never report an incomplete page as `complete`.
- **[PROPOSED]** Never return an exact total unless the full authorised candidate set was evaluated.
- **[PROPOSED]** Never assert `has_more=false` unless the full candidate set was evaluated.
- **[PROPOSED]** A status of `page_complete` may assert `has_more=true` only because observing `offset + limit + 1` matches proves another match exists.
- **[PROPOSED]** Candidate caps affect work per request, not result omission; reaching one yields `partial`, not silent truncation.
- **[PROPOSED]** Result caps yield explicit `truncated`.
- **[PROPOSED]** Every continuation response carries `session_id`, `next_cursor`, `status`, `result_count`, `cap_state`, and `total_is_exact=false` where applicable.

### 3.3 Duplicate prevention — [PROPOSED]

- **[PROPOSED]** Results are ordered by the stable candidate key.
- **[PROPOSED]** Cursor stores the last processed candidate key; continuation starts strictly after it.
- **[PROPOSED]** `next_page_offset` is stored in the session instead of accepting a client-controlled offset on continuation.
- **[PROPOSED]** `emitted_keys` prevents the same `(resource, primary_key)` appearing twice, including join-induced duplicates such as audit rows joined to users/profiles.
- **[PROPOSED]** Duplicate suppression itself is bounded and included in memory limits.

### 3.4 Concrete algorithm — [PROPOSED]

```text
1. First request:
   - authenticate and authorise
   - create session with as_of, canonical scope, query hash, caps
2. Continuation request:
   - validate cursor/session integrity
   - revalidate authentication, roles, scope, and assignment
3. Build candidate query:
   - scope predicates only
   - pii_changed_at <= as_of
   - created_at <= as_of
   - ordered by stable key
   - key > session.last_candidate_key
4. Loop candidate chunks:
   - decrypt required fields
   - fail closed on decryption error
   - evaluate match predicate
   - add to emitted set if not duplicate
   - stop when offset+limit+1 matches are observed
5. Emit one of:
   - complete: candidate set exhausted and all evaluated
   - page_complete: offset+limit+1 matches observed
   - partial: work budget exhausted first
   - truncated: configured cap reached
6. Persist last processed key and next_page_offset.
```

### 3.5 Completeness proof — [PROPOSED]

Let `C` be the candidate set defined by authorised scope and `as_of`; let `K` be the stable order key.

1. **[PROPOSED]** Candidates are processed strictly in `K` order.
2. **[PROPOSED]** A cursor advances only after a candidate is fully processed.
3. **[PROPOSED]** No candidate with `K <= cursor` remains unprocessed for that session.
4. **[PROPOSED]** `complete` is emitted only when the candidate iterator is exhausted.
5. **[PROPOSED]** `page_complete` is emitted only after `offset + limit + 1` matches are observed, proving the page and one further match.
6. **[PROPOSED]** `partial` and `truncated` explicitly state that the result is not exhaustive.
7. **[PROPOSED]** Decryption failure aborts; it never causes a skipped candidate.

Therefore, **[PROPOSED]** within the authorised snapshot and declared caps, no match is silently omitted and the response status never overstates completeness.

### 3.6 Required pagination tests — [PROPOSED]

- Match before first candidate cap.
- Match after first candidate cap; first response `partial`, continuation returns the match.
- Twelve matches with `limit=3`; pages never duplicate or skip.
- Exact-total test: only `complete` includes a number in `total`.
- `has_more=false` absent unless candidate set exhausted.
- Counsellor A query against Counsellor B’s lead: zero results and denial audit.
- Role revoked mid-session: continuation denied.
- Counsellor assignment changed mid-session: continuation denied.
- Record updated after `as_of`: excluded from session.
- Record deleted before reached: absent without shifting duplicate results.
- Decryption failure: generic error, no skipped candidate.
- Result cap reached: `truncated`, no exact total.
- Tampered cursor: rejected.

---

## 4. Correction C — HMAC rotation and uniqueness

### 4.1 Why tokens are required — [CONFIRMED / PROPOSED]

- **[CONFIRMED]** Registration checks exact `User.email` / `User.mobile` duplicates.
- **[CONFIRMED]** Login, resend, OTP send/verify, and forgot-password use exact email or mobile lookups.
- **[CONFIRMED]** OTP service queries exact `(purpose, identifier)` before a user is known.
- **[CONFIRMED]** Guardian verification stores and reconciles an exact verification target.
- **[PROPOSED]** Random AES-GCM ciphertext cannot support equality lookup or unique constraints.
- **[PROPOSED]** HMAC tokens are narrow exact-lookup artifacts, not general search indexes and not reversible identifiers.

### 4.2 Exact fields — [PROPOSED]

| Source field | Token field | Uniqueness |
|---|---|---|
| `users.email` | `users.email_lookup` | Unique after cutover |
| `users.mobile` | `users.mobile_lookup` | Unique after cutover |
| `otp_records.identifier` | `otp_records.identifier_lookup` | Composite with `purpose`, `created_at` |
| `guardian_consents.guardian_email` | `guardian_consents.guardian_email_lookup` | Non-unique, user/consent scoped |
| `guardian_consents.guardian_mobile` | `guardian_consents.guardian_mobile_lookup` | Non-unique, user/consent scoped |
| `guardian_consents.verification_target` | `guardian_consents.verification_target_lookup` | Non-unique, user/consent scoped |

### 4.3 Normalization and purpose — [CONFIRMED / PROPOSED]

- **[CONFIRMED]** `otp_service.normalize_email()` strips and lowercases.
- **[CONFIRMED]** `otp_service.normalize_mobile()` reduces to 10 national digits.
- **[CONFIRMED]** OTP purposes include `mobile_verification`, `login`, `email_verification`, `password_reset`, and guardian-consent purposes carrying a consent id.
- **[PROPOSED]** Tokenization must reuse those exact normalizers and current `base_purpose()` behaviour.
- **[OPEN]** Any normalization or purpose-shape change requires separate approval and migration reconciliation.

### 4.4 Authoritative token versions — [PROPOSED]

- **[PROPOSED]** Token format: `v<n>$<base64url(hmac)>`.
- **[PROPOSED]** `v1` is the initial authoritative version.
- **[PROPOSED]** During rotation, `v1` is readable and `v2` is authoritative for writes.
- **[PROPOSED]** Writes never produce old-version tokens.
- **[PROPOSED]** Verification accepts only configured versions; unknown versions fail closed.

### 4.5 Domain separation — [PROPOSED]

```text
padhaanewala|pii-lookup|v1|{domain}|{key_version}|{normalized_value}
```

Domains:

```text
user_email
user_mobile
otp_identifier:{base_purpose}
guardian_email
guardian_mobile
guardian_verification_target
```

### 4.6 Concurrent registration and update behaviour — [PROPOSED]

- **[PROPOSED]** Registration computes normalized token values inside the same transaction that inserts the user.
- **[PROPOSED]** A pre-check improves UX but is not authoritative.
- **[PROPOSED]** Database-enforced unique indexes on `email_lookup` and `mobile_lookup` are authoritative.
- **[PROPOSED]** Concurrent duplicate registrations result in one success and one `IntegrityError`, mapped to the existing generic 409 without naming which field collided.
- **[PROPOSED]** Email/mobile updates write `*_enc`, `*_lookup`, and `*_kv` in one transaction.
- **[PROPOSED]** A unique violation during update rolls back the whole update; no partial ciphertext/token state is allowed.
- **[PROPOSED]** Shadow rotation columns are written in the same transaction as authoritative tokens.

### 4.7 Collision handling — [PROPOSED]

- **[PROPOSED]** A true HMAC collision is treated as an integrity incident; the write is rejected, never overwritten.
- **[PROPOSED]** A duplicate normalized value is expected to collide and is handled as a duplicate business record via unique-index failure.
- **[PROPOSED]** Non-unique tokens may repeat when source values repeat; that is not an error.
- **[PROPOSED]** Collision and duplicate events are logged without token or plaintext values.

### 4.8 Rotation, cutover, and rollback — [PROPOSED]

1. **[PROPOSED]** Add shadow token columns and unique indexes.
2. **[PROPOSED]** Deploy app that accepts both versions and dual-writes old and shadow tokens.
3. **[PROPOSED]** Backfill shadow tokens in batches.
4. **[PROPOSED]** Verify 100% token parity and zero unique violations.
5. **[PROPOSED]** Flip `PII_LOOKUP_VERSION` to shadow.
6. **[PROPOSED]** Keep old tokens and previous key for rollback.
7. **[PROPOSED]** Retire old token columns only in a separate destructive migration.
8. **[PROPOSED]** Rollback is a flag flip to the retained old version; after retirement, rollback requires restore.

### 4.9 Compatibility tests — [PROPOSED]

- v1 tokens verify under v1.
- v2 tokens verify under v2.
- v1 verifies while v2 is authoritative during rotation.
- v2 verifies after cutover.
- Unknown version fails closed.
- OTP purpose isolation prevents cross-purpose lookup.
- Normalization remains identical to current behaviour.
- Two concurrent registrations with the same email produce exactly one success.
- Two concurrent registrations with the same mobile produce exactly one success.
- Update to an existing email/mobile succeeds; update to a duplicate fails atomically.
- Simulated collision does not overwrite another row.
- Rollback flag restores v1 lookup behaviour.

---

## 5. Correction D — Encryption envelope

### 5.1 Canonical serialization — [PROPOSED]

Binary envelope layout:

```text
byte 0        format marker 0x01
bytes 1-12    96-bit random nonce
bytes 13...   AES-256-GCM ciphertext with 128-bit tag
```

Stored encoding:

```text
pe1.<base64url(binary envelope without padding)>
```

- **[PROPOSED]** `pe1.` is mandatory.
- **[PROPOSED]** No whitespace, line breaks, alternate base64 alphabets, or padding are accepted.
- **[PROPOSED]** Decryption rejects non-canonical encodings even if they decode to valid bytes.

### 5.2 AAD and fixed purpose allowlist — [PROPOSED]

Canonical AAD:

```text
padhaanewala|pii-aad|v1|{table}|{column}|{pii_context_id}|{purpose}
```

Fixed purpose allowlist:

```text
user_identity
student_profile
admin_staff
counsellor_staff
enquiry
lead_note
guardian_consent
otp
consent_record
data_request
audit_ip
refresh_token_ip
college_submission
```

- **[PROPOSED]** Callers cannot supply arbitrary AAD purpose strings.
- **[PROPOSED]** Unknown purpose fails closed.

### 5.3 Size limits — [PROPOSED]

- **[PROPOSED]** Nonce exactly 12 bytes.
- **[PROPOSED]** Tag exactly 16 bytes.
- **[PROPOSED]** Encrypted short fields accept plaintext up to their existing validated maximum, generally 255 characters.
- **[PROPOSED]** Free-text encrypted fields accept plaintext up to 16 KB unless an existing endpoint already enforces a smaller limit; the smaller limit wins.
- **[PROPOSED]** Oversize input is rejected before encryption with the existing validation error shape.
- **[PROPOSED]** Encrypted column sizes account for base64 expansion and envelope overhead.

### 5.4 Key-version validation — [PROPOSED]

- **[PROPOSED]** Version byte must map to a configured AES key version.
- **[PROPOSED]** Current version is used only for writes.
- **[PROPOSED]** Previous version is accepted only for reads during rotation.
- **[PROPOSED]** Unknown version, missing key, or duplicate configured version fails closed.
- **[PROPOSED]** Key version labels appear in logs; key values never do.

### 5.5 `pii_context_id` lifecycle — [PROPOSED]

- **[PROPOSED]** Generated as UUIDv4 by the application at row creation.
- **[PROPOSED]** Immutable for the life of the row.
- **[PROPOSED]** Backfill assigns it once to legacy rows and never reassigns it.
- **[PROPOSED]** Updates preserve it byte-for-byte.
- **[PROPOSED]** It is never reused across rows.
- **[PROPOSED]** Missing or duplicate context fails verification/backfill.

### 5.6 Substitution tests — [PROPOSED]

- Move ciphertext to another row: decryption fails.
- Swap table name in AAD: decryption fails.
- Swap column name in AAD: decryption fails.
- Swap purpose in AAD: decryption fails.
- Change key-version byte to an unknown version: failure is closed.
- Change key-version byte to a wrong but configured version: GCM authentication fails.
- Modify nonce, ciphertext, or tag: decryption fails.
- Non-canonical base64 or whitespace: rejected.
- Wrong key: decryption fails.
- Valid envelope with correct context and purpose: round trip succeeds.

---

## 6. Correction E — Migration rollback

### 6.1 Schema rollback vs application rollback — [PROPOSED]

| Phase | Safe rollback | Prohibited rollback |
|---|---|---|
| Before dual-write | Reverse schema migrations may drop unused columns in staging. | Dropping anything used by deployed code. |
| After dual-write starts | Disable write/read flags and redeploy prior app; retain schema and encrypted data. | Dropping `*_enc`, `*_lookup`, `pii_context_id`, `pii_changed_at`, or progress tables. |
| After backfill starts | Same as above; retain all encrypted data for verification/recovery. | Truncating progress table or deleting encrypted values. |
| After read cutover | Flag rollback to plaintext while plaintext columns still exist. | Removing plaintext columns. |
| After destructive plaintext removal | Restore from verified backup only. | Assuming flag rollback works. |

### 6.2 Feature-flag states — [PROPOSED]

| Flag | Safe values | Meaning |
|---|---|---|
| `PII_DUAL_WRITE` | `off`, `on` | Writes both plaintext and encrypted/token fields. Never on before schema migrations. |
| `PII_ALLOW_BACKFILL` | `off`, `on` | Permits batch jobs. Never on before dual-write is stable. |
| `PII_READ_SOURCE` | `plaintext`, `encrypted` | Authoritative read path. Encrypted requires verification pass. |
| `PII_LOOKUP_VERSION` | `current`, `shadow_v2` | Authoritative HMAC token version. |
| `PII_DISABLE_PLAINTEXT_SEARCH` | `off`, `on` | Disables old `ilike` search endpoints/parameters. |
| `PII_STRICT_SEARCH` | `off`, `on` | Requires search sessions and cursor semantics. |

Forbidden combinations: **[PROPOSED]**

- `PII_READ_SOURCE=encrypted` with failed verification.
- `PII_DISABLE_PLAINTEXT_SEARCH=on` while `PII_STRICT_SEARCH=off`.
- `PII_LOOKUP_VERSION=shadow_v2` before token parity verification.
- Any encrypted read with missing keys.

### 6.3 PostgreSQL concurrent-index handling — [PROPOSED]

- **[CONFIRMED]** Alembic migrations exist and currently use a single head.
- **[PROPOSED]** Index migrations that add unique/non-unique indexes on populated tables must use PostgreSQL `CREATE INDEX CONCURRENTLY`.
- **[PROPOSED]** Concurrent index creation cannot run inside a normal transactional Alembic block; the migration must use Alembic’s autocommit mechanism or an equivalent read-only-verified pattern.
- **[PROPOSED]** Set `lock_timeout` and `statement_timeout` for the migration session.
- **[PROPOSED]** Verify `pg_index.indisvalid = true` after creation; an invalid index must be dropped and recreated, not ignored.
- **[PROPOSED]** Rehearse on staging with representative row counts and measure lock waits.
- **[PROPOSED]** SQLite test environments must skip concurrent-index-specific operations or use an explicitly documented equivalent.
- **[OPEN]** DBA owner must approve the exact autocommit pattern and thresholds before implementation.

### 6.4 Authoritative migration sequence — [PROPOSED]

| Stage | Type | Name | Notes |
|---|---|---|---|
| S0 | Pre-flight job | `PII_PREFLIGHT` | Approvals, backup, restore, head verification |
| S1 | Alembic | `DB-M1_EXPAND_ENC` | Nullable `*_enc`, `*_kv`, `pii_context_id`, `pii_changed_at` |
| S2 | Alembic | `DB-M2_LOOKUP_COLUMNS` | Nullable lookup and shadow columns |
| S3 | Alembic | `DB-M3_LOOKUP_INDEXES` | Concurrent indexes; validity checks |
| S4 | Alembic | `DB-M4_PROGRESS` | `pii_backfill_progress` |
| S5 | App release | `APP-R1_CRYPTO` | Crypto, config, keyring, log sanitisation; flags off |
| S6 | App release | `APP-R2_DUAL_WRITE` | Enable transactional dual-write |
| S7 | Backfill job | `JOB-B1_BACKFILL` | Idempotent batches |
| S8 | Verification job | `JOB-V1_VERIFY` | 100% checks |
| S9 | App release | `APP-R3_SEARCH` | Restricted search in shadow mode |
| S10 | Flag | `FLAG-F1_SEARCH` | Secure search authoritative |
| S11 | Flag | `FLAG-F2_READS` | Encrypted reads authoritative |
| S12 | Ops soak | `OPS-S1` | Monitor and gate |
| S13 | Job | `JOB-K1_ROTATE` | Staging rotation rehearsal |
| S14 | Destructive Alembic | `DB-D1_DROP_PLAINTEXT` | Separate explicit approval only |
| S15 | App release | `APP-R4_REMOVE_LEGACY` | Remove fallback code after D1 |

---

## 7. Correction F — Backup and restore rehearsal

### 7.1 Staging-only rehearsal — [PROPOSED]

- **[PROPOSED]** Use staging data and staging-only keys.
- **[PROPOSED]** Do not use production dumps, production keys, or production services.
- **[PROPOSED]** Create encrypted dump, independent-key custody, isolated restore, and verification evidence as previously planned.
- **[PROPOSED]** Run the following authorised application smoke tests against the isolated restored environment.

### 7.2 Required smoke tests after isolated restore — [PROPOSED]

| Area | Smoke test | Pass condition |
|---|---|---|
| Login | Existing staging test user signs in with password | 200/token; decrypts display name correctly |
| Account recovery | Forgot-password flow issues a reset challenge | Uniform response; OTP/token record decrypts and verifies |
| OTP | Issue and verify SMS/email OTP using staging test channel | Verification succeeds; identifier log-free |
| Guardian verification | Minor staging test account requests and verifies guardian consent | Consent status becomes verified; guardian fields decrypt |
| Profiles | Read and update a staging student profile | Encrypted fields round trip correctly |
| Enquiries | Submit/read a staging enquiry | Dual-write and decrypted detail match |
| Leads | Admin/counsellor lead list and detail | Assignment scope correct; decrypted fields visible only to authorised roles |
| Restricted search | Secure search across users/leads with cursor continuation | Status semantics correct; no cross-scope results |
| Data requests | Create/read staging data request | Encrypted subject/details round trip; duplicate detection works |
| Retention | Run dry-run and limited apply on staging test rows | Expected purge/anonymisation counts; no decrypt failures |

### 7.3 Evidence — [PROPOSED]

- Release SHA, Alembic head, key version labels only.
- Encrypted dump checksum and restore log.
- Smoke-test results by area.
- Decryptability verification counts.
- Zero-PII log assertion.
- Sign-offs by operations and security.

---

## 8. Correction G — Branch reconciliation

### 8.1 Exact preconditions for safe fast-forward — [PROPOSED]

Fast-forward is safe only if **all** are true:

1. **[PROPOSED]** Written approval exists to reconcile H-08 with H-07.
2. **[PROPOSED]** H-08 still has zero commits ahead of `70cdb7f`.
3. **[PROPOSED]** H-07 is exactly `5049ab1` and its parent is `70cdb7f`.
4. **[PROPOSED]** `git status --porcelain` lists exactly the three report files in section 0 and nothing else: no staged changes, no untracked source files.
5. **[PROPOSED]** The three report-file SHA-256 hashes match the baseline values in section 0.
6. **[PROPOSED]** Backup refs are recorded for H-08 and H-07.
7. **[PROPOSED]** No implementation commits from Fix 02 exist on H-08.
8. **[PROPOSED]** `alembic heads` still returns `f4a1c6d8e902`.
9. **[PROPOSED]** No merge/rebase/reset operation has already begun.
10. **[PROPOSED]** The operator has a rollback ref pointing to `70cdb7f`.

### 8.2 Reconciliation path — [PROPOSED, NOT EXECUTED]

- **[PROPOSED]** If all preconditions hold: fast-forward H-08 to H-07 with `git merge --ff-only security/H-07-jwt-key-hardening`.
- **[PROPOSED]** If any precondition fails: stop; use a separate reviewed merge plan with conflict review; never reset or force-overwrite.
- **[PROPOSED]** Do not touch the three report files.
- **[PROPOSED]** Re-hash the three report files immediately after reconciliation and compare to baseline.

### 8.3 Post-reconciliation verification — [PROPOSED]

- `git log` shows `5049ab1` as H-08 HEAD.
- `git status --porcelain` still lists exactly the three baseline report files.
- Report-file hashes still match section 0.
- `alembic heads` returns `f4a1c6d8e902`.
- JWT key-hardening tests pass.
- Config tests pass.
- A new test proves PII keys are distinct from JWT current and previous keys.
- No source, env, migration, or deployment file is modified by reconciliation itself.

---

## 9. Decision and approval register

| ID | Decision | Owner | Status | Evidence required |
|---|---|---|---|---|
| D-01 | Supersede ADR 0009 partial-encryption decision | Security architect | **[OPEN]** | Signed ADR update |
| D-02 | Explicit service-layer encryption over `TypeDecorator` | Security architect | **[OPEN]** | Architecture sign-off |
| D-03 | AES envelope format and AAD allowlist | Security architect | **[OPEN]** | Crypto design review |
| D-04 | HMAC exact-lookup tokens and equality leakage | Security architect + DPO | **[OPEN]** | Written risk acceptance |
| D-05 | Preserve current OTP purpose/normalisation | Security architect | **[OPEN]** | Compatibility test sign-off |
| D-06 | Lookup-key rotation with shadow columns | Security architect + DBA | **[OPEN]** | Rotation rehearsal evidence |
| D-07 | Search session/cursor semantics | Product + backend owner | **[OPEN]** | UX and API contract approval |
| D-08 | Counsellor scope rules | Product + DPO | **[OPEN]** | RBAC approval |
| D-09 | Child-data plaintext exceptions | DPO/legal | **[OPEN]** | Legal decision register sign-off |
| D-10 | Consent text and audit IP retention | DPO/legal | **[OPEN]** | Legal rationale |
| D-11 | Legacy audit JSON remediation | DPO + security | **[OPEN]** | Scan results and decision |
| D-12 | Browser localStorage minimisation | DPO + product | **[OPEN]** | Updated policy approval |
| D-13 | Email/SMS processor retention | Legal/vendor owner | **[OPEN]** | DPA/vendor evidence |
| D-14 | Backup key custody and retention | Operations + DPO | **[OPEN]** | Rehearsal evidence |
| D-15 | Concurrent-index pattern and thresholds | DBA owner | **[OPEN]** | Staging lock metrics |
| D-16 | Branch reconciliation execution | Release owner | **[OPEN]** | Precondition checklist |
| D-17 | Destructive plaintext removal | Security + DPO + DBA | **[OPEN]** | Separate approval |
| D-18 | Production key rotation | Security + operations | **[OPEN]** | Separate approval |

---

## 10. Dependencies and measurable pass/fail gates

### 10.1 Dependencies — [PROPOSED]

| Dependency | Required before |
|---|---|
| Branch reconciliation approval | Any implementation work |
| H-07 included in H-08 | Config/env/deployment changes |
| Security/DPO HMAC approval | Lookup token implementation |
| Secret manager naming and custody | Config validation and dual-write |
| Verified Alembic head | First migration creation |
| DBA concurrent-index approval | S3 |
| Backup/restore rehearsal pass | Read cutover |
| Restricted search tests pass | Disable plaintext search |
| 100% backfill verification | Encrypted read cutover |
| Separate approval | Plaintext removal or production key rotation |

### 10.2 Gates — [PROPOSED]

| Gate | Pass criteria | Fail action |
|---|---|---|
| G0 Reconciliation | H-07 ancestor; head `f4a1c6d8e902`; hashes unchanged; exactly three report files dirty | Stop; no git changes |
| G1 Schema | S1–S4 apply/rollback on staging; index validity true; no excessive lock waits | Reverse only if pre-dual-write |
| G2 Crypto | 100% unit tests; canonical envelope tests pass; zero PII in logs | Disable flags; roll back app |
| G3 Dual-write | 100% sampled writes consistent; zero partial transactions | Disable `PII_DUAL_WRITE` |
| G4 Backfill | 100% rows encrypted; rerun changes 0; token parity 100% | Pause; repair; rerun |
| G5 Verification | 100% decryptability, AAD, context, and token checks | Block cutover |
| G6 Search | RBAC matrix pass; zero cross-counsellor; pagination scenarios pass; no PII `ilike` | Keep shadow mode |
| G7 Search cutover | Frontend flows pass; no exact totals on incomplete searches | Flip flag back |
| G8 Read cutover | Encrypted reads authoritative; zero decrypt failures | Flip flag back |
| G9 Rotation | v1/v2 compatibility 100%; zero old-version after rehearsal | Retain both keys |
| G10 Backup/restore | Isolated restore + smoke suite pass; evidence has zero PII | Block release |
| G11 Full regression | All backend/frontend suites pass; zero PII log leakage | Block release |
| G12 Rollback proof | Plaintext rollback succeeds before D1 | Block D1 |

### 10.3 Zero-tolerance checks — [PROPOSED]

- Zero PII in new logs, audit values, traces, or URLs.
- Zero cross-counsellor search results.
- Zero silently omitted search matches.
- Zero exact totals on incomplete searches.
- Zero duplicate results across cursor continuations.
- Zero backfill idempotency violations.
- Zero envelope substitution successes.
- Zero key/token values outside secret manager and authorised storage.

---

## 11. Exact first implementation task and stop conditions

### 11.1 Exact first task — [PROPOSED]

**T0 — Reconciliation and baseline lock.**

Purpose: establish the correct H-07-inclusive baseline without changing Fix 02 content or touching the three report files.

Actions, only after approval:

1. Record all refs and the three report-file hashes from section 0.
2. Verify the ten preconditions in section 8.1.
3. Fast-forward H-08 to H-07 only if all preconditions pass.
4. Re-verify hashes, status, Alembic head, and JWT/config tests.

### 11.2 Stop conditions — [PROPOSED]

Stop T0 immediately if any of the following occurs:

- Any report-file hash differs from section 0.
- `git status --porcelain` includes anything beyond the three report files.
- H-08 has any commit ahead of `70cdb7f`.
- H-07 is not exactly `5049ab1` or has a different parent.
- Alembic head is not `f4a1c6d8e902`.
- Any staged change, untracked source file, merge state, rebase state, or in-progress git operation exists.
- JWT/config tests fail after reconciliation.
- No written approval exists from the release owner.
- Any instruction would require reset, force push, stash drop, or overwrite of existing work.

### 11.3 First source-affecting task after T0 — [PROPOSED, NOT STARTED]

**T1 — Approved ADR update and crypto design test harness.**

- Write a superseding ADR.
- Add crypto tests using disposable test keys only.
- Define envelope/AAD/key-version validation tests.
- Do not touch production keys, env values, migrations, or records.

T1 cannot start until D-01, D-02, and D-03 are approved.

---

## 12. Explicitly prohibited work until separate approval

### 12.1 Prohibited now, under this planning task — [CONFIRMED]

- Source code changes.
- Test file changes.
- Migration creation or execution.
- Database record changes.
- Key generation, rotation, or key-value display.
- Environment or deployment configuration changes.
- Production or staging service changes.
- Git merge, rebase, reset, checkout, stash drop, force push, or any other Git operation.
- Branch reconciliation execution.
- HMAC or privacy-policy approvals on behalf of owners.
- Marking unresolved approvals complete.
- Printing secrets or personal data.

### 12.2 Prohibited until explicit separate approval — [PROPOSED]

- Implementing HMAC lookup tokens.
- Implementing deterministic or blind indexes as the primary search strategy.
- Removing plaintext columns.
- Rotating production keys.
- Running destructive migrations.
- Changing OTP purpose or normalization behaviour.
- Changing child-data classification or legal retention decisions.
- Clearing browser `localStorage` keys in production.
- Modifying email/SMS provider retention settings.
- Running staging rehearsals against production data or keys.
- Deploying any Fix 02 application release.

---

## 13. Final human-review position

- **[CONFIRMED]** The plan now incorporates corrections A–G and is internally consistent.
- **[CONFIRMED]** No unresolved approval is marked complete.
- **[PROPOSED]** Implementation begins only with T0 after written approval.
- **[PROPOSED]** Destructive and production changes remain outside Fix 02 scope.
- **[OPEN]** All decision-register items remain open for the named owners.
