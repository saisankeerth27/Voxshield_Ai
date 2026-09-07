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
    created_at: datetime
    updated_at: datetime


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