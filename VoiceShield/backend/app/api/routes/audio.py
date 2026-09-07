"""Audio upload and analysis record endpoints.

All business logic lives in ``app.services.audio_service``; these handlers
only translate HTTP requests into service calls and responses.
"""

import uuid

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.audio import (
    AudioAnalysisResponse,
    AudioDeleteResponse,
    AudioListItemResponse,
    AudioListResponse,
    AudioUploadResponse,
)
from app.services import audio_service

router = APIRouter(prefix="/audio", tags=["audio"])


@router.post(
    "/upload",
    response_model=AudioUploadResponse,
    status_code=status.HTTP_200_OK,
)
def upload_audio(
    file: UploadFile = File(...), db: Session = Depends(get_db)
) -> AudioUploadResponse:
    """Upload, validate, store, and record an audio file."""
    record = audio_service.save_audio_upload(file, db)
    return AudioUploadResponse(
        success=True,
        analysis_id=str(record.id),
        filename=record.original_filename,
        status=record.status,
        message="Audio uploaded successfully",
    )


@router.get("", response_model=AudioListResponse, status_code=status.HTTP_200_OK)
def list_audio(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
) -> AudioListResponse:
    """Paginated list of uploaded analysis records (newest first)."""
    records, total = audio_service.list_audio_analyses(db, page, limit)
    items = [
        AudioListItemResponse(
            analysis_id=str(record.id),
            filename=record.original_filename,
            file_size=record.file_size,
            status=record.status.value,
            created_at=record.created_at,
        )
        for record in records
    ]
    return AudioListResponse(items=items, page=page, limit=limit, total=total)


@router.get(
    "/{analysis_id}",
    response_model=AudioAnalysisResponse,
    status_code=status.HTTP_200_OK,
)
def get_audio(
    analysis_id: uuid.UUID, db: Session = Depends(get_db)
) -> AudioAnalysisResponse:
    """Return metadata for a single analysis. Never returns raw audio."""
    record = audio_service.get_audio_analysis(analysis_id, db)
    return AudioAnalysisResponse(
        analysis_id=str(record.id),
        filename=record.original_filename,
        file_size=record.file_size,
        mime_type=record.mime_type,
        duration_seconds=record.duration_seconds,
        status=record.status.value,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


@router.delete(
    "/{analysis_id}",
    response_model=AudioDeleteResponse,
    status_code=status.HTTP_200_OK,
)
def delete_audio(
    analysis_id: uuid.UUID, db: Session = Depends(get_db)
) -> AudioDeleteResponse:
    """Delete an analysis record and its temporarily stored audio file."""
    audio_service.delete_audio_analysis(analysis_id, db)
    return AudioDeleteResponse(
        success=True,
        message="Audio analysis deleted successfully",
    )