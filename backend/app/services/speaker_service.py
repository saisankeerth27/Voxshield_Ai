"""Speaker profile registration and verification orchestration.

Registration flow:
1. Accept a reference recording (multipart field ``speaker_name`` +
   ``reference_audio``). 2. Store it like any upload, preprocess it to
   16 kHz mono via the shared Phase 3 pipeline. 3. Run the real ECAPA-TDNN
   model to extract a fixed-dimension embedding. 4. Persist the embedding
   (dimension-prefixed float32 bytes) into ``speaker_profiles`` together
   with model metadata. The reference WAV is deleted immediately after the
   embedding is extracted - the raw voice recording is not retained.

Verification flow:
1. Locate the analysis record; it must be preprocessed. 2. Load the active
   registered profile (404 if none exists). 3. Generate an embedding for
   the analyzed audio and compare with the stored one. 4. Persist the
   actual cosine similarity + per-module status and set the top-level
   status to SPEAKER_ANALYZED on success.

Only one application-level profile is kept; registering a new profile
replaces the previous voiceprint.
"""

import logging
import uuid
from pathlib import Path
from time import monotonic

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import (
    BadRequestError,
    NotFoundError,
    ServiceUnavailableError,
    SpeakerModelUnavailableError,
    SpeakerVerificationError,
    VoiceShieldError,
)
from app.ml import speaker_verifier_manager
from app.ml.schemas import SpeakerEmbedding
from app.models.audio import AudioAnalysis
from app.models.enums import AudioAnalysisStatus, SpeakerVerificationStatus
from app.models.speaker import SpeakerProfile

logger = logging.getLogger("voiceshield.speaker")

ERROR_NOT_PREPROCESSED = "Audio must be preprocessed before speaker verification."
ERROR_NO_PROFILE = (
    "No speaker profile is registered. POST /profile with a reference "
    "recording before asking for verification."
)


def _normalise_name(raw: str | None) -> str:
    name = (raw or "").strip()
    if not name:
        raise BadRequestError("Speaker name is required.")
    if len(name) > 255:
        raise BadRequestError("Speaker name must be 255 characters or fewer.")
    return name


