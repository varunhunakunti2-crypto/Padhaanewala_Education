import json
import time
import urllib.request
import urllib.error
import sys
import uuid

BASE_URL = "http://localhost:3000"
BACKEND_DIRECT = "http://localhost:8000"

def request(path, method="GET", data=None, token=None, cookies=None, direct_backend=False):
    base = BACKEND_DIRECT if direct_backend else BASE_URL
    url = f"{base}{path}"
    headers = {
        "User-Agent": "Padhaanewala-E2E-Tester/1.0",
        "Accept": "application/json",
    }
    if data is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if cookies:
        headers["Cookie"] = cookies

    encoded_data = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            res_body = res.read().decode("utf-8", errors="replace")
            res_headers = dict(res.headers)
            parsed = None
            if res_body:
                try:
                    parsed = json.loads(res_body)
                except Exception:
                    parsed = res_body
            return res.status, parsed, res_headers
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(err_body)
        except Exception:
            parsed = err_body
        return e.code, parsed, dict(e.headers)
    except Exception as e:
        return 0, str(e), {}

passed = 0
failed = 0

def assert_step(name, condition, extra=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"[PASS] {name} {extra}")
    else:
        failed += 1
        print(f"[FAIL] {name} {extra}")

def main():
    global passed, failed
    print("==========================================================")
    print("     PADHAANEWALA COMPLETE END-TO-END VERIFICATION       ")
    print("==========================================================")

    # 1. Platform Health & Stats
    st, body, _ = request("/health", direct_backend=True)
    assert_step("1.1 Backend Health Check (/health)", st == 200 and body.get("status") == "ok")

    st, body, _ = request("/api/v1/stats/catalog")
    assert_step("1.2 Platform Catalog Stats (/api/v1/stats/catalog)", st == 200 and "colleges" in body)

    # 2. Public Catalog APIs
    st, colleges, _ = request("/api/v1/colleges?limit=5")
    assert_step("2.1 List Colleges", st == 200 and len(colleges) > 0, f"Found {len(colleges)} colleges")
    sample_college_slug = colleges[0]["slug"] if colleges else None

    st, col_detail, _ = request(f"/api/v1/colleges/{sample_college_slug}")
    assert_step("2.2 Single College Detail", st == 200 and col_detail.get("slug") == sample_college_slug)

    st, courses, _ = request("/api/v1/courses?limit=5")
    assert_step("2.3 List Courses", st == 200 and len(courses) > 0, f"Found {len(courses)} courses")

    st, exams, _ = request("/api/v1/exams")
    assert_step("2.4 List Exams", st == 200 and len(exams) > 0, f"Found {len(exams)} exams")

    st, scholarships, _ = request("/api/v1/scholarships")
    assert_step("2.5 List Scholarships", st == 200 and len(scholarships) > 0, f"Found {len(scholarships)} scholarships")

    st, mock_tests, _ = request("/api/v1/mock-tests")
    assert_step("2.6 List Mock Tests", st == 200 and len(mock_tests) > 0, f"Found {len(mock_tests)} mock tests")

    st, blogs, _ = request("/api/v1/blogs")
    assert_step("2.7 List Blogs", st == 200 and len(blogs) > 0, f"Found {len(blogs)} blogs")

    st, states, _ = request("/api/v1/locations/states")
    assert_step("2.8 List States", st == 200 and len(states) > 0, f"Found {len(states)} states")

    # 3. AI & Prediction Services
    st, pred_res, _ = request("/api/v1/predictor", "POST", {"exam": "jee-main", "category": "General", "rank": 1500})
    assert_step("3.1 College Predictor API", st == 200 and "results" in pred_res)

    st, ai_res, _ = request("/api/ai", "POST", {"message": "Hello! Can you help me find a good college?"})
    assert_step("3.2 Ask AI Chat Service", st == 200 and ("reply" in str(ai_res) or "message" in str(ai_res) or "choices" in str(ai_res)))

    # 4. Student Authentication Lifecycle (Self-contained registration & login)
    uid = uuid.uuid4().hex[:8]
    test_email = f"student.{uid}@padhaanewala.in"
    test_mobile = f"98{int(time.time()) % 100000000:08d}"
    test_pw = "Password123!"

    st, reg_res, _ = request("/api/v1/auth/register", "POST", {
        "name": f"Student {uid}",
        "email": test_email,
        "mobile": test_mobile,
        "password": test_pw,
        "age_band": "18_plus"
    })
    assert_step("4.1 Student Registration", st in (200, 201), f"Created {test_email}")

    st, login_res, headers = request("/api/v1/auth/login", "POST", {
        "email": test_email,
        "password": test_pw
    })
    student_token = login_res.get("access_token") if st == 200 else None
    assert_step("4.2 Student Login", st == 200 and bool(student_token))

    st, prof_res, _ = request("/api/v1/users/me/profile", token=student_token)
    assert_step("4.3 Get Student Profile", st == 200 and prof_res.get("email") == test_email)

    st, roles_res, _ = request("/api/v1/users/me/roles", token=student_token)
    assert_step("4.4 Get Student Roles", st == 200 and "student" in roles_res.get("roles", []))

    # 5. Student Engagement (Saved Colleges, Enquiries, Suggestions)
    first_college_id = colleges[0]["id"] if colleges else 1
    st, save_res, _ = request(f"/api/v1/saved-colleges?college_id={first_college_id}", "POST", token=student_token)
    assert_step("5.1 Save College", st in (200, 201), f"Status {st}")

    st, list_saved, _ = request("/api/v1/saved-colleges", token=student_token)
    assert_step("5.2 List Saved Colleges", st == 200 and len(list_saved) > 0, f"Count {len(list_saved)}")

    st, enq_res, _ = request("/api/v1/enquiries", "POST", {
        "name": f"Student {uid}",
        "email": test_email,
        "mobile": test_mobile,
        "college_id": first_college_id,
        "age_band": "18_plus",
        "message": "Interested in admissions."
    })
    assert_step("5.3 Submit Student Enquiry", st in (200, 201), f"Status {st}")

    st, sub_res, _ = request("/api/v1/college-submissions", "POST", {
        "proposed_name": f"Institute of Tech {uid}",
        "proposed_state_name": "Maharashtra",
        "proposed_city": "Pune",
        "submitter_notes": "Submitted by test student"
    }, token=student_token)
    assert_step("5.4 Submit College Suggestion", st in (200, 201), f"Status {st}")

    # 6. Mock Test Attempt Lifecycle
    test_slug = mock_tests[0]["slug"] if mock_tests else None
    st, start_res, _ = request(f"/api/v1/mock-tests/{test_slug}/start", "POST", token=student_token)
    attempt_id = start_res.get("attempt", {}).get("id") if st == 200 else None
    questions = start_res.get("questions", []) if st == 200 else []
    assert_step("6.1 Start Mock Test Attempt", st == 200 and attempt_id is not None, f"Attempt #{attempt_id}, {len(questions)} questions")

    if attempt_id and questions:
        q1 = questions[0]
        opt = q1.get("options", ["A"])[0] if q1.get("options") else "10"
        st, save_ans, _ = request(f"/api/v1/mock-tests/{test_slug}/attempts/{attempt_id}/answers/{q1['id']}", "PUT", {
            "selected_answer": opt
        }, token=student_token)
        assert_step("6.2 Save Question Answer", st == 200)

        st, finish_res, _ = request(f"/api/v1/mock-tests/{test_slug}/submit", "POST", {
            "answers": [{"question_id": q1["id"], "selected_answer": opt}]
        }, token=student_token)
        assert_step("6.3 Submit Mock Test Attempt", st == 200 and ("score" in finish_res or "total_marks" in finish_res or "is_submitted" in finish_res or "status" in str(finish_res)))

    # 7. Admin Authentication & Operations
    st, admin_login, _ = request("/api/v1/auth/login", "POST", {
        "email": "contact@padhaanewala.in",
        "password": "AdminPassword123!"
    })
    admin_token = admin_login.get("access_token") if st == 200 else None
    assert_step("7.1 Admin Login", st == 200 and bool(admin_token))

    st, admin_roles, _ = request("/api/v1/users/me/roles", token=admin_token)
    assert_step("7.2 Admin Roles Verified", st == 200 and "admin" in admin_roles.get("roles", []))

    st, admin_stats, _ = request("/api/v1/admin/analytics/overview", token=admin_token)
    assert_step("7.3 Admin Analytics Overview", st == 200)

    st, admin_enq, _ = request("/api/v1/enquiries", token=admin_token)
    assert_step("7.4 Admin View Enquiries", st == 200)

    st, admin_subs, _ = request("/api/v1/college-submissions", token=admin_token)
    assert_step("7.5 Admin View College Submissions", st == 200)

    st, audit_logs, _ = request("/api/v1/audit-logs", token=admin_token)
    assert_step("7.6 Admin View Audit Logs", st == 200)

    st, settings_res, _ = request("/api/v1/settings", token=admin_token)
    assert_step("7.7 Platform Settings (Admin Gated)", st == 200)

    print("==========================================================")
    print(f"RESULTS: {passed} PASSED, {failed} FAILED")
    print("==========================================================")
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())

