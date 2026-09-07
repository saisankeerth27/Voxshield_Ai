"""Pydantic schemas for the speaker verification endpoints."""

from pydantic import BaseModel


class SpeakerVerifyRequest(BaseModel):
    """Request body for speaker verification of an analyzed file."""

    analysis_id: str


class SpeakerVerifyResponse(BaseModel):
    """Snapshot returned after a verification run."""

    analysis_id: str
    status: str
    speaker_verification_status: str
    verified: bool
    similarity_score: float | None
    speaker_model: str | None
    speaker_model_version: str | None
    speaker_processing_time: float | None
    speaker_device: str | None
    speaker_error: str | None
    reference_profile_id: str | None
    reference_name: str | None
    message: str


class SpeakerResultResponse(BaseModel):
    """Result of a completed speaker verification."""

    analysis_id: str
    status: str
    verified: bool | None
    similarity_score: float | None
    speaker_verification_status: str | None
    speaker_model: str | None
    speaker_model_version: str | None
    speaker_processing_time: float | None
    speaker_device: str | None
    speaker_error: str | None
    reference_profile_id: str | None
    reference_name: str | None