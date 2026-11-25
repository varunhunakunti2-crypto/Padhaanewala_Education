# TestSprite AI Testing Report (MCP) — Backend

---

## 1️⃣ Document Metadata
- **Project Name:** padhaanewala
- **Date:** 2026-11-24
- **Prepared by:** TestSprite AI Team
- **Scope:** FastAPI backend at `http://127.0.0.1:8000`, 10 generated API cases, development server mode
- **Environment:** PostgreSQL (docker `padhaanewala-db-1`, port 5433), Redis (`padhaanewala-redis-1`, port 6379); `/health` green before and after the run

---

## 2️⃣ Requirement Validation Summary

### Requirement: Public catalogue discovery (colleges and courses)
- **Description:** List/search colleges and courses with valid filters, pagination, and not-found behavior.

#### Test TC001 browse colleges with filters
- **Test Code:** [TC001_browse_colleges_with_filters.py](./TC001_browse_colleges_with_filters.py)
- **Test Error:** None
- **Test Visualization and Result:** https://www.testsprite.com/dashboard-v3/o/21e3f557-9777-54fa-8c62-ad15322917bb/projects/mcp/e9984dba-cb7b-5d23-95b6-971caa827d4b/test/5888b212-9b97-4681-9806-e63c7165014b
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** `GET /api/v1/colleges` honoured `state_id`, `limit`, `offset`; pages did not overlap; `GET /api/v1/colleges/search?q=` returned matches and an empty list for an unmatched query. The current API contract was used successfully.

#### Test TC002 retrieve college details
- **Test Code:** [TC002_retrieve_college_details.py](./TC002_retrieve_college_details.py)
- **Test Error:** None
- **Test Visualization and Result:** https://www.testsprite.com/dashboard-v3/o/21e3f557-9777-54fa-8c62-ad15322917bb/projects/mcp/e9984dba-cb7b-5d23-95b6-971caa827d4b/test/1e247926-da7e-4ad8-b861-1b4e1b892074
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** College detail lookup returned the expected seeded record and handled an unknown reference without a server error.

#### Test TC003 browse course catalog
- **Test Code:** [TC003_browse_course_catalog.py](./TC003_browse_course_catalog.py)
- **Test Error:** None
- **Test Visualization and Result:** https://www.testsprite.com/dashboard-v3/o/21e3f557-9777-54fa-8c62-ad15322917bb/projects/mcp/e9984dba-cb7b-5d23-95b6-971caa827d4b/test/52b51938-801e-4610-998b-5f37e5e01389
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** `GET /api/v1/courses?q=` with `limit`/`offset` returned valid, bounded results. Earlier failures using `?search=` were a generated-test contract error, not an app defect.

---

### Requirement: Lead capture and input validation
- **Description:** Public enquiry submission must validate inputs before persisting a lead.

#### Test TC004 submit enquiry form
- **Test Code:** [TC004_submit_enquiry_form.py](./TC004_submit_enquiry_form.py)
- **Test Error:** `AssertionError: Expected validation rejection for POST /api/v1/enquiries` — payload `{'email': 'not-an-email', 'age_band': '18_plus', ...}` returned **status=201** and was persisted (`id=2`).
- **Test Visualization and Result:** https://www.testsprite.com/dashboard-v3/o/21e3f557-9777-54fa-8c62-ad15322917bb/projects/mcp/e9984dba-cb7b-5d23-95b6-971caa827d4b/test/f887a279-9516-4fcd-8b76-4a51186a2481
- **Status:** ❌ Failed
- **Severity:** MEDIUM
- **Analysis / Findings:** **Genuine application defect.** `EnquiryCreate.email` in `backend/app/schemas/catalog.py` is a plain `str | None` with only `max_length=255`; unlike `schemas/auth.py`, `schemas/submissions.py`, and `schemas/compliance.py`, it performs no email shape validation. Malformed addresses are written to the enquiry/lead tables and can break downstream CRM/email hand-off. Fix: reuse the existing `_validate_email_value` helper (or `EmailStr`) on `EnquiryCreate.email` and reject invalid values with 422.

---

### Requirement: Authenticated student operations
- **Description:** Suggest a college, save a college, mark notifications read, and submit a mock-test attempt.

#### Test TC005 submit college suggestion
- **Test Code:** [TC005_submit_college_suggestion.py](./TC005_submit_college_suggestion.py)
- **Test Error:** `POST /api/v1/auth/login` returned **429** `RATE_LIMIT_EXCEEDED` (`retry_after_seconds=47`) instead of 200.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard-v3/o/21e3f557-9777-54fa-8c62-ad15322917bb/projects/mcp/e9984dba-cb7b-5d23-95b6-971caa827d4b/test/2601ea45-de94-42b2-bd7d-4eff4b50248e
- **Status:** ❌ Failed
- **Severity:** LOW (harness)
- **Analysis / Findings:** Not an application defect. The auth limiter (`AUTH_TIGHT_LIMIT = 5` per 60 s per client IP) worked as intended; multiple generated cases each log in afresh from the same IP. Re-run should reuse one token across cases or stagger/whitelist the test client.

#### Test TC006 save college to student account
- **Test Code:** [TC006_save_college_to_student_account.py](./TC006_save_college_to_student_account.py)
- **Test Error:** `POST /api/v1/auth/login` returned **429** `RATE_LIMIT_EXCEEDED` (`retry_after_seconds=35`).
- **Test Visualization and Result:** https://www.testsprite.com/dashboard-v3/o/21e3f557-9777-54fa-8c62-ad15322917bb/projects/mcp/e9984dba-cb7b-5d23-95b6-971caa827d4b/test/72f21e4f-240d-4336-99b3-7797b6391bc3
- **Status:** ❌ Failed
- **Severity:** LOW (harness)
- **Analysis / Findings:** Same rate-limit interaction as TC005; the save-college endpoint itself was not reached. No evidence of a defect in the save flow.

