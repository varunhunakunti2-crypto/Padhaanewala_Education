from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class CutoffBase(BaseModel):
    course_id: int | None = None
    branch: str | None = Field(default=None, max_length=100)
    exam_name: str = Field(max_length=50)
    year: int
    round: str | None = Field(default=None, max_length=30)
    quota: str | None = Field(default=None, max_length=30)
    category: str = Field(max_length=30)
    opening_rank: int | None = None
    closing_rank: int | None = None
    opening_score: Decimal | None = None
    closing_score: Decimal | None = None
    source: str | None = Field(default=None, max_length=50)
    source_url: str | None = Field(default=None, max_length=255)
    verified_date: date | None = None


class CutoffCreate(CutoffBase):
    pass


class CutoffUpdate(BaseModel):
    course_id: int | None = None
    branch: str | None = Field(default=None, max_length=100)
    exam_name: str | None = Field(default=None, max_length=50)
    year: int | None = None
    round: str | None = Field(default=None, max_length=30)
    quota: str | None = Field(default=None, max_length=30)
    category: str | None = Field(default=None, max_length=30)
    opening_rank: int | None = None
    closing_rank: int | None = None
    opening_score: Decimal | None = None
    closing_score: Decimal | None = None
    source: str | None = Field(default=None, max_length=50)
    source_url: str | None = Field(default=None, max_length=255)
    verified_date: date | None = None


class CutoffResponse(CutoffBase):
    id: int
    college_id: int | None
    college_name: str | None = None
    course_name: str | None = None

    model_config = {"from_attributes": True}


class FeeBase(BaseModel):
    college_course_id: int
    tuition_fee: Decimal | None = None
    hostel_fee: Decimal | None = None
    examination_fee: Decimal | None = None
    other_charges: Decimal | None = None
    total_approximate: Decimal | None = None
    fee_period: str | None = Field(default=None, max_length=50)
    academic_year: str = Field(max_length=20)
    is_approximate: bool = True


class FeeCreate(FeeBase):
    pass


class FeeUpdate(BaseModel):
    college_course_id: int | None = None
    tuition_fee: Decimal | None = None
    hostel_fee: Decimal | None = None
    examination_fee: Decimal | None = None
    other_charges: Decimal | None = None
    total_approximate: Decimal | None = None
    fee_period: str | None = Field(default=None, max_length=50)
    academic_year: str | None = Field(default=None, max_length=20)
    is_approximate: bool | None = None


class FeeResponse(FeeBase):
    id: int
    course_name: str | None = None

    model_config = {"from_attributes": True}


class PlacementBase(BaseModel):
    course_id: int | None = None
    branch: str | None = Field(default=None, max_length=100)
    academic_year: str = Field(max_length=20)
    total_graduating: int | None = None
    total_placed: int | None = None
    placement_percentage: Decimal | None = None
    students_higher_studies: int | None = None
    median_salary_lpa: Decimal | None = None
    average_salary_lpa: Decimal | None = None
    highest_salary_lpa: Decimal | None = None
    lowest_salary_lpa: Decimal | None = None
    total_recruiters: int | None = None
    top_recruiters: list | None = None
    source: str | None = Field(default=None, max_length=50)
    source_url: str | None = Field(default=None, max_length=255)
    verified_date: date | None = None


class PlacementCreate(PlacementBase):
    pass


class PlacementUpdate(BaseModel):
    course_id: int | None = None
    branch: str | None = Field(default=None, max_length=100)
    academic_year: str | None = Field(default=None, max_length=20)
    total_graduating: int | None = None
    total_placed: int | None = None
    placement_percentage: Decimal | None = None
    students_higher_studies: int | None = None
    median_salary_lpa: Decimal | None = None
    average_salary_lpa: Decimal | None = None
    highest_salary_lpa: Decimal | None = None
    lowest_salary_lpa: Decimal | None = None
    total_recruiters: int | None = None
    top_recruiters: list | None = None
    source: str | None = Field(default=None, max_length=50)
    source_url: str | None = Field(default=None, max_length=255)
    verified_date: date | None = None


