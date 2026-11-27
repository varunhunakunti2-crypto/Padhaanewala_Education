# API connectivity report

Generated: 2026-11-26T10:36:07.8113060+05:30

Credentials and tokens are intentionally excluded from this report.

## Summary

- Total checks: 159
- Status counts: 200=59, 204=1, 401=1, 403=35, 404=6, 405=53, 422=4
- OpenAPI path coverage: 144 unique paths

## Results

| Area | Target | Method | Status | Note |
|---|---|---|---:|---|
| auth | /api/v1/auth/login | POST | 200 | token obtained; value not recorded |
| health | /openapi.json | GET | 200 | paths=144 |
| backend-get | /api/v1/auth/register | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/auth/login | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/auth/refresh | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/auth/logout | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/auth/verify-email | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/auth/verify-email/resend | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/auth/login/otp/send | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/auth/login/otp/verify | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/auth/verify-mobile/send | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/auth/verify-mobile/verify | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/auth/forgot-password | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/auth/reset-password | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/admin/analytics/overview | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/users/me | GET | 200 |  |
| backend-get | /api/v1/users/me/profile | GET | 200 |  |
| backend-get | /api/v1/users/me/password | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/users/admin-only | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/users/me/roles | GET | 200 |  |
| backend-get | /api/v1/users | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/users/{user_id} | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/roles | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/locations/states | GET | 200 |  |
| backend-get | /api/v1/locations/states/{state_id}/districts | GET | 200 |  |
| backend-get | /api/v1/locations/districts/{district_id}/cities | GET | 200 |  |
| backend-get | /api/v1/universities | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/universities/{university_ref} | GET | 200 |  |
| backend-get | /api/v1/colleges | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/colleges/search | GET | 200 |  |
| backend-get | /api/v1/colleges/{college_ref}/courses | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/colleges/{college_ref} | GET | 200 |  |
| backend-get | /api/v1/college-submissions | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/college-submissions/my | GET | 200 |  |
| backend-get | /api/v1/college-submissions/{submission_id} | GET | 404 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/college-submissions/{submission_id}/approve | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/college-submissions/{submission_id}/reject | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/college-submissions/{submission_id}/request-changes | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/compliance/status | GET | 200 |  |
| backend-get | /api/v1/compliance/age | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/compliance/parental-consent | GET | 200 |  |
| backend-get | /api/v1/compliance/parental-consent/request | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/compliance/parental-consent/verify | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/compliance/parental-consent/withdraw | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/compliance/requests | GET | 200 |  |
| backend-get | /api/v1/compliance/requests/{request_id} | GET | 404 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/compliance/admin/requests | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/compliance/admin/requests/{request_id} | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/courses | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/courses/categories | GET | 200 |  |
| backend-get | /api/v1/courses/{course_ref} | GET | 200 |  |
| backend-get | /api/v1/consent | GET | 200 |  |
| backend-get | /api/v1/consent/{consent_id} | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/enquiries | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/leads | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/leads/{enquiry_id} | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/leads/{enquiry_id}/notes | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/leads/{enquiry_id}/status | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/leads/{enquiry_id}/assign | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/leads/{enquiry_id}/follow-up | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/leads/{enquiry_id}/details | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/counsellors | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/colleges/{college_ref}/cutoffs | GET | 200 |  |
| backend-get | /api/v1/colleges/{college_ref}/cutoffs/{cutoff_id} | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/colleges/{college_ref}/fees | GET | 200 |  |
| backend-get | /api/v1/colleges/{college_ref}/fees/{fee_id} | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/colleges/{college_ref}/placements | GET | 200 |  |
| backend-get | /api/v1/colleges/{college_ref}/placements/{placement_id} | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/colleges/{college_ref}/rankings | GET | 422 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/colleges/{college_ref}/rankings/nirf | GET | 200 |  |
| backend-get | /api/v1/colleges/{college_ref}/rankings/other | GET | 200 |  |
| backend-get | /api/v1/colleges/{college_ref}/rankings/nirf/{rank_id} | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/colleges/{college_ref}/rankings/other/{rank_id} | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/colleges/{college_ref}/seat-matrix | GET | 200 |  |
| backend-get | /api/v1/colleges/{college_ref}/seat-matrix/{seat_id} | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/colleges/{college_ref}/admissions | GET | 200 |  |
| backend-get | /api/v1/colleges/{college_ref}/admissions/{admission_id} | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/cutoffs | GET | 200 |  |
| backend-get | /api/v1/fees | GET | 200 |  |
| backend-get | /api/v1/placements | GET | 200 |  |
| backend-get | /api/v1/rankings | GET | 422 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/seat-matrix | GET | 200 |  |
| backend-get | /api/v1/admissions | GET | 200 |  |
| backend-get | /api/v1/scholarships | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/scholarships/{scholarship_ref} | GET | 200 |  |
| backend-get | /api/v1/exams | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/exams/upcoming | GET | 200 |  |
| backend-get | /api/v1/exams/{exam_ref} | GET | 200 |  |
| backend-get | /api/v1/mock-tests | GET | 200 |  |
| backend-get | /api/v1/mock-tests/{mock_test_ref} | GET | 200 |  |
| backend-get | /api/v1/mock-tests/{mock_test_ref}/questions | GET | 200 |  |
| backend-get | /api/v1/mock-tests/{mock_test_ref}/questions/{question_id} | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/mock-tests/{mock_test_ref}/start | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/mock-tests/{mock_test_ref}/submit | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/mock-tests/{mock_test_ref}/attempts | GET | 200 |  |
| backend-get | /api/v1/mock-tests/{mock_test_ref}/attempts/{attempt_id} | GET | 404 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/mock-tests/{mock_test_ref}/attempts/{attempt_id}/answers/{question_id} | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/mock-tests/{mock_test_ref}/attempts/{attempt_id}/submit | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/mock-tests/{mock_test_ref}/attempts/{attempt_id}/result | GET | 404 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/mock-tests/admin/all | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/mock-tests/admin/all/{mock_test_ref} | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/mock-tests/admin/review-attempts | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/mock-tests/admin/review-attempts/{attempt_id}/answers/{question_id}/grade | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/questions | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/questions/facets | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/question-imports/pdf | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/question-imports | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/question-imports/{job_id} | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/question-imports/{job_id}/drafts/{question_id} | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/question-imports/{job_id}/drafts/{question_id}/review | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/question-imports/{job_id}/review-all | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/reviews/college/{college_ref} | GET | 200 |  |
| backend-get | /api/v1/reviews/moderation | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/reviews/my | GET | 200 |  |
| backend-get | /api/v1/reviews | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/reviews/{review_id} | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/reviews/{review_id}/moderate | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/blog-categories | GET | 200 |  |
| backend-get | /api/v1/blogs | GET | 422 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/blogs/{blog_ref} | GET | 404 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/blogs/{blog_ref}/view | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/faqs | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/faqs/{faq_id} | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/media | GET | 200 |  |
| backend-get | /api/v1/media/{media_id} | GET | 200 |  |
| backend-get | /api/v1/media/upload | GET | 422 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/seo | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/seo/{entity_type}/{entity_id} | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/settings | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/notifications | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/notifications/sends | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/notifications/my | GET | 200 |  |
| backend-get | /api/v1/notifications/my/unread-count | GET | 200 |  |
| backend-get | /api/v1/notifications/batch/{batch_id} | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/notifications/{notification_id} | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/notifications/{notification_id}/read | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/notifications/my/read-all | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/audit-logs | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/banners | GET | 403 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/banners/{banner_id} | GET | 404 | reachable; auth/fixture-dependent |
| backend-get | /api/v1/saved-colleges | GET | 200 |  |
| backend-get | /api/v1/saved-colleges/{college_id} | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/predictor/exams | GET | 200 |  |
| backend-get | /api/v1/predictor | GET | 405 | reachable; write-only route (GET probe) |
| backend-get | /api/v1/stats/catalog | GET | 200 |  |
| backend-get | /health | GET | 200 |  |
| frontend-page | / | GET | 200 |  |
| frontend-page | /login | GET | 200 |  |
| frontend-page | /colleges | GET | 200 |  |
| frontend-page | /contact | GET | 200 |  |
| frontend-page | /mock-tests | GET | 200 |  |
| frontend-page | /dashboard | GET | 200 |  |
| frontend-page | /admin | GET | 200 |  |
| frontend-page | /api/health | GET | 200 |  |
| frontend-proxy | /api/v1/colleges | GET | 200 |  |
| frontend-api | /api/errors | POST | 204 | small valid probe body |
| frontend-api | /api/ai | POST | 200 | empty message; no upstream call expected |
| frontend-api | /api/revalidate | POST | 401 | missing bearer must be denied |
| frontend-api | /api/auth/login | POST | 200 | invalid credentials must redirect; no credentials printed |

## Interpretation

- 2xx/3xx means the route answered through the expected network path.
- 401/403/404/422 means the route is reachable but needs auth, ownership or a fixture; these are not connectivity failures.
- 405 on a GET probe means a write-only route is mounted; the probe does not mutate data.
- 5xx or status 0 means a real connectivity/server failure that must be investigated.
