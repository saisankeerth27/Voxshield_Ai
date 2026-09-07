"""Deepfake / synthetic speech analysis endpoints.

Flow: preprocess (audio routes) -> POST deepfake -> DEEPFAKE_ANALYZED.
Handlers are thin; all orchestration lives in ``analysis_service``.
"""

import uuid
from html import escape

from fastapi import APIRouter, Depends, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.enums import AudioAnalysisStatus
from app.ml import deepfake_model_manager, speaker_verifier_manager
from app.schemas.analysis import (
    AnalysisStatusResponse,
    DeepfakeResultResponse,
    DeepfakeRunResponse,
)
from app.schemas.risk import RiskCalculateResponse, RiskResultResponse
from app.schemas.speaker import SpeakerResultResponse, SpeakerVerifyResponse
from app.services import analysis_service, risk_service, speaker_service

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.get("/status", response_model=AnalysisStatusResponse)
def analysis_status() -> AnalysisStatusResponse:
    """Report which analysis capabilities are available.

    State is read from the live model managers, never guessed. Capabilities
    are reported as available only while the underlying model is loaded.
    """
    deepfake_state = deepfake_model_manager.status().state
    speaker_state = speaker_verifier_manager.status().state
    return AnalysisStatusResponse(
        available=True,
        deepfake=deepfake_state == "loaded",
        speaker=speaker_state == "loaded",
        message=(
            "Deepfake detection and speaker verification are available."
            if deepfake_state == "loaded" and speaker_state == "loaded"
            else "One or more analysis models are loading or unavailable."
        ),
    )


@router.post(
    "/{analysis_id}/deepfake",
    response_model=DeepfakeRunResponse,
    status_code=status.HTTP_200_OK,
)
def run_deepfake_analysis(
    analysis_id: uuid.UUID, db: Session = Depends(get_db)
) -> DeepfakeRunResponse:
    """Run the real deepfake detector and store the actual model output."""
    record = analysis_service.run_deepfake_analysis(analysis_id, db)
    return DeepfakeRunResponse(
        analysis_id=str(record.id),
        status=record.status,
        ai_probability=record.ai_probability,
        real_probability=record.real_probability,
        predicted_class=record.deepfake_label,
        model={"name": record.deepfake_model, "version": record.deepfake_model_version},
        device=record.deepfake_device,
        processing_time_seconds=record.deepfake_processing_time,
        message="Deepfake analysis completed successfully",
    )


@router.get(
    "/{analysis_id}/deepfake",
    response_model=DeepfakeResultResponse,
    status_code=status.HTTP_200_OK,
)
def get_deepfake_result(
    analysis_id: uuid.UUID, db: Session = Depends(get_db)
) -> DeepfakeResultResponse:
    """Return the stored deepfake result without running inference."""
    record = analysis_service.get_deepfake_result(analysis_id, db)
    return DeepfakeResultResponse(
        analysis_id=str(record.id),
        status=record.status,
        ai_probability=record.ai_probability,
        real_probability=record.real_probability,
        predicted_class=record.deepfake_label,
        model={"name": record.deepfake_model, "version": record.deepfake_model_version},
        device=record.deepfake_device,
        processing_time_seconds=record.deepfake_processing_time,
        deepfake_error=record.deepfake_error,
    )


@router.post(
    "/{analysis_id}/speaker",
    response_model=SpeakerVerifyResponse,
    status_code=status.HTTP_200_OK,
)
def run_speaker_verification(
    analysis_id: uuid.UUID, db: Session = Depends(get_db)
) -> SpeakerVerifyResponse:
    """Run real speaker verification against the registered profile."""
    record = speaker_service.run_speaker_verification(analysis_id, db)
    active = speaker_service.get_active_profile(db)
    return SpeakerVerifyResponse(
        analysis_id=str(record.id),
        status=record.status,
        speaker_verification_status=record.speaker_verification_status,
        verified=bool(record.speaker_verified),
        similarity_score=record.speaker_similarity,
        speaker_model=record.speaker_model,
        speaker_model_version=record.speaker_model_version,
        speaker_processing_time=record.speaker_processing_time,
        speaker_device=record.speaker_device,
        speaker_error=record.speaker_error,
        reference_profile_id=str(active.id) if active else None,
        reference_name=active.name if active else None,
        message="Speaker verification completed successfully",
    )


