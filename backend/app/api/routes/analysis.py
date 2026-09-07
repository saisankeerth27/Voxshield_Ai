"""Deepfake / synthetic speech analysis endpoints.

Flow: preprocess (audio routes) -> POST deepfake -> DEEPFAKE_ANALYZED.
Handlers are thin; all orchestration lives in ``analysis_service``.
"""

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.enums import AudioAnalysisStatus
from app.ml import deepfake_model_manager
from app.schemas.analysis import (
    AnalysisStatusResponse,
    DeepfakeResultResponse,
    DeepfakeRunResponse,
)
from app.services import analysis_service

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.get("/status", response_model=AnalysisStatusResponse)
def analysis_status() -> AnalysisStatusResponse:
    """Report which analysis capabilities are available.

    State is read from the live model manager, never guessed. The deepfake
    capability is reported as available only while the model is loaded.
    """
    model_state = deepfake_model_manager.status().state
    return AnalysisStatusResponse(
        available=True,
        deepfake=model_state == "loaded",
        message=(
            "Deepfake detection is available."
            if model_state == "loaded"
            else "Deepfake detection model is loading or unavailable."
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