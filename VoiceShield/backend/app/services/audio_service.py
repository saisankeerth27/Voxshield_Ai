"""Audio upload orchestration service.

Responsibilities:
- validate uploaded audio
- generate a UUID-based storage filename
- persist the file to temporary storage
- create and manage the analysis database record
- list / fetch / delete analyses

The route handlers stay thin and delegate entirely to this layer.
"""

import uuid
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import NotFoundError, ServiceUnavailableError
from app.models.audio import AudioAnalysis
from app.models.enums import AudioAnalysisStatus
from app.utils.audio_metadata import detect_audio_duration
from app.utils.file_validation import validate_audio_upload


def _ensure_upload_dir() -> Path:
    """Create (if needed) and return the temporary upload directory."""
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


def save_audio_upload(file, db: Session) -> AudioAnalysis:
    """Validate, store, and record an uploaded audio file.

    ``file`` is a FastAPI ``UploadFile``. The user-supplied filename is
    never used for storage; a UUID-based name is generated instead.
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
    """Delete an analysis record and its stored audio file.

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

    try:
        db.delete(record)
        db.commit()
    except Exception:
        db.rollback()
        raise ServiceUnavailableError(
            "Unable to delete the analysis record."
        ) from None