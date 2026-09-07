"""Audio upload and preprocessing orchestration service.

Responsibilities:
- validate uploaded audio
- generate a UUID-based storage filename
- persist the file to temporary storage
- create and manage the analysis database record
- run the preprocessing pipeline and update analysis metadata
- list / fetch / delete analyses

The route handlers stay thin and delegate entirely to this layer.
"""

import logging
import uuid
from pathlib import Path
from time import monotonic

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.audio.preprocessor import AudioPreprocessor
from app.core.config import settings
from app.core.exceptions import (
    NotFoundError,
    PreprocessingError,
    ServiceUnavailableError,
    VoiceShieldError,
)
from app.models.audio import AudioAnalysis
from app.models.enums import AudioAnalysisStatus, AudioSource
from app.utils.audio_metadata import detect_audio_duration
from app.utils.file_validation import validate_audio_upload

logger = logging.getLogger("voiceshield.service")


def _ensure_upload_dir() -> Path:
    """Create (if needed) and return the temporary upload directory."""
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


def _ensure_processed_audio_dir() -> Path:
    """Create (if needed) and return the processed audio directory."""
    processed_dir = Path(settings.processed_audio_dir)
    processed_dir.mkdir(parents=True, exist_ok=True)
    return processed_dir


def save_audio_upload(
    file,
    db: Session,
    source: AudioSource = AudioSource.UPLOAD,
) -> AudioAnalysis:
    """Validate, store, and record an uploaded audio file.

    ``file`` is a FastAPI ``UploadFile``. The user-supplied filename is
    never used for storage; a UUID-based name is generated instead.
    ``source`` marks where the audio came from (file upload or microphone
    recording) so history can distinguish the two without a separate table.
    """
    filename = (file.filename or "upload").strip() or "upload"
    mime_type = file.content_type
    content = file.file.read()
    file_size = len(content)

    max_size_bytes = settings.max_audio_size_mb * 1024 * 1024
    extension = validate_audio_upload(filename, mime_type, file_size, max_size_bytes)

    stored_filename = f"{uuid.uuid4().hex}.{extension}"
    upload_dir = _ensure_upload_dir()
    storage_path = upload_dir / stored_filename

    try:
        storage_path.write_bytes(content)
    except OSError:
        raise ServiceUnavailableError("Unable to store the uploaded audio.") from None

    duration_seconds = detect_audio_duration(content, extension)

    record = AudioAnalysis(
        source=source.value,
        original_filename=filename,
        stored_filename=stored_filename,
        file_extension=extension,
        mime_type=mime_type,
        file_size=file_size,
        duration_seconds=duration_seconds,
        status=AudioAnalysisStatus.UPLOADED,
    )

    try:
        db.add(record)
        db.commit()
        db.refresh(record)
    except Exception:
        db.rollback()
        try:
            storage_path.unlink(missing_ok=True)
        except OSError:
            pass
        raise ServiceUnavailableError(
            "Unable to save the analysis record."
        ) from None

    return record


def get_audio_analysis(analysis_id: uuid.UUID, db: Session) -> AudioAnalysis:
    """Return an analysis record by ID, raising 404 if it does not exist."""
    record = db.get(AudioAnalysis, analysis_id)
    if record is None:
        raise NotFoundError("Analysis not found.")
    return record