class PlacementResponse(PlacementBase):
    id: int
    college_id: int | None
    college_name: str | None = None
    course_name: str | None = None

    model_config = {"from_attributes": True}


class NIRFRankingBase(BaseModel):
    category: str = Field(max_length=50)
    year: int
    rank: int
    score: Decimal | None = None
    rank_change: int | None = None
    state_rank: int | None = None


class NIRFRankingCreate(NIRFRankingBase):
    pass


class NIRFRankingUpdate(BaseModel):
    category: str | None = Field(default=None, max_length=50)
    year: int | None = None
    rank: int | None = None
    score: Decimal | None = None
    rank_change: int | None = None
    state_rank: int | None = None


class NIRFRankingResponse(NIRFRankingBase):
    id: int
    college_id: int | None
    college_name: str | None = None

    model_config = {"from_attributes": True}


class OtherRankingBase(BaseModel):
    ranking_body: str = Field(max_length=100)
    category: str | None = Field(default=None, max_length=50)
    year: int | None = None
    rank: int | None = None


class OtherRankingCreate(OtherRankingBase):
    pass


class OtherRankingUpdate(BaseModel):
    ranking_body: str | None = Field(default=None, max_length=100)
    category: str | None = Field(default=None, max_length=50)
    year: int | None = None
    rank: int | None = None


class OtherRankingResponse(OtherRankingBase):
    id: int
    college_id: int | None
    college_name: str | None = None

    model_config = {"from_attributes": True}


class RankingResponse(BaseModel):
    id: int
    ranking_type: str
    college_id: int | None
    college_name: str | None = None
    ranking_body: str | None = None
    category: str | None = None
    year: int | None = None
    rank: int | None = None
    score: Decimal | None = None
    rank_change: int | None = None
    state_rank: int | None = None


class SeatMatrixBase(BaseModel):
    course_id: int | None = None
    branch: str | None = Field(default=None, max_length=100)
    exam: str | None = Field(default=None, max_length=50)
    total_seats: int | None = None
    general_seats: int | None = None
    obc_seats: int | None = None
    sc_seats: int | None = None
    st_seats: int | None = None
    ews_seats: int | None = None
    pwd_seats: int | None = None
    female_supernumerary: int | None = None
    home_state_quota: int | None = None
    all_india_quota: int | None = None
    management_quota: int | None = None
    year: int
    source: str | None = Field(default=None, max_length=50)


class SeatMatrixCreate(SeatMatrixBase):
    pass


class SeatMatrixUpdate(BaseModel):
    course_id: int | None = None
    branch: str | None = Field(default=None, max_length=100)
    exam: str | None = Field(default=None, max_length=50)
    total_seats: int | None = None
    general_seats: int | None = None
    obc_seats: int | None = None
    sc_seats: int | None = None
    st_seats: int | None = None
    ews_seats: int | None = None
    pwd_seats: int | None = None
    female_supernumerary: int | None = None
    home_state_quota: int | None = None
    all_india_quota: int | None = None
    management_quota: int | None = None
    year: int | None = None
    source: str | None = Field(default=None, max_length=50)


class SeatMatrixResponse(SeatMatrixBase):
    id: int
    college_id: int | None
    college_name: str | None = None
    course_name: str | None = None

    model_config = {"from_attributes": True}


class AdmissionBase(BaseModel):
    college_course_id: int
    admission_information: str | None = None
    eligibility_details: str | None = None
    entrance_exam: str | None = Field(default=None, max_length=100)
    application_start_date: date | None = None
    application_end_date: date | None = None


class AdmissionCreate(AdmissionBase):
    pass


class AdmissionUpdate(BaseModel):
    college_course_id: int | None = None
    admission_information: str | None = None
    eligibility_details: str | None = None
    entrance_exam: str | None = Field(default=None, max_length=100)
    application_start_date: date | None = None
    application_end_date: date | None = None


class AdmissionResponse(AdmissionBase):
    id: int
    course_name: str | None = None

    model_config = {"from_attributes": True}