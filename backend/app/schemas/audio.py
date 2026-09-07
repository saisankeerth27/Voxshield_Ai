"""Pydantic schemas for audio upload and analysis records.

Response models are intentionally separate from the SQLAlchemy models so
the API contract can evolve without changing storage.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.enums import AudioAnalysisStatus


class AudioUploadResponse(BaseModel):
    """Returned after a successful audio upload."""

    success: bool
    analysis_id: str
    filename: str
    status: AudioAnalysisStatus
    message: str


class AudioAnalysisResponse(BaseModel):
    """Metadata for a single audio analysis record."""

    analysis_id: str
    filename: str
    file_size: int
    mime_type: str | None
    duration_seconds: float | None
    status: str
    original_sample_rate: int | None
    original_channels: int | None
    processed_sample_rate: int | None
    processed_channels: int | None
    processed_duration_seconds: float | None
    processed_filename: str | None
    preprocessing_error: str | None
    ai_probability: float | None
    real_probability: float | None
    deepfake_label: str | None
    deepfake_model: str | None
    deepfake_model_version: str | None
    deepfake_processing_time: float | None
    deepfake_device: str | None
    deepfake_error: str | None
    created_at: datetime
    updated_at: datetime


class AudioMetadataBrief(BaseModel):
    """Optional media summary used in preprocessing responses."""

    sample_rate: int | None = None
    channels: int | None = None
    duration_seconds: float | None = None


class AudioPreprocessResponse(BaseModel):
    """Returned after a successful preprocessing run."""

    success: bool
    analysis_id: str
    status: AudioAnalysisStatus
    audio: AudioMetadataBrief
    message: str


class PreprocessStatusResponse(BaseModel):
    """Metadata returned by GET preprocessing status."""

    analysis_id: str
    status: AudioAnalysisStatus
    original: AudioMetadataBrief
    processed: AudioMetadataBrief
    preprocessing_error: str | None = None


class AudioListItemResponse(BaseModel):
    """Concise record for list views (dashboard / history)."""

    analysis_id: str
    filename: str
    file_size: int
    status: str
    created_at: datetime


class AudioListResponse(BaseModel):
    """Paginated list of audio analysis records."""

    items: list[AudioListItemResponse]
    page: int
    limit: int
    total: int


class AudioDeleteResponse(BaseModel):
    """Returned after deleting an audio analysis record."""

    success: bool
    message: str