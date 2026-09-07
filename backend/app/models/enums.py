"""Analysis status enumeration."""

import enum


class AudioAnalysisStatus(str, enum.Enum):
    """Lifecycle states of an uploaded audio analysis record."""

    UPLOADED = "UPLOADED"
    PREPROCESSING = "PREPROCESSING"
    READY_FOR_ANALYSIS = "READY_FOR_ANALYSIS"
    PROCESSING = "PROCESSING"
    DEEPFAKE_ANALYZED = "DEEPFAKE_ANALYZED"
    SPEAKER_ANALYZED = "SPEAKER_ANALYZED"
    RISK_CALCULATED = "RISK_CALCULATED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class SpeakerVerificationStatus(str, enum.Enum):
    """Per-analysis speaker verification module state.

    Kept separate from ``AudioAnalysisStatus`` so deepfake semantics are
    never coupled to speaker verification failures.
    """

    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    VERIFIED = "VERIFIED"
    FAILED = "FAILED"


class RiskLevel(str, enum.Enum):
    """Discrete risk classification produced by the risk fusion engine."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class RiskStatus(str, enum.Enum):
    """Per-analysis risk-engine module state.

    Separated from the top-level lifecycle so a deepfake/speaker result
    remains valid even if risk fusion is still pending or failed.
    """

    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    CALCULATED = "CALCULATED"
    FAILED = "FAILED"