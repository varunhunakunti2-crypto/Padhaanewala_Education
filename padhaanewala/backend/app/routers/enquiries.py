from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_optional_current_user
from app.models import Enquiry, StudentProfile, User
from app.schemas.catalog import EnquiryCreate, EnquiryResponse
from app.utils.client_ip import client_ip

router = APIRouter(prefix="/api/v1/enquiries", tags=["enquiries"])


@router.post("", response_model=EnquiryResponse, status_code=201)
def submit_enquiry(
    payload: EnquiryCreate,
    request: Request,
    user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> EnquiryResponse:
    data = payload.model_dump()
    if user is not None:
        profile = db.scalar(
            select(StudentProfile).where(StudentProfile.user_id == user.id)
        )
        if profile is not None:
            data["student_id"] = profile.id
    # 4.1 — the source IP is the server's to decide. The schema has no ip_address
    # field, so a caller can no longer write arbitrary strings into the CRM;
    # the derived value comes from the connection (honouring X-Forwarded-For
    # only when TRUSTED_PROXY_HOPS describes a real proxy topology).
    data["ip_address"] = client_ip(request)
    enquiry = Enquiry(**data, status="new")
    db.add(enquiry)
    db.commit()
    db.refresh(enquiry)
    return enquiry