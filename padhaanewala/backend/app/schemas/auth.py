from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.common import TokenResponse


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    mobile: str = Field(..., min_length=10, max_length=15)
    password: str = Field(..., min_length=8, max_length=128)

    # Phase 9.1. Required, with no default, because this is the one field that
    # decides whether DPDP s.9 applies to everything else the account will hold.
    #
    # It is an age *band* rather than a date of birth: the only question s.9
    # turns on is whether the user is under 18, and s.5(1)(ii) requires collecting
    # no more than is necessary for that. A full date of birth is strictly more
    # identifying, outlives every retention sweep that erases the derived flag,
    # and is a standing target for an identity thief.
    #
    # No default on purpose. An optional field with a default would let an account
    # exist whose age is unknown, and "unknown" would then have to be treated as
    # either adult or blocked — and the first of those is the failure this phase
    # exists to close.
    age_band: Literal["under_18", "18_plus"]

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower() if isinstance(value, str) else value

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

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower() if isinstance(value, str) else value


class RefreshRequest(BaseModel):
    # Optional since Phase 3: the refresh token normally rides in an HttpOnly
    # cookie, in which case the body is `{}`. The body field covers native
    # clients and an explicit token winning over an ambient cookie.
    refresh_token: str | None = Field(default=None, min_length=20)


class LogoutRequest(BaseModel):
    refresh_token: str | None = Field(default=None, min_length=20)


# --------------------------------------------------------------- Phase 3: OTP
# The mobile validator is shared with RegisterRequest rather than repeated, so a
# number accepted at signup is a number the OTP endpoints will also accept.


def _validate_mobile(value: str) -> str:
    digits = "".join(ch for ch in value if ch.isdigit())
    if not digits.startswith(("6", "7", "8", "9")) or len(digits) != 10:
        raise ValueError("Mobile must be a valid 10-digit Indian number")
    return digits


class MobileOtpSendRequest(BaseModel):
    """Body for requesting a login OTP against a mobile number."""

    mobile: str = Field(..., min_length=10, max_length=15)

    @field_validator("mobile")
    @classmethod
    def check_mobile(cls, value: str) -> str:
        return _validate_mobile(value)


class MobileOtpVerifyRequest(BaseModel):
    mobile: str = Field(..., min_length=10, max_length=15)
    otp: str = Field(..., min_length=4, max_length=10, pattern=r"^[0-9]+$")

    @field_validator("mobile")
    @classmethod
    def check_mobile(cls, value: str) -> str:
        return _validate_mobile(value)


class VerifyEmailRequest(BaseModel):
    token: str = Field(..., min_length=20, max_length=200)


class ResendVerificationRequest(BaseModel):
    email: EmailStr

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower() if isinstance(value, str) else value


class ForgotPasswordRequest(BaseModel):
    email: EmailStr

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower() if isinstance(value, str) else value


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=20, max_length=200)
    new_password: str = Field(..., min_length=8, max_length=128)


class OtpChallengeResponse(BaseModel):
    """Acknowledge a send without revealing whether the account exists.

    `expires_in_seconds` is the only genuinely useful fact for the caller, and
    it is constant across all responses on a given endpoint so it cannot be used
    to distinguish a registered number from an unregistered one.
    """

    success: bool = True
    message: str
    expires_in_seconds: int



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


class RoleResponse(BaseModel):
    id: int
    name: str
    description: str | None = None

    model_config = {"from_attributes": True}


class AdminRoleResponse(RoleResponse):
    """`RoleResponse` plus whether *this* caller may grant the role.

    The privilege ceiling (R4.8) is enforced in `PATCH /users/{id}` by
    `roles.exceeds_ceiling`. Recomputing it in the frontend would mean a second
    implementation of the ordering in `PRIVILEGE_ORDER`, which is precisely how
    the two drift apart — and the failure mode is a UI that offers a button the
    API will reject with a 403. So the server, which holds the authoritative
    ordering, states per role whether the caller may grant it, using the same
    `outranks()` call the write path uses.
    """

    grantable: bool = False


class UserRolesResponse(BaseModel):
    roles: list[str]


class AdminUpdateUserRequest(BaseModel):
    is_active: bool | None = None
    role_ids: list[int] | None = None


class UserAdminResponse(BaseModel):
    id: int
    email: EmailStr
    mobile: str
    is_active: bool
    is_email_verified: bool
    is_mobile_verified: bool
    created_at: datetime
    last_login_at: datetime | None
    roles: list[str]
    #: `User.display_name` — the student profile's name, falling back to the
    #: email. The admin console used to render `email.split("@")[0]` as the
    #: person's name, which is a truncation of an address rather than a name.
    display_name: str


class UserAdminListResponse(BaseModel):
    """A page of users plus the unpaged total.

    `GET /users` returned a bare `list[...]`, so the console could not tell
    "50 users" from "50 users, out of many more" — it requested no limit at all
    and rendered whatever arrived, so an admin managing more than 50 accounts
    had no indication that the rest existed. `total` counts the *filtered* set,
    not the page.
    """

    items: list[UserAdminResponse]
    total: int
    limit: int
    offset: int
