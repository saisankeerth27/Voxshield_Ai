"""SQLAlchemy database configuration.

Provides:
- engine: the SQLAlchemy engine bound to PostgreSQL
- SessionLocal: session factory for per-request sessions
- Base: declarative base for all ORM models
- get_db: FastAPI dependency yielding a session
- init_db: create tables and apply lightweight forward migrations
"""

import logging
from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

logger = logging.getLogger("voiceshield")


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    class_=Session,
)


def get_db() -> Generator[Session, None, None]:
    """Yield a database session for the lifetime of a request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _apply_forward_migrations() -> None:
    """Add new columns to existing tables without dropping data.

    Uses idempotent ``ALTER TABLE ... ADD COLUMN IF NOT EXISTS`` statements
    (PostgreSQL dialect). SQLite errors are caught and ignored because its
    in-memory test tables are already created by ``create_all``.
    """
    statements = [
        "ALTER TABLE audio_analyses ADD COLUMN IF NOT EXISTS original_sample_rate INTEGER",
        "ALTER TABLE audio_analyses ADD COLUMN IF NOT EXISTS original_channels INTEGER",
        "ALTER TABLE audio_analyses ADD COLUMN IF NOT EXISTS processed_sample_rate INTEGER",
        "ALTER TABLE audio_analyses ADD COLUMN IF NOT EXISTS processed_channels INTEGER",
        "ALTER TABLE audio_analyses ADD COLUMN IF NOT EXISTS processed_duration_seconds FLOAT",
        "ALTER TABLE audio_analyses ADD COLUMN IF NOT EXISTS processed_filename VARCHAR(255)",
        "ALTER TABLE audio_analyses ADD COLUMN IF NOT EXISTS preprocessing_error VARCHAR(2000)",
        # Deepfake detection results
        "ALTER TABLE audio_analyses ADD COLUMN IF NOT EXISTS ai_probability FLOAT",
        "ALTER TABLE audio_analyses ADD COLUMN IF NOT EXISTS real_probability FLOAT",
        "ALTER TABLE audio_analyses ADD COLUMN IF NOT EXISTS deepfake_label VARCHAR(50)",
        "ALTER TABLE audio_analyses ADD COLUMN IF NOT EXISTS deepfake_model VARCHAR(255)",
        "ALTER TABLE audio_analyses ADD COLUMN IF NOT EXISTS deepfake_model_version VARCHAR(100)",
        "ALTER TABLE audio_analyses ADD COLUMN IF NOT EXISTS deepfake_processing_time FLOAT",
        "ALTER TABLE audio_analyses ADD COLUMN IF NOT EXISTS deepfake_device VARCHAR(50)",
        "ALTER TABLE audio_analyses ADD COLUMN IF NOT EXISTS deepfake_error VARCHAR(2000)",
        # Speaker verification results
        "ALTER TABLE audio_analyses ADD COLUMN IF NOT EXISTS speaker_verification_status VARCHAR(20)",
        "ALTER TABLE audio_analyses ADD COLUMN IF NOT EXISTS speaker_similarity FLOAT",
        "ALTER TABLE audio_analyses ADD COLUMN IF NOT EXISTS speaker_verified BOOLEAN",
        "ALTER TABLE audio_analyses ADD COLUMN IF NOT EXISTS speaker_model VARCHAR(255)",
        "ALTER TABLE audio_analyses ADD COLUMN IF NOT EXISTS speaker_model_version VARCHAR(100)",
        "ALTER TABLE audio_analyses ADD COLUMN IF NOT EXISTS speaker_processing_time FLOAT",
        "ALTER TABLE audio_analyses ADD COLUMN IF NOT EXISTS speaker_device VARCHAR(50)",
        "ALTER TABLE audio_analyses ADD COLUMN IF NOT EXISTS speaker_error VARCHAR(2000)",
        # New statuses for the extended enum (PostgreSQL only)
        "ALTER TYPE audio_analysis_status ADD VALUE IF NOT EXISTS 'DEEPFAKE_ANALYZED'",
        "ALTER TYPE audio_analysis_status ADD VALUE IF NOT EXISTS 'SPEAKER_ANALYZED'",
    ]
    with engine.connect() as conn:
        for statement in statements:
            try:
                conn.execute(text(statement))
                conn.commit()
            except Exception as exc:  # pragma: no cover - dialect specific
                conn.rollback()
                logger.debug("Skipped migration %r: %s", statement, exc)


def init_db() -> None:
    """Create all tables defined by the ORM models and apply migrations.

    Called during application startup. Tables for detection history and
    voice profiles are added in later phases.
    """
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _apply_forward_migrations()
