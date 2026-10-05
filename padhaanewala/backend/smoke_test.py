"""Full-stack smoke test against the running localtest stack.

Exercises every button's underlying API call: public catalogue reads, the whole
auth lifecycle, admin CRUD, reviews/enquiries/saved-colleges, the mock-test
attempt flow, and the Phase 9 compliance flows.

Deliberately hits the deployed stack over HTTPS rather than importing the app, so
it covers the parts unit tests cannot: Caddy routing, the image build, the
migration that ran at container start, and the frontend that calls these.

Run: python smoke_test.py [base_url]
"""
import json
import os
import ssl
import sys
import time
import urllib3
import httpx

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://localhost:18443").rstrip("/")
API = f"{BASE}/api/v1"
STAMP = f"{int(time.time())}"

client = httpx.Client(
    base_url=API,
    verify=False,
    timeout=30.0,
    follow_redirects=True,
    headers={"Accept": "application/json"},
)

PASS, FAIL = [], []


def check(name, condition, detail=""):
    (PASS if condition else FAIL).append((name, detail))
    mark = "ok  " if condition else "FAIL"
    print(f"  [{mark}] {name}" + (f"  -- {detail}" if detail and not condition else ""))
    return condition


def get(path, **kw):
    return client.get(path, **kw)


def post(path, **kw):
    return client.post(path, **kw)


def section(title):
    print(f"\n=== {title} ===")


# --------------------------------------------------------------------------- #
section("health + public catalogue reads (no auth)")

r = get("/../health") if False else client.get(f"{BASE}/api/health")
check("GET /api/health", r.status_code == 200, f"{r.status_code} {r.text[:120]}")

public_gets = [
    "/colleges", "/colleges/search?q=engineering", "/courses", "/courses/categories",
    "/exams", "/exams/upcoming", "/scholarships", "/universities",
    "/blogs", "/blog-categories", "/faqs", "/banners", "/locations/states",
    "/cutoffs", "/fees", "/placements", "/rankings", "/seat-matrix",
    "/admissions", "/stats/catalog", "/predictor/exams", "/mock-tests",
]
for path in public_gets:
    r = get(path)
    ok = r.status_code == 200
    body = r.text[:100] if not ok else ""
    check(f"GET {path}", ok, f"{r.status_code} {body}")

# A 200 that is an empty list is how BUG-05 presented, so record row counts.
print("\n  -- row counts (a 200 with zero rows is a silent-empty failure) --")
for path in ["/colleges", "/courses", "/exams", "/scholarships", "/blogs",
             "/universities", "/banners", "/faqs", "/cutoffs", "/placements"]:
    r = get(path)
    try:
        n = len(r.json())
    except Exception:
        n = "not-a-list"
    flag = "" if (isinstance(n, int) and n > 0) else "   <-- EMPTY"
    print(f"     {path:22} {n}{flag}")

# --------------------------------------------------------------------------- #
section("auth lifecycle")

email = f"smoke.{STAMP}@example.com"
mobile = f"9{int(time.time()) % 1000000000:09d}"

r = post("/auth/register", json={
    "name": "Smoke Tester", "email": email, "mobile": mobile,
    "password": "SmokeTest123!", "age_band": "18_plus",
})
check("POST /auth/register", r.status_code == 201, f"{r.status_code} {r.text[:200]}")
tokens = r.json() if r.status_code == 201 else {}
access = tokens.get("access_token")

check("register returns access_token", bool(access), str(list(tokens)[:6]))

# Duplicate registration must be refused.
r = post("/auth/register", json={
    "name": "Smoke Tester", "email": email, "mobile": mobile,
    "password": "SmokeTest123!", "age_band": "18_plus",
})
check("POST /auth/register rejects duplicate", r.status_code in (400, 409),
      f"{r.status_code} {r.text[:120]}")

# Weak password must be refused.
r = post("/auth/register", json={
    "name": "Weak", "email": f"weak.{STAMP}@example.com",
    "mobile": f"8{int(time.time()) % 1000000000:09d}",
    "password": "123", "age_band": "18_plus",
})
check("POST /auth/register rejects weak password", r.status_code == 422,
      f"{r.status_code} {r.text[:120]}")

