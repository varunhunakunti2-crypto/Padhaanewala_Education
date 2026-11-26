# Fix 02 — Gate Approval Request Forms

**Status:** `BLANK REQUEST FORMS — NOT APPROVALS`  
**Purpose:** Provide separate written decision forms for the owners who must close the production and Fix 02 gates.

A chat message such as “approve all”, “do it”, or “you are allowed” is not sufficient. Each form must be completed by the named approver with a real date, decision, rationale, conditions, and traceable written reference.

Do not include secrets, keys, real PII, production data, or credentials in any form.

---

## Evidence standard

Each decision requires:

```text
Decision ID
Exact decision scope
Approver name
Approver role
Decision: APPROVE / REJECT / DEFER
Date
Rationale
Conditions
Traceable written reference
Evidence checked by
```

A valid written reference may be:

- signed ADR;
- signed approval document;
- ticket with explicit decision;
- meeting record with explicit decision;
- governance document path containing the decision.

A request, plan, task instruction, passing test, or this form by itself is not approval.

---

# A-01 — First-cohort field treatment

**Required approvers:** Security Architect + DPO/legal + Product owner  
**Decision requested:** Approve `lead_notes.note` as the only first-cohort `ENCRYPT` field; reject expansion to other fields.

```text
Decision ID: A-01
Approver name:
Approver role:
Decision (APPROVE / REJECT / DEFER):
Exact scope approved:
Date:
Rationale:
Conditions:
Written reference:
Evidence checked by:
Notes:
```

---

# D-01 — ADR-0009 amendment

**Required approver:** Security Architect  
**Decision requested:** Approve a scoped amendment/supersession allowing field-level encryption for `lead_notes.note` only. ADR-0009 remains in force for all other fields.

```text
Decision ID: D-01
Approver name:
Approver role:
Decision (APPROVE / REJECT / DEFER):
Exact scope approved:
Date:
Rationale:
Conditions:
Written reference:
Evidence checked by:
Notes:
```

---

# D-02 — Service-layer encryption

**Required approver:** Security Architect  
**Decision requested:** Approve explicit service-layer encryption and reject SQLAlchemy `TypeDecorator` / transparent ORM encryption.

```text
Decision ID: D-02
Approver name:
Approver role:
Decision (APPROVE / REJECT / DEFER):
Exact scope approved:
Date:
Rationale:
Conditions:
Written reference:
Evidence checked by:
Notes:
```

---

# D-03 — Envelope and AAD contract

**Required approver:** Security Architect / cryptographic reviewer  
**Decision requested:** Approve exact envelope and AAD contract.

Exact envelope:

```text
pe1.<base64url-no-padding(BODY)>
```

Exact AAD:

```text
padhaanewala|pii-aad|v1|lead_notes|note|{pii_context_id}|lead_note
```

```text
Decision ID: D-03
Approver name:
Approver role:
Decision (APPROVE / REJECT / DEFER):
Exact scope approved:
Date:
Rationale:
Conditions:
Written reference:
Evidence checked by:
Notes:
```

---

# D-15 — Expand-only migration

**Required approver:** DBA owner  
**Decision requested:** Approve expand-only migration pattern for nullable `note_enc`, `pii_context_id`, and `pii_changed_at`; no index; no concurrent-index operation; no data mutation; no destructive downgrade after dual-write.

```text
Decision ID: D-15
Approver name:
Approver role:
Decision (APPROVE / REJECT / DEFER):
Exact migration pattern approved:
Statement timeout:
Lock timeout:
Rollback reference:
Staging verification reference:
Date:
Rationale:
Conditions:
Written reference:
Evidence checked by:
Notes:
```

---

# D-16 — Baseline reconciliation

**Required approver:** Release owner / Product Operations  
**Decision requested:** Approve reconciled baseline at `5049ab1425a00bd31382ab21af472d36bf21ee57` and resolve conflicting report hashes.

```text
Decision ID: D-16
Approver name:
Approver role:
Decision (APPROVE / REJECT / DEFER):
Exact baseline approved:
Alembic head:
Report hashes reconciled:
Date:
Rationale:
Conditions:
Written reference:
Evidence checked by:
Notes:
```

---

# D-14 — Backup, custody and restore evidence

**Required approver:** Operations/key custodian + DPO/legal  
**Decision requested:** Approve backup retention, key custody, restore rehearsal, isolated smoke-test evidence, and zero-PII log evidence before encrypted read cutover.

```text
Decision ID: D-14
Approver name:
Approver role:
Decision (APPROVE / REJECT / DEFER):
Backup reference:
Restore rehearsal reference:
Key custody reference:
Zero-PII log evidence reference:
Date:
Rationale:
Conditions:
Written reference:
Evidence checked by:
Notes:
```

---

# D-17 — Destructive plaintext removal

**Required approvers:** Security Architect + DPO/legal + DBA owner  
**Decision requested:** Approve or defer destructive removal of legacy plaintext `note` and fallback code. This must be a separate change after read cutover.

```text
Decision ID: D-17
Approver name:
Approver role:
Decision (APPROVE / REJECT / DEFER):
Exact destructive scope approved:
Date:
Rationale:
Conditions:
Written reference:
Evidence checked by:
Notes:
```

---

# D-18 — Production key rotation

**Required approvers:** Security Architect + Operations/key custodian  
**Decision requested:** Approve or defer production key generation/rotation. No key values should be recorded.

```text
Decision ID: D-18
Approver name:
Approver role:
Decision (APPROVE / REJECT / DEFER):
Key version labels only:
Rotation window:
Date:
Rationale:
Conditions:
Written reference:
Evidence checked by:
Notes:
```

---

# DEPLOY — Production go/no-go

**Required approver:** Named release owner / operations owner  
**Decision requested:** Approve production deployment for an explicit release ref after staging, backup/restore, monitoring, WAF and smoke tests.

```text
Decision ID: DEPLOY
Approver name:
Approver role:
Decision (APPROVE / REJECT / DEFER):
Approved release ref:
Target environment:
Target domain:
Backup reference:
Restore rehearsal reference:
Monitoring reference:
WAF/rate-limit reference:
Rollback reference:
Date:
Rationale:
Conditions:
Written reference:
Evidence checked by:
Notes:
```

---

# DOMAIN — Canonical domain decision

**Required approver:** Product owner / founder  
**Decision requested:** Resolve conflict between `hh.md` (`padhaanewala.in`) and deployment runbook (`padhaanewala.com`).

```text
Decision ID: DOMAIN
Approver name:
Approver role:
Decision (APPROVE / REJECT / DEFER):
Canonical domain:
Secondary domains and redirects:
SEO canonical base URL:
Cookie domain:
Date:
Rationale:
Conditions:
Written reference:
Evidence checked by:
Notes:
```

---

## What happens after forms are returned

When completed forms are supplied:

1. verify each form contains all required fields;
2. confirm the written reference actually contains the decision;
3. create a new reconciliation report;
4. update the approval register only with verified evidence;
5. recompute Gate 0;
6. only if fully approved, proceed with the authorised phase.

Until then, Gate 0 remains blocked and no implementation or deployment is authorised.

Created file:

```text
docs/fix-02-gate-approval-request-forms.md
```
