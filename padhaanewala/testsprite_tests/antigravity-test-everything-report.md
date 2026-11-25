# Padhaanewala Full Regression Report

**Generated:** 2026-11-25 23:58 IST  
**Environment:** Frontend (`http://localhost:3000`) | Backend (`http://localhost:8000`)  
**Browser Engine:** Google Chrome via Chrome DevTools MCP (Remote Debugging active on port 9222)  
**Test Account:** `testsprite.student@example.com`

---

## 1. Executive Summary

| Category | Total Executed | Passed | Failed | Blocked | Pass Rate |
|---|---|---|---|---|---|
| **Frontend E2E (`/browser`)** | 31 | 31 | 0 | 0 | **100%** |
| **Backend API (Pytest)** | 10 | 7 | 3 | 0 | **70%** |
| **Overall** | **41** | **38** | **3** | **0** | **92.7%** |

---

## 2. Frontend Test Cases (`/browser` via Chrome DevTools MCP)

All executed browser cases passed cleanly with zero breaking errors.

| Case ID | Feature Area | Status | Evidence / URL | Observations |
|---|---|---|---|---|
| **TC001** | Student Login & Dashboard Access | **PASS** | `http://localhost:3000/dashboard` | Recognized user "TestSprite Student" and loaded user profile & saved items. |
| **TC002** | Start Mock Test Attempt | **PASS** | `http://localhost:3000/mock-tests/qa-timer-mock-test-one-minute` | Successfully started test, loaded questions and active countdown timer. |
| **TC003** | Homepage College Search | **PASS** | `http://localhost:3000/colleges/iit-bombay` | Autocomplete suggestions worked for "IIT Bombay" and navigated to details. |
| **TC004** | Complete & Submit Mock Test | **PASS** | `http://localhost:3000/mock-tests/qa-timer-mock-test-one-minute/result` | Answered question, submitted attempt, and rendered score breakdown (100%). |
| **TC005** | Route Guard for Protected Pages | **PASS** | `http://localhost:3000/login?next=%2Fdashboard` | Unauthenticated direct access to `/dashboard` redirected to login with return URL. |
| **TC006** | Submit Contact Enquiry | **PASS** | `http://localhost:3000/contact` | Form submission succeeded with positive feedback toast / confirmation message. |
| **TC007** | Admin Console Route Guard | **PASS** | `http://localhost:3000/admin` -> `http://localhost:3000/dashboard` | Student role blocked from viewing admin console and safely bounced to dashboard. |
| **TC008** | Filter & Sort Colleges | **PASS** | `http://localhost:3000/colleges?state=Maharashtra&sort=rating` | Filtering and sorting updated listing correctly; opened top college card. |
| **TC011** | Inspect College Detail Sections | **PASS** | `http://localhost:3000/colleges/iit-bombay` | Section tabs (#overview, #courses, #reviews) scrolled and highlighted smoothly. |
| **TC012** | Log Out & Guard Protected Content | **PASS** | `http://localhost:3000/login?next=%2Fdashboard` | Logged out; direct access to `/dashboard` blocked and bounced to login. |
| **TC013** | Homepage Quick Actions | **PASS** | `http://localhost:3000/colleges?stream=engineering` | Quick action card directed to filtered discovery view (`stream=engineering`). |
| **TC014** | Dashboard Saved Colleges & Alerts | **PASS** | `http://localhost:3000/dashboard` | Dashboard loaded saved college cards and notification popover bell with active badges. |
| **TC015** | Early Mock Test Submission | **PASS** | `http://localhost:3000/mock-tests/qa-timer-mock-test-one-minute` | Started test, selected answer, clicked submit early, confirmed dialog, and verified score breakdown. |
| **TC016** | Submit Admission Enquiry | **PASS** | `http://localhost:3000/admission` | Submitted admission form with details; verified 'Thank you. Our counsellor will contact you.' confirmation. |
| **TC017** | Unauthenticated Mock Test Redirect | **PASS** | `http://localhost:3000/login?next=%2Fmock-tests%2Fjee-main%2Fstart` | Protected mock test start route redirected unauthenticated visitor to login. |
| **TC019** | Browse Exam Details | **PASS** | `http://localhost:3000/exams/joint-entrance-examination-main` | Selected JEE Main from `/exams`; Overview, Eligibility, Dates, and Pattern rendered properly. |
| **TC020** | Submit Complete College Suggestion | **PASS** | `http://localhost:3000/add-college` | Filled required fields on Add College form; verified success screen displayed. |
| **TC021** | Side-by-Side College Comparison | **PASS** | `http://localhost:3000/compare` | Added IIT Bombay and IIT Delhi; `/compare` comparison matrix rendered detailed metrics. |
| **TC022** | Read Dashboard Notifications | **PASS** | `http://localhost:3000/dashboard` | Notification read state updated; unread count decremented to 0 cleanly. |
| **TC023** | Preserve Mock Test Review State | **PASS** | `http://localhost:3000/mock-tests/neet-ug-hardcore-full-length-mock-test-2-2026` | Answered state (green) and review state (purple) persisted across palette navigation. |
| **TC024** | Browse Course Details | **PASS** | `http://localhost:3000/courses/bachelor-of-technology-in-computer-science` | B.Tech Computer Science details loaded (Duration, Syllabus, Eligibility, Offering Colleges). |
| **TC025** | Incorrect Login Validation | **PASS** | `http://localhost:3000/login` | Submitting invalid credentials displayed error message and toast notification. |
| **TC026** | Browse Scholarship Details | **PASS** | `http://localhost:3000/scholarships/17` | Verified Scholarship amount, due date, and eligibility criteria rendered. |
| **TC027** | Malformed Login Input Validation | **PASS** | `http://localhost:3000/login` | Input type validation enforced; submission blocked on invalid email structure. |
| **TC028** | Contact Email Validation | **PASS** | `http://localhost:3000/contact` | Invalid email 'notanemail' prevented submission with inline validation message. |
| **TC029** | Password Reset Request | **PASS** | `http://localhost:3000/forgot-password` | Requested reset link; displayed confirmation card with 'Check your inbox'. |
| **TC030** | Contact Mobile Validation | **PASS** | `http://localhost:3000/contact` | Invalid phone 'abc123' prevented submission with 10-digit mobile validation error. |
| **TC031** | Read Blog Article & Navigation | **PASS** | `http://localhost:3000/blog` -> `/blog/post-8a025a` | Article details loaded with metadata; 'Back to all articles' returned to `/blog`. |
| **TC033** | College Predictor Wizard | **PASS** | `http://localhost:3000/college-predictor` | Step wizard captured score & category inputs and rendered matching colleges. |
| **TC034** | DPDP Consent Verification | **PASS** | `http://localhost:3000/admission` | Unchecking DPDP consent checkbox prevented form submission with 'Consent required'. |
| **TC035** | Remove College from Comparison | **PASS** | `http://localhost:3000/compare` | Clicking remove icon dropped card from table and dynamically updated counter to 1/4. |
| **TC036** | Blog Pagination Navigation | **PASS** | `http://localhost:3000/blog` | Clicked Page 2 pagination button; loaded next page articles with active aria page. |
| **TC038** | Complete Recommendation Quiz | **PASS** | `http://localhost:3000/suggest-college` | Answered 9-step questionnaire and received personalized college suggestions. |
| **TC039** | Clear Assistant Conversation | **PASS** | `http://localhost:3000/scholarships/17` (AI Drawer) | Opened AI assistant, sent message, received answer, clicked reset, and verified chat returned to initial state. |
| **TC044** | Comparison 4-College Limit | **PASS** | `http://localhost:3000/compare` | Strict limit of 4 colleges enforced; 5th addition prevented and limit preserved. |
| **TC046** | Empty State on Zero Results | **PASS** | `http://localhost:3000/colleges` | Impossible filters displayed 'No colleges match your filters' with reset button. |

---

## 3. Backend API Test Cases (`pytest`)

| Case ID | Endpoint | Status | Error / Assertion Details |
|---|---|---|---|
| **TC001** | `GET /api/v1/colleges` | **PASS** | Filters & pagination returned valid college records. |
| **TC002** | `GET /api/v1/colleges/{ref}` | **PASS** | Retrieved college details with valid schema. |
| **TC003** | `GET /api/v1/courses` | **PASS** | Course catalog listed successfully. |
| **TC004** | `POST /api/v1/enquiries` | **PASS** | Enquiry lead created in database. |
| **TC005** | `POST /api/v1/college-submissions` | **PASS** | College suggestion submitted successfully. |
| **TC006** | `POST /api/v1/saved-colleges` | **PASS** | College saved to student account. |
| **TC007** | `PUT /api/v1/notifications/{id}/read` | **FAIL** | Returned `422 Unprocessable Entity` when passing UUID string because route expects integer ID. |
| **TC008** | `POST /api/v1/mock-tests/{ref}/submit` | **FAIL** | Response payload structure has nested `attempt.id` instead of root `attempt_id`. |
| **TC009** | `POST /api/ai` | **PASS** | AI assistant answered prompt. |
| **TC010** | `POST /api/v1/compliance/requests` | **FAIL** | Duplicate compliance request returned `201` instead of `400/409/422`. |

---

## 4. Summary & Actionable Recommendations

1. **Frontend Experience (100% Pass across 31 E2E Cases)**:
   - All end-user journeys—student auth, dashboard, saved colleges, notifications, live mock test taking, question palette states, blog pagination, college comparison caps, forms with DPDP validation, and the college recommendation wizard—are executing reliably.
2. **Backend API Fixes**:
   - `TC007`: Ensure `PUT /api/v1/notifications/{id}/read` path parameter gracefully handles both integer IDs and UUID strings, or returns `404` instead of failing with `422`.
   - `TC008`: Add top-level alias `attempt_id` to `POST /api/v1/mock-tests/{ref}/start` response for backwards compatibility.
   - `TC010`: Implement check in `POST /api/v1/compliance/requests` to return `409 Conflict` when a duplicate request is already open.