@router.get(
    "/{analysis_id}/speaker",
    response_model=SpeakerResultResponse,
    status_code=status.HTTP_200_OK,
)
def get_speaker_result(
    analysis_id: uuid.UUID, db: Session = Depends(get_db)
) -> SpeakerResultResponse:
    """Return the stored speaker result without running inference."""
    record = speaker_service.get_speaker_result(analysis_id, db)
    active = speaker_service.get_active_profile(db)
    return SpeakerResultResponse(
        analysis_id=str(record.id),
        status=record.status,
        verified=record.speaker_verified,
        similarity_score=record.speaker_similarity,
        speaker_verification_status=record.speaker_verification_status,
        speaker_model=record.speaker_model,
        speaker_model_version=record.speaker_model_version,
        speaker_processing_time=record.speaker_processing_time,
        speaker_device=record.speaker_device,
        speaker_error=record.speaker_error,
        reference_profile_id=str(active.id) if active else None,
        reference_name=active.name if active else None,
    )


@router.post(
    "/{analysis_id}/risk",
    response_model=RiskCalculateResponse,
    status_code=status.HTTP_200_OK,
)
def run_risk_analysis(
    analysis_id: uuid.UUID, db: Session = Depends(get_db)
) -> RiskCalculateResponse:
    """Calculate risk from the STORED deepfake + speaker results.

    The frontend supplies only the analysis id; the backing values are read
    from the database so the client cannot manipulate the risk calculation.
    """
    record = risk_service.run_risk_analysis(analysis_id, db)
    return RiskCalculateResponse(
        analysis_id=str(record.id),
        status=record.status,
        risk_status=record.risk_status,
        risk_score=record.risk_score,
        risk_level=record.risk_level,
        explanation=record.risk_explanation,
        recommendation=record.risk_recommendation,
        risk_processing_time=record.risk_processing_time,
        risk_engine_version=record.risk_engine_version,
        message="Risk assessment completed successfully",
    )


@router.get(
    "/{analysis_id}/risk",
    response_model=RiskResultResponse,
    status_code=status.HTTP_200_OK,
)
def get_risk_result(
    analysis_id: uuid.UUID, db: Session = Depends(get_db)
) -> RiskResultResponse:
    """Return the stored risk result without recomputation."""
    record = risk_service.get_risk_result(analysis_id, db)
    return RiskResultResponse(
        analysis_id=str(record.id),
        status=record.status,
        risk_status=record.risk_status,
        risk_score=record.risk_score,
        risk_level=record.risk_level,
        explanation=record.risk_explanation,
        recommendation=record.risk_recommendation,
        risk_processing_time=record.risk_processing_time,
        risk_engine_version=record.risk_engine_version,
    )


# ───────────────────────────────────────────────────────────────
# Phase 9 — Analysis details + printable HTML report
# ───────────────────────────────────────────────────────────────


class StageStatus(BaseModel):
    status: str
    error: str | None = None
    message: str | None = None


class AnalysisDetailsResponse(BaseModel):
    analysis_id: str
    status: str
    source: str
    created_at: str
    updated_at: str
    audio: dict
    deepfake: dict
    speaker: dict
    risk: dict
    timeline: dict[str, StageStatus]


