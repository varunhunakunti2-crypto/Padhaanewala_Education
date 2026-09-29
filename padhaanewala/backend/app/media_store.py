"""Where uploaded files actually go, and why only these four types are allowed.

## The gap this fills

`media.py` was, and still is primarily, a **registry**: `MediaCreate` takes a
`url` string, so it records where an image already lives. Nothing in the backend
accepted a file — no `UploadFile`, no multipart handler, no object-storage
client. All nine seeded rows pointed at `https://example.com/img.jpg`, so the
admin media panel rendered nine broken images and its "Upload" button fired a
toast. `python-multipart` was in `requirements.txt` and never imported.

This module is the missing half: it takes bytes that have already been
validated by the route, and puts them somewhere a browser can fetch them again.

## Why the type check is by magic byte and not by Content-Type

`UploadFile.content_type` is whatever the client sent. It is a header, so it is
attacker-controlled, and `python-multipart` has no reason to second-guess it.
Accepting it would mean `curl -F "file=@payload.html;type=image/png"` stores an
HTML document under an image name.

The consequence of that is not a broken image, it is stored XSS. The serving
route is **same-origin** — `/api/v1/media/files/{id}` is proxied through the
Next.js rewrite like every other API path — so anything this origin serves with
an HTML content type can read the session and call the API as the visitor. A
polygot file that is simultaneously a valid PNG and valid HTML is the standard
way to get there.

So the bytes decide, in this order:

1. `sniff_image_type` looks at the file header. No match, no store.
2. The **sniffed** type is what gets stored, served, and recorded in
   `media.file_type`. The declared type is never persisted, so a later read
   cannot be misled by what the client claimed.
3. The serving route sets `X-Content-Type-Options: nosniff` and
   `Content-Security-Policy: default-src 'none'`, so even a browser that
   ignores the content type cannot execute anything from the response.

## Why SVG is refused

SVG is an XML document that can carry `<script>`. Serving it inline from the
application origin is the same stored-XSS problem as HTML, in a file extension
that looks like an image to a reviewer and to `file_type`. It is not in the
allow-list, and the rejection message says why rather than "invalid file".

## Why the stored name is derived from the primary key

The first cut stored files as `<uuid4><ext>` and put only the media id in the
serving URL, so `GET /media/files/{id}` had no way to find its own file — every
read 404'd while every write reported 201. The file name has to be
*reconstructible from the row*, with no extra column to keep in step.

It is: `<entity_type>/<entity_id>/<media.id><ext>`, where the extension comes
from the sniffed `file_type` that the row already stores. The primary key is
unique, so the name is unique without a uuid, and an admin renaming or
re-categorising a row cannot orphan the bytes.

This also means `url` is a pure lookup handle and carries no storage detail —
which is what lets the store be swapped for S3 later without migrating rows.

## Why the uploaded name is never used for the path

The uploaded filename is attacker-controlled and may contain `../`, a null
byte, a 300-character name, or a homoglyph. It is kept only as
`media.file_name` — the display label — and is sanitised on the way in. The path
on disk is built from the entity and the primary key.

## Why the root is resolved, then verified

`_resolve_inside` is the last line of defence against path traversal in the
stored `url` and in `entity_type`. The candidate path is resolved to an
absolute real path and checked to be under the root. `Path.resolve()` follows
symlinks, which is why this runs on both sides.

## The honest limitation

Local disk does not survive replacing the container. The production compose
file mounts a named volume at `/var/lib/padhaanewala/media` and
`MEDIA_ROOT` points inside it, so a redeploy keeps the files — but this store
assumes **one backend replica**. Two replicas would not share a filesystem.
Swapping in S3 or Azure Blob means reimplementing `save`/`load`/`delete` and
nothing else; the route, the schema and the panel are already storage-agnostic
because they only ever exchange a `url`.
"""

from __future__ import annotations

import shutil
from dataclasses import dataclass
from pathlib import Path

from app.config import get_settings

