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

    # Deepfake / synthetic voice detection (ML)
    # Model fine-tuned on real speech vs AI TTS / voice-cloning audio.
    deepfake_model_name: str = "garystafford/wav2vec2-deepfake-voice-detector"
    # Device resolution: auto | cpu | cuda
    model_device: str = "auto"
    # Hugging Face cache directory for downloaded weights (gitignored)
    model_cache_dir: str = "models"
    # Long-audio segmentation before inference (seconds per window)
    model_chunk_seconds: int = 30
    # Overlap between windows (seconds); 0 disables overlap.
    model_overlap_seconds: int = 0
    # Minimum segment duration that is meaningful for the model (seconds)
    model_min_chunk_seconds: float = 0.5

    # Speaker verification (Phase 5 - ECAPA-TDNN speaker recognition)
    # Pretrained SpeechBrain ECAPA-TDNN trained on VoxCeleb 1+2.
    speaker_model_name: str = "speechbrain/spkrec-ecapa-voxceleb"
    # Where SpeechBrain materialises the downloaded model (gitignored).
    speaker_model_savedir: str = "models/speaker"
    # Configurable verification threshold. This is an MVP default and is NOT
    # scientifically calibrated for this dataset/domain - it must be tuned
    # on representative validation data before any security-critical use.
    speaker_similarity_threshold: float = 0.25
    # Audio must contain at least this much speech (16 kHz) to generate a
    # stable speaker embedding (both for profiles and verification).
    min_speaker_duration_seconds: float = 1.0

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
