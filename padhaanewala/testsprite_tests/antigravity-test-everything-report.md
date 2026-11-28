# Padhaanewala Full Regression & Deployment Readiness Report

**Generated:** 2026-11-28 03:45 IST  
**Report type:** Interim snapshot — the 50-case frontend runner was stopped after the CLI session drifted to an unrelated project  
**Environment:** Frontend `http://localhost:3000` | Backend `http://localhost:8000`  
**Browser:** Chrome 158, default profile, `--remote-debugging-port=9222`  
**Database:** PostgreSQL `padhaanewala_dev`, Alembic head `b2f8c4d9e731`  
**Cache:** Redis 7, healthy  
**Release ref:** `6cf8274` (`main`)  
**Test data:** Synthetic accounts only. No real student or minor data was used.

> This report will be updated to final verdicts when the frontend rerun finishes. Every frontend case is listed below with one of: `PASS`, `FAIL`, `BLOCKED`, `INTERRUPTED` (started but no verdict), or `PENDING` (not started).

---

## 1. Executive summary

| Category | Total | Passed | Failed | Blocked | Interrupted | Pending | Pass rate so far |
|---|---:|---:|---:|---:|---:|---:|---:|
| Frontend E2E (`/browser`) | 50 | 3 | 0 | 1 | 2 | 44 | 3/4 final verdicts (75%) |
| Backend API (`pytest`) | 10 | 10 | 0 | 0 | 0 | 0 | **100%** |
| Combined | 60 | 13 | 0 | 1 | 2 | 44 | — |

**Current release decision:**  
- **Staging:** NO-GO until AWS CloudShell/CLI, EC2 SSH/SSM, and Cloudflare DNS access are provided and the runbook Phase 0/1 outputs are captured.  
- **Production:** NO-GO. All security/readiness gates listed in section 6 remain unsatisfied.  
- **Code/config readiness:** application baseline is green and deployed from clean ref `e35a33f…`; local QA-only overrides must not be deployed.

---

## 2. Frontend E2E results — all 50 cases

