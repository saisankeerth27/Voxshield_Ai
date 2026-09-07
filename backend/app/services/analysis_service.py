"""Deepfake / synthetic speech analysis orchestration.

Flow (mirrors the documented API):

1. Locate the analysis record.
2. Verify preprocessing completed and the processed WAV exists.
3. Acquire the resident model detector (loads once at startup / on demand).
4. Persist PROCESSING state, then run real inference with timing.
5. Store actual model output and set DEEPFAKE_ANALYZED.
6. On failure, persist FAILED + a stored error message and re-raise a
   typed API error (no fabricated values, no raw exceptions).
"""

import logging
import uuid
from pathlib import Path
from time import monotonic

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import (
    BadRequestError,
    DeepfakeDetectionError,
    DeepfakeModelUnavailableError,
    ServiceUnavailableError,
    VoiceShieldError,
)
from app.ml import deepfake_model_manager
from app.models.audio import AudioAnalysis
from app.models.enums import AudioAnalysisStatus

logger = logging.getLogger("voiceshield.analysis")

ERROR_MODEL_UNAVAILABLE = "Deepfake detection model is currently unavailable."
ERROR_NOT_PREPROCESSED = "Audio must be preprocessed before deepfake analysis."


def get_analysis_record(analysis_id: uuid.UUID, db: Session) -> AudioAnalysis:
    """Return the analysis record or raise 404."""
    record = db.get(AudioAnalysis, analysis_id)
    if record is None:
        from app.core.exceptions import NotFoundError

        raise NotFoundError("Analysis not found.")
    return record


def run_deepfake_analysis(analysis_id: uuid.UUID, db: Session) -> AudioAnalysis:
    """Run the real model on the processed audio and persist the result.

    Returns the record with stored model output. Idempotent: re-running an
    already-analyzed record returns the stored result without re-inference.
    """
    record = get_analysis_record(analysis_id, db)

    # Already analyzed -> return stored result unchanged.
    if (
        record.status == AudioAnalysisStatus.DEEPFAKE_ANALYZED
        and record.ai_probability is not None
    ):
        return record

    _ensure_preprocessed(record, db)

    detector = deepfake_model_manager.get_detector()  # may raise 503

    record.status = AudioAnalysisStatus.PROCESSING
    record.deepfake_error = None
    _commit_record(db, record, "Unable to start deepfake analysis.")

    logger.info("Deepfake inference started analysis_id=%s", analysis_id)
    started_at = monotonic()
    try:
        processed_path = Path(settings.processed_audio_dir) / record.processed_filename
        prediction = detector.predict(processed_path)
    except DeepfakeModelUnavailableError:
        raise
    except VoiceShieldError as exc:
        _mark_deepfake_failed(db, record, exc.detail)
        logger.warning(
            "Deepfake inference failed analysis_id=%s error=%s",
            analysis_id,
            exc.detail,
        )
        raise
    except Exception:
        _mark_deepfake_failed(
            db, record, "Deepfake inference failed unexpectedly."
        )
        logger.exception("Deepfake inference crashed analysis_id=%s", analysis_id)
        raise DeepfakeDetectionError(
            "Deepfake inference failed unexpectedly."
        ) from None
    finally:
        processing_time = monotonic() - started_at

    record.ai_probability = prediction.ai_probability
    record.real_probability = prediction.real_probability
    record.deepfake_label = prediction.predicted_class
    record.deepfake_model = prediction.model_name
    record.deepfake_model_version = prediction.model_version
    record.deepfake_processing_time = round(processing_time, 3)
    record.deepfake_device = prediction.device
    record.deepfake_error = None
    record.status = AudioAnalysisStatus.DEEPFAKE_ANALYZED
    _commit_record(db, record, "Unable to store the deepfake result.")

    logger.info(
        "Deepfake inference completed analysis_id=%s duration=%.3fs model=%s device=%s",
        analysis_id,
        processing_time,
        prediction.model_name,
        prediction.device,
    )
    return record


def get_deepfake_result(analysis_id: uuid.UUID, db: Session) -> AudioAnalysis:
    """Return the stored deepfake result without triggering inference."""
    return get_analysis_record(analysis_id, db)


def _ensure_preprocessed(record: AudioAnalysis, db: Session) -> None:
    """Verify the audio is ready for model input (never trusts client paths)."""
    if not record.processed_filename:
        raise BadRequestError(ERROR_NOT_PREPROCESSED)
    processed_path = Path(settings.processed_audio_dir) / record.processed_filename
    if not processed_path.is_file():
        raise BadRequestError(ERROR_NOT_PREPROCESSED)


def _commit_record(db: Session, record: AudioAnalysis, message: str) -> None:
    try:
        db.commit()
        db.refresh(record)
    except Exception:
        db.rollback()
        raise ServiceUnavailableError(message) from None


def _mark_deepfake_failed(
    db: Session, record: AudioAnalysis, message: str
) -> None:
    """Persist FAILED state with a stored, human-readable error."""
    record.status = AudioAnalysisStatus.FAILED
    record.deepfake_error = message[:2000]
    try:
        db.commit()
    except Exception:
        db.rollback()