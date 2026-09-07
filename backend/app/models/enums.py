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