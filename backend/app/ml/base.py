"""Stable interface for deepfake / synthetic speech detectors.

The application only depends on ``DeepfakeDetector``. Concrete models
(such as the Wav2Vec2 implementation) can be swapped without touching the
rest of the codebase.
"""

from abc import ABC, abstractmethod
from pathlib import Path

from app.ml.schemas import DeepfakePrediction


class DeepfakeDetector(ABC):
    """Interface every detector implementation must satisfy."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable model identifier (e.g. HF repo id)."""

    @property
    @abstractmethod
    def version(self) -> str:
        """Loaded revision / version of the model weights."""

    @property
    @abstractmethod
    def device(self) -> str:
        """Device used for inference: 'cpu' or 'cuda'."""

    @property
    @abstractmethod
    def labels(self) -> tuple[str, ...]:
        """Ordered model output labels (index == logits column)."""

    @abstractmethod
    def predict(self, audio_path: Path) -> DeepfakePrediction:
        """Run inference on a processed (16 kHz mono WAV) file.

        Probabilities come from real model output. Raises typed ML errors
        on invalid audio or inference failures.
        """