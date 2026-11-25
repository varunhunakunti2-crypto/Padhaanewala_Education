# Backend case index

Generated from `testsprite_backend_test_plan.json`. The pytest files listed here already implement these cases; `scripts/run-backend-cases.ps1` runs all ten in one command.

| Case | Title | Endpoint(s) | Pytest file |
|---|---|---|---|
| TC001 | Browse colleges with filters | `GET /api/v1/colleges` | `TC001_browse_colleges_with_filters.py` |
| TC002 | Retrieve college details | `GET /api/v1/colleges/{college_ref}` | `TC002_retrieve_college_details.py` |
| TC003 | Browse course catalog | `GET /api/v1/courses` | `TC003_browse_course_catalog.py` |
| TC004 | Submit enquiry form | `POST /api/v1/enquiries` | `TC004_submit_enquiry_form.py` |
| TC005 | Submit college suggestion | `POST /api/v1/college-submissions` | `TC005_submit_college_suggestion.py` |
| TC006 | Save college to student account | `POST /api/v1/saved-colleges` | `TC006_save_college_to_student_account.py` |
| TC007 | Mark notification as read | `PUT /api/v1/notifications/{id}/read` | `TC007_mark_notification_as_read.py` |
| TC008 | Submit mock test attempt | `POST /api/v1/mock-tests/{ref}/submit` | `TC008_submit_mock_test_attempt.py` |
| TC009 | Send AI assistant question | `POST /api/ai` | `TC009_send_ai_assistant_question.py` |
| TC010 | Create compliance data request | `POST /api/v1/compliance/requests` | `TC010_create_compliance_data_request.py` |

All paths are relative to `APP/testsprite_tests/`.
