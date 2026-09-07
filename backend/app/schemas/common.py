"""Shared Pydantic schemas for common API responses."""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Response for the /health endpoint."""

    status: str
    deepfake_model: str | None = None
    model_name: str | None = None
    model_device: str | None = None


class ErrorDetail(BaseModel):
    """Standard error envelope body used by the exception handlers."""

    code: str
    message: str


class ErrorResponse(BaseModel):
    """Standard error envelope returned by the exception handlers."""

    error: ErrorDetail
