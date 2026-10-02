"""Upload storage and the routes around it.

The interesting assertions here are the refusals. A happy-path upload test
passes just as well against a naive implementation, so it proves almost nothing.
What matters is that the specific attacks below are rejected:

- a `.html` file labelled `image/png` (the type is checked from bytes)
- a `.svg` (scriptable, and served from the app's own origin)
- an oversize body (rejected while streaming, not after buffering)
- a traversal attempt in the stored path (rejected on read as well as on write)
- a registry row's external URL (never resolved against local disk)

And two properties that are easy to lose in a refactor and impossible to notice
until an image 404s: `media.url` is filled in with the real id in the same
transaction, and deleting a row removes the file while a failed upload leaves
neither.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import SessionLocal
from app.main import app
from app.media_store import (
    PAYLOAD_REASON,
    SVG_REASON,
    MediaRejected,
    sniff_image_type,
)
from app.models import College, Media, Role, User

client = TestClient(app)
BASE = "/api/v1"


# --- Byte fixtures ---------------------------------------------------------- #
# Hand-built headers rather than generated image files: the point is that the
# *type* is decided by these bytes, so the bytes must be the whole story.

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\rIHDR" + b"\x00" * 32
JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00" + b"\x00" * 32
GIF = b"GIF89a" + b"\x01\x00\x01\x00\x00\x00\x00;"
WEBP = b"RIFF" + b"\x00\x00\x00\x00" + b"WEBPVP8 " + b"\x00" * 32

#: A file that is a valid PNG *and* contains an HTML document. A type check that
#: trusts the filename or the request header accepts this.
POLYGOT = PNG + b"\n<html><script>alert(document.cookie)</script></html>\n"

SVG = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'

#: Plain HTML, no `<svg` marker, so it exercises the generic "not an image"
#: refusal rather than the SVG-specific one.
HTML = b"<!DOCTYPE html><html><body><script>alert(document.cookie)</script></body></html>"


def _unique(prefix: str) -> str:
    return f"{prefix}.{uuid.uuid4().hex[:8]}@example.com"


def _unique_mobile() -> str:
    return f"9{uuid.uuid4().int % 1_000_000_000:09d}"


@pytest.fixture(scope="module")
def content_admin() -> dict:
    email = _unique("media.admin")
    registered = client.post(
        f"{BASE}/auth/register",
        json={
            "name": "Media Admin",
            "email": email,
            "mobile": _unique_mobile(),
            "password": "SecurePass123!",
            "age_band": "18_plus",
        },
    )
    assert registered.status_code == 201, registered.text

    with SessionLocal() as db:
        role = db.scalar(select(Role).where(Role.name == "admin"))
        user = db.scalar(select(User).where(User.email == email))
        user.roles.append(role)
        db.commit()

    login = client.post(
        f"{BASE}/auth/login", json={"email": email, "password": "SecurePass123!"}
    )
    assert login.status_code == 200, login.text
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


@pytest.fixture
def college_id() -> int:
    with SessionLocal() as db:
        college = College(
            college_id=f"M{uuid.uuid4().int % 1_000_000_000}",
            name=f"Media Target {uuid.uuid4().hex[:6]}",
            slug=f"media-target-{uuid.uuid4().hex[:8]}",
            college_type="institute",
            ownership="private",
            is_active=True,
        )
        db.add(college)
        db.commit()
        db.refresh(college)
        return college.id


def _upload(
    headers: dict,
    college_id: int,
    data: bytes,
    filename: str = "logo.png",
    content_type: str = "image/png",
    **form,
) -> "object":
    payload = {
        "entity_type": form.pop("entity_type", "college"),
        "entity_id": str(college_id),
        **form,
    }
    return client.post(
        f"{BASE}/media/upload",
        files={"file": (filename, data, content_type)},
        data=payload,
        headers=headers,
    )


def _purge(media_ids: list[int]) -> None:
    if not media_ids:
        return
    with SessionLocal() as db:
        for mid in media_ids:
            row = db.get(Media, mid)
            if row:
                db.delete(row)
        db.commit()


# --- Type sniffing ---------------------------------------------------------- #


class TestTypeIsDecidedByBytes:
    @pytest.mark.parametrize(
        "data,expected",
        [
            (PNG, "image/png"),
            (JPEG, "image/jpeg"),
            (GIF, "image/gif"),
            (WEBP, "image/webp"),
        ],
    )
    def test_recognises_each_allowed_format(self, data, expected):
        assert sniff_image_type(data) == expected

    @pytest.mark.parametrize(
        "data",
        [
            b"",
            b"not an image at all",
            b"\x00\x00\x00\x00",
            # A RIFF container that is not WebP — e.g. WAVE audio. The trailing
            # tag is what distinguishes them, so the prefix alone is not enough.
            b"RIFF" + b"\x00" * 4 + b"WAVEfmt ",
        ],
    )
    def test_refuses_anything_else(self, data):
        assert sniff_image_type(data) is None

    def test_a_bare_soi_marker_is_not_a_jpeg(self):
        """`FF D8` alone is not a JPEG.

        Accepting the two-byte prefix would let a file that merely starts with
        those bytes through as `image/jpeg`, which is a wider hole than it
        looks: some decoders sniff leniently.
        """
        assert sniff_image_type(b"\xff\xd8\x00\x00") is None


# --- Upload refusals -------------------------------------------------------- #


class TestUploadRefusals:
    def test_html_labelled_as_png_is_refused(self, content_admin, college_id):
        # The declared type says image. The bytes say HTML. The bytes win.
        response = _upload(
            content_admin, college_id, HTML, filename="logo.png", content_type="image/png"
        )
        assert response.status_code == 415, response.text
        assert "not a PNG" in response.json()["detail"]

    def test_svg_is_refused_with_a_reason(self, content_admin, college_id):
        response = _upload(
            content_admin, college_id, SVG, filename="logo.svg", content_type="image/svg+xml"
        )
        assert response.status_code == 415, response.text
        # The message must say why, so an admin does not retry as a different
        # extension and conclude the uploader is broken.
        assert response.json()["detail"] == SVG_REASON

    def test_a_polyglot_png_html_is_refused(self, content_admin, college_id):
        # A prefix-only sniff would accept this: it *starts* with a valid PNG
        # signature. That is enough to defeat a browser that sniffs content, and
        # the serving route's `nosniff` is what would make the browser trust the
        # declared type instead.
        response = _upload(
            content_admin, college_id, POLYGOT, filename="x.png", content_type="image/png"
        )
        assert response.status_code == 415, response.text
        assert response.json()["detail"] == PAYLOAD_REASON

    @pytest.mark.parametrize(
        "payload",
        [
            b"<script>alert(1)</script>",
            b"<!DOCTYPE html><html></html>",
            b"<iframe src=//evil>",
            b"<body onload=alert(1)>",
        ],
    )
    def test_an_image_header_carrying_markup_is_refused(self, content_admin, college_id, payload):
        for header in (PNG, JPEG, GIF, WEBP):
            response = _upload(
                content_admin, college_id, header + payload, filename="x.png"
            )
            assert response.status_code == 415, f"{header[:4]!r}: {response.text}"

    def test_a_clean_image_is_not_mistaken_for_a_polyglot(self, content_admin, college_id):
        """The markup check must not reject real images.

        Binary image data contains arbitrary bytes, so a check that is too eager
        here would refuse every legitimate upload. Asserted with a body that
        contains bytes resembling markup but not the markers.
        """
        # Real image payloads carry arbitrary bytes, including bytes that
        # spell ASCII fragments. Every byte value 0-255 appears in IDAT data of
        # any real PNG, so the marker list has to be specific.
        body = PNG + bytes(range(256))
        response = _upload(content_admin, college_id, body, filename="ok.png")
        assert response.status_code == 201, response.text
        _purge([response.json()["id"]])

    def test_empty_file_is_refused(self, content_admin, college_id):
        response = _upload(content_admin, college_id, b"", filename="x.png")
        assert response.status_code == 400, response.text
        assert "empty" in response.json()["detail"].lower()

    def test_oversize_is_refused(self, content_admin, college_id, monkeypatch):
        from app.config import get_settings

        monkeypatch.setattr(get_settings(), "MEDIA_MAX_BYTES", 1024)
        response = _upload(
            content_admin, college_id, PNG + b"\x00" * 4096, filename="big.png"
        )
        assert response.status_code == 413, response.text
        assert "1024" not in response.json()["detail"]  # human-readable MB/kB
        assert "limit" in response.json()["detail"].lower()

    def test_upload_requires_a_role(self, college_id):
        anonymous = _upload({}, college_id, PNG)
        assert anonymous.status_code in (401, 403), anonymous.text

    def test_a_declared_content_type_is_never_persisted(self, content_admin, college_id):
        """The stored type is the sniffed one, so a later read cannot be misled."""
        response = _upload(
            content_admin, college_id, JPEG, filename="a.jpg", content_type="image/png"
        )
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["file_type"] == "image/jpeg"
        _purge([body["id"]])

    def test_a_traversing_filename_is_reduced_to_its_leaf(self, content_admin, college_id):
        response = _upload(
            content_admin,
            college_id,
            PNG,
            filename="../../../../etc/passwd\x00.png",
            content_type="image/png",
        )
        assert response.status_code == 201, response.text
        body = response.json()
        # Stored as a label, and the file itself is under the root.
        assert "/" not in body["file_name"]
        assert ".." not in body["file_name"]
        assert "\x00" not in body["file_name"]
        _purge([body["id"]])


# --- The happy path, and the parts that are easy to lose ------------------- #


class TestUploadRoundTrip:
    def test_upload_registers_and_serves_the_same_bytes(self, content_admin, college_id):
        response = _upload(
            content_admin,
            college_id,
            PNG,
            image_type="logo",
            alt_text="Institute crest",
            display_order="2",
        )
        assert response.status_code == 201, response.text
        body = response.json()

        # `url` must already carry the real id, not a placeholder. If it did, the
        # row would be unusable until something rewrote it.
        assert body["url"] == f"/api/v1/media/files/{body['id']}"
        assert body["entity_type"] == "college"
        assert body["entity_id"] == college_id
        assert body["image_type"] == "logo"
        assert body["alt_text"] == "Institute crest"
        assert body["display_order"] == 2
        assert body["file_size"] == len(PNG)
        assert body["file_name"] == "logo.png"

        try:
            served = client.get(body["url"])
            assert served.status_code == 200, served.text
            assert served.content == PNG
            # The security headers are the boundary, not decoration.
            assert served.headers["content-type"] == "image/png"
            assert served.headers["x-content-type-options"] == "nosniff"
            assert "default-src 'none'" in served.headers["content-security-policy"]
        finally:
            _purge([body["id"]])

    def test_all_four_formats_store_and_serve(self, content_admin, college_id):
        created = []
        try:
            for data, name, expected in (
                (PNG, "a.png", "image/png"),
                (JPEG, "a.jpg", "image/jpeg"),
                (GIF, "a.gif", "image/gif"),
                (WEBP, "a.webp", "image/webp"),
            ):
                response = _upload(
                    content_admin, college_id, data, filename=name, content_type="application/octet-stream"
                )
                assert response.status_code == 201, response.text
                body = response.json()
                created.append(body["id"])
                # Declared as octet-stream and still stored as the real type.
                assert body["file_type"] == expected
                served = client.get(body["url"])
                assert served.status_code == 200
                assert served.headers["content-type"] == expected
        finally:
            _purge(created)

    def test_two_uploads_of_the_same_name_do_not_collide(self, content_admin, college_id):
        first = _upload(content_admin, college_id, PNG, filename="logo.png")
        second = _upload(content_admin, college_id, JPEG, filename="logo.png")
        assert first.status_code == second.status_code == 201
        a, b = first.json(), second.json()
        try:
            assert a["id"] != b["id"]
            assert a["url"] != b["url"]
            assert client.get(a["url"]).content == PNG
            assert client.get(b["url"]).content == JPEG
        finally:
            _purge([a["id"], b["id"]])

    def test_delete_removes_the_file_as_well_as_the_row(self, content_admin, college_id):
        created = _upload(content_admin, college_id, PNG)
        body = created.json()
        assert client.get(body["url"]).status_code == 200

        deleted = client.delete(f"{BASE}/media/{body['id']}", headers=content_admin)
        assert deleted.status_code == 204, deleted.text
        assert client.get(f"{BASE}/media/{body['id']}").status_code == 404
        # The file is gone, not orphaned.
        assert client.get(body["url"]).status_code == 404

    def test_a_registry_row_is_never_resolved_against_local_disk(self, content_admin):
        """A row created through the plain JSON API holds an external URL.

        The serving route must refuse it rather than treat the URL as a path —
        otherwise `url=/api/v1/media/files/../../etc/shadow` would read a host
        file, and every external asset would 500.
        """
        created = client.post(
            f"{BASE}/media",
            json={
                "url": "https://cdn.example.com/logo.png",
                "file_name": "logo.png",
                "entity_type": "college",
                "entity_id": 1,
            },
            headers=content_admin,
        )
        assert created.status_code == 201, created.text
        body = created.json()
        try:
            served = client.get(f"{BASE}/media/files/{body['id']}")
            assert served.status_code == 404
            assert "hosted externally" in served.json()["detail"]

            # And deleting it must not touch the filesystem or 500.
            assert (
                client.delete(f"{BASE}/media/{body['id']}", headers=content_admin).status_code
                == 204
            )
        finally:
            _purge([body["id"]])

    def test_serving_an_inactive_row_is_a_404(self, content_admin, college_id):
        body = _upload(content_admin, college_id, PNG).json()
        try:
            hidden = client.put(
                f"{BASE}/media/{body['id']}", json={"is_active": False}, headers=content_admin
            )
            assert hidden.status_code == 200, hidden.text
            assert client.get(body["url"]).status_code == 404
        finally:
            _purge([body["id"]])


# --- Path traversal on read ------------------------------------------------- #


class TestPathContainment:
    def test_a_stored_path_escaping_the_root_is_refused_on_read(self, content_admin, college_id):
        """The read side re-checks containment, not just the write side.

        `url` is a plain string column, so a row edited directly in the database
        can point anywhere. Containment is enforced where the read happens,
        because that is the only place it can still stop anything.
        """
        from app.media_store import load

        for hostile in (
            "../../../etc/passwd",
            "/etc/passwd",
            "college/1/../../../../../../etc/hostname",
            "college/1/subdir/../../../../../../etc/shadow",
        ):
            with pytest.raises(MediaRejected) as excinfo:
                load(hostile)
            assert "escapes the media root" in excinfo.value.message, hostile

    def test_a_missing_file_is_a_404_not_a_500(self, content_admin):
        with pytest.raises(MediaRejected) as excinfo:
            from app.media_store import load

            load("college/999999/deadbeef.png")
        assert excinfo.value.status_code == 404