def _build_timeline(record) -> dict[str, StageStatus]:
    s = record.status
    df_err = record.deepfake_error
    sp_err = record.speaker_error
    pp_err = record.preprocessing_error

    uploaded = StageStatus(status="completed", message="Audio uploaded")
    preprocessed = StageStatus(status="not_started")
    deepfake = StageStatus(status="not_started")
    speaker = StageStatus(status="not_started")
    risk = StageStatus(status="not_started")

    # Preprocessing
    if pp_err and s == AudioAnalysisStatus.FAILED:
        preprocessed = StageStatus(status="failed", error=pp_err)
    elif s in (
        AudioAnalysisStatus.READY_FOR_ANALYSIS,
        AudioAnalysisStatus.PROCESSING,
        AudioAnalysisStatus.DEEPFAKE_ANALYZED,
        AudioAnalysisStatus.SPEAKER_ANALYZED,
        AudioAnalysisStatus.RISK_CALCULATED,
        AudioAnalysisStatus.COMPLETED,
    ):
        preprocessed = StageStatus(status="completed", message="Preprocessed")
    elif s == AudioAnalysisStatus.PREPROCESSING:
        preprocessed = StageStatus(status="running")

    # Deepfake
    if df_err and s == AudioAnalysisStatus.FAILED:
        deepfake = StageStatus(status="failed", error=df_err)
    elif record.ai_probability is not None:
        deepfake = StageStatus(status="completed", message="Detection completed")
    elif s == AudioAnalysisStatus.PROCESSING:
        deepfake = StageStatus(status="running")

    # Speaker
    if sp_err:
        speaker = StageStatus(status="failed", error=sp_err)
    elif record.speaker_verification_status == "VERIFIED":
        speaker = StageStatus(status="completed", message="Verification completed")
    elif record.speaker_verification_status == "PROCESSING":
        speaker = StageStatus(status="running")
    elif record.speaker_verification_status == "PENDING":
        speaker = StageStatus(status="running")

    # Risk
    if record.risk_status == "FAILED":
        risk = StageStatus(status="failed", error="Risk calculation failed")
    elif record.risk_status == "CALCULATED":
        risk = StageStatus(status="completed", message="Risk calculated")
    elif record.risk_status == "PROCESSING":
        risk = StageStatus(status="running")

    # Overall completed
    if s in (AudioAnalysisStatus.RISK_CALCULATED, AudioAnalysisStatus.COMPLETED):
        completed = StageStatus(status="completed", message="Analysis completed")
    elif s == AudioAnalysisStatus.FAILED:
        completed = StageStatus(status="failed", error="One or more stages failed")
    else:
        completed = StageStatus(status="not_started")

    return {
        "uploaded": uploaded,
        "preprocessed": preprocessed,
        "deepfake": deepfake,
        "speaker": speaker,
        "risk": risk,
        "completed": completed,
    }


@router.get(
    "/{analysis_id}",
    response_model=AnalysisDetailsResponse,
    status_code=status.HTTP_200_OK,
)
def get_analysis_details(
    analysis_id: uuid.UUID, db: Session = Depends(get_db)
) -> AnalysisDetailsResponse:
    """Return a combined payload for the analysis details page.

    All values come from stored database records — nothing is recomputed.
    """
    record = analysis_service.get_analysis_record(analysis_id, db)
    timeline = _build_timeline(record)

    return AnalysisDetailsResponse(
        analysis_id=str(record.id),
        status=record.status.value,
        source=record.source,
        created_at=record.created_at.isoformat() if record.created_at else "",
        updated_at=record.updated_at.isoformat() if record.updated_at else "",
        audio={
            "filename": record.original_filename,
            "file_size": record.file_size,
            "mime_type": record.mime_type,
            "duration_seconds": record.duration_seconds,
            "original_sample_rate": record.original_sample_rate,
            "original_channels": record.original_channels,
            "processed_sample_rate": record.processed_sample_rate,
            "processed_channels": record.processed_channels,
            "processed_duration_seconds": record.processed_duration_seconds,
        },
        deepfake={
            "status": timeline["deepfake"].status,
            "ai_probability": record.ai_probability,
            "real_probability": record.real_probability,
            "label": record.deepfake_label,
            "model": record.deepfake_model,
            "model_version": record.deepfake_model_version,
            "processing_time": record.deepfake_processing_time,
            "device": record.deepfake_device,
            "error": record.deepfake_error,
        },
        speaker={
            "status": timeline["speaker"].status,
            "similarity": record.speaker_similarity,
            "verified": record.speaker_verified,
            "model": record.speaker_model,
            "model_version": record.speaker_model_version,
            "processing_time": record.speaker_processing_time,
            "device": record.speaker_device,
            "reference_name": record.reference_name,
            "reference_profile_id": record.reference_profile_id,
            "error": record.speaker_error,
        },
        risk={
            "status": timeline["risk"].status,
            "score": record.risk_score,
            "level": record.risk_level,
            "explanation": record.risk_explanation,
            "recommendation": record.risk_recommendation,
            "processing_time": record.risk_processing_time,
            "engine_version": record.risk_engine_version,
        },
        timeline={k: v for k, v in timeline.items()},
    )


