"""Pydantic schemas for speaker profile registration.

The embedding itself is NEVER serialized here - only metadata, so the
voiceprint cannot be exfiltrated via the API.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel


class SpeakerProfileResponse(BaseModel):
    """Public view of a registered speaker profile (no embedding data)."""

    profile_id: str
    name: str
    embedding_dim: int
    model_name: str
    model_version: str
    device: str | None
    sample_rate: int
    duration_seconds: float
    created_at: datetime
    updated_at: datetime


class SpeakerProfileListResponse(BaseModel):
    """All active profiles."""

    items: list[SpeakerProfileResponse]
    count: int
    has_profile: bool


class SpeakerProfileStatusResponse(BaseModel):
    """Availability probe for the profile feature."""

    available: bool
    has_profile: bool
    profile: SpeakerProfileResponse | None = None
    message: str


class SpeakerProfileDeleteResponse(BaseModel):
    """Returned after a profile (and its voiceprint) is deleted."""

    success: bool
    message: str