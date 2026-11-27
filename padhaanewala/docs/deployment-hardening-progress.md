# Deployment hardening progress — non-gated security batch

**Branch:** `security/deployment-hardening`  
**Date:** 2026-11-27  
**Status:** technical work prepared and locally verified; **no gate approval, staging deploy, production deploy, migration execution, or real-data work is claimed**.

This batch addresses only items that do not require the outstanding owner, independent-review, backup-rehearsal, or production-release decisions. The encryption gates A-01, D-01, D-02, D-03, D-15, D-14, D-17 and the production deployment remain blocked.

## Changes made

| Checklist item | Change | Evidence |
|---|---|---|
| 9 — OTP in logs | `backend/app/services/sms_service.py` no longer logs the OTP or the full mobile. The console fallback logs a masked number and states that the code is withheld. | `backend/tests/test_otp.py` now captures the code at the delivery seam and asserts neither code nor full mobile is in captured logs. |
| 5 / 13 — PII in notifications | `backend/app/services/lead_handoff.py` no longer copies lead name or mobile into admin/counsellor notifications. Payload is `{"enquiry_id": ...}` only. | New `test_lead_notifications_carry_no_personal_lead_data` in `backend/tests/test_phase9.py`. |
| 15 — Browser storage | `frontend/lib/api.ts` stores only `{id, name}` in `cp_user`. `purgeLegacyTokenStorage` rewrites older full profiles down to those fields on boot. `clearAuth` still removes the key on explicit sign-out. | `frontend/tests/auth-token.test.ts` extended. |
| 16 — Privacy notice | Legal copy now points data-rights requests to the in-app “Privacy and data” panel with email as fallback, qualifies the 30-day closure statement with the scheduled sweep, and corrects stale claims about file upload and the AI route. `LEGAL_LAST_UPDATED` bumped. | New `frontend/tests/legal-consistency.test.ts`. |
| 11 — API docs exposure | `backend/app/main.py` extracts a pure `docs_paths_for_env()` helper; production still disables `/docs`, `/redoc` and `/openapi.json`. | New `backend/tests/test_api_docs_exposure.py`. |
| Deployment migration safety | Alembic had **two heads** (`b2f8c4d9e731` and `f4a1c6d8e902`), both branched from `a7d3c5e1f924`. `b2f8c4d9e731` is re-parented onto `f4a1c6d8e902` so a database stamped on the main-line revision picks up the AI-settings migration on `upgrade head`. | New `backend/tests/test_alembic_heads.py`; static graph check now reports one head. |
| Rate-limit coverage | Two DELETE routes added after the P10 audit were unclassified: `DELETE /api/v1/compliance/requests/{request_id}` and `DELETE /api/v1/users/{user_id}`. They are now P7 `consent_write` and P9 `user_mutation` respectively, so the 23-route known gap does not grow silently. | New params in `test_rate_limit_p7.py` and `test_rate_limit_p9.py`; `test_rate_limit_p10.py` pin stays at 23. |
| Frontend lint | `app/login/page.tsx` now applies the post-mount URL read through `startTransition`, as in the Next.js mutating-data guide, so no `setState` is called synchronously in an effect body. Two unused test bindings were also removed. | `npm run lint`, `npm run typecheck` and the 905-test suite are all clean locally. |

## Verification performed

- Frontend: **905 tests passed** (50 files), including the new browser-storage and legal-consistency tests. `npm run lint` and `npm run typecheck` also pass cleanly.
- Backend: Python compilation succeeded for `app`, `tests` and `alembic`.
- Alembic metadata: single head confirmed (`b2f8c4d9e731`).
- Backend CI on `security/deployment-hardening` was re-run after the rate-limit fix and is **green**. The first run found 1 failure (the P10 pin for the two DELETE routes above); after classification the suite passed. This branch was merged into `main` only after that green result.
- Backend pytest cannot be re-run locally here: this environment has no reachable PostgreSQL on port 5433 with usable credentials.

## Still blocked / not touched

- Encryption integration for `lead_notes.note` and its migration (T2–T5) — gated.
- D-15 owner acceptance, D-14 restore rehearsal, D-17 destructive approval, independent reviews.
- AWS Secrets Manager/SSM secrets, staging DNS, Cloudflare real-client-IP fix, WAF, backups, alerts, production approval.
- Analytics/GA/GTM code — not approved.
- SEO/AEO/MEO content and verified college data.