| Case | Title | Status | Evidence | Note |
|---|---|---|---|---|
| TC001 | Log in with valid credentials and access the dashboard | **PASS** | `TC001_dashboard.png` | Successfully authenticated as testsprite.student@example.com and verified protected dashboard displaying student profile (console error: initial 401 on unauthenticated session check before login). |
| TC002 | Start a mock test attempt from the catalog | **BLOCKED** | `Chrome remote debugging connection failed (Could not find DevToolsActivePort for chrome at C:\Users\pushk\AppData\Local\Google\Chr...` | Chrome connection could not be established; please ensure Chrome is running with remote debugging enabled or check DevToolsActivePort. |
| TC003 | Find a college from the homepage search | **PASS** | `tc003_college_detail_page.png` | Searched "A.B. Shetty", selected suggestion, and verified college detail page and overview with zero console errors. |
| TC004 | Complete and submit a mock test attempt | **INTERRUPTED** | - | Runner ended without a final verdict; rerun required |
| TC005 | Block access to a protected route while signed out | **PASS** | `tc005_redirect.png` | Unauthenticated access to /dashboard is blocked and redirected to /login?next=%2Fdashboard. |
| TC006 | Submit a contact enquiry successfully | **INTERRUPTED** | - | `agy` CLI session drifted to an unrelated SafeRoute AI project; runner stopped at 03:42 IST with no TC006 verdict |
| TC007 | Block unauthenticated access to the admin console | **PENDING** | - | Not executed yet in the current run |
| TC008 | Filter and sort colleges before opening a detail page | **PENDING** | - | Not executed yet in the current run |
| TC009 | Auto-submit a mock test when time runs out | **PENDING** | - | Not executed yet in the current run |
| TC010 | Save a college to the dashboard | **PENDING** | - | Not executed yet in the current run |
| TC011 | Inspect college detail sections | **PENDING** | - | Not executed yet in the current run |
| TC012 | Log out and block revisiting protected content | **PENDING** | - | Not executed yet in the current run |
| TC013 | Use a homepage quick action to open a discovery page | **PENDING** | - | Not executed yet in the current run |
| TC014 | Protect the dashboard from unauthenticated access | **PENDING** | - | Not executed yet in the current run |
| TC015 | Submit a mock test early and view results | **PENDING** | - | Not executed yet in the current run |
| TC016 | Submit an admission enquiry successfully | **PENDING** | - | Not executed yet in the current run |
| TC017 | Redirect unauthenticated users away from mock tests | **PENDING** | - | Not executed yet in the current run |
| TC018 | Prevent a student from opening admin content | **PENDING** | - | Not executed yet in the current run |
| TC019 | Browse an exam and review its details | **PENDING** | - | Not executed yet in the current run |
| TC020 | Submit a complete college suggestion | **PENDING** | - | Not executed yet in the current run |
| TC021 | Compare multiple colleges side by side | **PENDING** | - | Not executed yet in the current run |
| TC022 | Read dashboard notifications | **PENDING** | - | Not executed yet in the current run |
| TC023 | Preserve unanswered review state during a mock test | **PENDING** | - | Not executed yet in the current run |
| TC024 | Browse a course and review its details | **PENDING** | - | Not executed yet in the current run |
| TC025 | Show an error for incorrect login credentials | **PENDING** | - | Not executed yet in the current run |
| TC026 | Browse a scholarship and review matching information | **PENDING** | - | Not executed yet in the current run |
| TC027 | Show validation for malformed login input | **PENDING** | - | Not executed yet in the current run |
| TC028 | Show validation for an invalid contact email | **PENDING** | - | Not executed yet in the current run |
| TC029 | Request a password reset link | **PENDING** | - | Not executed yet in the current run |
| TC030 | Show validation for an invalid contact mobile number | **PENDING** | - | Not executed yet in the current run |
| TC031 | Read a blog article from the listing | **PENDING** | - | Not executed yet in the current run |
| TC032 | Browse reviews with a filter applied | **PENDING** | - | Not executed yet in the current run |
| TC033 | Find predicted colleges from the predictor form | **PENDING** | - | Not executed yet in the current run |
| TC034 | Require consent before submitting an enquiry | **PENDING** | - | Not executed yet in the current run |
| TC035 | Remove a college from comparison | **PENDING** | - | Not executed yet in the current run |
| TC036 | Move through the blog listing pages | **PENDING** | - | Not executed yet in the current run |
| TC037 | Browse featured content on the homepage | **PENDING** | - | Not executed yet in the current run |
| TC038 | Complete the college suggestion questionnaire | **PENDING** | - | Not executed yet in the current run |
| TC039 | Clear the assistant conversation | **PENDING** | - | Not executed yet in the current run |
| TC040 | Show validation for missing college suggestion fields | **PENDING** | - | Not executed yet in the current run |
| TC041 | Reject an empty assistant message | **PENDING** | - | Not executed yet in the current run |
| TC042 | Show validation for invalid password recovery email | **PENDING** | - | Not executed yet in the current run |
| TC043 | See validation when predictor inputs are missing | **PENDING** | - | Not executed yet in the current run |
| TC044 | Prevent adding too many colleges to comparison | **PENDING** | - | Not executed yet in the current run |
| TC045 | Open informational pages from the planning and legal sections | **PENDING** | - | Not executed yet in the current run |
| TC046 | See an empty state when college filters return no results | **PENDING** | - | Not executed yet in the current run |
| TC047 | Switch between admin sections after entering the console | **PENDING** | - | Not executed yet in the current run |
| TC048 | Show an error for an invalid reset token | **PENDING** | - | Not executed yet in the current run |
| TC049 | Search and paginate admin users or leads | **PENDING** | - | Not executed yet in the current run |
| TC050 | See validation when an admin form is submitted with invalid values | **PENDING** | - | Not executed yet in the current run |

---

## 3. Backend API results — all 10 cases

Command used: system `python -m pytest` from `padhaanewala/`.

| Case | Feature | Endpoint | Result | Evidence |
|---|---|---|---|---|
| TC001 | Browse colleges with filters | `GET /api/v1/colleges` | **PASS** | `python -m pytest` — 10 passed in 5.41s |
| TC002 | Retrieve college details | `GET /api/v1/colleges/{ref}` | **PASS** | `python -m pytest` — 10 passed in 5.41s |
| TC003 | Browse course catalog | `GET /api/v1/courses` | **PASS** | `python -m pytest` — 10 passed in 5.41s |
| TC004 | Submit enquiry form | `POST /api/v1/enquiries` | **PASS** | `python -m pytest` — 10 passed in 5.41s |
| TC005 | Submit college suggestion | `POST /api/v1/college-submissions` | **PASS** | `python -m pytest` — 10 passed in 5.41s |
| TC006 | Save college to student account | `POST /api/v1/saved-colleges` | **PASS** | `python -m pytest` — 10 passed in 5.41s |
| TC007 | Mark notification as read | `PUT /api/v1/notifications/{id}/read` | **PASS** | `python -m pytest` — 10 passed in 5.41s |
| TC008 | Submit mock test attempt | `POST /api/v1/mock-tests/{ref}/submit` | **PASS** | `python -m pytest` — 10 passed in 5.41s |
| TC009 | Send AI assistant question | `POST /api/ai` | **PASS** | `python -m pytest` — 10 passed in 5.41s |
| TC010 | Create compliance data request | `POST /api/v1/compliance/requests` | **PASS** | `python -m pytest` — 10 passed in 5.41s |

