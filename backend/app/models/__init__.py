"""ORM models package.

Import every model here so SQLAlchemy registers its table on
``Base.metadata`` (required by ``create_all``).
"""

from app.models.audio import AudioAnalysis  # noqa: F401
from app.models.enums import AudioAnalysisStatus, SpeakerVerificationStatus  # noqa: F401
from app.models.speaker import SpeakerProfile  # noqa: F401

__all__ = [
    "AudioAnalysis",
    "AudioAnalysisStatus",
    "SpeakerVerificationStatus",
    "SpeakerProfile",
]