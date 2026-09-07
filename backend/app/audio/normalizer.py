"""Amplitude normalization and silence handling.

Goals:
- make the signal suitable for downstream AI inference
- never aggressively alter speech characteristics
- reject audio with no meaningful speech signal (do not fake validity)
"""

import numpy as np

from app.core.config import settings
from app.core.exceptions import BadRequestError

# Peak target after normalization (0.9 leaves headroom, avoids clipping)
NORMALIZATION_PEAK = 0.9

# Peak magnitude below which a file is considered silent regardless of RMS
ABS_SILENCE_PEAK = 1e-6


class AudioNormalizer:
    """Applies gain normalization and leading/trailing silence trimming."""

    @staticmethod
    def peak_normalize(samples: np.ndarray) -> np.ndarray:
        """Scale the signal so its peak reaches the target amplitude.

        Extremely quiet audio is boosted; clipping/loud audio is attenuated.
        Never applied to a signal with negligible peak (already rejected).
        """
        peak = float(np.max(np.abs(samples))) if samples.size else 0.0
        if not np.isfinite(peak) or peak <= 0.0:
            raise BadRequestError("Audio contains insufficient speech signal.")
        scale = NORMALIZATION_PEAK / peak
        return (samples.astype(np.float64) * scale).astype(np.float32)

    @staticmethod
    def is_silent(samples: np.ndarray) -> bool:
        """Return True when the signal holds no meaningful audio."""
        rms = float(
            np.sqrt(np.mean(samples.astype(np.float64) ** 2))
        ) if samples.size else 0.0
        peak = float(np.max(np.abs(samples))) if samples.size else 0.0

        if peak < ABS_SILENCE_PEAK:
            return True
        rms_db = 20.0 * np.log10(rms) if rms > 0.0 else -np.inf
        return bool(rms_db < settings.silence_threshold_db)

    def reject_if_silent(self, samples: np.ndarray) -> None:
        """Raise a client error when the file contains no speech."""
        if self.is_silent(samples):
            raise BadRequestError("Audio contains insufficient speech signal.")

    @staticmethod
    def trim_silence(samples: np.ndarray, sample_rate: int) -> np.ndarray:
        """Trim leading/trailing silence while preserving natural pauses."""
        trimmed, _ = librosa_trim(samples, top_db=settings.trim_top_db)
        if trimmed.size == 0:
            raise BadRequestError("Audio contains insufficient speech signal.")
        return trimmed


def librosa_trim(samples: np.ndarray, top_db: float) -> tuple[np.ndarray, np.ndarray]:
    """Thin wrapper around librosa's silence trimder."""
    import librosa

    return librosa.effects.trim(samples, top_db=top_db)