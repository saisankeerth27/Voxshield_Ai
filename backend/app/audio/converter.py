"""Audio conversion: stereo-to-mono downmix and resampling."""

import numpy as np
import librosa

from app.core.config import settings
from app.core.exceptions import PreprocessingError


class AudioConverter:
    """Normalize channel count (-> mono) and sample rate (-> 16 kHz)."""

    @staticmethod
    def to_mono(samples: np.ndarray) -> np.ndarray:
        """Downmix any channel layout to mono by averaging channels.

        Averaging (rather than discarding) preserves energy from every
        channel and is safe for multi-channel or unbalanced sources.
        """
        if samples.ndim == 1 or samples.shape[1] == 1:
            return samples[:, 0].copy() if samples.shape[1] == 1 else samples.copy()
        return np.mean(samples, axis=1).astype(np.float32, copy=False)

    @staticmethod
    def resample(
        samples: np.ndarray, source_rate: int, target_rate: int
    ) -> np.ndarray:
        """Resample to the target rate using a high-quality algorithm.

        Files already at the target rate are returned unchanged (no
        unnecessary repeated resampling).
        """
        if source_rate == target_rate:
            return samples
        if target_rate <= 0 or source_rate <= 0:
            raise PreprocessingError("Invalid sample rate encountered.")

        try:
            return librosa.resample(
                samples,
                orig_sr=source_rate,
                target_sr=target_rate,
                res_type="soxr_hq",
            )
        except Exception:
            # soxr backend unavailable in exotic installs: fall back to
            # the polyphase (high-quality) resampler.
            return librosa.resample(
                samples,
                orig_sr=source_rate,
                target_sr=target_rate,
                res_type="polyphase",
            )


def target_sample_rate() -> int:
    """Convenience accessor for the configured 16 kHz target."""
    return settings.target_sample_rate