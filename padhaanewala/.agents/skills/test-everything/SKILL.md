---
name: test-everything
description: Runs the full Padhaanewala regression — all 50 frontend E2E cases through Antigravity's browser (`/browser`: built-in browser in the App, Chrome DevTools MCP in the IDE/CLI) plus all 10 backend API cases — and writes one consolidated pass/fail report. Use when asked to test everything, run the full suite, or do a release regression on this app.
---

# Test Everything (Padhaanewala)

Run the complete QA regression for the Padhaanewala Education platform. Frontend cases are executed by the `browser` subagent via `/browser` — in the Antigravity IDE/CLI this drives your local Chrome through Chrome DevTools MCP; in the App (personal account, v2.30+) it uses the built-in browser. Backend cases are executed with the existing pytest case files from the terminal. Do **not** fix bugs in this workflow — execute, capture evidence, and report only.

## 0. Resolve paths

Let `APP` be the project directory that contains `testsprite_tests/testsprite_frontend_test_plan.json`.

- If the Antigravity workspace is `D:\COde\client project\Pa`, then `APP` = `Padhaanewala_Education\padhaanewala`.
- If you opened the repository itself as the workspace, `APP` = `.`.

All paths below are relative to `APP`.

Key inputs:

| File | Use |
|---|---|
| `testsprite_tests/testsprite_frontend_test_plan.json` | 50 browser cases, with full steps and assertions |
| `testsprite_tests/testsprite_backend_test_plan.json` | 10 API cases |
| `.agents/skills/test-everything/resources/frontend-cases.md` | Compact frontend index, grouped by category — use this to batch |
| `.agents/skills/test-everything/resources/backend-cases.md` | Backend index with endpoints |

Test account from the existing suite: `testsprite.student@example.com` / `SecurePass123!`. Use only this account. Never enter real credentials, payment details, or CAPTCHAs.

## 1. Preflight

1. Check both servers are up:
   - `curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000`
   - `curl.exe -s -o NUL -w "%{http_code}" http://localhost:8000/health`
2. If either does not return 200, stop and tell the user to start it using `README.md` (frontend `npm run dev`; backend `uvicorn app.main:app --reload --no-proxy-headers`, with PostgreSQL and Redis running). Do not try to start databases or change configuration yourself.
3. Check browser readiness:
   - **Antigravity IDE / CLI**: Google Chrome 144+ must be running, with `chrome://inspect/#remote-debugging` → **Allow remote debugging for this browser instance** turned on, and Node.js/`npx` on `PATH`. The first `/browser` call will prompt Chrome to allow debugging — the user must click **Allow** within 60 seconds. Only one Chrome debugging connection is active per IDE instance, so run browser cases **sequentially**, not in parallel.
   - **Antigravity App (personal account, v2.30+)**: no Chrome setup; the built-in browser is used. Parallel tabs are allowed there.
4. Read both test plans and both resource indexes. Confirm the counts: 50 frontend, 10 backend. If the plans differ, report the discrepancy and continue with what exists.

## 2. Backend phase (terminal, not browser)

Run the ten existing backend case files with pytest from `APP`:

```powershell
python -m pytest `
  testsprite_tests/TC001_browse_colleges_with_filters.py `
  testsprite_tests/TC002_retrieve_college_details.py `
  testsprite_tests/TC003_browse_course_catalog.py `
  testsprite_tests/TC004_submit_enquiry_form.py `
  testsprite_tests/TC005_submit_college_suggestion.py `
  testsprite_tests/TC006_save_college_to_student_account.py `
  testsprite_tests/TC007_mark_notification_as_read.py `
  testsprite_tests/TC008_submit_mock_test_attempt.py `
  testsprite_tests/TC009_send_ai_assistant_question.py `
  testsprite_tests/TC010_create_compliance_data_request.py `
  -q --tb=short
```

Preferred: run the helper script (read its `-?` help first):

```powershell
powershell -NoProfile -File .agents/skills/test-everything/scripts/run-backend-cases.ps1 -?
powershell -NoProfile -File .agents/skills/test-everything/scripts/run-backend-cases.ps1
```

It writes `testsprite_tests/antigravity-backend-results.txt` and first restores the shared test account and the two notifications TC007 addresses by id, so repeat runs do not fail on stale fixture state. Always derive the backend counts from this run / that result file — never reuse numbers from an earlier conversation.

Map each `TCxxx` to **PASS** (test passed), **FAIL** (assertion failed), or **BLOCKED** (import/collection/server error). Keep the exact error line for failures. Never write tokens or credentials into any report.

## 3. Frontend phase (`/browser`)

Use the `browser` subagent via `/browser`. Do not use Playwright CLI or BrowserMCP for this skill.

Preferred automation in IDE/CLI: run the helper below from `APP`. It invokes `/browser` one case at a time and appends every response to `testsprite_tests/antigravity-frontend-results.txt`. Use `-Ids TC001,TC007` for a subset. The per-case prompts still follow the template in step 3.

```powershell
powershell -NoProfile -File .agents/skills/test-everything/scripts/run-frontend-cases.ps1 -Start 1 -End 50
```

1. Start from `http://localhost:3000`.
2. Work through the cases grouped by category in `frontend-cases.md`.
   - **IDE/CLI**: run **one case at a time** (only one Chrome DevTools connection per instance). If the user wants speed, ask them to switch to the App for parallel tabs.
   - **App built-in browser**: batches of up to 5 cases may run in parallel, each in its own tab.
3. For each case, send a `/browser` task built from this template (fill the brackets from the JSON plan):

```text
/browser QA case [ID]: [title]. Start at http://localhost:3000. Perform: [steps from the plan]. Verify: [assertions from the plan]. If sign-in is required, use the app's own test account (testsprite.student@example.com / SecurePass123!); if the browser pauses at sign-in, stop and ask me to sign in, then continue. Report exactly:
CASE [ID] | PASS|FAIL|BLOCKED | evidence: [screenshot artifact path or console/network detail] | note: [one line].
Do not edit code or the database. Report any console errors you see.
```

4. For route-guard / unauthenticated cases, use a fresh signed-out tab (or sign out first).
5. For forms that create records (enquiries, college suggestions, compliance requests), use clearly test-labelled values and note the created record in the report.
6. Save a screenshot artifact for every **FAIL** and for the key state of each auth case.
7. If a subagent reports quota exhausted, stop launching new tabs and ask the user how to proceed. Do not silently switch models.

## 4. Report

Write `testsprite_tests/antigravity-test-everything-report.md`:

```markdown
# Full regression report
Generated: <timestamp>
Base URLs: frontend http://localhost:3000 | backend http://localhost:8000

## Summary
- Total: 60 (frontend 50, backend 10)
- Passed / Failed / Blocked: X / Y / Z

## Frontend (`/browser`)
| Case | Area | Result | Evidence | Note |
|---|---|---|---|---|

## Backend (pytest)
| Case | Endpoint | Result | Evidence | Note |
|---|---|---|---|---|

## Top issues
1. ...
```

Then reply with a short summary: counts, failing case IDs, and the single most important next action. Link the report path.

## Guardrails

- Read-only: no source edits, no DB purge, no schema changes.
- Respect every Antigravity browser approval prompt; never bypass a site, sign-in, download, or upload gate.
- No real credentials, payments, personal file uploads, or CAPTCHA solving.
- If servers are down or quota runs out, mark the remaining cases BLOCKED instead of guessing.
