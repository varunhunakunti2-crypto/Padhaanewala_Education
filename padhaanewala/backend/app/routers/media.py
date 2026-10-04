from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import media_store
from app.config import get_settings
from app.database import get_db
from app.dependencies import require_role
from app.models import Media, User
from app.schemas.content import MediaCreate, MediaResponse, MediaUpdate
from app.utils import audit

router = APIRouter(prefix="/api/v1/media", tags=["media"])

from app.roles import CONTENT_ROLES

#: Multipart is read in chunks and the running total is compared against the
#: ceiling, rather than trusting `Content-Length` or calling `.read()` on the
#: whole thing. A 2 GiB body would otherwise be held in memory before any check
#: ran.
_UPLOAD_CHUNK = 64 * 1024

def _to_response(media: Media) -> MediaResponse:
    return MediaResponse(
        id=media.id,
        url=media.url,
        file_name=media.file_name,
        file_type=media.file_type,
        file_size=media.file_size,
        alt_text=media.alt_text,
        entity_type=media.entity_type,
        entity_id=media.entity_id,
        image_type=media.image_type,
        display_order=media.display_order,
        is_active=media.is_active,
        created_at=media.created_at,
    )

@router.get("", response_model=list[MediaResponse])
def list_media(
    entity_type: str | None = Query(None, max_length=50),
    entity_id: int | None = None,
    file_type: str | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = select(Media).where(Media.is_active)
    if entity_type:
        query = query.where(Media.entity_type == entity_type)
    if entity_id is not None:
        query = query.where(Media.entity_id == entity_id)
    if file_type:
        query = query.where(Media.file_type == file_type)
    medias = db.scalars(
        query.order_by(Media.entity_type, Media.entity_id, Media.display_order)
        .limit(limit)
        .offset(offset)
    ).all()
    return [_to_response(m) for m in medias]

@router.get("/{media_id}", response_model=MediaResponse)
def get_media(media_id: int, db: Session = Depends(get_db)):
    media = db.get(Media, media_id)
    if media is None or not media.is_active:
        raise HTTPException(status_code=404, detail="Media not found")
    return _to_response(media)

@router.post(
    "",
    response_model=MediaResponse,
    status_code=201,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def create_media(
    payload: MediaCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*CONTENT_ROLES)),
):
    media = Media(**payload.model_dump())
    db.add(media)
    # 4.4 — flushed so `media.id` exists for the audit row; the commit below
    # lands the registry row and its trail entry together, as
    # `create_college` does.
    db.flush()
    audit.record(
        db,
        request=request,
        action="create_media",
        entity_type="media",
        entity_id=media.id,
        actor=user,
        new_value=payload.model_dump(),
    )
    db.commit()
    db.refresh(media)
    return _to_response(media)

@router.put(
    "/{media_id}",
    response_model=MediaResponse,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def update_media(
    media_id: int,
    payload: MediaUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*CONTENT_ROLES)),
):
    media = db.get(Media, media_id)
    if media is None:
        raise HTTPException(status_code=404, detail="Media not found")
    data = payload.model_dump(exclude_unset=True)
    # 4.4 — old values read before the `setattr` loop below, so the row
    # describes the edit and not its result; an asset silently re-pointed at a
    # different entity is exactly the change the trail exists to show.
    audit.record(
        db,
        request=request,
        action="update_media",
        entity_type="media",
        entity_id=media.id,
        actor=user,
        old_value={field: getattr(media, field) for field in data},
        new_value=data,
    )
    for field, value in data.items():
        setattr(media, field, value)
    db.commit()
    db.refresh(media)
    return _to_response(media)

@router.delete(
    "/{media_id}",
    status_code=204,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def delete_media(
    media_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*CONTENT_ROLES)),
):
    media = db.get(Media, media_id)
    if media is None:
        raise HTTPException(status_code=404, detail="Media not found")
    # 4.4 — enough to name the asset that is about to disappear from both the
    # registry and disk, read while the row still exists.
    audit.record(
        db,
        request=request,
        action="delete_media",
        entity_type="media",
        entity_id=media.id,
        actor=user,
        old_value={
            "file_name": media.file_name,
            "url": media.url,
            "entity_type": media.entity_type,
            "entity_id": media.entity_id,
        },
    )
    # Only rows this store owns have a path to clean up. A registry row holds an
    # external URL and deleting it must not touch the filesystem.
    stored_path = media_store.path_for_row(media)
    db.delete(media)
    db.commit()
    # After the commit, so a failure here orphans a file rather than leaving a
    # row pointing at a file that is gone.
    if stored_path is not None:
        media_store.delete(stored_path)


