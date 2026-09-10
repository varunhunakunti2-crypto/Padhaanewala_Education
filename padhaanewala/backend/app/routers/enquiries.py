from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Enquiry
from app.schemas.catalog import EnquiryCreate, EnquiryResponse

router = APIRouter(prefix="/api/v1/enquiries", tags=["enquiries"])


@router.post("", response_model=EnquiryResponse, status_code=201)
def submit_enquiry(payload: EnquiryCreate, db: Session = Depends(get_db)) -> EnquiryResponse:
    enquiry = Enquiry(**payload.model_dump(), status="new")
    db.add(enquiry)
    db.commit()
    db.refresh(enquiry)
    return enquiry