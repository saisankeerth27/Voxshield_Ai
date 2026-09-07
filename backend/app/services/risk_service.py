"""Risk fusion orchestration.

Retrieves the *stored* deepfake and speaker results from the database (never
from the client), passes them to the ``RiskEngine``, persists the outcome,
and sets the top-level status to RISK_CALCULATED.

Security: the frontend only supplies an ``analysis_id``. ai_probability and
speaker_similarity are always read from the DB, so the client cannot
manipulate the risk calculation.

Idempotency: re-running risk on an already-calculated analysis returns the
existing result without recomputation.
"""

import logging
import uuid
from time import monotonic

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import (
    IncompleteAnalysisError,
    NotFoundError,
    ServiceUnavailableError,
    VoiceShieldError,
)
from app.models.audio import AudioAnalysis
from app.models.enums import AudioAnalysisStatus, RiskStatus
from app.services.risk_engine import RiskEngine, RiskInputs, RiskResult

logger = logging.getLogger("voiceshield.risk")

ERROR_INCOMPLETE = (
    "Complete deepfake detection and speaker verification before "
    "calculating risk."
)


def get_risk_result(analysis_id: uuid.UUID, db: Session) -> AudioAnalysis:
    """Return the stored analysis (risk fields may be null)."""
    record = db.get(AudioAnalysis, analysis_id)
    if record is None:
        raise NotFoundError("Analysis not found.")
    return record


def run_risk_analysis(analysis_id: uuid.UUID, db: Session) -> AudioAnalysis:
    """Calculate and persist the risk assessment for a completed analysis.

    Requires both stored deepfake and speaker results. Idempotent: returns
    the existing completed risk result when present.
    """
    record = db.get(AudioAnalysis, analysis_id)
    if record is None:
        raise NotFoundError("Analysis not found.")

    if (
        record.risk_status == RiskStatus.CALCULATED
        and record.risk_score is not None
    ):
        return record

    _require_complete(record)

    engine = RiskEngine()
    inputs = RiskInputs(
        ai_probability=record.ai_probability,
        real_probability=record.real_probability,
        speaker_similarity=record.speaker_similarity,
    )

    record.risk_status = RiskStatus.PROCESSING
    record.risk_score = None
    _commit_record(db, record, "Unable to start risk analysis.")

    logger.info("Risk calculation started analysis_id=%s", analysis_id)
    started_at = monotonic()
    try:
        result: RiskResult = engine.evaluate(inputs)
    except VoiceShieldError:
        raise
    except Exception as exc:
        _mark_risk_failed(db, record, str(exc))
        logger.exception("Risk calculation crashed analysis_id=%s", analysis_id)
        raise ServiceUnavailableError(
            "Risk calculation failed unexpectedly."
        ) from None
    finally:
        processing_time = monotonic() - started_at

    if result.status != "CALCULATED":
        # Guard: inputs were validated complete, so this should not happen.
        _mark_risk_failed(db, record, ERROR_INCOMPLETE)
        raise IncompleteAnalysisError(ERROR_INCOMPLETE)

    record.risk_score = result.risk_score
    record.risk_level = result.risk_level
    record.risk_status = RiskStatus.CALCULATED
    record.risk_explanation = result.explanation
    record.risk_recommendation = result.recommendation
    record.risk_processing_time = round(processing_time, 4)
    record.risk_engine_version = result.engine_version
    record.status = AudioAnalysisStatus.RISK_CALCULATED
    _commit_record(db, record, "Unable to store the risk result.")

    logger.info(
        "Risk calculation completed analysis_id=%s level=%s score=%s "
        "duration=%.4fs version=%s",
        analysis_id,
        result.risk_level,
        result.risk_score,
        processing_time,
        result.engine_version,
    )
    return record


def _require_complete(record: AudioAnalysis) -> None:
    """Both signals must be present for a meaningful risk score."""
    if record.ai_probability is None:
        raise IncompleteAnalysisError(ERROR_INCOMPLETE)
    if record.speaker_similarity is None:
        raise IncompleteAnalysisError(ERROR_INCOMPLETE)


def _commit_record(db: Session, record: AudioAnalysis, message: str) -> None:
    try:
        db.commit()
        db.refresh(record)
    except Exception:
        db.rollback()
        raise ServiceUnavailableError(message) from None


def _mark_risk_failed(
    db: Session, record: AudioAnalysis, message: str
) -> None:
    """Persist per-module FAILED state without touching valid ML results."""
    record.risk_status = RiskStatus.FAILED
    try:
        db.commit()
    except Exception:
        db.rollback()
