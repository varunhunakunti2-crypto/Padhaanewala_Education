from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_role
from app.models import Media
from app.schemas.content import MediaCreate, MediaResponse, MediaUpdate

router = APIRouter(prefix="/api/v1/media", tags=["media"])

CONTENT_ROLES = ("admin", "super_admin", "content_manager")


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
    limit: int = 50,
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
def create_media(payload: MediaCreate, db: Session = Depends(get_db)):
    media = Media(**payload.model_dump())
    db.add(media)
    db.commit()
    db.refresh(media)
    return _to_response(media)


@router.put(
    "/{media_id}",
    response_model=MediaResponse,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def update_media(
    media_id: int, payload: MediaUpdate, db: Session = Depends(get_db)
):
    media = db.get(Media, media_id)
    if media is None:
        raise HTTPException(status_code=404, detail="Media not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(media, field, value)
    db.commit()
    db.refresh(media)
    return _to_response(media)


@router.delete(
    "/{media_id}",
    status_code=204,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def delete_media(media_id: int, db: Session = Depends(get_db)):
    media = db.get(Media, media_id)
    if media is None:
        raise HTTPException(status_code=404, detail="Media not found")
    db.delete(media)
    db.commit()