"""Admin-uploaded images on colleges, courses, scholarships and exams.

Before this feature every "image" those entities rendered was a gradient
derived on the client from the row id, so there was nothing an admin could
edit. These tests pin the three things that make the feature real:

  * the **column and the round-trip** — a value written through the admin
    route comes back on the read route, for all four entities;
  * the **list projection** — a college image is carried by
    `GET /colleges`, not only by the detail route, because college *cards*
    read the list endpoint. Leaving it detail-only is the failure mode that
    makes an uploaded image silently never appear where the gradient was;
  * the **validation** — `image_url` is rendered into an `<img src>`, so the
    scheme guard that protects `banners.link_url` has to protect it too.

The shapes accepted are deliberately the same as a banner link: an internal
path (`/media/files/12`) or an absolute `http(s)` URL. Everything else —
`javascript:`, `data:`, protocol-relative `//evil.example`, and a bare
`example.com` — is refused, because each is either stored XSS or a broken
image that looks fine in the database.
"""

import uuid

from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models import Role, User

client = TestClient(app)


def _make_admin_token() -> str:
    email = f"img.admin.{uuid.uuid4().hex[:8]}@example.com"
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Image Admin",
            "email": email,
            "mobile": f"9{uuid.uuid4().int % 1_000_000_000:09d}",
            "password": "SecurePass123!",
            "age_band": "18_plus",
        },
    )
    assert response.status_code == 201
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).first()
        admin = db.query(Role).filter(Role.name == "admin").first()
        assert admin is not None
        user.roles.append(admin)
        db.commit()
    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "SecurePass123!"},
    )
    assert login.status_code == 200
    return login.json()["access_token"]


# ---------------------------------------------------------------- courses


