# TestSprite AI Testing Report (MCP) â€” Mock Test Attempt Fix Verification

---

## 1ï¸âƒ£ Document Metadata

- **Project Name:** padhaanewala
- **Date:** 2026-11-22
- **Prepared by:** TestSprite AI Team
- **Purpose:** Targeted re-run of the last remaining baseline failure (`TC006`) after fixing the backend mock-test `start` endpoint so a live, unfinished attempt is resumed instead of being counted against the student's `attempts_allowed` allowance.
- **Test Type:** Frontend (browser/UI automation via Playwright, generated and executed by TestSprite MCP)
- **Target Application:** `http://localhost:3000/` (Next.js dev server, Turbopack)
- **Dependent Backend:** `http://127.0.0.1:8000` (FastAPI, seeded `test_suite` PostgreSQL schema, Redis healthy)
- **Test Credential:** `[REDACTED]` / `[REDACTED]` (student role; account was recreated after the database reset)
- **Cases Re-run:** 1 (`TC006`)
- **Result:** 1 passed / 0 failed (100%)
- **Raw Data:** `testsprite_tests/tmp/raw_report.md`, `testsprite_tests/tmp/test_results.json`
- **Baseline Report:** `testsprite_tests/testsprite-mcp-test-report.md` (original 15-case run, 5 pass / 10 fail â€” file currently absent from the test-output directory)
- **Prior Fix Reports:** `testsprite_tests/testsprite-mcp-auth-fix-report.md`, `testsprite_tests/testsprite-mcp-college-fix-report.md`

---

## 2ï¸âƒ£ Requirement Validation Summary

### Requirement: Mock Test Start/Answer/Submit/Timer Flow
- **Description:** A signed-in student can start a mock test, answer questions, submit the attempt, and review the result summary.

#### Test TC006 Start and complete a mock test attempt
- **Test Code:** [TC006_Start_and_complete_a_mock_test_attempt.py](./TC006_Start_and_complete_a_mock_test_attempt.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard-v3/o/21e3f557-9777-54fa-8c62-ad15322917bb/projects/mcp/bae255ce-4531-5b0c-92f2-8d7594463588/test/68263234-ba58-42c5-94b3-46ae73ad5d63
- **Status:** âœ… Passed
- **Severity:** HIGH (was failing in baseline)
- **Analysis / Findings:** The baseline failure was **not** a catalog-loading problem â€” the catalog renders correctly. The real break was `POST /api/v1/mock-tests/{slug}/start` returning `400 {"detail":"Attempt limit reached for this mock test"}`. `start_mock_test` finalised only *expired* in-progress attempts, then counted the still-live in-progress attempt toward `attempts_allowed`. With the seeded papers set to `attempts_allowed = 1`, one visit permanently locked the student out: a second "Begin test" was refused even though no attempt had ever been finished. The endpoint was changed to resume a live attempt (`status == "in_progress"` and `time_remaining_seconds > 0`) and return its saved answers via `_answers_by_question`; the `attempts_allowed` check now runs only when there is nothing to resume. A regression test (`test_start_resumes_live_attempt_instead_of_spending_the_limit`) verifies resume, answer restoration, the enforced limit after submission, and passes alongside the existing engine tests (`3 passed, 23 deselected`). Manual verification confirmed the full flow: login â†’ `/mock-tests` â†’ "Take test" â†’ "Begin test" opens the timed runner (no attempt-limit error) â†’ answer â†’ submit â†’ result screen. The final targeted TestSprite re-run passed with `testStatus: PASSED`; backend logs show `POST .../start â†’ 200`, `PUT .../answers/{q} â†’ 200`, `POST .../submit â†’ 200`.

---

## 3ï¸âƒ£ Coverage & Matching Metrics

- **100% of the mock-test cluster passes** â€” 1 passed / 0 failed.
- Progression: baseline 0/1 â†’ backend resume fix â†’ final targeted re-run 1/1.

| Requirement | Total Tests | âœ… Passed | âŒ Failed |
|---|---|---|---|
| Mock Test Start/Answer/Submit/Timer Flow | 1 | 1 | 0 |
| **Total (cluster)** | **1** | **1** | **0** |

**Matching notes**
- `TC006` maps cleanly to the mock-test flow requirement; no orphan cases.
- This is a targeted regression check, not a full-suite run. The five original passes (`TC001`, `TC002`, `TC004`, `TC010`, `TC014`) were not re-executed.
- Combined verified coverage across the three fix cycles: 10 of the original 15 cases (5 auth/role guard + 4 college discovery + TC006) now pass in targeted runs. The remaining original passes have not been re-run.

---

## 4ï¸âƒ£ Key Gaps / Risks

- **Test data was repaired manually before this run.** The `test_suite` database had been reset: the `[REDACTED]` account was gone and `test_suite.test_attempts` was empty. The account was recreated through `POST /api/v1/auth/register` (student role) and the leftover submitted attempt was deleted so the single allowed attempt was available. Neither step is in a repeatable setup script, so a fresh database rebuild will otherwise fail this case at login or at the attempt-limit check.
- **Single-attempt papers are consumed by each passing run.** All four seeded papers have `attempts_allowed = 1`; after one successful submission the same account cannot repeat TC006. Future re-runs must reset attempts (or use a fresh user / a higher allowance in test data) before execution.
- **Generated assertion quality is weak.** The exported test asserts the visible `/300` score text, which is a reasonable result-screen signal, but the assertion comment says "not verified â€” the export-time check could not be evaluated", and the exported file does not show an explicit "Submit" click even though the backend logs confirm a submit request was made. Treat the pass as a flow smoke check, not deep grading coverage.
- **Result screen has no dedicated URL.** It renders in place at `/mock-tests/{slug}` (`stage === "result"`). Any generated assertion expecting a `/result` URL will fail against correct application behavior; the additional instruction supplied for this run steered the assertion to visible result content instead.
- **Servers stopped after execution.** Both the backend and frontend background processes ended after the TestSprite command completed. They must be restarted before any further manual or TestSprite work.
- **Auth refresh noise persists.** Repeated login/logout cycles produced `401` and occasional `429` responses from `POST /api/v1/auth/refresh` (5 requests / 60 s cap). These are transient test-harness artifacts, not part of the TC006 defect, but can cause misleading sign-out symptoms during tight re-run schedules.
- **Next.js security maintenance debt remains.** Dev mode still reports a known-vulnerability upgrade nudge; the upgrade was deliberately not applied as part of these targeted fixes.

**All original baseline failures are now addressed.** Next step requires approval before any new work cluster (for example, the pending Next.js security upgrade).
