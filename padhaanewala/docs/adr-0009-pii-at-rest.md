# Phase 9.6 — Encryption and tokenisation of personal data at rest

**Status: IMPLEMENTED (partial, deliberate) · decided 2 October 2026**
**Requirement:** DPDP Act, 2023 s.8(5) and Rule 4 of the DPDP Rules, 2025 —
a Data Fiduciary shall implement appropriate technical and organisational
measures, which include encryption, in proportion to the risk.

Phase 9.6 as originally written was *"encrypt or tokenise PII at rest, or
document why it is not required"*. This document is that record. It states what
was decided, what was built, and — more importantly — what was **not** built and
why, because a decision that only records its conclusions is not a decision
anyone can audit later.

---

## What was actually at risk before this phase

Measured, not assumed. Before writing anything:

| Store | What it holds | Protection before Phase 9 |
|---|---|---|
| `users.password_hash` | every account credential | bcrypt, cost 12+ (Phase 1.7) |
| `otp_records.code_hash` | every OTP and email-link token | bcrypt (Phase 3) |
| `consent_records`, `guardian_consents` | consent text, version, timestamps | **plaintext** |
| `audit_logs.old_value` / `new_value` | whatever callers passed | **plaintext JSON, 730-day retention** |
| `student_profiles` | name, course interest, budget, location | **plaintext** |
| `enquiries` | name, mobile, email, message | **plaintext** |
| `cp_*` browser keys | name, mobile, search history, locations | **plaintext `localStorage`** |

The two rows in bold were the finding. `audit_logs` is the important one, because
it was an *accident waiting for a schema change*: seven call sites pass
`payload.model_dump(exclude_unset=True)`, which copies whatever the caller sent.
The day a schema gained an `email` field, the audit log would have started
keeping a second, unindexed, differently-protected copy of every student's
contact details — with no redaction, no encryption, and a two-year retention.

## Decision 1 — audit-log PII redaction: implemented

`app/utils/audit.py` now redacts on the way in, via `SENSITIVE_KEYS`.

This was chosen **over** encrypting the column, and the reason is that the threat
encryption addresses is not the dominant one here. The realistic exposure of an
audit row is not a stolen disk image — it is a staff member or a compromised
admin session reading a table they already have query access to. Column
encryption does nothing against that reader, because the application decrypts on
read. Redaction does: the value is never stored, so there is nothing to read.

Redaction is also enforceable in a way encryption is not. It is a pure function
over a key list, so a test can assert that a payload containing every sensitive
key comes out clean — the property is verifiable, and stays verifiable as call
sites are added. "Is this column encrypted" is not a property a test can assert
about a running system.

Enforced at the single choke point (`audit.record`) rather than at call sites,
because a rule enforced in eleven places is a rule enforced in ten.

### What this does *not* cover

Stated plainly, because the difference matters:

- **`audit_logs.ip_address` is not redacted.** It is a column, not a payload key,
  and it is deliberately retained: Phase 9.3's breach report and every privilege
  escalation investigation are reconstructed from it. Redacting the forensic
  trail to make the forensic trail more private would be self-defeating. It is
  also the one field with a genuine legitimate purpose attached to each row.
- **Existing rows are not rewritten.** The redaction applies to rows written
  after this change. Rows written before it are covered by the fact that no
  current call site passes contact details — but that is an argument, not a
  guarantee, and if a pre-Phase-9.6 row is found to contain PII it should be
  handled as a finding rather than waved through.

## Decision 2 — field-level encryption of `student_profiles` and `enquiries`: not implemented

Not because it is unnecessary, but because doing it *properly* would make the
product worse in a way that is easy to miss.

What "properly" requires:

1. A key that is **not** the database password. `app/config.py` already refuses to
   boot `APP_ENV=production` with any placeholder secret — the same guard would
   apply here, and `openssl rand -hex 32` would have to be a Phase 8.2 step.
