# QA and hardening change log

No credentials, API keys, tokens or secret values are recorded here. All changes
are local/uncommitted; no git repository was detected at the project root.

## Backend correctness and security

- Repaired local DB bootstrap so migrations/seeds are present in `public`; student login and profile now return 200.
- `backend/app/schemas/catalog.py`: fixed `EnquiryCreate.email` validation so malformed emails return 422.
- `backend/tests/test_catalog.py`: `test_get_college_courses` now selects a college that actually has courses instead of assuming `colleges[0]`.
- `backend/scripts/reset_testsprite_attempts.py`: deterministic E2E fixture reset; clears prior attempts, sets local `attempts_allowed=5`, seeds one unread notification, tolerates BOM-bearing config files, and idempotently seeds clearly labelled QA enrichment rows for IIT Bombay (fees, placement, cutoff, NIRF/other ranking, seat matrix, FAQs) so detail-page cases have real content.
- `backend/app/config.py`: production guards reject disabled rate limiting and missing email verification while registration is enabled; added `REGISTRATION_ENABLED`.
- `backend/app/routers/auth.py`: registration honours `EMAIL_VERIFICATION_REQUIRED` without issuing a session; OTP login checks verification before session issuance; registration kill switch added.
- `backend/app/services/otp_service.py`: guardian challenges bound to consent id, target and user.
- `backend/app/routers/compliance.py` / `backend/app/schemas/compliance.py` / `backend/app/models/guardian_consent.py`: guardian-consent hardening, mobile required, client target override prevented, paginated request lists.
- `backend/app/routers/media.py`: multipart uploads now write an audit record with redacted metadata.
- `backend/app/routers/mock_tests.py`: foreign/missing attempt IDs both return 404, removing an existence oracle.
- `backend/app/utils/pagination.py`: shared `list_limit()` / `list_offset()` helper (default 100, max 500, non-negative offset), applied to selected enrichment, saved-college, consent, notification and college list endpoints.
- New/updated backend regression tests: `test_guardian_consent.py`, `test_otp.py`, `test_media_upload.py`, `test_mock_test_engine.py`, `test_list_endpoint_pagination_caps.py`, `test_media_config.py`.

## Frontend correctness and security

- `frontend/lib/api.ts`: global 15s API deadline, auth boot guards, memory-only token handling, and single in-flight refresh that survives the 4s deadline; failure is broadcast to other tabs.
- `frontend/app/login/page.tsx`: SSR login form, named fields, local-only `next` guard, native fallback hidden field carries the validated value, profile deadline/fallback prevents anonymous dashboard cards.
- `frontend/app/api/auth/login/route.ts`: native no-JS POST fallback with refresh-cookie forwarding and local redirect guard.
- `frontend/lib/context/AppContext.tsx`: silent profile setter, boot/cross-tab profile fetch.
- `frontend/frontend/components/contact/ContactForm.tsx` and `frontend/app/contact/page.tsx`: validated contact enquiry form with success state retained inside a `<form>`.
- `frontend/frontend/components/home/SearchBar.tsx` and `frontend/lib/data/index.ts`: real suggestion buttons, `aria-label`, shortName-preferred IIT Bombay labels.
- `backend/scripts/seed_colleges_courses.py`: seeded IIT Bombay catalogue row.
- `frontend/app/api/errors/route.ts`: stream-level 32 KB cap with 413 on overflow; no longer trusts `Content-Length`.
- `frontend/app/api/ai/route.ts` and `docker/Caddyfile`: rate limiter reads only edge-set `X-Client-IP`; Caddy strips inbound forwarding headers.
- `frontend/proxy.ts`: removed internal backend host and wildcard from browser-visible `connect-src`; documented CSP contract.
- `frontend/app/verify-email/page.tsx`, `frontend/app/reset-password/page.tsx`, `frontend/frontend/components/auth/TokenUrlCleanup.tsx`: strip one-time `token` query params after reading.
- New `frontend/frontend/components/ui/SafeExternalLink.tsx`; used in exam, scholarship and admin submission components to reject unsafe hrefs.
- `frontend/components/ui/Modal.tsx`: focus trap and focus restoration.
- `frontend/tests/content.test.ts`: explicit 15s timeout for two module-graph reset tests that were flaky under full-suite parallel load.
- New/updated frontend tests: `refresh-race.test.ts`, `errors-route.test.ts`, `ai-route.test.ts`, `proxy-headers.test.ts`, `token-url-cleanup.test.tsx`, `login-next-page.test.tsx`, `login-route-guards.test.ts`, `revalidate-auth.test.ts`, `href-hardening.test.tsx`, `modal-focus.test.tsx`.

## QA tooling and evidence

- `testsprite_tests/industry-qa-methodology.md`: ISTQB-style lifecycle plus OWASP ASVS 5.0 / WSTG / Top 10 baseline.
- `testsprite_tests/api-connectivity-check.ps1` and `api-connectivity-report.md`: 159 checks covering all 144 OpenAPI paths, frontend pages and Next.js route handlers; no credentials written.
- `testsprite_tests/tmp/run_frontend_batches.ps1`: small-batch TestSprite runner with explicit IDs, fixture reset, health gates, raw report/JSON preservation and cooldown. Admin-only IDs TC047/TC049/TC050 intentionally excluded at the user's request.
- `testsprite_tests/tmp/run_backend_batch.ps1`: backend TestSprite runner with fixture reset, rate-limit flush, explicit IDs and raw report preservation.
- `testsprite_tests/tmp/run_backend_batches.ps1`: sequential backend batch wrapper (3/3/4 IDs) to avoid tunnel overload.
- `testsprite_tests/tmp/run_single_test.ps1`: single-ID runner with lock/process guards, health checks, fixture reset, mode-specific config, raw report/JSON preservation and TC011 locator guidance.
- `testsprite_tests/sanitize_generated_scripts.ps1`: now also redacts signed video URLs and credentials from all generated scripts, reports, JSON results and logs.
- `testsprite_tests/tmp/summarize_results.ps1`: consolidated pass/fail/blocked view from preserved JSON results.
- Preserved raw reports and JSON results are kept under `testsprite_tests/tmp/` with descriptive batch names.
