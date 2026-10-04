from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_role
from app.models import SeoMetadata, User
from app.schemas.content import SeoMetadataResponse, SeoMetadataUpsert
from app.utils import audit

router = APIRouter(prefix="/api/v1/seo", tags=["seo"])

from app.roles import SEO_ROLES

def _to_response(seo: SeoMetadata) -> SeoMetadataResponse:
    return SeoMetadataResponse(
        id=seo.id,
        entity_type=seo.entity_type,
        entity_id=seo.entity_id,
        meta_title=seo.meta_title,
        meta_description=seo.meta_description,
        og_title=seo.og_title,
        og_description=seo.og_description,
        og_image_url=seo.og_image_url,
        structured_data=seo.structured_data,
        canonical_url=seo.canonical_url,
        updated_at=seo.updated_at,
    )

@router.get("", response_model=list[SeoMetadataResponse])
def list_seo(
    entity_type: str | None = Query(None, max_length=50),
    entity_id: int | None = None,
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    # SEO rows carry draft/unpublished metadata and structured data for every
    # entity. This was previously an unauthenticated full-table dump with no
    # pagination, so it is now restricted to the same roles that can write it.
    _=Depends(require_role(*SEO_ROLES)),
    db: Session = Depends(get_db),
):
    query = select(SeoMetadata)
    if entity_type:
        query = query.where(SeoMetadata.entity_type == entity_type)
    if entity_id is not None:
        query = query.where(SeoMetadata.entity_id == entity_id)
    return [
        _to_response(s)
        for s in db.scalars(
            query.order_by(SeoMetadata.entity_type).limit(limit).offset(offset)
        ).all()
    ]


@router.get("/{entity_type}/{entity_id}", response_model=SeoMetadataResponse)
def get_seo(
    entity_type: str,
    entity_id: int,
    _=Depends(require_role(*SEO_ROLES)),
    db: Session = Depends(get_db),
):
    seo = db.scalar(
        select(SeoMetadata).where(
            SeoMetadata.entity_type == entity_type, SeoMetadata.entity_id == entity_id
        )
    )
    if seo is None:
        raise HTTPException(status_code=404, detail="SEO metadata not found")
    return _to_response(seo)

@router.put(
    "/{entity_type}/{entity_id}",
    response_model=SeoMetadataResponse,
    dependencies=[Depends(require_role(*SEO_ROLES))],
)
def upsert_seo(
    entity_type: str,
    entity_id: int,
    payload: SeoMetadataUpsert,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*SEO_ROLES)),
):
    seo = db.scalar(
        select(SeoMetadata).where(
            SeoMetadata.entity_type == entity_type, SeoMetadata.entity_id == entity_id
        )
    )
    if seo is None:
        seo = SeoMetadata(
            entity_type=entity_type, entity_id=entity_id, **payload.model_dump()
        )
        db.add(seo)
        # 4.4 — this PUT is an upsert, so which branch ran is itself the
        # change: a fresh row is flushed for its id and logged whole, as
        # `create_college` does.
        db.flush()
        old_value = None
        new_value = payload.model_dump()
    else:
        data = payload.model_dump(exclude_unset=True)
        # 4.4 — old values read before the `setattr` loop, so the row
        # describes the edit and not its result; the console prefills from the
        # record, so only what the caller actually sent belongs in the diff.
        old_value = {field: getattr(seo, field) for field in data}
        new_value = data
        for field, value in data.items():
            setattr(seo, field, value)

    audit.record(
        db,
        request=request,
        action="upsert_seo",
        entity_type="seo",
        entity_id=seo.id,
        actor=user,
        old_value=old_value,
        new_value=new_value,
    )
    db.commit()
    db.refresh(seo)
    return _to_response(seo)

@router.delete(
    "/{entity_type}/{entity_id}",
    status_code=204,
    dependencies=[Depends(require_role(*SEO_ROLES))],
)
def delete_seo(
    entity_type: str,
    entity_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(*SEO_ROLES)),
):
    seo = db.scalar(
        select(SeoMetadata).where(
            SeoMetadata.entity_type == entity_type, SeoMetadata.entity_id == entity_id
        )
    )
    if seo is None:
        raise HTTPException(status_code=404, detail="SEO metadata not found")
    # 4.4 — whose metadata this was, read while the row still exists; after
    # `db.delete` there is nothing left to ask. The row's own `entity_type` /
    # `entity_id` name the target, which is why they appear inside `old_value`.
    audit.record(
        db,
        request=request,
        action="delete_seo",
        entity_type="seo",
        entity_id=seo.id,
        actor=user,
        old_value={
            "entity_type": seo.entity_type,
            "entity_id": seo.entity_id,
            "meta_title": seo.meta_title,
        },
    )
    db.delete(seo)
    db.commit()