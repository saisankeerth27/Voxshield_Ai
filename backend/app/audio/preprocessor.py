"""Central audio preprocessing pipeline.

Coordinates:

    load -> validate -> mono -> resample(16k) -> silence check
          -> trim -> normalize -> validate -> save WAV

The pipeline is synchronous for the MVP but fully isolated behind the
``AudioPreprocessor`` abstraction so it can move to a background worker
without touching the API layer.
"""

import logging
import uuid
from dataclasses import dataclass
from pathlib import Path

import soundfile as sf

from app.audio.converter import AudioConverter
from app.audio.loader import AudioLoader
from app.audio.normalizer import AudioNormalizer
from app.audio.validator import AudioValidator
from app.core.config import settings

logger = logging.getLogger("voiceshield.audio")


@dataclass
class PreprocessingResult:
    """Technical summary of a successful preprocessing run."""

    original_sample_rate: int
    original_channels: int
    original_duration_seconds: float
    processed_sample_rate: int
    processed_channels: int
    processed_duration_seconds: float
    processed_filename: str
    processed_path: Path


class AudioPreprocessor:
    """Orchestrates the full preprocessing pipeline."""

    def __init__(self) -> None:
        self.loader = AudioLoader()
        self.converter = AudioConverter()
        self.normalizer = AudioNormalizer()
        self.validator = AudioValidator()

    def _ensure_dir(self) -> Path:
        processed_dir = Path(settings.processed_audio_dir)
        processed_dir.mkdir(parents=True, exist_ok=True)
        return processed_dir

    def preprocess(self, audio_path: Path) -> PreprocessingResult:
        """Run the full pipeline and return structured preprocessing info."""
        target_rate = settings.target_sample_rate

        loaded = self.loader.load(audio_path)

        # Early rejection of invalid durations before expensive processing.
        self.validator.validate_duration(loaded.duration_seconds)

        mono = self.converter.to_mono(loaded.samples)
        resampled = self.converter.resample(mono, loaded.sample_rate, target_rate)

        # Silence is checked pre-trim so a fully silent file gets the
        # dedicated "insufficient speech signal" error instead of "too short".
        self.normalizer.reject_if_silent(resampled)

        trimmed = self.normalizer.trim_silence(resampled, target_rate)
        normalized = self.normalizer.peak_normalize(trimmed)

        processed_duration = normalized.size / float(target_rate)
        self.validator.validate_processed(normalized, target_rate, processed_duration)

        processed_dir = self._ensure_dir()
        processed_filename = f"{uuid.uuid4().hex}.wav"
        processed_path = processed_dir / processed_filename

        try:
            sf.write(
                str(processed_path),
                normalized,
                target_rate,
                format="WAV",
                subtype="PCM_16",
            )
        except OSError as exc:
            raise RuntimeError(f"Unable to store processed audio: {exc}") from exc

        return PreprocessingResult(
            original_sample_rate=loaded.sample_rate,
            original_channels=loaded.channels,
            original_duration_seconds=loaded.duration_seconds,
            processed_sample_rate=target_rate,
            processed_channels=1,
            processed_duration_seconds=round(processed_duration, 3),
            processed_filename=processed_filename,
            processed_path=processed_path,
        )