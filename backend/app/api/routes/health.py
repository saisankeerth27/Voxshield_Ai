"""Health check endpoint."""

from fastapi import APIRouter, status

from app.schemas.common import HealthResponse

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
)
def health_check() -> HealthResponse:
    """Simple liveness probe.

    Returns only ``{"status": "healthy"}``. No database or ML model checks
    yet; those are added in later phases.
    """
    return HealthResponse(status="healthy")
