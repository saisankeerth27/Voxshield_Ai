"""Health check endpoint."""

from fastapi import APIRouter, Request, status

from app.ml import deepfake_model_manager, speaker_verifier_manager
from app.schemas.common import HealthResponse

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
)
def health_check(request: Request) -> HealthResponse:
    """Liveness and model-status probe.

    Both model fields reflect the real manager state; a model is never
    reported as loaded unless loading actually succeeded.
    """
    model_status = deepfake_model_manager.status()
    speaker_status = speaker_verifier_manager.status()
    return HealthResponse(
        status="healthy",
        deepfake_model=model_status.state,
        model_name=model_status.model_name,
        model_device=model_status.device,
        speaker_model=speaker_status.state,
        speaker_model_name=speaker_status.model_name,
        speaker_model_version=speaker_status.model_version,
        speaker_model_device=speaker_status.device,
    )
