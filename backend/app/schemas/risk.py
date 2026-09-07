"""Pydantic schemas for the risk fusion endpoints."""

from pydantic import BaseModel


class RiskCalculateResponse(BaseModel):
    """Snapshot returned after a risk calculation run."""

    analysis_id: str
    status: str
    risk_status: str
    risk_score: float | None
    risk_level: str | None
    explanation: str | None
    recommendation: str | None
    risk_processing_time: float | None
    risk_engine_version: str | None
    message: str


class RiskResultResponse(BaseModel):
    """Stored risk result returned by GET risk."""

    analysis_id: str
    status: str
    risk_status: str | None
    risk_score: float | None
    risk_level: str | None
    explanation: str | None
    recommendation: str | None
    risk_processing_time: float | None
    risk_engine_version: str | None
