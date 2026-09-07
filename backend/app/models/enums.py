"""Analysis status enumeration."""

import enum


class AudioAnalysisStatus(str, enum.Enum):
    """Lifecycle states of an uploaded audio analysis record."""

    UPLOADED = "UPLOADED"
    PREPROCESSING = "PREPROCESSING"
    READY_FOR_ANALYSIS = "READY_FOR_ANALYSIS"
    PROCESSING = "PROCESSING"
    DEEPFAKE_ANALYZED = "DEEPFAKE_ANALYZED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"