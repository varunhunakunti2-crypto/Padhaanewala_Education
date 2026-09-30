from datetime import date, datetime

from pydantic import BaseModel, Field

CONSENT_TYPES = {
    "marketing",
    "analytics",
    "personal_data",
    "terms",
    "privacy",
    "proctoring",
    "whatsapp",
}

LEAD_STATUSES = {"new", "contacted", "qualified", "proposal", "won", "lost", "closed"}


class ConsentCreate(BaseModel):
    consent_type: str = Field(min_length=2, max_length=50)
    consent_version: str | None = Field(default=None, max_length=20)
    consent_text: str = Field(min_length=1, max_length=2000)
    granted: bool = True


class ConsentUpdate(BaseModel):
    granted: bool


class ConsentResponse(BaseModel):
    id: int
    consent_type: str
    consent_version: str | None
    consent_text: str
    granted: bool
    ip_address: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class LeadListItem(BaseModel):
    id: int
    name: str
    mobile: str
    email: str | None
    course_name: str | None
    college_name: str | None
    state_name: str | None
    city: str | None
    qualification: str | None
    message: str | None
    source: str | None
    status: str
    assigned_counsellor: str | None
    follow_up_date: date | None
    created_at: datetime


class LeadNoteResponse(BaseModel):
    id: int
    note: str
    created_at: datetime

    model_config = {"from_attributes": True}


class LeadStatusHistoryResponse(BaseModel):
    id: int
    old_status: str | None
    new_status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class LeadDetailResponse(LeadListItem):
    notes: list[LeadNoteResponse] = []
    status_history: list[LeadStatusHistoryResponse] = []


class AddLeadNoteRequest(BaseModel):
    note: str = Field(min_length=1, max_length=2000)


class UpdateLeadStatusRequest(BaseModel):
    status: str = Field(min_length=1, max_length=30)


class AssignLeadRequest(BaseModel):
    counsellor_id: int | None = None


class SetFollowUpRequest(BaseModel):
    follow_up_date: date | None = None