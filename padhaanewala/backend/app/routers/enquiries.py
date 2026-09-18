from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_optional_current_user
from app.models import Enquiry, StudentProfile, User
from app.schemas.catalog import EnquiryCreate, EnquiryResponse

router = APIRouter(prefix="/api/v1/enquiries", tags=["enquiries"])


@router.post("", response_model=EnquiryResponse, status_code=201)
def submit_enquiry(
    payload: EnquiryCreate,
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
    enquiry = Enquiry(**data, status="new")
    db.add(enquiry)
    db.commit()
    db.refresh(enquiry)
    return enquiry