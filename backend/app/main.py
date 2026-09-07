"""VoiceShield backend application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.router import api_router
from app.core.exceptions import register_exception_handlers

logger = logging.getLogger("voiceshield")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown hooks.

    Table creation and the upload directory are prepared at startup. A
    missing database is logged but does not block startup so the API can
    still respond while the database comes online.
    """
    from app.database.database import init_db
    from app.ml import deepfake_model_manager, speaker_verifier_manager
    from app.services.audio_service import (
        _ensure_processed_audio_dir,
        _ensure_upload_dir,
    )

    try:
        init_db()
    except Exception as exc:
        logger.warning("Database initialization failed: %s", exc)
    for prepare in (_ensure_upload_dir, _ensure_processed_audio_dir):
        try:
            prepare()
        except OSError as exc:
            logger.warning("Could not prepare storage directory: %s", exc)

    # Load both models once, off the request path. The managers stay
    # resident and report their state accurately via /health; if loading
    # fails later the API returns 503 instead of a fake result.
    deepfake_model_manager.load_in_background()
    speaker_verifier_manager.load_in_background()

    yield


def create_app() -> FastAPI:
    """Application factory."""
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        lifespan=lifespan,
        description=(
            "VoiceShield - AI-powered voice impersonation and "
            "deepfake voice attack detection system."
        ),
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Exception handlers
    register_exception_handlers(app)

    # API router
    app.include_router(api_router)

    return app


app = create_app()