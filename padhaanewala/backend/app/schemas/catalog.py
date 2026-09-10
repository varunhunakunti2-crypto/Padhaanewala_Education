from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field


class StateResponse(BaseModel):
    id: int
    name: str
    code: str
    is_union_territory: bool

    model_config = {"from_attributes": True}


class DistrictResponse(BaseModel):
    id: int
    name: str
    code: str
    state_id: int

    model_config = {"from_attributes": True}


class CityResponse(BaseModel):
    id: int
    name: str
    district_id: int
    is_metropolitan: bool

    model_config = {"from_attributes": True}


class UniversityResponse(BaseModel):
    id: int
    name: str
    slug: str
    state_id: int | None
    city: str | None
    type: str
    is_deemed: bool
    website: str | None

    model_config = {"from_attributes": True}


class CollegeCourseResponse(BaseModel):
    id: int
    course_id: int
    course_name: str | None = None
    annual_fee: Decimal | None
    total_fee: Decimal | None
    intake_seats: int | None
    admission_mode: str | None
    entrance_exam: str | None

    model_config = {"from_attributes": True}


class CollegeListItemResponse(BaseModel):
    id: int
    college_id: str
    name: str
    slug: str
    college_type: str | None
    ownership: str | None
    city: str | None
    state: str | None = None
    university_name: str | None = None
    has_hostel: bool | None
    total_reviews: int
    average_rating: Decimal
    is_featured: bool

    model_config = {"from_attributes": True}


class CollegeDetailResponse(CollegeListItemResponse):
    official_name: str | None
    address: str | None
    pincode: str | None
    lat: Decimal | None
    lng: Decimal | None
    website: str | None
    email: str | None
    phone: str | None
    established_year: int | None
    accreditation_naac: str | None
    accreditation_nba: bool | None
    overview: str | None
    facilities: dict | None
    state_id: int | None
    district_id: int | None
    university_id: int | None
    courses: list[CollegeCourseResponse] = []

    model_config = {"from_attributes": True}


class CourseResponse(BaseModel):
    id: int
    name: str
    slug: str
    degree: str | None
    duration: str | None
    category: str | None

    model_config = {"from_attributes": True}


class SearchResult(BaseModel):
    colleges: list[CollegeListItemResponse] = []
    courses: list[CourseResponse] = []


class CollegeCourseCreate(BaseModel):
    course_id: int
    annual_fee: Decimal | None = None
    total_fee: Decimal | None = None
    intake_seats: int | None = None
    admission_mode: str | None = None
    entrance_exam: str | None = None


class CollegeCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    official_name: str | None = None
    college_type: str | None = None
    ownership: str | None = None
    university_id: int | None = None
    state_id: int | None = None
    district_id: int | None = None
    city: str | None = None
    address: str | None = None
    pincode: str | None = None
    lat: Decimal | None = None
    lng: Decimal | None = None
    website: str | None = None
    email: str | None = None
    phone: str | None = None
    established_year: int | None = None
    accreditation_naac: str | None = None
    overview: str | None = None
    facilities: dict[str, Any] | None = None
    has_hostel: bool | None = None
    courses: list[CollegeCourseCreate] = []


class CollegeUpdate(BaseModel):
    name: str | None = None
    official_name: str | None = None
    college_type: str | None = None
    ownership: str | None = None
    university_id: int | None = None
    state_id: int | None = None
    district_id: int | None = None
    city: str | None = None
    address: str | None = None
    pincode: str | None = None
    lat: Decimal | None = None
    lng: Decimal | None = None
    website: str | None = None
    email: str | None = None
    phone: str | None = None
    established_year: int | None = None
    accreditation_naac: str | None = None
    overview: str | None = None
    facilities: dict[str, Any] | None = None
    has_hostel: bool | None = None
    is_active: bool | None = None
    is_featured: bool | None = None


class ScholarshipResponse(BaseModel):
    id: int
    name: str
    slug: str
    provider: str
    ownership: str
    eligibility: str | None
    state_id: int | None
    state_name: str | None = None
    course: str | None
    category: str | None
    income_criteria: str | None
    amount: str | None
    application_deadline: date | None
    documents_required: list | None
    application_procedure: str | None
    official_website: str | None
    verification_status: str
    last_verified_date: date | None
    next_verification_date: date | None
    is_active: bool

    model_config = {"from_attributes": True}


class ExamResponse(BaseModel):
    id: int
    name: str
    slug: str
    conducting_authority: str
    exam_type: str
    eligibility: str | None
    application_start_date: date | None
    application_deadline: date | None
    exam_date: date | None
    admit_card_date: date | None
    result_date: date | None
    official_website: str | None
    official_notification: str | None
    syllabus: dict | None
    faqs: list | None
    is_active: bool

    model_config = {"from_attributes": True}