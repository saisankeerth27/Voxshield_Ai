"""Health check endpoint."""

from fastapi import APIRouter, Request, status

from app.ml import deepfake_model_manager
from app.schemas.common import HealthResponse

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
)
def health_check(request: Request) -> HealthResponse:
    """Liveness and model-status probe.

    The deepfake field reflects the real manager state; it is never
    reported as loaded unless loading actually succeeded.
    """
    model_status = deepfake_model_manager.status()
    return HealthResponse(
        status="healthy",
        deepfake_model=model_status.state,
        model_name=model_status.model_name,
        model_device=model_status.device,
    )
