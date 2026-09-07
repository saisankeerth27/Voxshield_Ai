"""Voice analysis endpoints (placeholder).

Real analysis (deepfake detection, speaker verification, risk fusion) is
implemented in later phases. This module only exposes the route structure.
"""

from fastapi import APIRouter, status

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.get("/status", status_code=status.HTTP_200_OK)
def analysis_status() -> dict:
    """Return analysis pipeline availability.

    Deliberately reports that analysis is not yet available rather than
    fabricating results.
    """
    return {
        "available": False,
        "message": "Voice analysis is not implemented yet.",
    }
