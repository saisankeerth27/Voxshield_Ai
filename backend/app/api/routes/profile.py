"""Speaker profile registration endpoints.

POST /profile registers a reference recording and replaces any existing
voiceprint. GET /profile lists the stored profile (metadata only - the
embedding is never returned). DELETE deletes the profile and its bytes.

Handlers are thin; orchestration lives in ``speaker_service``.
"""

import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.profile import (
    SpeakerProfileDeleteResponse,
    SpeakerProfileListResponse,
    SpeakerProfileResponse,
    SpeakerProfileStatusResponse,
)
from app.services import speaker_service

router = APIRouter(prefix="/profile", tags=["profile"])


def _to_response(profile) -> SpeakerProfileResponse:
    return SpeakerProfileResponse(
        profile_id=str(profile.id),
        name=profile.name,
        embedding_dim=profile.embedding_dim,
        model_name=profile.model_name,
        model_version=profile.model_version,
        device=profile.device,
        sample_rate=profile.sample_rate,
        duration_seconds=profile.duration_seconds,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.post(
    "",
    response_model=SpeakerProfileResponse,
    status_code=status.HTTP_200_OK,
)
def create_speaker_profile(
    speaker_name: str | None = Form(default=None),
    reference_audio: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
) -> SpeakerProfileResponse:
    """Register (or replace) the speaker profile from a reference recording."""
    profile = speaker_service.register_speaker_profile(speaker_name, reference_audio, db)
    return _to_response(profile)


@router.get("", response_model=SpeakerProfileListResponse)
def list_speaker_profiles(db: Session = Depends(get_db)) -> SpeakerProfileListResponse:
    """Return stored profile metadata (the embedding is never exposed)."""
    profiles = speaker_service.list_speaker_profiles(db)
    return SpeakerProfileListResponse(
        items=[_to_response(item) for item in profiles],
        count=len(profiles),
        has_profile=len(profiles) > 0,
    )


@router.get("/status", response_model=SpeakerProfileStatusResponse)
def profile_status(db: Session = Depends(get_db)) -> SpeakerProfileStatusResponse:
    """Report the currently registered profile (or availability)."""
    profile = speaker_service.get_active_profile(db)
    if profile is None:
        return SpeakerProfileStatusResponse(
            available=True,
            has_profile=False,
            profile=None,
            message="No speaker profile registered.",
        )
    return SpeakerProfileStatusResponse(
        available=True,
        has_profile=True,
        profile=_to_response(profile),
        message="Speaker profile is registered.",
    )


@router.delete(
    "/{profile_id}",
    response_model=SpeakerProfileDeleteResponse,
    status_code=status.HTTP_200_OK,
)
def delete_speaker_profile(
    profile_id: uuid.UUID, db: Session = Depends(get_db)
) -> SpeakerProfileDeleteResponse:
    """Delete a profile and its stored voiceprint bytes."""
    speaker_service.delete_speaker_profile(profile_id, db)
    return SpeakerProfileDeleteResponse(
        success=True,
        message="Speaker profile deleted.",
    )