def test_course_image_round_trips():
    headers = {"Authorization": f"Bearer {_make_admin_token()}"}
    name = f"Imaged Course {uuid.uuid4().hex[:6]}"

    create = client.post(
        "/api/v1/courses",
        json={
            "name": name,
            "degree": "B.Tech",
            "image_url": "/media/files/42",
        },
        headers=headers,
    )
    assert create.status_code == 201, create.text
    body = create.json()
    assert body["image_url"] == "/media/files/42"
    ref = body["id"]

    listed = client.get("/api/v1/courses", params={"q": name}).json()
    row = next((c for c in listed if c["id"] == ref), None)
    assert row is not None, "created course missing from the list projection"
    assert row["image_url"] == "/media/files/42"

    updated = client.put(
        f"/api/v1/courses/{ref}",
        json={"image_url": "https://cdn.example.com/cover.webp"},
        headers=headers,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["image_url"] == "https://cdn.example.com/cover.webp"

    # An explicit null clears the image, which is the edit that restores the
    # gradient fallback. It must not be confused with "field absent".
    cleared = client.put(
        f"/api/v1/courses/{ref}",
        json={"image_url": None},
        headers=headers,
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["image_url"] is None


def test_course_image_defaults_to_null():
    headers = {"Authorization": f"Bearer {_make_admin_token()}"}
    name = f"Plain Course {uuid.uuid4().hex[:6]}"
    create = client.post(
        "/api/v1/courses", json={"name": name}, headers=headers
    )
    assert create.status_code == 201, create.text
    assert create.json()["image_url"] is None


# ---------------------------------------------------------------- colleges


def test_college_image_round_trips_through_list_and_detail():
    """The list projection is the assertion that matters.

    College cards are rendered from `GET /colleges`; only the detail page reads
    `GET /colleges/{slug}`. A column that reached the detail response but not
    the list one would look correct in an API test and be invisible on the
    page the admin was actually editing.

    The name is chosen to sort before the seeded catalog, and we search by the
    created slug rather than relying on a tiny page because leftover rows from
    earlier runs can accumulate in the shared test schema.
    """
    headers = {"Authorization": f"Bearer {_make_admin_token()}"}
    name = f"AAA Imaged College {uuid.uuid4().hex[:6]}"

    create = client.post(
        "/api/v1/colleges",
        json={"name": name, "image_url": "/media/files/7"},
        headers=headers,
    )
    assert create.status_code == 201, create.text
    body = create.json()
    assert body["image_url"] == "/media/files/7"
    slug = body["slug"]

    listed = client.get("/api/v1/colleges", params={"limit": 100}).json()
    row = next((c for c in listed if c["slug"] == slug), None)
    assert row is not None, "created college missing from the list projection"
    assert row["image_url"] == "/media/files/7"

    detail = client.get(f"/api/v1/colleges/{slug}").json()
    assert detail["image_url"] == "/media/files/7"

    cleared = client.put(
        f"/api/v1/colleges/{slug}", json={"image_url": None}, headers=headers
    )
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["image_url"] is None


def test_every_college_list_row_carries_the_image_key():
    """The projection must include the column, not merely sometimes carry a value.

    A client reading `row.image_url` cannot tell a missing key from a null one
    in JavaScript, so this asserts the key is present. Seeded colleges have no
    image because the migration adds the column with no backfill; a row created
    earlier in this session might carry a value, so we check presence, not null.
    """
    rows = client.get("/api/v1/colleges", params={"limit": 100}).json()
    assert rows, "no colleges returned"
    for row in rows:
        assert "image_url" in row, f"{row['slug']} has no image_url key"


# ------------------------------------------------------------ scholarships


def test_scholarship_image_round_trips():
    headers = {"Authorization": f"Bearer {_make_admin_token()}"}
    name = f"Imaged Scholarship {uuid.uuid4().hex[:6]}"

    create = client.post(
        "/api/v1/scholarships",
        json={
            "name": name,
            "provider": "Test Board",
            "image_url": "/media/files/11",
        },
        headers=headers,
    )
    assert create.status_code == 201, create.text
    body = create.json()
    assert body["image_url"] == "/media/files/11"
    ref = body["id"]

    listed = client.get("/api/v1/scholarships", params={"q": name}).json()
    row = next((s for s in listed if s["id"] == ref), None)
    assert row is not None, "created scholarship missing from the list projection"
    assert row["image_url"] == "/media/files/11"

    detail = client.get(f"/api/v1/scholarships/{ref}").json()
    assert detail["image_url"] == "/media/files/11"


# ------------------------------------------------------------------- exams


def test_exam_image_round_trips():
    headers = {"Authorization": f"Bearer {_make_admin_token()}"}
    name = f"Imaged Exam {uuid.uuid4().hex[:6]}"

    create = client.post(
        "/api/v1/exams",
        json={
            "name": name,
            "conducting_authority": "Test Authority",
            "image_url": "/media/files/13",
        },
        headers=headers,
    )
    assert create.status_code == 201, create.text
    body = create.json()
    assert body["image_url"] == "/media/files/13"
    ref = body["id"]
    slug = body["slug"]

    listed = client.get("/api/v1/exams", params={"limit": 100}).json()
    row = next((e for e in listed if e["slug"] == slug), None)
    assert row is not None, "created exam missing from the list projection"
    assert row["image_url"] == "/media/files/13"

    detail = client.get(f"/api/v1/exams/{ref}").json()
    assert detail["image_url"] == "/media/files/13"


# --------------------------------------------------------------- validation

#: Every shape the schema must refuse, with the reason it is dangerous or
#: broken. Shared by all four entities below.
_REFUSED = [
    "javascript:alert(1)",  # stored XSS through an <img src>
    "data:image/svg+xml;base64,PHN2Zz4=",  # inline SVG carries script
    "//evil.example/logo.png",  # protocol-relative: leaves the origin
    "example.com/logo.png",  # no scheme: not a usable src
    "ftp://example.com/logo.png",  # not http(s)
]


def _assert_refused(endpoint: str, payload: dict, headers: dict) -> None:
    for bad in _REFUSED:
        response = client.post(
            endpoint, json={**payload, "image_url": bad}, headers=headers
        )
        assert response.status_code == 422, (
            f"{bad!r} was accepted by {endpoint} with {response.status_code}"
        )


def test_image_url_is_validated_on_every_entity():
    headers = {"Authorization": f"Bearer {_make_admin_token()}"}
    suffix = uuid.uuid4().hex[:6]

    _assert_refused(
        "/api/v1/colleges", {"name": f"Bad Image College {suffix}"}, headers
    )
    _assert_refused(
        "/api/v1/courses", {"name": f"Bad Image Course {suffix}"}, headers
    )
    _assert_refused(
        "/api/v1/scholarships",
        {"name": f"Bad Image Scholarship {suffix}", "provider": "Board"},
        headers,
    )
    _assert_refused(
        "/api/v1/exams",
        {"name": f"Bad Image Exam {suffix}", "conducting_authority": "Auth"},
        headers,
    )


def test_image_url_is_validated_on_update_too():
    """A create-only guard is not a guard.

    The create and update schemas are separate classes; the field and its
    validator are declared on both, and this is the test that would fail if the
    update one were ever dropped.
    """
    headers = {"Authorization": f"Bearer {_make_admin_token()}"}
    name = f"Update Guard Course {uuid.uuid4().hex[:6]}"
    created = client.post(
        "/api/v1/courses", json={"name": name}, headers=headers
    )
    assert created.status_code == 201
    ref = created.json()["id"]

    bad = client.put(
        f"/api/v1/courses/{ref}",
        json={"image_url": "javascript:alert(1)"},
        headers=headers,
    )
    assert bad.status_code == 422

    # A blank string is "no image", not an error: it is stored as NULL so the
    # gradient fallback applies rather than an empty <img src>.
    blank = client.put(
        f"/api/v1/courses/{ref}", json={"image_url": "   "}, headers=headers
    )
    assert blank.status_code == 200, blank.text
    assert blank.json()["image_url"] is None


def test_image_url_length_is_capped():
    headers = {"Authorization": f"Bearer {_make_admin_token()}"}
    name = f"Long Image Course {uuid.uuid4().hex[:6]}"
    too_long = "/" + ("a" * 500)
    response = client.post(
        "/api/v1/courses",
        json={"name": name, "image_url": too_long},
        headers=headers,
    )
    assert response.status_code == 422
