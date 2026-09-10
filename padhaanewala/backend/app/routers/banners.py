from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_role
from app.models import Banner
from app.schemas.content import BannerCreate, BannerResponse, BannerUpdate

router = APIRouter(prefix="/api/v1/banners", tags=["banners"])

CONTENT_ROLES = ("admin", "super_admin", "content_manager")


def _to_response(banner: Banner) -> BannerResponse:
    return BannerResponse(
        id=banner.id,
        title=banner.title,
        image_url=banner.image_url,
        link_url=banner.link_url,
        position=banner.position,
        display_order=banner.display_order,
        is_active=banner.is_active,
        start_date=banner.start_date,
        end_date=banner.end_date,
        created_at=banner.created_at,
    )


def _is_visible(banner: Banner) -> bool:
    today = date.today()
    if banner.start_date and banner.start_date > today:
        return False
    if banner.end_date and banner.end_date < today:
        return False
    return True


@router.get("", response_model=list[BannerResponse])
def list_banners(
    position: str | None = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
):
    query = select(Banner)
    if position:
        query = query.where(Banner.position == position)
    if not include_inactive:
        query = query.where(Banner.is_active)
    banners = db.scalars(
        query.order_by(Banner.position, Banner.display_order)
    ).all()
    result = [
        _to_response(b) for b in banners if include_inactive or _is_visible(b)
    ]
    return result


@router.get("/{banner_id}", response_model=BannerResponse)
def get_banner(banner_id: int, db: Session = Depends(get_db)):
    banner = db.get(Banner, banner_id)
    if banner is None:
        raise HTTPException(status_code=404, detail="Banner not found")
    return _to_response(banner)


@router.post(
    "",
    response_model=BannerResponse,
    status_code=201,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def create_banner(payload: BannerCreate, db: Session = Depends(get_db)):
    banner = Banner(**payload.model_dump())
    db.add(banner)
    db.commit()
    db.refresh(banner)
    return _to_response(banner)


@router.put(
    "/{banner_id}",
    response_model=BannerResponse,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def update_banner(
    banner_id: int, payload: BannerUpdate, db: Session = Depends(get_db)
):
    banner = db.get(Banner, banner_id)
    if banner is None:
        raise HTTPException(status_code=404, detail="Banner not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(banner, field, value)
    db.commit()
    db.refresh(banner)
    return _to_response(banner)


@router.delete(
    "/{banner_id}",
    status_code=204,
    dependencies=[Depends(require_role(*CONTENT_ROLES))],
)
def delete_banner(banner_id: int, db: Session = Depends(get_db)):
    banner = db.get(Banner, banner_id)
    if banner is None:
        raise HTTPException(status_code=404, detail="Banner not found")
    db.delete(banner)
    db.commit()