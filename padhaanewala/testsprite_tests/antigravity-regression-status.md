# Padhaanewala Regression — Current Status

**Snapshot:** 2026-11-28 00:38 IST  
**Full report:** [`antigravity-test-everything-report.md`](./antigravity-test-everything-report.md)  
**Raw frontend output:** [`antigravity-frontend-results.txt`](./antigravity-frontend-results.txt)

## Summary

| Category | Total | Pass | Fail | Blocked | Interrupted | Running | Pending |
|---|---:|---:|---:|---:|---:|---:|---:|
| Frontend E2E | 50 | 3 | 0 | 1 | 1 | 1 | 44 |
| Backend API | 10 | 10 | 0 | 0 | 0 | 0 | 0 |

## Frontend

Passed:

- TC001 — login and dashboard access
- TC003 — college search from homepage
- TC005 — signed-out protected route redirect

Open:

- TC002 — BLOCKED: agent could not detect Chrome `DevToolsActivePort`; Chrome itself was verified healthy on port 9222. Rerun required.
- TC004 — INTERRUPTED: `agy` process hung without browser progress or a final verdict; process was terminated to unblock the runner. Rerun required.
- TC006 — currently running.
- TC007–TC050 — pending.

## Backend

All 10 backend API cases pass with system `python -m pytest`:

- 10 passed in 5.41s.
- `/health` returns 200 with PostgreSQL and Redis healthy.
- Local Alembic head is `b2f8c4d9e731`.
- Earlier TC004 rate-limit 429 and TC009 missing `ai_settings` failures are resolved.

## Deployment decision

- **Staging:** NO-GO until AWS CloudShell/CLI, EC2 SSH/SSM, Cloudflare DNS access, and runbook Phase 0/1 outputs are provided.
- **Production:** NO-GO until Gate 0, T2–T5, D-14/D-15/D-17/D-18, secrets, Cloudflare real-IP fix, WAF/rate limits, backup/restore, no-PII logs, monitoring/alerts, canonical domain, verified college data, and written approval are closed.

## Next actions

1. Let TC006–TC050 finish.
2. Rerun TC002 and TC004 individually.
3. Regenerate the full report with final verdicts.
4. Revert the local synthetic admin credential edit in `.agents/skills/test-everything/scripts/run-frontend-cases.ps1`.
5. Keep generated result files local-only; do not commit local QA configuration.
