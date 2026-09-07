"""Audio quality validation before handing audio to future AI models."""

import numpy as np

from app.core.config import settings
from app.core.exceptions import BadRequestError, PreprocessingError


class AudioValidator:
    """Validates duration, sample rate, channels, and signal content."""

    @staticmethod
    def validate_duration(duration_seconds: float) -> None:
        """Reject audio outside the configurable [min, max] window."""
        if duration_seconds < settings.min_audio_duration_seconds:
            raise BadRequestError("Audio file is too short.")
        if duration_seconds > settings.max_audio_duration_seconds:
            raise BadRequestError("Audio file is too long.")

    @staticmethod
    def validate_processed(
        samples: np.ndarray,
        sample_rate: int,
        duration_seconds: float,
    ) -> None:
        """Validate the final processed signal before it is stored.

        Any violation here is an internal processing defect, not a user
        error - processed output is produced by this service.
        """
        if sample_rate != settings.target_sample_rate:
            raise PreprocessingError(
                "Processed audio does not match the target sample rate."
            )
        if samples.ndim != 1:
            raise PreprocessingError("Processed audio is not mono.")
        if samples.size == 0:
            raise PreprocessingError("Processed audio contains no samples.")
        if not np.all(np.isfinite(samples)):
            raise PreprocessingError("Processed audio contains non-finite samples.")
        if duration_seconds < settings.min_audio_duration_seconds:
            raise BadRequestError("Audio file is too short.")