# 4.4 gap: audit coverage for this multipart upload path is not yet wired.
@router.post(
    "/upload",
    response_model=MediaResponse,
    status_code=201,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
async def upload_media(
    file: UploadFile = File(...),
    entity_type: str = Form(...),
    entity_id: int = Form(...),
    image_type: str | None = Form(None),
    alt_text: str | None = Form(None),
    display_order: int = Form(0),
    db: Session = Depends(get_db),
):
    """Store an uploaded image and register it against an entity.

    The entity is not verified to exist. `media` has no foreign key to
    `college`, `blog` or anything else — the column pair is a soft reference,
    added in Phase 0 — so a typo in `entity_id` produces a row that is
    invisible in every listing and impossible to find later. Validating it would
    mean a registry of entity types, which the schema does not have; the admin
    panel picks both values from a real list, which is the actual safeguard.
    """
    settings = get_settings()

    data = bytearray()
    while True:
        chunk = await file.read(_UPLOAD_CHUNK)
        if not chunk:
            break
        data.extend(chunk)
        if len(data) > settings.MEDIA_MAX_BYTES:
            # Stop reading rather than draining a hostile body. The connection
            # is closed by the error response.
            raise HTTPException(
                status_code=413,
                detail=(
                    f"That file is larger than the "
                    f"{settings.MEDIA_MAX_BYTES // 1024 // 1024} MB limit."
                ),
            )

    media = Media(
        # `url` is NOT NULL and the served path is keyed on the primary key the
        # row does not have yet, so the row is flushed first and the real URL is
        # set in the same transaction. No other request can observe the
        # placeholder: an uncommitted row is invisible.
        url="pending",
        file_name=media_store.safe_label(file.filename or "upload"),
        alt_text=alt_text or None,
        entity_type=entity_type.strip()[:50],
        entity_id=entity_id,
        image_type=image_type or None,
        display_order=display_order,
    )
    db.add(media)
    db.flush()

    try:
        stored = media_store.save(
            bytes(data),
            entity_type=media.entity_type,
            entity_id=media.entity_id,
            media_id=media.id,
        )
    except media_store.MediaRejected as exc:
        db.rollback()
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    media.file_type = stored.content_type
    media.file_size = stored.size
    media.url = f"{settings.MEDIA_URL_PREFIX}/{media.id}"

    try:
        db.commit()
    except Exception:
        db.rollback()
        # The row is gone, so the file would be unreachable and unlisted.
        media_store.delete(stored.relative_path)
        raise

    db.refresh(media)
    return _to_response(media)


@router.get(
    "/files/{media_id}",
    include_in_schema=False,
)
def serve_media_file(media_id: int, db: Session = Depends(get_db)):
    """Return the bytes for an uploaded file.

    Public and unauthenticated, because the images appear on public pages.

    This route serves the **same origin as the application**, so the response
    headers are part of the security boundary and not decoration. The content
    type is the one sniffed from the bytes on disk, never the stored
    `file_type` and never the upload's declared type, and `nosniff` plus
    `default-src 'none'` mean a browser cannot be talked into treating the body
    as a document even if that sniff were ever wrong.
    """
    media = db.get(Media, media_id)
    if media is None or not media.is_active:
        raise HTTPException(status_code=404, detail="Media not found")

    stored_path = media_store.path_for_row(media)
    if stored_path is None:
        # A registry row: its URL points somewhere else, and that host serves it.
        raise HTTPException(
            status_code=404,
            detail="This asset is hosted externally; nothing to serve here.",
        )

    try:
        path, content_type = media_store.load(stored_path)
    except media_store.MediaRejected as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    return FileResponse(
        path,
        media_type=content_type,
        headers={
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
            # An admin may replace the file for the same id, so a cached copy
            # would be a stale image with no way to see the new one.
            "Cache-Control": "private, max-age=0, must-revalidate",
        },
    )