r = post("/auth/login", json={"email": email, "password": "SmokeTest123!"})
check("POST /auth/login", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
access = r.json().get("access_token", access)
refresh = r.json().get("refresh_token")

r = post("/auth/login", json={"email": email, "password": "WrongPassword1!"})
check("POST /auth/login rejects wrong password", r.status_code in (401, 400),
      f"{r.status_code}")

auth = {"Authorization": f"Bearer {access}"}

# Auth-required endpoints, checked with a real token rather than listed as
# public. These 401 without one, which is correct. `/roles` and `/seo` are
# admin-only and appear in the RBAC section below instead.
for path in ["/consent", "/compliance/status", "/saved-colleges"]:
    r = get(path, headers=auth)
    check(f"GET {path} (authed)", r.status_code == 200, f"{r.status_code} {r.text[:100]}")

for path in ["/consent", "/compliance/status", "/roles", "/seo"]:
    r = get(path)
    check(f"GET {path} refuses anonymous", r.status_code in (401, 403), f"{r.status_code}")

r = post("/auth/refresh", json={"refresh_token": refresh})
check("POST /auth/refresh", r.status_code == 200, f"{r.status_code} {r.text[:150]}")

for path in ["/users/me", "/users/me/profile", "/users/me/roles",
             "/saved-colleges", "/reviews/my", "/notifications/my",
             "/notifications/my/unread-count"]:
    r = get(path, headers=auth)
    check(f"GET {path} (authed)", r.status_code == 200, f"{r.status_code} {r.text[:120]}")

# Unauthenticated access to a protected route must be refused.
r = get("/users/me")
check("GET /users/me refuses anonymous", r.status_code in (401, 403), f"{r.status_code}")

r = client.put(f"{API}/users/me", json={"name": "Smoke Renamed"}, headers=auth)
check("PUT /users/me", r.status_code == 200, f"{r.status_code} {r.text[:150]}")

# --------------------------------------------------------------------------- #
section("student-facing actions (the buttons on a college page)")

colleges = get("/colleges?limit=5").json()
check("colleges list has rows", len(colleges) > 0, str(len(colleges)))
cref = colleges[0]["slug"] if colleges else None

if cref:
    for label, path in [
        ("detail", f"/colleges/{cref}"),
        ("courses", f"/colleges/{cref}/courses"),
        ("cutoffs", f"/colleges/{cref}/cutoffs"),
        ("fees", f"/colleges/{cref}/fees"),
        ("placements", f"/colleges/{cref}/placements"),
        ("rankings", f"/colleges/{cref}/rankings"),
        # The college page fetches the two per-type lists too, not just the
        # merged one. They were missing here while also missing from the router,
        # which is how a 405 on both went unnoticed until a build log said so.
        ("nirf rankings", f"/colleges/{cref}/rankings/nirf"),
        ("other rankings", f"/colleges/{cref}/rankings/other"),
        ("seat matrix", f"/colleges/{cref}/seat-matrix"),
        ("admissions", f"/colleges/{cref}/admissions"),
        ("reviews", f"/reviews/college/{cref}"),
    ]:
        r = get(path)
        check(f"GET college {label}", r.status_code == 200, f"{r.status_code} {r.text[:100]}")

    r = get(f"/colleges/{cref}")
    detail = r.json() if r.status_code == 200 else {}
    courses = detail.get("courses", [])
    check("college detail includes courses", isinstance(courses, list),
          f"{type(courses).__name__}")

    # Save / unsave is a real button; it must be idempotent and reversible.
    # `college_id` is a query parameter here, not a body field.
    r = post("/saved-colleges", params={"college_id": colleges[0]["id"]}, headers=auth)
    check("POST /saved-colleges", r.status_code in (200, 201), f"{r.status_code} {r.text[:150]}")
    r = get("/saved-colleges", headers=auth)
    saved = r.json() if r.status_code == 200 else []
    check("saved college appears in list", any(
        s.get("college", {}).get("id") == colleges[0]["id"] or s.get("college_id") == colleges[0]["id"]
        for s in saved), f"{len(saved)} saved")
    r = client.delete(f"{API}/saved-colleges/{colleges[0]['id']}", headers=auth)
    check("DELETE /saved-colleges", r.status_code in (200, 204), f"{r.status_code}")

    # Review submit.
    r = post("/reviews", json={
        "college_id": colleges[0]["id"], "rating": 5,
        "review_text": "Smoke test review", "year_of_study": "2nd",
    }, headers=auth)
    check("POST /reviews", r.status_code == 201, f"{r.status_code} {r.text[:200]}")
    review_id = r.json().get("id") if r.status_code == 201 else None

    if review_id:
        r = client.put(f"{API}/reviews/{review_id}",
                       json={"review_text": "Smoke test review (edited)"}, headers=auth)
        check("PUT /reviews/{id}", r.status_code == 200, f"{r.status_code} {r.text[:120]}")
    # Editing your own review is allowed; deleting one is admin-only by design
    # (a moderation trail, not a self-service delete), so 403 is correct here.
    r = client.delete(f"{API}/reviews/{review_id}", headers=auth)
    check("DELETE /reviews/{id} is admin-only", r.status_code in (403, 404),
          f"{r.status_code} -- author could delete their own review")

# Enquiry form (public, no auth). `age_band` is required since Phase 9.1, and
# the schema is extra="forbid", so only declared fields are sent.
r = post("/enquiries", json={
    "name": "Smoke Student", "mobile": f"7{int(time.time()) % 1000000000:09d}",
    "email": f"enq.{STAMP}@example.com", "age_band": "18_plus",
})
# 429 is a legitimate outcome once this script has been re-run against the same
# Redis within the window — the limiter doing its job, not a defect.
enquiry_status = r.status_code
check("POST /enquiries", enquiry_status in (200, 201, 429),
      f"{enquiry_status} {r.text[:200]}")
if enquiry_status == 429:
    print("     -> rate limited (expected on a repeat run); "
          "enquiry assertions below are inconclusive this run")

if enquiry_status in (200, 201):
    # Phase 9.1: the age gate must reject a minor with no verified guardian consent.
    r = post("/enquiries", json={
        "name": "Minor Student", "mobile": f"5{int(time.time()) % 1000000000:09d}",
        "age_band": "13_17",
    })
    check("POST /enquiries refuses an unconsented minor",
          r.status_code in (403, 409, 422), f"{r.status_code} {r.text[:150]}")

    # Server must derive ip_address, not accept it from the client.
    r = post("/enquiries", json={
        "name": "Spoofer", "mobile": f"6{int(time.time()) % 1000000000:09d}",
        "age_band": "18_plus", "ip_address": "1.2.3.4",
    })
    check("POST /enquiries rejects client-supplied ip_address", r.status_code == 422,
          f"{r.status_code} {r.text[:150]}")

# Predictor. `category` is required, and this is the product's headline feature.
r = post("/predictor", json={
    "exam": "JEE Main", "category": "General", "rank": 5000,
})
check("POST /predictor", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
print(f"     -> {r.text[:200]}")

# --------------------------------------------------------------------------- #
section("mock test attempt flow")

mts = get("/mock-tests?limit=5").json()
check("mock-tests list has rows", len(mts) > 0, str(len(mts)))

if mts:
    ref = mts[0]["slug"]
    r = post(f"/mock-tests/{ref}/start", headers=auth)
    check("POST /mock-tests/{ref}/start", r.status_code in (200, 201),
          f"{r.status_code} {r.text[:200]}")
    body = r.json() if r.status_code in (200, 201) else {}
    # The response is nested: {"attempt": {...}, "questions": [...]}. Reading
    # `id` off the top level returns None, and every check after this point is
    # inside `if attempt_id:` — so a wrong shape skips the whole flow and still
    # reports green. Hence the explicit assertion below.
    attempt = body.get("attempt") or {}
    attempt_id = attempt.get("id")
    questions = body.get("questions") or []

    if not check("start response is {attempt, questions} with an id",
                 bool(attempt_id), f"top-level keys: {sorted(body)[:6]}"):
        print("     -> attempt flow NOT exercised; skipping the rest of it")

    if attempt_id:
        check("start returns the paper's questions", len(questions) > 0,
              f"{len(questions)} questions")
        check("attempt carries a time limit",
              attempt.get("time_remaining_seconds", 0) > 0,
              str(attempt.get("time_remaining_seconds")))

        if questions:
            q = questions[0]
            qid = q.get("id")
            if q.get("question_type") == "numeric":
                payload = {"selected_answer": "42"}
            else:
                opts = q.get("options") or []
                # The stored key is the option *value*, not its letter — see
                # commit 9c5b19b "store the option value as an MCQ key".
                payload = {"selected_answer": opts[0] if opts else "a"}

            r = client.put(
                f"{API}/mock-tests/{ref}/attempts/{attempt_id}/answers/{qid}",
                json=payload, headers=auth)
            check("PUT save answer", r.status_code in (200, 204),
                  f"{r.status_code} {r.text[:150]}")

        r = post(f"/mock-tests/{ref}/attempts/{attempt_id}/submit", headers=auth)
        check("POST submit attempt", r.status_code in (200, 201),
              f"{r.status_code} {r.text[:250]}")

        r = get(f"/mock-tests/{ref}/attempts/{attempt_id}/result", headers=auth)
        check("GET attempt result", r.status_code == 200, f"{r.status_code} {r.text[:250]}")
        # Also nested under "attempt" — reading the top level yields None and
        # looks like an ungraded submission.
        graded = (r.json().get("attempt") or {}) if r.status_code == 200 else {}
        print(f"     -> graded: score={graded.get('score')} "
              f"correct={graded.get('correct_count')} "
              f"incorrect={graded.get('incorrect_count')} "
              f"unanswered={graded.get('unanswered_count')}")
        check("a submitted attempt is graded", graded.get("score") is not None,
              "score is null after submit")
        check("graded attempt counts reconcile",
              (graded.get("correct_count") or 0)
              + (graded.get("incorrect_count") or 0)
              + (graded.get("unanswered_count") or 0)
              == len(questions),
              f"{graded.get('correct_count')}+{graded.get('incorrect_count')}"
              f"+{graded.get('unanswered_count')} != {len(questions)}")
        check("a wrong answer costs marks",
              graded.get("score") is not None
              and float(graded["score"]) < 0,
              f"score={graded.get('score')} with 0 correct and 1 answered wrong")

        r = get(f"/mock-tests/{ref}/attempts/{attempt_id}", headers=auth)
        check("GET attempt detail", r.status_code == 200, f"{r.status_code}")

# --------------------------------------------------------------------------- #
section("Phase 9 compliance flows")

r = get("/compliance/status", headers=auth)
check("GET /compliance/status", r.status_code == 200, f"{r.status_code} {r.text[:200]}")
print(f"     -> {r.text[:200]}")

r = post("/compliance/age", json={"age_band": "18_plus"}, headers=auth)
check("POST /compliance/age", r.status_code in (200, 201), f"{r.status_code} {r.text[:200]}")

r = get("/compliance/parental-consent", headers=auth)
check("GET /compliance/parental-consent", r.status_code == 200, f"{r.status_code} {r.text[:150]}")

r = post("/compliance/requests", json={
    "request_type": "access", "details": "Smoke test access request",
}, headers=auth)
check("POST /compliance/requests", r.status_code in (200, 201), f"{r.status_code} {r.text[:200]}")

r = get("/compliance/requests", headers=auth)
check("GET /compliance/requests", r.status_code == 200, f"{r.status_code}")
reqs = r.json() if r.status_code == 200 else []
check("compliance request is listed", len(reqs) > 0, str(len(reqs)))

if reqs:
    rid = reqs[0]["id"]
    r = get(f"/compliance/requests/{rid}", headers=auth)
    check("GET /compliance/requests/{id}", r.status_code == 200, f"{r.status_code}")

# Consent endpoints need a minor account; confirm they refuse cleanly otherwise.
r = get("/compliance/parental-consent", headers=auth)
check("consent read is stable for an adult", r.status_code == 200, f"{r.status_code}")

# --------------------------------------------------------------------------- #
section("RBAC: a student must not reach admin")

# `/media` is deliberately public — its response is image metadata only (url,
# file name, alt text, sizes) and those images appear on public college pages.
# Writes are gated on CONTENT_ROLES. It is deliberately absent from this list.
for path in ["/audit-logs", "/users", "/leads", "/reviews/moderation",
             "/compliance/admin/requests", "/roles", "/seo"]:
    r = get(path, headers=auth)
    check(f"GET {path} refuses a student", r.status_code in (401, 403),
          f"{r.status_code} -- LEAKED" if r.status_code == 200 else f"{r.status_code}")

for path in ["/colleges", "/courses", "/exams", "/blogs"]:
    r = post(path, json={"name": "Sneaky", "slug": "sneaky"}, headers=auth)
    check(f"POST {path} refuses a student", r.status_code in (401, 403),
          f"{r.status_code} -- LEAKED" if r.status_code in (200, 201) else f"{r.status_code}")

# --------------------------------------------------------------------------- #
section("session teardown")

r = post("/auth/logout", json={}, headers=auth)
check("POST /auth/logout", r.status_code in (200, 204), f"{r.status_code} {r.text[:120]}")

# --------------------------------------------------------------------------- #
section("frontend pages (HTML)")

pages = [
    "/", "/colleges", "/courses", "/exams", "/scholarships", "/blog",
    "/about", "/contact", "/login", "/forgot-password", "/reset-password",
    "/privacy", "/terms", "/mock-tests", "/resources", "/reviews",
    "/dashboard", "/plan", "/admission", "/college-predictor", "/compare",
    "/ask-ai", "/verify-email", "/admin",
    "/legal/grievance", "/legal/dpdp-notice", "/legal/privacy", "/legal/terms",
    "/robots.txt", "/sitemap.xml",
]
for p in pages:
    try:
        r = client.get(f"{BASE}{p}")
        check(f"page {p}", r.status_code in (200, 307, 308), f"{r.status_code}")
    except Exception as e:
        check(f"page {p}", False, str(e)[:120])

# An unknown URL must 404, not serve the homepage with a 200.
r = client.get(f"{BASE}/nonexistent-page-should-404")
check("unknown page 404s", r.status_code == 404, f"{r.status_code}")

# College detail page needs a real slug.
if cref:
    r = client.get(f"{BASE}/colleges/{cref}")
    check(f"page /colleges/{cref[:40]}", r.status_code == 200, f"{r.status_code}")

# --------------------------------------------------------------------------- #
print("\n" + "=" * 70)
print(f"PASSED: {len(PASS)}    FAILED: {len(FAIL)}")
if FAIL:
    print("\nFailures:")
    for name, detail in FAIL:
        print(f"  - {name}  [{detail}]")
print("=" * 70)
sys.exit(1 if FAIL else 0)