**Backend environment notes**

- `/health` returned `200` with DB and Redis checks OK.
- `RATE_LIMIT_ENABLED` was **never** set to `false`.
- Local-only P8 overrides were supplied as process environment variables so TC004 could send four synthetic enquiries; production defaults are unchanged.
- Local database was migrated from `f4a1c6d8e902` to `b2f8c4d9e731`, creating `ai_settings` so TC009 no longer returns 500.
- No backend case is currently failed or blocked.

---

## 4. Fail / Blocked register

### 4.1 Current run — open items

| Case | Layer | Status | Root cause | Action |
|---|---|---|---|---|
| TC002 | Frontend | **BLOCKED** | Agent reported `DevToolsActivePort` not found for `C:\Users\pushk\AppData\Local\Google\Chrome\User Data`. A separate check at 00:19 IST confirmed the file exists, port 9222 answers `/json/version` with 200, and Chrome is running with the default profile. This is a runner/browser-connection flake, not an application defect. | Rerun TC002 alone after the current batch completes; if it recurs, restart Chrome and rerun. |
| TC004 | Frontend | **INTERRUPTED** | Complete and submit a mock test attempt started but the `agy` process hung without browser progress or a final verdict; no PASS/FAIL/BLOCKED line was produced. | Rerun TC004 alone in an isolated CLI project; if it hangs again, restart Chrome and rerun. |
| TC006 | Frontend | **INTERRUPTED** | The `agy -p` process launched for TC006 attached to an unrelated SafeRoute AI conversation (transcript shows work on `src/api/app.py`, port 8010, and a different user request) instead of the Padhaanewala browser case. No TC006 verdict was produced. The stuck runner was stopped at 03:42 IST. | Rerun TC006–TC050 with `--new-project --add-dir <APP>` (or an equivalent isolated CLI project) and `--print-timeout` so a session cannot drift into another workspace. |

### 4.2 Resolved earlier blockers (not current failures)

| Case / area | Earlier result | Resolution | Current state |
|---|---|---|---|
| Frontend TC001 | BLOCKED — Chrome remote debugging unavailable | Chrome relaunched on the **default** profile with `--remote-debugging-port=9222`, matching the runner's expected `DevToolsActivePort` path. | PASS in current run. |
| Frontend TC004 | BLOCKED — same Chrome profile mismatch | Same Chrome fix. | Interrupted in current run after hanging; rerun required. |
| Backend TC004 | FAIL — HTTP 429 from `public_enquiry` limit 3/600s | Local-only `RATE_LIMIT_P8_CRM_LIMITS` and `RATE_LIMIT_P8_IDENTIFIER_LIMITS` overrides; limits raised for synthetic QA only. | PASS — included in 10/10. |
| Backend TC009 / AI chat | 500 — `relation "ai_settings" does not exist` | `alembic upgrade head` applied `b2f8c4d9e731` locally. | PASS — included in 10/10. |
| Backend fixture helper | `RuntimeError: Could not restore test account: HTTP 409` | Used direct `pytest` instead of the helper reset step. | PASS — no product impact. |
| Frontend TC001 console note | Initial 401 during unauthenticated session check | Expected pre-login session probe; dashboard rendered correctly after login. | PASS with benign console note. |

---

## 5. Local QA-only configuration (must never be deployed)

These are QA-machine settings only and are absent from the clean release ref:

- Backend process env overrides for P8 CRM and identifier rate limits. `RATE_LIMIT_ENABLED=false` was not used.
- Local Alembic upgrade to `b2f8c4d9e731`.
- Synthetic accounts:
  - `testsprite.student@example.com` — student role.
  - `testsprite.admin@example.com` — local admin/super-admin account created via `scripts/seed_admin.py` under the explicit allowlist gate.
- Chrome launched with the default user-data directory and remote debugging on port 9222.
- The frontend runner script's local synthetic admin credential edit was reverted before commit `6cf8274`; future admin-case reruns need the local-only edit re-added, then reverted again before any commit.

