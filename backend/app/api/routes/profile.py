"""Voice profile endpoints (placeholder).

Speaker profile registration and verification are implemented in later
phases.
"""

from fastapi import APIRouter, status

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/status", status_code=status.HTTP_200_OK)
def profile_status() -> dict:
    """Report voice-profile feature availability."""
    return {
        "available": False,
        "message": "Voice profiles are not implemented yet.",
    }
