# Padhaanewala Regression — Current Status

**Snapshot:** 2026-11-28 03:45 IST  
**Full report:** [`antigravity-test-everything-report.md`](./antigravity-test-everything-report.md)  
**Raw frontend output:** [`antigravity-frontend-results.txt`](./antigravity-frontend-results.txt)

## Summary

| Category | Total | Pass | Fail | Blocked | Interrupted | Pending |
|---|---:|---:|---:|---:|---:|---:|
| Frontend E2E | 50 | 3 | 0 | 1 | 2 | 44 |
| Backend API | 10 | 10 | 0 | 0 | 0 | 0 |

## Frontend

Passed:

- TC001 — login and dashboard access
- TC003 — college search from homepage
- TC005 — signed-out protected route redirect

Open:

- TC002 — BLOCKED: agent could not detect Chrome `DevToolsActivePort`; Chrome itself was verified healthy on port 9222. Rerun required.
- TC004 — INTERRUPTED: `agy` process hung without browser progress or a final verdict. Rerun required.
- TC006 — INTERRUPTED: the `agy -p` process launched for TC006 attached to an unrelated SafeRoute AI conversation instead of the Padhaanewala browser case. No verdict was produced. The stuck runner was stopped at 03:42 IST.
- TC007–TC050 — pending.

Root cause of the stalled "44 pending" state: the sequential runner never got past TC006 because the Antigravity CLI session drifted into another workspace. It is not caused by the QA files that were removed from GitHub and restored locally. All 40 removed files were restored to GitHub in commit `6cf8274`.

## Backend

All 10 backend API cases pass with system `python -m pytest`:

- 10 passed in 5.41s.
- `/health` returns 200 with PostgreSQL and Redis healthy.
- Local Alembic head is `b2f8c4d9e731`.
- Earlier TC004 rate-limit 429 and TC009 missing `ai_settings` failures are resolved.

## Environment blocker

- **2026-11-28 16:05 IST:** port `8000` is occupied by another active project's server (`scripts\run_app.py --no-browser --port 8000`, PIDs `22724`/`39028` from `D:\COde\Major project\Saferoute-AI-Project`). The Padhaanewala backend API cases hardcode `127.0.0.1:8000`, so the rerun cannot start on another port without local test/config edits.
- The OpenCode/server restarts also stopped Docker Desktop, the frontend dev server, and the Chrome remote-debugging session.
- I did not terminate the other project's processes or change configuration. The rerun is paused until port `8000` is free and the local stack is restored.

## Deployment decision

- **Staging:** NO-GO until AWS CloudShell/CLI, EC2 SSH/SSM, Cloudflare DNS access, and runbook Phase 0/1 outputs are provided.
- **Production:** NO-GO until Gate 0, T2–T5, D-14/D-15/D-17/D-18, secrets, Cloudflare real-IP fix, WAF/rate limits, backup/restore, no-PII logs, monitoring/alerts, canonical domain, verified college data, and written approval are closed.

## Next actions

1. Free port `8000`, restore Docker/frontend/Chrome debug, then rerun TC002 and TC004–TC050 in an isolated CLI project (`--new-project --add-dir <APP>`) with a per-case `--print-timeout`.
2. Re-add the local synthetic admin credential only if admin cases require it, then revert before any commit.
3. Regenerate the full report from raw results with final verdicts.
4. Keep generated result files local-only; do not commit local QA configuration.
5. Keep staging and production NO-GO until their gates are closed.
