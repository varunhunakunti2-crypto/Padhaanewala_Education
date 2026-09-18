from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import ConsentRecord, User
from app.schemas.engagement import (
    CONSENT_TYPES,
    ConsentCreate,
    ConsentResponse,
    ConsentUpdate,
)

router = APIRouter(prefix="/api/v1/consent", tags=["consent"])


@router.get("", response_model=list[ConsentResponse])
def list_my_consents(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.scalars(
        select(ConsentRecord)
        .where(ConsentRecord.user_id == user.id)
        .order_by(ConsentRecord.created_at.desc())
    ).all()


@router.post("", response_model=ConsentResponse, status_code=201)
def record_consent(
    payload: ConsentCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.consent_type not in CONSENT_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported consent type. Allowed: {sorted(CONSENT_TYPES)}",
        )

    record = ConsentRecord(
        user_id=user.id,
        consent_type=payload.consent_type,
        consent_version=payload.consent_version,
        consent_text=payload.consent_text,
        granted=payload.granted,
        ip_address=request.client.host if request.client else None,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.patch("/{consent_id}", response_model=ConsentResponse)
def update_consent(
    consent_id: int,
    payload: ConsentUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.scalar(
        select(ConsentRecord).where(
            ConsentRecord.id == consent_id,
            ConsentRecord.user_id == user.id,
        )
    )
    if record is None:
        raise HTTPException(status_code=404, detail="Consent record not found")
    record.granted = payload.granted
    db.commit()
    db.refresh(record)
    return record