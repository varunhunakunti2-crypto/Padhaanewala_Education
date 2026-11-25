# Padhaanewala — TestSprite MCP Industry QA Report

## 1. Document Metadata

| Field | Value |
|---|---|
| Project | Padhaanewala Education |
| Report generated | 2026-11-25 (IST) |
| Methodology | ISTQB-style test lifecycle; OWASP ASVS 5.0 / WSTG / Top 10 baseline (`industry-qa-methodology.md`) |
| Test source of truth | `testsprite_frontend_test_plan.json` (50 cases) and `testsprite_backend_test_plan.json` (10 cases) |
| Execution | TestSprite MCP `generateCodeAndExecute` with explicit `testIds`, small batches, fixture resets, and preserved raw reports + JSON results under `testsprite_tests/tmp/` |
| Browser | Google Chrome via `/browser` and Chrome DevTools MCP (remote debugging) |
| Frontend under test | Production build served by `.next/standalone/server.js` on `http://localhost:3000` (dual-stack `HOSTNAME='::'`) |
| Backend under test | FastAPI/Uvicorn on `http://127.0.0.1:8000`, `RATE_LIMIT_ENABLED=true`, development env file |
| Status basis | Latest preserved per-case artifacts only; superseded failing batches remain on disk but are not current |
| Confidentiality | No credentials, API keys, tokens, signed URLs, or secrets appear in this report. `sanitize_generated_scripts.ps1` scanned 348 artifacts; a rescan confirmed no sensitive values outside the owner-only local `tmp/config.json` |
| Change control | All fixes are local/uncommitted; no git repository was detected at the project root |

---

## 2. Requirement Validation Summary

**Frontend (50 planned, 47 executed, 47 passed).** All applicable cases `TC001`–`TC046` plus `TC048` pass in the latest preserved evidence. `TC018` includes navigating to `/admin` as a student and confirming denial; it is not an admin-only case. `TC047`, `TC049`, `TC050` were intentionally skipped as admin-only per the engagement scope. Correctness/security fixes implemented and validated include: global 15s API deadline and single-flight refresh, protected-route cookie guard, duplicate sign-in guard, exact inline credential-error copy, admission consent, password-reset confirmation status, immediate timer auto-submit, numeric-primary-key saved-college identity (`frontend/lib/mappers.ts`, `AppContext.tsx`), contact form, login identity/profile hydration, homepage search suggestions, exam syllabus mapping, course eligibility/career fields, scholarship detail route, blog pagination, rating filter and API-backed review feed, trusted `X-Client-IP` rate-limit key, `/api/errors` 32 KB stream cap, CSP/header hardening, token URL cleanup, safe external hrefs, redirect guards, modal focus trap, and a relative `Location` in the native login fallback so the standalone server never emits an unroutable `http://[::]:3000/...` redirect.

**Backend (10 planned, 10 executed, 10 passed).** Latest passing evidence: `be_fix_tc001c` (TC001), `be_batch01_TC001_TC002_TC003` (TC002/TC003), `be_fix_tc004` (TC004), `be_fix_auth4` (TC005/TC006), `be_fix_tc007` (TC007), `be_fix_tc008` (TC008), `be_fix_tc009` (TC009), `be_fix_tc010b` (TC010). Validated areas: query/filter pagination, college and course catalog, enquiry validation, authenticated college submissions, saved-college ownership and integer identity, notification ownership, mock-test attempt lifecycle, AI assistant contract, and compliance data requests. Fixes implemented and validated include: enquiry email validation, registration email-verification gate, guardian-consent binding, OTP gate before session issue, shared `list_limit()`/`MAX_LIMIT=500` pagination helper, media upload audit, attempt-existence oracle removal, production config guards, malformed course-detail rejection, and the documented `/api/v1` + `details`-required compliance contract.

**Deployment verification.** `npm run typecheck` passed; `npm test -- --run` passed 47 files / 868 tests; `npm run build` passed with assets synced into the standalone bundle; backend pytest passed 863 tests with 1 legitimate skip and 3 third-party deprecation warnings; the 159-check API connectivity sweep passed with 0 failures across 144 OpenAPI paths; rate limiting was restored to `RATE_LIMIT_ENABLED=true` and verified (five 422 validation responses followed by a 429 on the sixth request). Both servers returned 200 on their health endpoints at report time.

---

## 3. Coverage & Matching Metrics

| Suite | Planned | Executed | Passed | Failed | Skipped | Pass rate |
|---|---:|---:|---:|---:|---:|---:|
| Frontend TestSprite E2E | 50 | 47 | 47 | 0 | 3 (admin-only) | **100%** |
| Backend TestSprite API | 10 | 10 | 10 | 0 | 0 | **100%** |
| **TestSprite total** | **60** | **57** | **57** | **0** | **3** | **100%** |
| Frontend unit/integration (vitest) | — | 868 | 868 | 0 | 0 | 100% |
| Backend pytest | — | 864 | 863 | 0 | 1 | 99.9% |
| API connectivity sweep | — | 159 | 159 | 0 | 0 | 100% |

- **Plan-to-execution match:** 50/50 frontend plan cases are accounted for (47 passed + 3 intentionally skipped); 10/10 backend plan cases passed.
- **Backend status distribution (connectivity):** `200=59, 204=1, 401=1, 403=35, 404=6, 405=53, 422=4`; no 5xx and no status-0 failures. Auth/fixture-dependent 401/403/404/422 and 405-on-GET write-only probes are expected reachability signals, not defects.
- **OpenAPI coverage:** 144 unique backend paths probed; every advertised GET operation invoked, with write-only routes verified via safe GET probes.
- **Rate limiting:** verified active with the exact sixth-request 429 probe after restoring normal configuration.
- **Evidence preservation:** raw reports and JSON results retained per small batch; auth wrappers forward only `TSEMCP_*` values and log in at runtime with `backendAuthType='basic token'` and seeded credentials, so no static token can go stale.
- **Sanitization:** 348 text artifacts scanned; credentials and short-lived signed video URLs redacted; final rescan clean.

---

## 4. Key Gaps / Risks

1. **Admin-only coverage gap.** `TC047`, `TC049`, `TC050` were not executed by explicit scope decision. Admin flows received indirect backend/pytest coverage, but no admin E2E browser evidence exists.
2. **Local fixture dependencies.** E2E isolation used a process-level rate-limit override and a locally relaxed `attempts_allowed=5` for one mock paper; the app default remains 1 and normal rate limiting was restored and verified. CI deployment must supply secrets and fixtures independently rather than relying on the owner-only local config.
3. **Shared-database test coupling.** Backend pytest mutates the same fixture rows the API connectivity sweep reads; the sweep was rerun only after pytest completed and fixtures were reset. Parallel execution would produce false 401s.
4. **Build-time data warnings.** Static generation logged 404/`fetch failed` messages for a few QA-only college rows and `localhost`→`::1` resolution during backend fetch. These are treated as empty and the build succeeds, but a deployment should bind the backend dual-stack (`--host ::`) to eliminate the transport noise.
5. **Superseded artifacts on disk.** Earlier failing batch results remain under `testsprite_tests/tmp/` for audit; the report deliberately uses only the latest preserved per-case artifacts. Consumers must not read older files as current status.
6. **No version control.** All changes are local/uncommitted with no git repository at the root; review and deployment require an explicit handoff of the modified files.
