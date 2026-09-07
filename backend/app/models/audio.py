"""Audio analysis ORM model.

Represents one uploaded audio file and its analysis record. The ML
analysis fields arrive in later phases; this model only tracks upload
metadata and lifecycle status.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    Enum,
    Float,
    Integer,
    String,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database.database import Base
from app.models.enums import AudioAnalysisStatus


def _enum_values(cls: type[AudioAnalysisStatus]) -> list[str]:
    return [member.value for member in cls]


class AudioAnalysis(Base):
    """Metadata for a single uploaded audio file awaiting analysis."""

    __tablename__ = "audio_analyses"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    stored_filename: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True
    )
    file_extension: Mapped[str] = mapped_column(String(10), nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[AudioAnalysisStatus] = mapped_column(
        Enum(
            AudioAnalysisStatus,
            name="audio_analysis_status",
            values_callable=_enum_values,
        ),
        default=AudioAnalysisStatus.UPLOADED,
        nullable=False,
        index=True,
    )

    # Preprocessing metadata (filled by the Phase 3 pipeline)
    original_sample_rate: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    original_channels: Mapped[int | None] = mapped_column(Integer, nullable=True)
    processed_sample_rate: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )
    processed_channels: Mapped[int | None] = mapped_column(Integer, nullable=True)
    processed_duration_seconds: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )
    processed_filename: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    preprocessing_error: Mapped[str | None] = mapped_column(
        String(2000), nullable=True
    )

    # Deepfake / synthetic voice detection (filled by the ML pipeline)
    ai_probability: Mapped[float | None] = mapped_column(Float, nullable=True)
    real_probability: Mapped[float | None] = mapped_column(Float, nullable=True)
    deepfake_label: Mapped[str | None] = mapped_column(String(50), nullable=True)
    deepfake_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    deepfake_model_version: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    deepfake_processing_time: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )
    deepfake_device: Mapped[str | None] = mapped_column(String(50), nullable=True)
    deepfake_error: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )