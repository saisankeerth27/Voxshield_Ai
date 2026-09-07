"""API router aggregation.

All route modules are included here so ``main.py`` stays clean.
"""

from fastapi import APIRouter

from app.api.routes import audio, analysis, profile, health

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(audio.router)
api_router.include_router(analysis.router)
api_router.include_router(profile.router)