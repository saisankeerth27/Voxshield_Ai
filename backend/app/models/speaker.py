"""Speaker profile ORM model.

One application-level speaker profile holds a deterministic embedding
extracted by the real ECAPA-TDNN model. The embedding is stored as
dimension-prefixed float32 bytes and is NEVER returned to the client.

The raw reference audio we recorded/uploaded is deleted immediately after
the embedding is extracted (GBVCD-AVOID-STORE semantics); only the
embedding, metadata, and timing information persist.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Float,
    Integer,
    LargeBinary,
    String,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.database.database import Base


class SpeakerProfile(Base):
    """The registered speaker reference embedding + metadata."""

    __tablename__ = "speaker_profiles"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # Dimension-prefixed float32 embedding (see SpeakerEmbedding.to_bytes).
    embedding_bytes: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    embedding_dim: Mapped[int] = mapped_column(Integer, nullable=False)
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    model_version: Mapped[str] = mapped_column(String(100), nullable=False)
    device: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sample_rate: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    active: Mapped[bool] = mapped_column(nullable=False, default=True, index=True)

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