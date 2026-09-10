from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.common import TokenResponse


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    mobile: str = Field(..., min_length=10, max_length=15)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, value: str) -> str:
        digits = "".join(ch for ch in value if ch.isdigit())
        if not digits.startswith(("6", "7", "8", "9")) or len(digits) != 10:
            raise ValueError("Mobile must be a valid 10-digit Indian number")
        return digits


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=20)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(..., min_length=20)


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    mobile: str
    is_active: bool
    is_email_verified: bool
    is_mobile_verified: bool
    created_at: datetime
    last_login_at: datetime | None

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=255)
    education_level: str | None = Field(None, max_length=100)
    course_interest: str | None = Field(None, max_length=255)
    preferred_state: str | None = Field(None, max_length=100)
    preferred_city: str | None = Field(None, max_length=100)
    budget_min: float | None = Field(None, ge=0)
    budget_max: float | None = Field(None, ge=0)


class ProfileResponse(BaseModel):
    id: int
    email: EmailStr
    mobile: str
    name: str
    education_level: str | None
    course_interest: str | None
    preferred_state: str | None
    preferred_city: str | None
    budget_min: float | None
    budget_max: float | None
    created_at: datetime

    model_config = {"from_attributes": True}


class UpdateProfileResponse(ProfileResponse):
    pass


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)