def list_audio_analyses(
    db: Session, page: int, limit: int
) -> tuple[list[AudioAnalysis], int]:
    """Return a page of analyses (newest first) and the total count."""
    total = db.scalar(select(func.count()).select_from(AudioAnalysis)) or 0
    statement = (
        select(AudioAnalysis)
        .order_by(AudioAnalysis.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    rows = list(db.scalars(statement).all())
    return rows, total


def delete_audio_analysis(analysis_id: uuid.UUID, db: Session) -> None:
    """Delete an analysis record and its stored audio files.

    Missing stored files are treated as already deleted, but unexpected
    filesystem and database errors are surfaced (never silently ignored).
    """
    record = get_audio_analysis(analysis_id, db)

    storage_path = Path(settings.upload_dir) / record.stored_filename
    try:
        storage_path.unlink(missing_ok=True)
    except OSError:
        raise ServiceUnavailableError(
            "Unable to delete the stored audio file."
        ) from None

    if record.processed_filename:
        processed_path = Path(settings.processed_audio_dir) / record.processed_filename
        try:
            processed_path.unlink(missing_ok=True)
        except OSError:
            raise ServiceUnavailableError(
                "Unable to delete the processed audio file."
            ) from None

    try:
        db.delete(record)
        db.commit()
    except Exception:
        db.rollback()
        raise ServiceUnavailableError(
            "Unable to delete the analysis record."
        ) from None


def preprocess_audio(analysis_id: uuid.UUID, db: Session) -> AudioAnalysis:
    """Run preprocessing for an analysis and persist the metadata.

    Status transitions: UPLOADED -> PREPROCESSING -> READY_FOR_ANALYSIS,
    or -> FAILED with a stored error message.

    Returns the record either after a fresh run or immediately when the
    analysis is already READY_FOR_ANALYSIS (idempotent re-entry).
    """
    record = get_audio_analysis(analysis_id, db)

    if (
        record.status == AudioAnalysisStatus.READY_FOR_ANALYSIS
        and record.processed_filename
    ):
        return record

    stored_path = Path(settings.upload_dir) / record.stored_filename
    if not stored_path.is_file():
        raise NotFoundError("Original audio file not found.")

    record.status = AudioAnalysisStatus.PREPROCESSING
    record.preprocessing_error = None
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise ServiceUnavailableError(
            "Unable to update the analysis record."
        ) from None

    logger.info("Preprocessing started analysis_id=%s", analysis_id)
    start = monotonic()

    try:
        result = AudioPreprocessor().preprocess(stored_path)
    except VoiceShieldError as exc:
        _mark_preprocessing_failed(db, record, exc.detail)
        logger.warning(
            "Preprocessing failed analysis_id=%s error=%s",
            analysis_id,
            exc.detail,
        )
        raise
    except Exception:
        _mark_preprocessing_failed(
            db, record, "Unexpected preprocessing failure."
        )
        logger.exception("Preprocessing crashed analysis_id=%s", analysis_id)
        raise PreprocessingError(
            "Unexpected preprocessing failure."
        ) from None

    record.original_sample_rate = result.original_sample_rate
    record.original_channels = result.original_channels
    record.duration_seconds = result.original_duration_seconds
    record.processed_sample_rate = result.processed_sample_rate
    record.processed_channels = result.processed_channels
    record.processed_duration_seconds = result.processed_duration_seconds
    record.processed_filename = result.processed_filename
    record.preprocessing_error = None
    record.status = AudioAnalysisStatus.READY_FOR_ANALYSIS

    try:
        db.commit()
    except Exception:
        db.rollback()
        _cleanup_processed_file(result)
        raise ServiceUnavailableError(
            "Unable to save the preprocessing result."
        ) from None

    processing_time = monotonic() - start
    logger.info(
        "Preprocessing completed analysis_id=%s processing_time=%.2fs",
        analysis_id,
        processing_time,
    )
    return record


def get_processed_audio_path(
    analysis_id: uuid.UUID, db: Session
) -> tuple[AudioAnalysis, Path]:
    """Return the analysis record and its processed-audio path."""
    record = get_audio_analysis(analysis_id, db)
    if not record.processed_filename:
        raise NotFoundError("Processed audio not found.")
    processed_path = Path(settings.processed_audio_dir) / record.processed_filename
    if not processed_path.is_file():
        raise NotFoundError("Processed audio not found.")
    return record, processed_path


def _mark_preprocessing_failed(
    db: Session, record: AudioAnalysis, message: str
) -> None:
    """Persist a FAILED preprocessing state with a stored error message."""
    record.status = AudioAnalysisStatus.FAILED
    record.preprocessing_error = message[:2000]
    try:
        db.commit()
    except Exception:
        db.rollback()


def _cleanup_processed_file(result) -> None:
    """Best-effort removal of a just-written processed file."""
    try:
        Path(result.processed_path).unlink(missing_ok=True)
    except OSError:
        pass