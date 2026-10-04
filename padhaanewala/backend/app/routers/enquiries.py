from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_optional_current_user, require_role
from app.models import Enquiry, StudentProfile, User
from app.roles import ADMIN_ROLES
from app.schemas.catalog import EnquiryCreate, EnquiryResponse
from app.services.lead_handoff import promote_enquiry_to_lead
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
    # Phase 25 — an enquiry is not a lead until somebody owns it. Committed
    # first so the hand-off can never cost us the captured enquiry.
    promote_enquiry_to_lead(db, enquiry)
    return enquiry


@router.get("", response_model=list[EnquiryResponse])
def list_enquiries(
    status: str | None = None,
    search: str | None = Query(None, max_length=255),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _: object = Depends(require_role(*ADMIN_ROLES)),
    db: Session = Depends(get_db),
) -> list[EnquiryResponse]:
    """Raw enquiry feed, for the admin console's enquiry view.

    Deliberately separate from `GET /api/v1/leads`: leads rescopes the same rows
    into a CRM view (counsellor name, follow-up date, notes) and hides
    everything a counsellor is not assigned. This is the unfiltered
    submission log, so it stays admin-only.
    """
    query = select(Enquiry).order_by(Enquiry.created_at.desc())
    if status:
        query = query.where(Enquiry.status == status)
    if search:
        term = f"%{search.strip()}%"
        query = query.where(
            or_(Enquiry.name.ilike(term), Enquiry.mobile.ilike(term))
        )
    return db.scalars(query.limit(limit).offset(offset)).all()