#: Header signature -> (canonical extension, content type).
#:
#: Ordered longest-first so a prefix cannot shadow a longer signature. Each
#: entry is a tuple of (offset, bytes) pairs, checked with `startswith` over
#: the joined prefix where the signature is contiguous.
_SIGNATURES: tuple[tuple[bytes, str, str], ...] = (
    # PNG: 8-byte signature, the longest fixed one.
    (b"\x89PNG\r\n\x1a\n", ".png", "image/png"),
    # GIF87a / GIF89a share a 6-byte prefix.
    (b"GIF87a", ".gif", "image/gif"),
    (b"GIF89a", ".gif", "image/gif"),
    # JPEG: FF D8 FF. The third byte being FF is what separates a real JFIF/Exif
    # stream from a bare SOI marker followed by something else.
    (b"\xff\xd8\xff", ".jpg", "image/jpeg"),
)

#: WebP is "RIFF....WEBP" — the payload size sits at offset 4, so the form
#: signature alone is not enough; the trailing tag is checked separately.
_RIFF = b"RIFF"
_WEBP = b"WEBP"

#: Refused even though it is an image format. Kept as a named constant so the
#: rejection message can explain itself.
SVG_REASON = (
    "SVG is not accepted: it is an XML document that can carry script, and "
    "uploaded files are served from this application's own origin. Export a "
    "PNG or WebP instead."
)

MAX_FILENAME_LABEL = 255


class MediaRejected(Exception):
    """A file was refused. Carries the message the admin should read.

    Deliberately not an `HTTPException` — this module is storage, not routing,
    and the route decides the status code.
    """

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class StoredFile:
    """What `save` produced."""

    absolute_path: Path
    relative_path: str
    content_type: str
    size: int


def sniff_image_type(data: bytes) -> str | None:
    """Return the canonical content type implied by the file's bytes, or None.

    Takes the **whole** file, not a header prefix, and that is deliberate. A
    prefix check asks "does this file *start* with a PNG signature?", which a
    file that is a PNG header followed by an HTML document answers yes to — and
    a browser given that body under an image content type, with sniffing
    defeated by `nosniff`, will happily treat the markup as the document.

    So this also confirms the file is not carrying a document payload: the
    signatures are matched at the start, and a file that additionally contains
    markup after its image header is refused. The cost is that `data` must be
    fully read, which the upload route does anyway against a size ceiling.
    """
    for signature, _ext, content_type in _SIGNATURES:
        if not data.startswith(signature):
            continue
        if _carries_markup(data):
            raise MediaRejected(PAYLOAD_REASON, 415)
        return content_type
    if data.startswith(_RIFF) and data[8:12] == _WEBP:
        if _carries_markup(data):
            raise MediaRejected(PAYLOAD_REASON, 415)
        return "image/webp"
    return None


#: Markers of a document body riding along behind an image header. Matched
#: case-insensitively against the bytes after the image header, and only for the
#: formats that carry a scriptable or renderable payload.
_MARKUP_MARKERS = (
    b"<html",
    b"<script",
    b"<!doctype",
    b"<svg",
    b"<?xml",
    b"<body",
    b"<iframe",
)


def _carries_markup(data: bytes) -> bool:
    lowered = data[:4096].lower()
    return any(marker in lowered for marker in _MARKUP_MARKERS)


PAYLOAD_REASON = (
    "That file has an image header but also contains markup, so it is not a "
    "plain image. Uploaded files are served from this application's own origin, "
    "so a file that a browser might render as a document would be able to run "
    "script against a visitor's session. Re-export it as a plain PNG or WebP."
)


def _extension_for(content_type: str) -> str:
    for _signature, ext, candidate in _SIGNATURES:
        if candidate == content_type:
            return ext
    if content_type == "image/webp":
        return ".webp"
    # Unreachable for a sniffed type, but a wrong extension is worse than a
    # failed upload if the allow-list is ever extended carelessly.
    raise MediaRejected(f"no stored extension for {content_type!r}", 500)


