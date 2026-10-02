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
    # Phase 9.1 — `is_minor` is derived once, here, from the declared band. A
    # caller cannot set it directly: it is not in the schema, and `extra="forbid"`
    # turns a client-supplied value into a 422 rather than silently ignoring it.
    # A signed-in user's own declaration wins over the form field, because a child
    # cannot make themselves an adult by typing a different value into a public
    # form.
    if user is not None and user.age_band:
        data["age_band"] = user.age_band
        data["is_minor"] = user.is_minor
        if not user.is_minor:
            # An adult account's guardian field is meaningless; keeping it would
            # put a third party's contact details on a lead record for no reason.
            data["guardian_contact"] = None
    else:
        data["is_minor"] = data.get("age_band") == "under_18"
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