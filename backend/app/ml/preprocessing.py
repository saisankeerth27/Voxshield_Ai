"""Model-ready audio preparation (inference-side only).

This layer consumes the processed audio produced by the Phase 3 pipeline
(16 kHz mono WAV) and prepares it for a model. It intentionally does NOT
re-implement conversion/resampling/normalization - that already happened
during preprocessing. What remains is verification plus long-audio
segmentation into inference windows.

Segment aggregation policy (documented, not invented):
the waveform is split into fixed-length windows (configurable
``MODEL_CHUNK_SECONDS`` / ``MODEL_OVERLAP_SECONDS``) and each window is
scored independently. Window probabilities are then averaged. Mean
probability aggregation is the standard, straightforward approach for
audio classification over longer recordings and keeps each window within
the model's expected operating range.
"""

from pathlib import Path

import numpy as np

from app.core.config import settings
from app.core.exceptions import DeepfakeInputError

PROCESSED_SAMPLE_RATE = 16000


def load_processed_waveform(audio_path: Path) -> np.ndarray:
    """Load and validate a processed WAV into a float32 mono waveform."""
    import soundfile as sf

    if not audio_path.is_file():
        raise DeepfakeInputError("Processed audio file not found.")

    try:
        with sf.SoundFile(str(audio_path)) as sound:
            if sound.samplerate != PROCESSED_SAMPLE_RATE:
                raise DeepfakeInputError(
                    "Processed audio is not 16 kHz; re-run preprocessing."
                )
            if sound.channels != 1:
                raise DeepfakeInputError(
                    "Processed audio is not mono; re-run preprocessing."
                )
            waveform = sound.read(dtype="float32", always_2d=True)[:, 0]
    except DeepfakeInputError:
        raise
    except Exception:
        raise DeepfakeInputError(
            "Processed audio is corrupted and cannot be read."
        ) from None

    if waveform.size == 0:
        raise DeepfakeInputError("Processed audio is empty.")
    if not bool(np.all(np.isfinite(waveform))):
        raise DeepfakeInputError("Processed audio contains invalid samples.")

    return waveform


def chunk_waveform(
    waveform: np.ndarray,
    chunk_seconds: int = 30,
    overlap_seconds: int = 0,
) -> list[np.ndarray]:
    """Split a waveform into overlapping windows for inference.

    Returns a list of windowed arrays. Each window is at most
    ``chunk_seconds`` long; the final window is not padded to the full
    length (models accept variable-length input).
    """
    if chunk_seconds <= 0:
        raise DeepfakeInputError("Invalid inference chunk configuration.")

    chunk = int(chunk_seconds * PROCESSED_SAMPLE_RATE)
    step = chunk - int(overlap_seconds * PROCESSED_SAMPLE_RATE)
    step = max(step, 1)

    total = waveform.size
    if total <= chunk:
        return [waveform]

    windows: list[np.ndarray] = []
    start = 0
    while start < total:
        windows.append(waveform[start : start + chunk])
        start += step
    return windows


def min_inference_duration_seconds() -> float:
    """Smallest waveform duration the pipeline will accept for inference."""
    return settings.model_min_chunk_seconds