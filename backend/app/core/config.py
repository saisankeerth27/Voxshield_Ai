"""Application configuration loaded from environment variables."""

from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings sourced from .env / environment variables."""

    app_name: str = "VoiceShield"
    app_version: str = "0.1.0"
    debug: bool = False

    # Database
    database_url: str = Field(
        default="postgresql://postgres:password@localhost:5432/voiceshield"
    )

    # Security (reserved for future phases; not used for authentication yet)
    secret_key: str = Field(default="change-me-in-production")
    algorithm: str = "HS256"

    # CORS
    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]

    # Audio uploads
    max_audio_size_mb: int = 25
    upload_dir: str = "uploads"

    # Audio preprocessing
    target_sample_rate: int = 16000
    min_audio_duration_seconds: float = 1
    max_audio_duration_seconds: float = 300
    processed_audio_dir: str = "processed_audio"
    # RMS floor (dB) below which a signal is treated as silence
    silence_threshold_db: float = -50
    # librosa top_db used to trim leading/trailing silence
    trim_top_db: float = 35
    # Optional explicit FFmpeg binary path (resolved otherwise)
    ffmpeg_binary: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Return the cached application settings instance."""
    return Settings()


settings = get_settings()
