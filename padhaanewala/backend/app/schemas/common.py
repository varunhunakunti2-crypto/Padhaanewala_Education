from typing import Any

from pydantic import BaseModel


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Any = None


class StandardError(BaseModel):
    success: bool = False
    error: ErrorDetail
    request_id: str | None = None


class StandardResponse(BaseModel):
    success: bool = True
    data: Any = None
    message: str | None = None