# ----------------------------------------------------------------------
# Profile registration
# ----------------------------------------------------------------------
def register_speaker_profile(
    name: str | None, file, db: Session
) -> SpeakerProfile:
    """Extract an embedding from a reference recording and store it.

    On success the temporary upload + processed WAV are deleted; only the
    embedding and metadata persist.
    """
    from app.services import audio_service

    speaker_name = _normalise_name(name)

    if file is None:
        raise BadRequestError("A reference audio file is required.")

    temp_analysis = None
    try:
        temp_analysis = audio_service.save_audio_upload(file, db)
        temp_analysis = audio_service.preprocess_audio(temp_analysis.id, db)
        _, processed_path = audio_service.get_processed_audio_path(
            temp_analysis.id, db
        )

        verifier = speaker_verifier_manager.get_verifier()  # may raise 503
        embedding = verifier.create_embedding(processed_path)

        # Single application-level profile: replace any existing voiceprint.
        db.execute(delete(SpeakerProfile))
        profile = SpeakerProfile(
            name=speaker_name,
            embedding_bytes=embedding.to_bytes(),
            embedding_dim=embedding.embedding_dim,
            model_name=embedding.model_name,
            model_version=embedding.model_version,
            device=embedding.device,
            sample_rate=settings.target_sample_rate,
            duration_seconds=_waudio_seconds(processed_path),
            active=True,
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    finally:
        if temp_analysis is not None:
            _cleanup_temporary_analysis(temp_analysis.id, db)

    logger.info(
        "Speaker profile registered name=%s model=%s dim=%d",
        profile.name,
        profile.model_name,
        profile.embedding_dim,
    )
    return profile


def _waudio_seconds(path: Path) -> float:
    """Duration of a processed WAV (16 kHz mono) without loading it fully."""
    import wave

    with wave.open(str(path), "rb") as wav:
        frames = wav.getnframes()
        rate = wav.getframerate()
        return float(frames / rate) if rate else 0.0


def _cleanup_temporary_analysis(analysis_id: uuid.UUID, db: Session) -> None:
    """Best-effort removal of the temp record + original/processed files."""
    from app.services import audio_service

    try:
        audio_service.delete_audio_analysis(analysis_id, db)
    except Exception:
        logger.exception("Failed to clean up temporary profile audio")


def list_speaker_profiles(db: Session) -> list[SpeakerProfile]:
    return list(
        db.scalars(
            select(SpeakerProfile)
            .where(SpeakerProfile.active.is_(True))
            .order_by(SpeakerProfile.updated_at.desc())
        ).all()
    )


def get_active_profile(db: Session) -> SpeakerProfile | None:
    return db.scalars(
        select(SpeakerProfile)
        .where(SpeakerProfile.active.is_(True))
        .order_by(SpeakerProfile.updated_at.desc())
        .limit(1)
    ).first()


def get_speaker_profile(profile_id: uuid.UUID, db: Session) -> SpeakerProfile:
    profile = db.get(SpeakerProfile, profile_id)
    if profile is None or not profile.active:
        raise NotFoundError("Speaker profile not found.")
    return profile


def delete_speaker_profile(profile_id: uuid.UUID, db: Session) -> None:
    """Delete a profile and its stored voiceprint bytes."""
    profile = get_speaker_profile(profile_id, db)
    try:
        db.delete(profile)
        db.commit()
    except Exception:
        db.rollback()
        raise ServiceUnavailableError(
            "Unable to delete the speaker profile."
        ) from None


def _load_reference_embedding(profile: SpeakerProfile) -> SpeakerEmbedding:
    """Deserialize the stored voiceprint bytes."""
    try:
        return SpeakerEmbedding.from_bytes(
            payload=profile.embedding_bytes,
            model_name=profile.model_name,
            model_version=profile.model_version,
            device=profile.device or "cpu",
        )
    except (ValueError, TypeError) as exc:
        raise SpeakerVerificationError(
            "Stored speaker embedding is corrupt or incompatible."
        ) from exc


# ----------------------------------------------------------------------
# Verification
# ----------------------------------------------------------------------
def run_speaker_verification(
    analysis_id: uuid.UUID, db: Session
) -> AudioAnalysis:
    """Run real verification for a preprocessed analysis and persist result.

    Idempotent: a record already carrying a completed speaker result is
    returned immediately without re-running inference.
    """
    record = db.get(AudioAnalysis, analysis_id)
    if record is None:
        raise NotFoundError("Analysis not found.")

    if (
        record.speaker_verification_status == SpeakerVerificationStatus.VERIFIED
        and record.speaker_similarity is not None
    ):
        return record

    _ensure_processed(record, db)

    profile = get_active_profile(db)
    if profile is None:
        raise NotFoundError(ERROR_NO_PROFILE)

    verifier = speaker_verifier_manager.get_verifier()  # may raise 503

    record.speaker_verification_status = SpeakerVerificationStatus.PROCESSING
    record.speaker_error = None
    _commit_record(db, record, "Unable to start speaker verification.")

    processed_path = Path(settings.processed_audio_dir) / record.processed_filename
    logger.info("Speaker verification started analysis_id=%s", analysis_id)
    started_at = monotonic()
    try:
        reference = _load_reference_embedding(profile)
        test_embedding = verifier.create_embedding(processed_path)
        result = verifier.compare_embeddings(reference, test_embedding)
    except SpeakerModelUnavailableError:
        raise
    except VoiceShieldError as exc:
        _mark_speaker_failed(db, record, exc.detail)
        logger.warning(
            "Speaker verification failed analysis_id=%s error=%s",
            analysis_id,
            exc.detail,
        )
        raise
    except Exception:
        _mark_speaker_failed(
            db, record, "Speaker verification failed unexpectedly."
        )
        logger.exception("Speaker verification crashed analysis_id=%s", analysis_id)
        raise SpeakerVerificationError(
            "Speaker verification failed unexpectedly."
        ) from None
    finally:
        processing_time = monotonic() - started_at

    record.speaker_verification_status = SpeakerVerificationStatus.VERIFIED
    record.speaker_similarity = result.similarity
    record.speaker_verified = result.verified
    record.speaker_model = result.embedding_model
    record.speaker_model_version = result.embedding_model_version
    record.speaker_processing_time = round(processing_time, 3)
    record.speaker_device = result.device
    record.speaker_error = None
    record.status = AudioAnalysisStatus.SPEAKER_ANALYZED
    _commit_record(db, record, "Unable to store the speaker verification result.")

    logger.info(
        "Speaker verification completed analysis_id=%s similarity=%.4f "
        "verified=%s duration=%.3fs",
        analysis_id,
        result.similarity,
        result.verified,
        processing_time,
    )
    return record


def get_speaker_result(analysis_id: uuid.UUID, db: Session) -> AudioAnalysis:
    """Return the stored speaker result without running inference."""
    record = db.get(AudioAnalysis, analysis_id)
    if record is None:
        raise NotFoundError("Analysis not found.")
    return record


# ----------------------------------------------------------------------
# Internals
# ----------------------------------------------------------------------
def _ensure_processed(record: AudioAnalysis, db: Session) -> None:
    from pathlib import Path

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


def _mark_speaker_failed(
    db: Session, record: AudioAnalysis, message: str
) -> None:
    """Persist per-module FAILED state with a stored, readable error.

    The top-level lifecycle status is deliberately left untouched: a deep-
    fake result remains valid even when speaker verification fails.
    """
    record.speaker_verification_status = SpeakerVerificationStatus.FAILED
    record.speaker_error = message[:2000]
    try:
        db.commit()
    except Exception:
        db.rollback()