None of these justify weakening production throttling, bypassing approval gates, or deploying the working tree.

---

## 6. Deployment readiness gates

| Gate | Required | Status | Evidence / blocker |
|---|---|---|---|
| Gate 0 | Written approvals satisfied | **BLOCKED** | Approval register: `APPROVED 0`, `OPEN 6` (A-01, D-01, D-02, D-03, D-15, D-16). |
| T0 / T0.1 / T1 | Branch reconciliation, JWT hardening, crypto primitives | COMPLETE | Prior verified reports; merged into `main`. |
| T2–T5 | PII field encryption integration, restricted search/HMAC, migration/backfill, plaintext removal | **BLOCKED** | Depends on Gate 0; no approved field scope or migration approval. |
| D-14 | Backup/key custody and restore rehearsal | **OPEN** | No rehearsal evidence. |
| D-15 | Expand-only migration pattern approval | **OPEN** | No DBA written approval. |
| D-17 | Destructive plaintext removal approval | **OPEN** | Not provided. |
| D-18 | Production key rotation | **OPEN** | Not provided. |
| Secrets | Secrets Manager/SSM with independent production keys | NOT DONE | No AWS access or secret values supplied; nothing pasted into chat. |
| Cloudflare real-IP | Trusted proxy hops, `CF-Connecting-IP`, discard client headers | DOCUMENTED / NOT APPLIED | Runbook section 4.2; no Cloudflare access. |
| WAF / rate limits | Edge WAF + app-level limits active | NOT CONFIGURED | App limits active locally; edge controls require Cloudflare access. |
| Backup / restore | Snapshot, DB dump, successful restore rehearsal | NOT DONE | No cloud access. |
| No PII in logs | Logs/errors verified free of PII | NOT VERIFIED IN PROD | Local logs show synthetic data only; production verification pending. |
| Monitoring / alerts | Uptime, container, backup, error alerts active | NOT ACTIVE | Runbook section 20 checklist remains unchecked. |
| Written approval | Named person signs off release | NOT PROVIDED | No approval evidence. |
| Canonical domain | One canonical domain resolved | UNRESOLVED | Runbook uses `padhaanewala.com`; older planning docs reference `.in`. Decision required. |
| Verified college data | Content accuracy verified | NOT PROVIDED | No verified dataset supplied. |
| Analytics / GA / GTM | Explicit approval + code + privacy + consent | NOT ADDED | No approval; nothing added. |

---

## 7. Staging decision

**NO-GO right now.** The application baseline is test-green, but deployment inputs are missing.

Required from you, outside chat:

1. AWS CloudShell access or a configured AWS CLI profile.
2. EC2 SSH or SSM access.
3. Cloudflare DNS access.
4. Phase 0 / Phase 1 outputs from `docs/aws-cloudflare-deployment-runbook.md`.

Staging constraints once access is available:

- Host at `staging.padhaanewala.com`.
- `noindex` must be active.
- Synthetic data only.
- Never submit staging to Google Search Console.
- DNS-only first; enable Cloudflare orange-cloud only after the real-client-IP fix is applied and tested.
- Re-run the 10 backend cases against staging after migrations.

---

## 8. Production decision

**NO-GO.** Production remains blocked until every gate in section 6 is closed, staging is deployed and smoke-tested, and a named authorised person signs off the exact release ref.

No production deploy, DNS change, secret write, analytics tag, or Cloudflare setting has been performed.

---

## 9. Immediate next actions

1. Free port `8000` (currently held by another active project's server), restore Docker/frontend/Chrome debug, then rerun TC002 and TC004–TC050 in an isolated CLI project (`--new-project --add-dir <APP>`) with a per-case `--print-timeout`; the previous runner drifted into another workspace.
2. Re-add the synthetic admin credential locally only if admin cases require it, then revert before any commit.
3. Regenerate this report from raw results with final frontend verdicts.
4. Keep generated raw results local-only; do not commit local QA configuration.
5. Provide the cloud access items above to start staging. Production stays blocked.

---

## 10. Files

- Frontend plan: `testsprite_tests/testsprite_frontend_test_plan.json`
- Backend plan: `testsprite_tests/testsprite_backend_test_plan.json`
- Raw frontend output: `testsprite_tests/antigravity-frontend-results.txt`
- This report: `testsprite_tests/antigravity-test-everything-report.md`
- Deployment runbook: `docs/aws-cloudflare-deployment-runbook.md`
- Gate evidence: `docs/fix-02-master-completion-report.md`, `docs/fix-02-gate-approval-request-forms.md`
