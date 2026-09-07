"""Schemas for deepfake / synthetic speech analysis endpoints."""

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.enums import AudioAnalysisStatus


class DeepfakeRunResponse(BaseModel):
    """Returned after a deepfake inference run."""

    analysis_id: str
    status: AudioAnalysisStatus
    ai_probability: float
    real_probability: float
    predicted_class: str
    model: dict[str, str | None]
    device: str
    processing_time_seconds: float
    message: str


class DeepfakeResultResponse(BaseModel):
    """Returned by GET deepfake result regardless of analysis state."""

    analysis_id: str
    status: AudioAnalysisStatus
    ai_probability: float | None = None
    real_probability: float | None = None
    predicted_class: str | None = None
    model: dict[str, str | None]
    device: str | None = None
    processing_time_seconds: float | None = None
    deepfake_error: str | None = None


class AnalysisStatusResponse(BaseModel):
    """Overall analysis availability probe."""

    available: bool
    deepfake: bool
    speaker: bool
    message: str


class AnalysisRecordResponse(BaseModel):
    """ID reference used by list/status endpoints."""

    analysis_id: uuid.UUID
    created_at: datetime
    status: AudioAnalysisStatus