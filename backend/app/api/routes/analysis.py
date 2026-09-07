"""Deepfake / synthetic speech analysis endpoints.

Flow: preprocess (audio routes) -> POST deepfake -> DEEPFAKE_ANALYZED.
Handlers are thin; all orchestration lives in ``analysis_service``.
"""

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.enums import AudioAnalysisStatus
from app.ml import deepfake_model_manager, speaker_verifier_manager
from app.schemas.analysis import (
    AnalysisStatusResponse,
    DeepfakeResultResponse,
    DeepfakeRunResponse,
)
from app.schemas.speaker import SpeakerResultResponse, SpeakerVerifyResponse
from app.services import analysis_service, speaker_service

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.get("/status", response_model=AnalysisStatusResponse)
def analysis_status() -> AnalysisStatusResponse:
    """Report which analysis capabilities are available.

    State is read from the live model managers, never guessed. Capabilities
    are reported as available only while the underlying model is loaded.
    """
    deepfake_state = deepfake_model_manager.status().state
    speaker_state = speaker_verifier_manager.status().state
    return AnalysisStatusResponse(
        available=True,
        deepfake=deepfake_state == "loaded",
        speaker=speaker_state == "loaded",
        message=(
            "Deepfake detection and speaker verification are available."
            if deepfake_state == "loaded" and speaker_state == "loaded"
            else "One or more analysis models are loading or unavailable."
        ),
    )


@router.post(
    "/{analysis_id}/deepfake",
    response_model=DeepfakeRunResponse,
    status_code=status.HTTP_200_OK,
)
def run_deepfake_analysis(
    analysis_id: uuid.UUID, db: Session = Depends(get_db)
) -> DeepfakeRunResponse:
    """Run the real deepfake detector and store the actual model output."""
    record = analysis_service.run_deepfake_analysis(analysis_id, db)
    return DeepfakeRunResponse(
        analysis_id=str(record.id),
        status=record.status,
        ai_probability=record.ai_probability,
        real_probability=record.real_probability,
        predicted_class=record.deepfake_label,
        model={"name": record.deepfake_model, "version": record.deepfake_model_version},
        device=record.deepfake_device,
        processing_time_seconds=record.deepfake_processing_time,
        message="Deepfake analysis completed successfully",
    )


@router.get(
    "/{analysis_id}/deepfake",
    response_model=DeepfakeResultResponse,
    status_code=status.HTTP_200_OK,
)
def get_deepfake_result(
    analysis_id: uuid.UUID, db: Session = Depends(get_db)
) -> DeepfakeResultResponse:
    """Return the stored deepfake result without running inference."""
    record = analysis_service.get_deepfake_result(analysis_id, db)
    return DeepfakeResultResponse(
        analysis_id=str(record.id),
        status=record.status,
        ai_probability=record.ai_probability,
        real_probability=record.real_probability,
        predicted_class=record.deepfake_label,
        model={"name": record.deepfake_model, "version": record.deepfake_model_version},
        device=record.deepfake_device,
        processing_time_seconds=record.deepfake_processing_time,
        deepfake_error=record.deepfake_error,
    )


@router.post(
    "/{analysis_id}/speaker",
    response_model=SpeakerVerifyResponse,
    status_code=status.HTTP_200_OK,
)
def run_speaker_verification(
    analysis_id: uuid.UUID, db: Session = Depends(get_db)
) -> SpeakerVerifyResponse:
    """Run real speaker verification against the registered profile."""
    record = speaker_service.run_speaker_verification(analysis_id, db)
    active = speaker_service.get_active_profile(db)
    return SpeakerVerifyResponse(
        analysis_id=str(record.id),
        status=record.status,
        speaker_verification_status=record.speaker_verification_status,
        verified=bool(record.speaker_verified),
        similarity_score=record.speaker_similarity,
        speaker_model=record.speaker_model,
        speaker_model_version=record.speaker_model_version,
        speaker_processing_time=record.speaker_processing_time,
        speaker_device=record.speaker_device,
        speaker_error=record.speaker_error,
        reference_profile_id=str(active.id) if active else None,
        reference_name=active.name if active else None,
        message="Speaker verification completed successfully",
    )


@router.get(
    "/{analysis_id}/speaker",
    response_model=SpeakerResultResponse,
    status_code=status.HTTP_200_OK,
)
def get_speaker_result(
    analysis_id: uuid.UUID, db: Session = Depends(get_db)
) -> SpeakerResultResponse:
    """Return the stored speaker result without running inference."""
    record = speaker_service.get_speaker_result(analysis_id, db)
    active = speaker_service.get_active_profile(db)
    return SpeakerResultResponse(
        analysis_id=str(record.id),
        status=record.status,
        verified=record.speaker_verified,
        similarity_score=record.speaker_similarity,
        speaker_verification_status=record.speaker_verification_status,
        speaker_model=record.speaker_model,
        speaker_model_version=record.speaker_model_version,
        speaker_processing_time=record.speaker_processing_time,
        speaker_device=record.speaker_device,
        speaker_error=record.speaker_error,
        reference_profile_id=str(active.id) if active else None,
        reference_name=active.name if active else None,
    )