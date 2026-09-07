"""Audio upload and analysis record endpoints.

All business logic lives in ``app.services.audio_service``; these handlers
only translate HTTP requests into service calls and responses.
"""

import uuid

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.exceptions import BadRequestError
from app.database.database import get_db
from app.models.enums import AudioSource
from app.schemas.audio import (
    AudioAnalysisResponse,
    AudioDeleteResponse,
    AudioListItemResponse,
    AudioListResponse,
    AudioMetadataBrief,
    AudioPreprocessResponse,
    AudioUploadResponse,
    PreprocessStatusResponse,
)
from app.services import audio_service

router = APIRouter(prefix="/audio", tags=["audio"])


@router.post(
    "/upload",
    response_model=AudioUploadResponse,
    status_code=status.HTTP_200_OK,
)
def upload_audio(
    file: UploadFile = File(...),
    source: str = Form(default="UPLOAD"),
    db: Session = Depends(get_db),
) -> AudioUploadResponse:
    """Upload, validate, store, and record an audio file.

    ``source`` (UPLOAD or MICROPHONE) records where the audio came from so
    the history page can distinguish file uploads from microphone
    recordings without a separate storage table.
    """
    try:
        source_enum = AudioSource(source.strip().upper())
    except ValueError:
        raise BadRequestError(
            "Invalid source. Expected 'UPLOAD' or 'MICROPHONE'."
        ) from None

    record = audio_service.save_audio_upload(file, db, source=source_enum)
    return AudioUploadResponse(
        success=True,
        analysis_id=str(record.id),
        filename=record.original_filename,
        status=record.status,
        message="Audio uploaded successfully",
        source=record.source,
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
            source=record.source,
            file_size=record.file_size,
            status=record.status.value,
            ai_probability=record.ai_probability,
            deepfake_label=record.deepfake_label,
            speaker_verification_status=record.speaker_verification_status,
            speaker_similarity=record.speaker_similarity,
            speaker_verified=record.speaker_verified,
            risk_status=record.risk_status,
            risk_score=record.risk_score,
            risk_level=record.risk_level,
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
        source=record.source,
        file_size=record.file_size,
        mime_type=record.mime_type,
        duration_seconds=record.duration_seconds,
        status=record.status.value,
        original_sample_rate=record.original_sample_rate,
        original_channels=record.original_channels,
        processed_sample_rate=record.processed_sample_rate,
        processed_channels=record.processed_channels,
        processed_duration_seconds=record.processed_duration_seconds,
        processed_filename=record.processed_filename,
        preprocessing_error=record.preprocessing_error,
        ai_probability=record.ai_probability,
        real_probability=record.real_probability,
        deepfake_label=record.deepfake_label,
        deepfake_model=record.deepfake_model,
        deepfake_model_version=record.deepfake_model_version,
        deepfake_processing_time=record.deepfake_processing_time,
        deepfake_device=record.deepfake_device,
        deepfake_error=record.deepfake_error,
        speaker_verification_status=record.speaker_verification_status,
        speaker_similarity=record.speaker_similarity,
        speaker_verified=record.speaker_verified,
        speaker_model=record.speaker_model,
        speaker_model_version=record.speaker_model_version,
        speaker_processing_time=record.speaker_processing_time,
        speaker_device=record.speaker_device,
        speaker_error=record.speaker_error,
        risk_status=record.risk_status,
        risk_score=record.risk_score,
        risk_level=record.risk_level,
        risk_explanation=record.risk_explanation,
        risk_recommendation=record.risk_recommendation,
        risk_processing_time=record.risk_processing_time,
        risk_engine_version=record.risk_engine_version,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


@router.post(
    "/{analysis_id}/preprocess",
    response_model=AudioPreprocessResponse,
    status_code=status.HTTP_200_OK,
)
def preprocess_audio(
    analysis_id: uuid.UUID, db: Session = Depends(get_db)
) -> AudioPreprocessResponse:
    """Run the preprocessing pipeline and set status to READY_FOR_ANALYSIS."""
    record = audio_service.preprocess_audio(analysis_id, db)
    return AudioPreprocessResponse(
        success=True,
        analysis_id=str(record.id),
        status=record.status,
        audio=AudioMetadataBrief(
            sample_rate=record.processed_sample_rate,
            channels=record.processed_channels,
            duration_seconds=record.processed_duration_seconds,
        ),
        message="Audio preprocessing completed successfully",
    )


@router.get(
    "/{analysis_id}/preprocess",
    response_model=PreprocessStatusResponse,
    status_code=status.HTTP_200_OK,
)
def get_preprocess_status(
    analysis_id: uuid.UUID, db: Session = Depends(get_db)
) -> PreprocessStatusResponse:
    """Return original/processed metadata plus any preprocessing error."""
    record = audio_service.get_audio_analysis(analysis_id, db)
    return PreprocessStatusResponse(
        analysis_id=str(record.id),
        status=record.status,
        original=AudioMetadataBrief(
            sample_rate=record.original_sample_rate,
            channels=record.original_channels,
            duration_seconds=record.duration_seconds,
        ),
        processed=AudioMetadataBrief(
            sample_rate=record.processed_sample_rate,
            channels=record.processed_channels,
            duration_seconds=record.processed_duration_seconds,
        ),
        preprocessing_error=record.preprocessing_error,
    )


@router.get(
    "/{analysis_id}/processed",
    status_code=status.HTTP_200_OK,
    response_class=FileResponse,
)
def get_processed_audio(
    analysis_id: uuid.UUID, db: Session = Depends(get_db)
) -> FileResponse:
    """Stream the processed WAV audio. Never exposes filesystem paths."""
    _, processed_path = audio_service.get_processed_audio_path(analysis_id, db)
    return FileResponse(
        str(processed_path),
        media_type="audio/wav",
        filename=processed_path.name,
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