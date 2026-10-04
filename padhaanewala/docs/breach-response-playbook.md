# Breach Response Playbook

**Owner:** Incident Commander (to be named — see [Contacts](#contacts))
**Applies to:** any confirmed or suspected loss of confidentiality of personal
data held by Padhaanewala Edutech Services.
**Status:** the process is written; the names and numbers in
[Contacts](#contacts) are not. Fill them before launch — a playbook with an
empty name in it is a playbook that will not be executed.

---

## 1. Why this document exists

Three separate clocks start the moment a personal data breach is *noticed* — not
the moment it is understood, and not the moment it is confirmed:

| Clock | Source | Deadline | Goes to |
|---|---|---|---|
| **6 hours** | CERT-In Directions 2022, clause (ixA) | From noticing or being informed | `cert-in@cert-in.org` / the incident reporting portal, format per the Directions |
| **72 hours** | DPDP Rules 2025 | From noticing | Data Protection Board of India — a **detailed** report |
| **Without delay** | DPDP Act 2023, s.8(6) | From noticing | **Each affected data principal**, in plain language, through the communication channel they gave us (or another appropriate one) |

All three run **in parallel**. The 72-hour report does not pause the 6-hour
one, and neither pauses the duty to tell the people affected.

**Maximum penalties** (DPDP Act 2023, s.33): ₹200 crore for failing to notify a
breach. This document exists so that number never becomes relevant.

### What counts

- **DPDP "personal data breach"** (s.2(5)): any personal data that we hold being
  lost, destroyed, altered, disclosed without authorisation, or otherwise
  compromised — *whether or not it causes harm*. The test is the compromise, not
  the damage.
- **CERT-In "cyber incident"**: broader. Includes unauthorised access to
  databases and servers, compromise of critical infrastructure, and ransomware,
  whether or not personal data is involved.

> **Default: report.** If the classification is genuinely unclear, report to
> CERT-In anyway. The cost of a report that turns out to be unnecessary is an
> hour of an incident commander's time. The cost of the alternative is a
> six-hour deadline missed on day one of an incident nobody logged.

---

## 2. Roles

Four roles. One person may hold two of them in the early hours; nobody should
hold three. The Incident Commander is a *coordination* role, not a seniority
one — whoever is awake and reachable at T+0 is the Incident Commander until
they hand over in writing.

| Role | Responsibility | Name |
|---|---|---|
| **Incident Commander** | Declares the incident, owns the timeline, makes the report/no-report call, signs every submission | _TBD_ |
| **Technical Lead** | Containment, evidence capture, scope determination | _TBD_ |
| **Legal / Grievance Officer** | DPDP Board filing, data-principal notification, CERT-In format | _TBD_ (also Phase 9.2) |
| **Communications** | Wording of the data-principal notice; the single public statement if any | _TBD_ |

---

## 3. Runbook

Times are measured from **T+0: the moment any person first suspects** that
personal data has been compromised. Recording that moment accurately is part of
the report; do not backdate it.

### T+0 → T+15 min — Declare

1. Anyone who suspects it says so, in writing, to the Incident Commander. There
   is no threshold to clear first.
2. The Incident Commander opens an incident record — a dated file, not a chat
   thread — and writes **T+0 in it**. Every later timestamp is measured from
   here and the record is itself evidence.
3. Open a shared log. Do **not** use the incident channel as the only record: it
   will be read back later and it will be incomplete.

### T+15 min → T+1 h — Contain

Stop it getting worse before working out how bad it already is. In this
codebase the levers are, in the order they should be pulled:

1. **Rotate `JWT_SECRET_KEY` and `JWT_REFRESH_SECRET_KEY`** (two distinct
   values, `openssl rand -hex 32` each). This invalidates every access and
   refresh token in existence. It is the single most effective action available
   and it is destructive to every signed-in user, so record the time it was
   done — it defines the end of the attacker's usable window.
2. **Revoke refresh-token families** if only some accounts are implicated:
   `refresh_tokens` holds `jti`, `family`, `revoked_at` and `request_ip`, and
   `session_service.revoke_family` is the supported path. Rotation reuse
   detection already revokes a family automatically when a used token is
   replayed.
3. **Disable specific accounts** — `users.is_active = false` via
   `PATCH /users/{id}` (admin) or directly. `get_current_user` checks
   `is_active` on every request, so this takes effect on the next call.
4. **Block the source** at the edge: Caddy `remote_ip` matcher or a firewall
   rule. The container topology helps here — **only Caddy publishes a port**, so
   the backend, Postgres and Redis are unreachable from the internet regardless
   of what the application layer is doing.
5. **Take a container out of rotation** if it is compromised: `docker compose
   -f docker-compose.prod.yml stop backend`. Do not `docker rm` it yet.
6. If the **database host itself** is suspected, disconnect it. Postgres has no
   published port in the prod topology, so "the DB was reached" implies either
   an authenticated connection from inside the network or a host-level
   compromise — both of which change the incident's character and should be
   escalated to the Technical Lead immediately.

> **Do not restore from backup as a containment step.** Restoring destroys the
> evidence of what was taken and does not help if the attacker still holds
> credentials. Contain first, preserve second, restore last.

### T+15 min → T+2 h — Preserve evidence

This step is destructive to itself if done out of order: the things you need
are the things a cleanup would delete.

**Capture, before anything is restarted, truncated or rotated:**

| Evidence | How |
|---|---|
| Container logs | `docker compose -f docker-compose.prod.yml logs --timestamps --no-color > incident-logs-<TS>.txt` for **every** service |
| Database state | `pg_dump` of the whole cluster (or at minimum `users`, `student_profiles`, `enquiries`, `refresh_tokens`, `audit_logs`, `otp_records`, `consent_records`, `guardian_consents`, `data_requests`, `media`) |
| Audit trail | `SELECT * FROM audit_logs WHERE created_at >= '<T+0 minus 90 days>'` — see [§5](#5-what-this-codebase-gives-you) |
| Request correlation | `X-Request-ID` values from any error report or user complaint. Every response carries one; every `500` body returns one |
| Client-side errors | The `POST /api/errors` sink entries (`error.digest`, path, route kind) |
| Access records | Cloud/VPS access logs, SSH auth log, Caddy access log |
| Process state | `docker ps`, `docker stats`, `netstat`/`ss` output |

**Do not** run `docker compose down -v` (destroys volumes), do not prune images,
do not clear `pgdata`, and do not restart a container whose filesystem may hold
the intrusion.

> **The retention clock runs against you.** `retention_sweep.py` deletes audit
> logs older than `AUDIT_RETENTION_DAYS` (730 days) on whatever schedule the
> host runs it. Take the export *now*; the sweep does not know an incident is
> open.

### T+1 h → T+4 h — Determine scope

Answer these four questions with evidence, and record "unknown" where the answer
is unknown — an honest unknown is reportable, a guessed number is not.

1. **Which data subjects?** How many accounts, and how many of them are under 18
   (DPDP s.9 makes a child's data a materially worse incident).
2. **Which categories of personal data?** The realistic set, given the schema:
   `email`, `mobile`, name, `age_band`/`is_minor`, education level, course
   interest, preferred state/city, budget range (`student_profiles`), enquiry
   contact details and IP (`enquiries`), guardian name and contact
   (`guardian_consents`), profile-free-text (`media`). **Password hashes are
   bcrypt at `BCRYPT_ROUNDS ≥ 12`** and OTP codes are bcrypt-hashed, so neither
   is directly readable — say so, it materially changes the severity.
3. **Was it accessed, or merely exposed?** A public `GET` with no authentication
   that returned rows is access. A misconfiguration nobody reached is exposure.
   CERT-In's clock starts at *noticing*, so this affects reporting urgency, not
   whether to report.
4. **Is it ongoing?** If yes, containment has failed and that fact goes in the
   report as-is.

### T+4 h → T+6 h — CERT-In report

File within **six hours of T+0**, in the format the Directions prescribe, to the
address in [Contacts](#contacts). Minimum content:

- Description of the incident and the systems affected
- Date and time of the incident **and** of detection, with time zone
- Estimated and actual number of records affected
- Whether the incident is contained
- A contact name, role, phone and email who can answer follow-up questions
- The remediation status and the plan

Attach the incident record. Do not wait for the scope analysis to be finished —
a report that says "under assessment, update at T+8h" is compliant; a late
report is not.

### T+6 h → T+72 h — DPDP Board report

A **detailed** report to the Data Protection Board of India:

- Nature and circumstances of the breach
- Categories and approximate number of data principals affected
- Categories and approximate volume of personal data involved
- Likely impact
- Containment and mitigation measures taken, with timestamps
- Contact details for the incident handler
- Whether the breach is ongoing

### In parallel, from T+6 h and without delay — Tell the people affected

DPDP s.8(6) requires notifying **each affected data principal** and the Board.
The notice must be in plain language — not legalese, not a status page nobody
reads.

**The template below is deliberately short. Fill the brackets; do not add
reassurance the facts do not support.**

> **Subject: Important notice about your Padhaanewala account**
>
> On **[date]** we discovered that **[what was accessed — one sentence]**.
> The information involved was **[categories: e.g. your name, email address and
> mobile number]**. It did **[not include / include]** your password — passwords
> are stored only as a one-way hash and cannot be read back.
>
> We found out on **[date]** and took these steps the same day: **[rotate
> tokens / disable accounts / block source / take the service offline]**.
>
> What you should do: **[change your password / nothing, we have done it /
> watch for unsolicited calls quoting your details]**. If we ask you to reset
> your password, use this link: **[URL]**.
>
> If your data was affected and you are under 18, this notice should also reach
> your parent or guardian — reply and we will send it to them.
>
> We are reporting this to the Data Protection Board of India and to CERT-In as
> the law requires. For questions, contact **[name]** at **[email]**, quoting
> incident reference **[ID]**.
>
> You can also raise a grievance through our Grievance Redressal page.

**Delivery:** email to the address on the account, plus an in-app notification
row (`POST /notifications`, admin-only) for anyone who still signs in. Record
per-user whether it was delivered — the Board will ask.

**Never:** speculate about the attacker, name a suspect, promise that it cannot
happen again, or omit the categories of data involved because they are
embarrassing.

### T+72 h → T+7 d — Recover and review

1. Rotate any credential that could have been read — DB password, `SECRET_KEY`,
   OpenAI key, SendGrid/MSG91 keys, SMTP password.
2. Rotate TLS/acme material if host access was lost.
3. Restore service, then verify: `/health` green, auth working, one full pass of
   `backend/smoke_test.py`.
4. Hold a blameless review within seven days. Its output is a change to this
   document or to the code, not to a person.
5. Record what was **not** detected, and why — that is the most valuable line in
   the review and the one most likely to be cut.

---

## 4. Notification matrix

| Audience | When | Channel | Who signs |
|---|---|---|---|
| CERT-In | ≤ 6 h from T+0 | Prescribed format | Incident Commander |
| Data Protection Board of India | ≤ 72 h, detailed | Prescribed format | Incident Commander + Legal |
| Each affected data principal | Without delay | Email + in-app notification | Communications |
| Grievance Officer | Immediately | Internal | Any reporter |
| Insurer / platform provider | Per contract | As per contract | Legal |
| Public statement | Only if asked, or if users cannot reach us | Site banner | Communications |

---

## 5. What this codebase gives you

Written against the source so the first responder does not have to discover it
under time pressure.

**Helpful:**

- **`X-Request-ID` on every response**, generated in
  `app/middleware/logging.py`, echoed in the `500` body, and printed by
  `instrumentation.ts` with `error.digest`. A user's screenshot is enough to
  find the corresponding server line.
- **`audit_logs`** records `action`, `entity_type`, `entity_id`, actor, IP and
  old/new values, with **PII redacted at the single choke point
  `audit.record`** (`app/utils/audit.py`). Privilege changes carry actor *and*
  IP. Retained 730 days.
- **`refresh_tokens` is a ledger**, not a blob: `jti`, `family`, `used_at`,
  `rotated_to_jti`, `revoked_at`, `request_ip`. Replay detection revokes the
  family automatically, which both limits damage and *leaves a record* that a
  token was replayed.
- **Access tokens are memory-only in the browser** and refresh tokens are
  HttpOnly `SameSite=Strict` cookies scoped to `/api/v1/auth`. A successful XSS
  or an exfiltrated `localStorage` therefore does not hand over a long-lived
  credential.
- **Passwords are bcrypt** at `BCRYPT_ROUNDS ≥ 12`; OTP codes are bcrypt-hashed
  in `otp_records` and never stored plaintext.
- **No object storage and no third-party analytics.** There is no S3 bucket and
  no GA/Meta/Sentry SDK, so there is no third-party breach notification to chase
  in the first six hours.
- **Postgres publishes no port** in `docker-compose.prod.yml`; only Caddy does.
  A reportable internet-reachable database is not the default failure mode.

**Working against you — these are open gaps, not hypothetical ones:**

| Gap | Consequence | Phase |
|---|---|---|
| **No centralised log shipping.** Logs go to container stdout and stop there. | Reconstructing a timeline depends on `docker logs` still being on the host. A host-level compromise can destroy the record of itself. | 78–85 |
| **No log rotation configured** in `docker-compose.prod.yml` (Docker's default `json-file` driver has no cap here). | Long-running containers can fill the disk — and a full disk is both an outage and a way to lose logs you needed. | 78–85 |
| **No uptime monitoring.** | Nothing detects the incident. The six-hour clock runs from *noticing*, so not noticing is not a defence — it is how a small breach becomes a large one. Phase 8.5 is explicitly the prerequisite for this playbook. | 8.5 |
| **No backup/restore procedure verified.** | Recovery after an encrypting or destructive incident is untested. | 78–85 |
| **Single uvicorn worker, single host.** | No horizontal log correlation and no failover; the same host holds the evidence and the service. | 86–95 |

**Do not claim in any report** that we have centralised logging, monitoring,
automated alerting or tested restores. None of it exists yet. The honest
statement — "logs are retained locally on the host; central shipping is being
implemented" — is far better than an assertion the Board can falsify by asking
for the log pipeline.

---

## 6. Contacts

Nothing here is optional. **Every blank is a missed deadline.**

| What | Detail |
|---|---|
| CERT-In reporting address / portal | _TBD — the Directions name the channel; confirm the current one before launch_ |
| Data Protection Board of India | _TBD_ |
| Incident Commander | _TBD (name, mobile, email)_ |
| Technical Lead | _TBD (name, mobile, email)_ |
| Legal / Grievance Officer | _TBD — this is Phase 9.2 and it is blocked on the client_ |
| Registered entity & address | Padhaanewala Edutech Services, Bengaluru 560100 |
| VPS / cloud provider abuse & support contact | _TBD — Phase 8.1_ |
| Insurance notification address | _TBD_ |

---

## 7. Pre-incident checklist

None of this is incident response; all of it decides whether the first six
hours are survivable. Ordered by how much it costs to fix *before* rather than
*during*.

- [ ] Name the four roles, with mobile numbers that will be answered at 2 a.m.
- [ ] Name the Grievance Officer (Phase 9.2) — also a launch blocker for the
      production build.
- [ ] Confirm the current CERT-In reporting channel and test the path.
- [ ] Add Docker log rotation (`json-file` with `max-size` / `max-file`) to every
      service in `docker-compose.prod.yml`.
- [ ] Ship logs off the host (Phase 78–85) so a host compromise cannot destroy
      the record of itself.
- [ ] Stand up uptime monitoring (Phase 8.5) — it is the detection half of this
      document, and without it every deadline above starts late or not at all.
- [ ] Verify a backup restore end to end, and date the evidence.
- [ ] Rehearse: read this document aloud against a fictional "the `users` table
      was public for 40 minutes" and time the T+0 → T+6 h path. If it takes more
      than an hour of calendar time, the document is too long — cut it, not the
      deadline.
- [ ] After any rehearsal or real incident, update this file. A playbook that
      was not updated is a playbook that will be distrusted the next time.