2. Rotation. A key that is never rotated is a key that is eventually leaked and
   never fixed. Rotation requires decrypting and re-writing every row, which
   requires the application to hold **both** keys simultaneously — so the
   rotation window is a period during which the database alone is insufficient to
   read the data, which is the property being bought, and during which the whole
   point is temporarily untrue.
3. Deterministic encryption where the column is queried (`preferred_state` is
   filtered on). Deterministic encryption leaks equality: two rows with the same
   plaintext produce the same ciphertext, so an attacker with the database can
   count how many students prefer Karnataka. That is a real disclosure under
   s.5, and it is invisible in a demo.

Against that, the marginal gain is small in this specific deployment:

- The database is **not published on any host port** — `docker-compose.prod.yml`
  gives `db` no `ports:` at all, so it is reachable only from the Compose network
  (verified in Phase 2.4).
- Access requires filesystem access to the Postgres volume, at which point the
  attacker has the WAL, the backups and the application secrets.

The honest summary is that **field-level encryption here defends against a
database-volume compromise, and that is not the leading threat.** The leading
threat is an over-privileged application reader, which redaction addresses and
encryption does not.

### The condition that would reverse this decision

Recorded now, while it is cheap, so the decision can be revisited against a
trigger rather than against a mood:

Revisit if **any** of these becomes true:

- The database is published on a host port, or moved to a managed service whose
  backup or snapshot model is not ours.
- Database access is granted to a third party — an analytics contractor, a
  support vendor, an offshore operations team.
- `MEDIA_ROOT` moves to object storage with a different trust boundary.
- The data set grows to include something whose *equality* is itself sensitive
  (a health or a disability field), where deterministic encryption's leakage
  matters more than its protection.

Until one of those is true, adding a second key to the production runbook adds a
way to lose the data and removes a way to read it.

## Decision 3 — the browser store: handled in 9.1, not here

`localStorage` holds plaintext name, mobile, search history and location, on a
device we do not control, readable by any script on the origin. No amount of
server-side work changes that.

Two things were done about it:

1. **Nothing behavioural is written before consent is granted** (Phase 9.1). For a
   user who has not passed the age gate, no `cp_*` key is written at all — which
   is also what s.9(2)'s prohibition on tracking a child's behaviour requires,
   and it is stronger than any encryption choice available here.
2. **The Cookie Policy enumerates the keys verbatim.** A policy that says "we
   store preferences" while `cp_enquiries` holds a name, a mobile number and a
   free-text message is a policy that misstates the product.

Not done, and stated: `cp_*` values are not encrypted client-side. There is no
secure enclave available to a web page, so client-side encryption here reduces to
a key shipped to the same machine as the ciphertext.

## Residual risk, accepted

| Risk | Why accepted |
|---|---|
| A Postgres volume compromise exposes plaintext PII in `student_profiles` / `enquiries` | The volume is unpublished and requires filesystem access. Revisit under the triggers above. |
| `enquiries` is collected **unauthenticated** — no account, no session | A public admission form cannot require an account without losing most of its submissions. The age band and guardian contact are collected instead (Phase 9.1), and the endpoint is throttled 5/hour (Phase 4.8). |
| Browser storage holds PII in plaintext | Enforced not to be written pre-consent; no alternative exists for a web page. |
| Audit rows predate the redaction and were not back-scanned | No current call site passes contact details, so the exposure is theoretical. Stated rather than assumed absent. |

## What Phase 8.2 has to add

If Decision 2 is ever taken, this is the list:

- `PII_ENCRYPTION_KEY` in `Settings`, refused as a placeholder in production by
  the existing `_guard_production_defaults` guard.
- `PII_ENCRYPTION_KEY_PREVIOUS`, so rotation can decrypt while re-encrypting.
- The two values added to `.env.example` and to the Phase 8.2 `openssl rand -hex 32`
  runbook.
- A migration test asserting a ciphertext column, so the flag cannot be flipped
  without the schema following it.