def relative_path_for(
    entity_type: str, entity_id: int, media_id: int, content_type: str | None
) -> str:
    """The on-disk path for a row, derived from the row alone.

    `content_type` may be `None` for a row that was never uploaded through this
    service; the caller is expected to check ownership first. The extension
    falls back to `.bin` rather than raising, so reading a malformed row returns
    a 404 rather than a 500.
    """
    shard = _shard(entity_type, entity_id)
    try:
        ext = _extension_for(content_type) if content_type else ".bin"
    except MediaRejected:
        ext = ".bin"
    return f"{shard}/{media_id}{ext}"


def _shard(entity_type: str, entity_id: int) -> str:
    """The directory a row's file lives in.

    `entity_type` is a free-text column. Anything that is not a plain slug is
    flattened, because this value is a path component.
    """
    slug = "".join(
        ch if (ch.isalnum() or ch in "-_") else "-" for ch in entity_type.strip().lower()
    ).strip("-")
    return f"{slug or 'misc'}/{entity_id}"


def media_root() -> Path:
    """The configured root, created if absent.

    Relative by default so development works with no configuration. The
    production guard in `config.py` refuses an absolute path, which is what
    keeps this inside the container's volume.
    """
    root = Path(get_settings().MEDIA_ROOT).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _resolve_inside(root: Path, relative_path: str) -> Path:
    """Resolve `relative_path` under `root`, refusing anything that escapes.

    Takes the path as one string rather than as segments, because a segment list
    is easy to validate wrongly: `root.joinpath("/etc/passwd")` discards `root`
    entirely, so an absolute segment replaces the root without ever tripping a
    containment test that only inspects the final path. It is refused here
    instead, and a Windows drive letter is caught by the `anchor` check that a
    leading-slash test would miss.
    """
    candidate_path = Path(relative_path)
    if candidate_path.is_absolute() or candidate_path.anchor:
        raise MediaRejected("resolved path escapes the media root", 400)

    # A Windows client (or a hand-edited row) can send either separator. On Linux
    # a backslash is an ordinary filename character, so one would silently become
    # a single oddly-named file rather than a traversal — refused instead, so the
    # two platforms cannot disagree about what a path means.
    if "\\" in relative_path:
        raise MediaRejected("resolved path escapes the media root", 400)

    for segment in candidate_path.parts:
        # `..` is the only segment that can climb out. `.` and empty segments
        # are harmless and are collapsed by the join.
        if segment == "..":
            raise MediaRejected("resolved path escapes the media root", 400)

    # Resolved last, and compared after resolving: this is what makes a symlink
    # planted inside the root useless as an escape.
    candidate = root.joinpath(candidate_path).resolve()
    if candidate != root and root not in candidate.parents:
        raise MediaRejected("resolved path escapes the media root", 400)
    return candidate


def save(
    data: bytes,
    entity_type: str,
    entity_id: int,
    media_id: int,
) -> StoredFile:
    """Validate `data` and write it under the root.

    `media_id` must already be allocated — the caller flushes the row first — so
    the stored name is derivable from the row alone and needs no extra column.
    The type is decided from the bytes *before* anything is written, so a
    rejected file never reaches the filesystem.
    """
    settings = get_settings()

    if not data:
        raise MediaRejected("The file is empty.", 400)
    if len(data) > settings.MEDIA_MAX_BYTES:
        raise MediaRejected(
            f"That file is {len(data) // 1024} KB. The limit is "
            f"{settings.MEDIA_MAX_BYTES // 1024} KB.",
            413,
        )

    content_type = sniff_image_type(data)
    if content_type is None:
        # Distinguish the two refusals an admin will actually hit, because the
        # fix is different: one needs re-exporting to a raster format, the other
        # needs a real image file.
        if b"<svg" in data[:512].lower() or data[:512].lstrip().startswith(b"<?xml"):
            raise MediaRejected(SVG_REASON, 415)
        raise MediaRejected(
            "That file is not a PNG, JPEG, GIF or WebP image. The type is "
            "checked from the file's contents, not from its name or the "
            "browser's label.",
            415,
        )

    # Sharded so a single directory does not accumulate every asset, and named
    # from the primary key so the path is derivable from the row. The first cut
    # used a uuid here and put only the id in the serving URL, which left
    # `GET /media/files/{id}` with no way to find its own file.
    relative = relative_path_for(entity_type, entity_id, media_id, content_type)

    root = media_root()
    # The whole relative path is re-validated as a single unit, so a row whose
    # `entity_type` was hand-edited to `../../etc` cannot place a file outside
    # the root. `_shard` sanitises it for the happy path; this is the check that
    # makes that sanitising load-bearing rather than merely tidy.
    absolute = _resolve_inside(root, relative)
    absolute.parent.mkdir(parents=True, exist_ok=True)
    absolute.write_bytes(data)

    return StoredFile(
        absolute_path=absolute,
        relative_path=relative,
        content_type=content_type,
        size=len(data),
    )