#### Test TC007 mark notification as read
- **Test Code:** [TC007_mark_notification_as_read.py](./TC007_mark_notification_as_read.py)
- **Test Error:** `GET /api/v1/notifications/my` returned **200** with body `[]`; assertion required an unread notification with an identifier.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard-v3/o/21e3f557-9777-54fa-8c62-ad15322917bb/projects/mcp/e9984dba-cb7b-5d23-95b6-971caa827d4b/test/0bb2800b-a9b1-4ace-805c-252d0624cf7a
- **Status:** ❌ Failed
- **Severity:** LOW (test data)
- **Analysis / Findings:** Endpoint responded correctly; the seeded student has zero unread notifications (`select count(*) ... where is_read=false` = 0). Seed one unread row before the case or use the admin broadcast flow to create it.

#### Test TC008 submit mock test attempt
- **Test Code:** [TC008_submit_mock_test_attempt.py](./TC008_submit_mock_test_attempt.py)
- **Test Error:** `POST /api/v1/mock-tests/jee-main-hardcore-mock-paper-2-2026/start` returned **400** `{"detail": "Attempt limit reached for this mock test"}`.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard-v3/o/21e3f557-9777-54fa-8c62-ad15322917bb/projects/mcp/f615babb-dbbc-4f7e-ba55-551d1c4b1689
- **Status:** ❌ Failed
- **Severity:** LOW (test data)
- **Analysis / Findings:** Not a defect. The paper has `attempts_allowed = 1` and one attempt is already recorded from an earlier run; the guard in `routers/mock_tests.py` correctly refuses a second start. Use a disposable test paper or reset the student's attempt state before re-running.

---

### Requirement: AI assistant proxy
- **Description:** AI assistant question through the Next.js proxy.

#### Test TC009 send ai assistant question
- **Test Code:** [TC009_send_ai_assistant_question.py](./TC009_send_ai_assistant_question.py)
- **Test Error:** None
- **Test Visualization and Result:** https://www.testsprite.com/dashboard-v3/o/21e3f557-9777-54fa-8c62-ad15322917bb/projects/mcp/e9984dba-cb7b-5d23-95b6-971caa827d4b/test/afa24a8c-3413-4f5f-9981-7ccb884f2dc5
- **Status:** ✅ Passed
- **Severity:** LOW
- **Analysis / Findings:** The correct endpoint (`http://localhost:3000/api/ai`, not a FastAPI route) was exercised successfully.

---

### Requirement: Compliance data requests
- **Description:** Create a data-access request through the compliance API.

#### Test TC010 create compliance data request
- **Test Code:** [TC010_create_compliance_data_request.py](./TC010_create_compliance_data_request.py)
- **Test Error:** `POST /api/v1/compliance/requests` with `{'request_type': 'access', 'details': '...'}` returned **201**, while the test expected one of `[400, 409, 422]`.
- **Test Visualization and Result:** https://www.testsprite.com/dashboard-v3/o/21e3f557-9777-54fa-8c62-ad15322917bb/projects/mcp/e9984dba-cb7b-5d23-95b6-971caa827d4b/test/20519de9-5bf7-4bcd-88f8-9a56028ab1b1
- **Status:** ❌ Failed
- **Severity:** LOW (harness expectation)
- **Analysis / Findings:** The payload was a valid new request and the router created it with `status=received`, `due_at` calculated 90 days out — correct behavior. The generated expectation of a validation/conflict error was unfounded. If duplicate suppression is required, that is a new requirement rather than a regression.

---

## 3️⃣ Coverage & Matching Metrics

- **40.00%** of tests passed (4/10); 6 failed, of which **1 is a genuine application defect** and 5 are harness/expectation/test-data issues.

| Requirement | Total Tests | ✅ Passed | ❌ Failed |
|---|---|---|---|
| Public catalogue discovery | 3 | 3 | 0 |
| Lead capture and input validation | 1 | 0 | 1 |
| Authenticated student operations | 4 | 0 | 4 |
| AI assistant proxy | 1 | 1 | 0 |
| Compliance data requests | 1 | 0 | 1 |

Earlier runs: 1/10 (first contract mismatch) and 0/10 (Docker DB/Redis containers had exited, producing 500/503). Containers were restarted and given `--restart unless-stopped`; seeded student login was verified 200 with a token before this run.

---

## 4️⃣ Key Gaps / Risks

> - **Fixed after this run:** `EnquiryCreate.email` now uses the same light email shape check as `schemas/submissions.py`; a direct re-check of `POST /api/v1/enquiries` with `not-an-email` returns **422**. Re-run the backend suite to record the green result.
> - **Test-harness risk:** the 5-per-minute login limiter (correct security behavior) blocks a suite where every case logs in separately. Reuse a single authenticated session or isolate the test client IP to get true coverage of authenticated endpoints.
> - **Data-state risk:** no unread notifications are seeded and the chosen mock paper has exhausted its single allowed attempt, so those paths were never actually exercised. Add deterministic fixtures/reset hooks.
> - **Environment risk:** the DB and Redis containers exited mid-testing earlier; although restart policies are now set, a deployment must monitor both because `/health` fails closed on either.
> - **Coverage gap:** negative paths (400/401/403/404, rate-limit boundaries) were only partially exercised; re-run after the fixture and validation fixes before declaring deployment readiness.
