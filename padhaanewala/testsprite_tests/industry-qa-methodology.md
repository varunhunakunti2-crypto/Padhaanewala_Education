# Industry-style QA methodology used for Padhaanewala

This checklist records the testing standard applied to this run. It is based on
ISTQB-style test-life-cycle discipline plus OWASP ASVS 5.0, OWASP WSTG and OWASP
Top 10 control areas. It contains no credentials or secret values.

## 1. Test planning and traceability

- Source of truth: `testsprite_frontend_test_plan.json` (50 cases) and
  `testsprite_backend_test_plan.json` (10 cases).
- Every TestSprite ID is mapped to a category, owner suite, latest status and
  fixture requirement before execution.
- Changes are verified against the same production-mode build that TestSprite
  exercises, not only against unit tests.

## 2. Static and security review

- Frontend and backend were reviewed independently for OWASP ASVS 5.0 / WSTG
  coverage: authentication, session management, authorization/IDOR, input
  validation, rate limiting, error handling, data exposure, CSP, XSS sinks,
  unsafe redirects, upload safety, audit logging and configuration hardening.
- UI files were also checked against the Vercel Web Interface Guidelines
  (accessibility, focus states, forms, reduced motion, content handling,
  navigation and hydration safety).
- Tailwind v4 guidance used the project's local fallback references because the
  official docs snapshot is intentionally not downloaded.

## 3. Test design and fixtures

- Frontend: small batches of 2–3 IDs to reduce cloud-tunnel flakiness.
- Backend: public cases first, then authenticated cases with one token/session
  and a flushed rate-limit window.
- Deterministic fixtures: seeded IIT Bombay catalogue record, one unread
  notification, fresh mock-attempt rows, `attempts_allowed=5` only in the local
  E2E fixture, and rate-limit keys flushed before auth-heavy batches.
- No two state-consuming mock cases are executed without a fixture reset.

## 4. Execution

- TestSprite MCP `generateCodeAndExecute` with explicit `testIds`.
- Every raw Markdown report and JSON result is preserved with a descriptive
  filename before the next batch overwrites `tmp/raw_report.md`.
- Production frontend build and backend health endpoints are checked before each
  batch; transport/tunnel errors are distinguished from product failures.
- Local suites: `pytest -q` (backend) and `npm test -- --run` (frontend), plus
  `npm run typecheck` and `npm run build`.

## 5. Defect management and regression

- Each failure is root-caused, fixed with the smallest safe change, and covered
  by a regression test before rerunning the affected TestSprite IDs.
- Security findings are prioritized P0/P1/P2 and fixed only when the change is
  behaviour-preserving for valid users.
- Rate limiting is disabled only in the local E2E process; it is restored to
  `RATE_LIMIT_ENABLED=true` for final deployment verification.

## 6. Closure and reporting

- Final status is computed from preserved raw reports and JSON results.
- Gaps that cannot be safely closed are listed explicitly with risk and next
  action rather than hidden.
- Final report uses exactly four sections: Document Metadata, Requirement
  Validation Summary, Coverage & Matching Metrics, Key Gaps / Risks.