# ───────────────────────────────────────────────────────────────
# Printable HTML report
# ───────────────────────────────────────────────────────────────

_REPORT_CSS = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>VoiceShield Analysis Report</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;color:#1e293b;background:#fff;
     max-width:800px;margin:0 auto;padding:40px 32px;line-height:1.6}
h1{font-size:22px;margin-bottom:4px}
.subtitle{color:#64748b;font-size:13px;margin-bottom:28px}
h2{font-size:15px;text-transform:uppercase;letter-spacing:.5px;color:#0f766e;
    border-bottom:2px solid #0f766e;padding-bottom:4px;margin:28px 0 12px}
table{width:100%;border-collapse:collapse;font-size:14px}
td{padding:6px 0;vertical-align:top}
td:first-child{font-weight:600;width:42%;color:#334155}
.bar-outer{background:#e2e8f0;border-radius:4px;height:16px;width:100%;max-width:240px}
.bar-inner{border-radius:4px;height:16px}
.badge{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700}
.badge-HIGH{background:#fef2f2;color:#dc2626}
.badge-MEDIUM{background:#fffbeb;color:#d97706}
.badge-LOW{background:#ecfdf5;color:#059669}
.badge-UNKNOWN{background:#f1f5f9;color:#64748b}
.disclaimer{margin-top:32px;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;
            border-radius:8px;font-size:12px;color:#64748b}
@media print{body{padding:20px}}
</style>
</head>
<body>
"""

_REPORT_BODY = """\
<h1>VoiceShield Analysis Report</h1>
<p class="subtitle">Generated on %(generated_at)s</p>

<h2>Analysis Overview</h2>
<table>
<tr><td>Analysis ID</td><td>%(analysis_id)s</td></tr>
<tr><td>Date</td><td>%(created_at)s</td></tr>
<tr><td>Audio file</td><td>%(filename)s</td></tr>
<tr><td>Source</td><td>%(source)s</td></tr>
<tr><td>Duration</td><td>%(duration)s</td></tr>
<tr><td>Status</td><td>%(status)s</td></tr>
</table>

<h2>AI Detection</h2>
<table>
<tr><td>AI-generated probability</td><td>%(ai_prob_display)s%(ai_bar)s</td></tr>
<tr><td>Real probability</td><td>%(real_prob_display)s%(real_bar)s</td></tr>
<tr><td>Prediction</td><td>%(prediction)s</td></tr>
<tr><td>Model</td><td>%(deepfake_model)s</td></tr>
</table>

<h2>Speaker Verification</h2>
<table>
<tr><td>Reference speaker</td><td>%(reference_name)s</td></tr>
<tr><td>Speaker similarity</td><td>%(similarity_display)s%(similarity_bar)s</td></tr>
<tr><td>Verification</td><td>%(verification_display)s</td></tr>
<tr><td>Model</td><td>%(speaker_model)s</td></tr>
</table>

<h2>Risk Assessment</h2>
<table>
<tr><td>Risk level</td><td><span class="badge badge-%(risk_level)s">%(risk_level_display)s</span></td></tr>
<tr><td>Risk score</td><td>%(risk_score_display)s%(risk_bar)s</td></tr>
<tr><td>Explanation</td><td>%(explanation)s</td></tr>
<tr><td>Recommendation</td><td>%(recommendation)s</td></tr>
</table>

<div class="disclaimer">
<strong>Disclaimer:</strong> This report is generated from stored analysis
results produced by AI models. Risk scores are heuristic estimates and not
proven probabilities of attack. They should be used as one signal among
others and never as the sole basis for security-critical decisions.
</div>

</body>
</html>"""


def _bar_html(pct: float | None, color: str) -> str:
    if pct is None:
        return ""
    v = round(pct * 100)
    return (
        f'<div class="bar-outer" style="display:inline-block;vertical-align:middle;'
        f'margin-left:10px"><div class="bar-inner" style="width:{v}%;background:{color}">'
        f"</div></div>"
    )


def _pct(val: float | None) -> str:
    if val is None:
        return "\u2014"
    return f"{round(val * 100)}%"


def _fmt_duration(seconds: float | None) -> str:
    if seconds is None:
        return "\u2014"
    return f"{seconds:.1f}s"


def _escape(val: str | None) -> str:
    return escape(val) if val else "\u2014"


@router.get(
    "/{analysis_id}/report",
    response_class=HTMLResponse,
    status_code=status.HTTP_200_OK,
)
def get_analysis_report(
    analysis_id: uuid.UUID, db: Session = Depends(get_db)
) -> HTMLResponse:
    """Return a clean printable HTML report for the analysis.

    All values come from stored database records — nothing is recomputed.
    The response is a standalone HTML document suitable for browser
    print / save-to-PDF.
    """
    from datetime import datetime, timezone

    record = analysis_service.get_analysis_record(analysis_id, db)
    created = record.created_at
    generated = datetime.now(timezone.utc)

    ai_p = record.ai_probability
    real_p = record.real_probability
    risk_score = record.risk_score

    verification = "Not performed"
    if record.speaker_verification_status == "VERIFIED":
        verification = "MATCH" if record.speaker_verified else "NO MATCH"
    elif record.speaker_verification_status == "FAILED":
        verification = "Failed"

    body = _REPORT_BODY % {
        "generated_at": generated.strftime("%Y-%m-%d %H:%M UTC"),
        "analysis_id": str(record.id),
        "created_at": created.strftime("%Y-%m-%d %H:%M:%S") if created else "\u2014",
        "filename": _escape(record.original_filename),
        "source": record.source or "UPLOAD",
        "duration": _fmt_duration(record.duration_seconds),
        "status": record.status.value,
        "ai_prob_display": _pct(ai_p),
        "ai_bar": _bar_html(ai_p, "#dc2626"),
        "real_prob_display": _pct(real_p),
        "real_bar": _bar_html(real_p, "#059669"),
        "prediction": _escape(record.deepfake_label.title()) if record.deepfake_label else "\u2014",
        "deepfake_model": _escape(record.deepfake_model) if record.deepfake_model else "\u2014",
        "reference_name": _escape(record.reference_name) if record.reference_name else "\u2014",
        "similarity_display": _pct(record.speaker_similarity),
        "similarity_bar": _bar_html(record.speaker_similarity, "#0f766e"),
        "verification_display": verification,
        "speaker_model": _escape(record.speaker_model) if record.speaker_model else "\u2014",
        "risk_level": record.risk_level or "UNKNOWN",
        "risk_level_display": record.risk_level or "Not calculated",
        "risk_score_display": _pct(risk_score),
        "risk_bar": _bar_html(risk_score, "#dc2626"),
        "explanation": _escape(record.risk_explanation),
        "recommendation": _escape(record.risk_recommendation),
    }
    return HTMLResponse(content=_REPORT_CSS + body)