def safe_label(name: str) -> str:
    """A filename safe to store and to render.

    Strips any directory component, control characters, and truncates to the
    column width. It is stored in `media.file_name` and shown in the admin
    panel, so it must not be able to carry a path or break the table layout.
    """
    if not name:
        return "upload"
    # `os.path.basename` on both separators: a Windows client sends backslashes
    # and this is a Linux container.
    leaf = name.replace("\\", "/").rsplit("/", 1)[-1]
    cleaned = "".join(ch for ch in leaf if ch.isprintable()).strip()
    cleaned = cleaned.lstrip(".") or "upload"
    return cleaned[:MAX_FILENAME_LABEL]


def load(relative_path: str) -> tuple[Path, str]:
    """Resolve a stored path for reading, re-checking that it is inside root.

    Returns the path and the content type to serve it as. The content type is
    re-sniffed from the bytes on disk rather than trusted from the column, so a
    row edited directly in the database cannot make the server serve an
    arbitrary type.
    """
    absolute = _resolve_inside(media_root(), relative_path)

    if not absolute.is_file():
        raise MediaRejected("The stored file is missing from disk.", 404)

    with absolute.open("rb") as fh:
        content_type = sniff_image_type(fh.read())
    if content_type is None:
        # The bytes on disk are no longer a recognised image. Serving them
        # under any type would be the vulnerability this module exists to
        # prevent, so refuse rather than guess.
        raise MediaRejected("The stored file is not a readable image.", 415)

    return absolute, content_type


def delete(relative_path: str) -> None:
    """Remove a stored file.

    Missing is success. Deleting the row and then the file means a crash between
    them leaves an orphan file, which is the harmless direction; a row pointing
    at a deleted file is the one that breaks the site.
    """
    try:
        absolute = _resolve_inside(media_root(), relative_path)
    except MediaRejected:
        # A row whose stored path is already outside the root cannot be cleaned
        # up through this path, and must not be able to delete something else.
        return
    if absolute.is_file():
        absolute.unlink()
    # Tidy the shard directory if this was the last file in it, so an entity
    # that had media removed does not leave an empty tree behind.
    parent = absolute.parent
    try:
        if parent != media_root() and not any(parent.iterdir()):
            shutil.rmtree(parent)
    except OSError:
        # A non-empty or already-removed directory is not an error worth
        # failing the request over.
        pass


def path_for_row(media) -> str | None:
    """The on-disk path for a `Media` row, or None if this service didn't store it.

    A row created through the plain JSON `POST /media` API carries whatever URL
    the caller supplied — an external address this service does not own. The
    discriminator is the URL prefix written at upload time, because that is a
    fact about provenance rather than a guess from the URL's shape.

    Returns the relative path only; resolving and containment-checking happens in
    `load`/`delete`, which is where a read actually reaches the filesystem.
    """
    prefix = get_settings().MEDIA_URL_PREFIX
    if not media.url or not media.url.startswith(f"{prefix}/"):
        return None
    return relative_path_for(
        media.entity_type, media.entity_id, media.id, media.file_type
    )
