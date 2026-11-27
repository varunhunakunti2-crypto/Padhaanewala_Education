# Full regression report — blocked run (2026-11-27)

This file records a separate blocked run. It does not replace the earlier passing regression report in `antigravity-test-everything-report.md`.

Generated: 2026-11-27 23:00:01 +05:30
Base URLs: frontend http://localhost:3000 | backend http://localhost:8000

## Summary
- Total: 60 (frontend 50, backend 10)
- Passed / Failed / Blocked: 0 / 0 / 60
- Reason: preflight failed. Frontend returned HTTP 000 and backend /health returned HTTP 000, so neither server was reachable.
- No case was executed. Counts are derived from the two plan files (50 frontend, 10 backend).

## Frontend (/browser)
| Case | Area | Result | Evidence | Note |
|---|---|---|---|---|
| TC001 | Authentication and session management | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC002 | Mock tests | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC003 | Home search and quick actions | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC004 | Mock tests | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC005 | Authentication and session management | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC006 | Enquiry and admission lead submission | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC007 | Admin console role-gated operations | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC008 | College discovery and detail | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC009 | Mock tests | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC010 | Student dashboard, saved colleges, and notifications | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC011 | College discovery and detail | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC012 | Authentication and session management | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC013 | Home search and quick actions | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC014 | Student dashboard, saved colleges, and notifications | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC015 | Mock tests | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC016 | Enquiry and admission lead submission | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC017 | Mock tests | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC018 | Admin console role-gated operations | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC019 | Course, exam, and scholarship browsing | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC020 | Add college submission | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC021 | Compare colleges | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC022 | Student dashboard, saved colleges, and notifications | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC023 | Mock tests | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC024 | Course, exam, and scholarship browsing | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC025 | Authentication and session management | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC026 | Course, exam, and scholarship browsing | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC027 | Authentication and session management | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC028 | Enquiry and admission lead submission | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC029 | Password recovery and email verification | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC030 | Enquiry and admission lead submission | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC031 | Reviews, blog, and comparison content | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC032 | Reviews, blog, and comparison content | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC033 | Predictor, planner, and static content pages | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC034 | Enquiry and admission lead submission | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC035 | Compare colleges | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC036 | Reviews, blog, and comparison content | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC037 | Home search and quick actions | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC038 | Predictor, planner, and static content pages | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC039 | AI assistant | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC040 | Add college submission | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC041 | AI assistant | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC042 | Password recovery and email verification | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC043 | Predictor, planner, and static content pages | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC044 | Compare colleges | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC045 | Predictor, planner, and static content pages | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC046 | College discovery and detail | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC047 | Admin console role-gated operations | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC048 | Password recovery and email verification | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC049 | Admin console role-gated operations | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |
| TC050 | Admin console role-gated operations | BLOCKED | preflight HTTP 000 | Not executed: frontend server unreachable |

## Backend (pytest)
| Case | Endpoint | Result | Evidence | Note |
|---|---|---|---|---|
| TC001 | browse colleges with filters | BLOCKED | preflight HTTP 000 | Not executed: backend server unreachable |
| TC002 | retrieve college details | BLOCKED | preflight HTTP 000 | Not executed: backend server unreachable |
| TC003 | browse course catalog | BLOCKED | preflight HTTP 000 | Not executed: backend server unreachable |
| TC004 | submit enquiry form | BLOCKED | preflight HTTP 000 | Not executed: backend server unreachable |
| TC005 | submit college suggestion | BLOCKED | preflight HTTP 000 | Not executed: backend server unreachable |
| TC006 | save college to student account | BLOCKED | preflight HTTP 000 | Not executed: backend server unreachable |
| TC007 | mark notification as read | BLOCKED | preflight HTTP 000 | Not executed: backend server unreachable |
| TC008 | submit mock test attempt | BLOCKED | preflight HTTP 000 | Not executed: backend server unreachable |
| TC009 | send ai assistant question | BLOCKED | preflight HTTP 000 | Not executed: backend server unreachable |
| TC010 | create compliance data request | BLOCKED | preflight HTTP 000 | Not executed: backend server unreachable |

## Top issues
1. Local frontend and backend servers are not running, so the 60-case regression cannot be executed.
2. Production eligibility cannot be granted from this run: zero end-to-end cases were exercised against a running stack.
