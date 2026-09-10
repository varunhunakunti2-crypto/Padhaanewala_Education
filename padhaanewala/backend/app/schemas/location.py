from datetime import datetime

from pydantic import BaseModel, Field


class StateBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    code: str = Field(..., min_length=2, max_length=10)
    is_union_territory: bool = False
    is_active: bool = True


class StateCreate(StateBase):
    pass


class StateUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    code: str | None = Field(None, min_length=2, max_length=10)
    is_union_territory: bool | None = None
    is_active: bool | None = None


class StateResponse(StateBase):
    id: int
    district_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class DistrictBase(BaseModel):
    state_id: int
    name: str = Field(..., min_length=2, max_length=100)
    code: str = Field(..., min_length=1, max_length=10)


class DistrictCreate(DistrictBase):
    pass


class DistrictUpdate(BaseModel):
    state_id: int | None = None
    name: str | None = Field(None, min_length=2, max_length=100)
    code: str | None = Field(None, min_length=1, max_length=10)


class DistrictResponse(DistrictBase):
    id: int
    city_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class CityBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    district_id: int
    is_metropolitan: bool = False


class CityCreate(CityBase):
    pass


class CityUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=100)
    district_id: int | None = None
    is_metropolitan: bool | None = None


class CityResponse(CityBase):
    id: int
    district_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UniversityBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    slug: str = Field(
        ...,
        min_length=2,
        max_length=255,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    )
    state_id: int | None = None
    city: str | None = Field(None, max_length=100)
    type: str = Field("university", max_length=50)
    is_deemed: bool = False
    website: str | None = Field(None, max_length=255)
    is_active: bool = True


class UniversityCreate(UniversityBase):
    pass


class UniversityUpdate(BaseModel):
    name: str | None = Field(None, min_length=2, max_length=255)
    slug: str | None = Field(
        None,
        min_length=2,
        max_length=255,
        pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$",
    )
    state_id: int | None = None
    city: str | None = Field(None, max_length=100)
    type: str | None = Field(None, max_length=50)
    is_deemed: bool | None = None
    website: str | None = Field(None, max_length=255)
    is_active: bool | None = None


class UniversityResponse(UniversityBase):
    id: int
    state_name: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}