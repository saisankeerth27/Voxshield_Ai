"""Stable interfaces for the ML detection models.

The application only depends on the abstractions ``DeepfakeDetector`` and
``SpeakerVerifier``. Concrete models can be swapped without touching the
rest of the codebase. Speaker verification stays fully decoupled from
deepfake detection.
"""

from abc import ABC, abstractmethod
from pathlib import Path

from app.ml.schemas import (
    DeepfakePrediction,
    SpeakerEmbedding,
    SpeakerVerificationResult,
)


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


class SpeakerVerifier(ABC):
    """Interface for speaker embedding extraction and verification.

    The API/service layer must NOT depend on SpeechBrain internals; it
    only speaks to this abstraction.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable model identifier (e.g. HF repo id)."""

    @property
    @abstractmethod
    def version(self) -> str:
        """Model/package version identifying the loaded checkpoint."""

    @property
    @abstractmethod
    def device(self) -> str:
        """Device used for inference: 'cpu' or 'cuda'."""

    @property
    @abstractmethod
    def embedding_dim(self) -> int:
        """Fixed dimensionality of generated embeddings."""

    @abstractmethod
    def create_embedding(self, audio_path: Path) -> SpeakerEmbedding:
        """Generate a speaker embedding for a processed (16 kHz mono) file.

        The embedding always comes from real model inference and is
        deterministic for a given input/model configuration.
        """

    @abstractmethod
    def compare_embeddings(
        self, reference: SpeakerEmbedding, test: SpeakerEmbedding
    ) -> SpeakerVerificationResult:
        """Return actual cosine similarity between two embeddings.

        Dimension mismatch is a typed error, never silently ignored.
        """

    def verify(
        self, reference_audio: Path, test_audio: Path
    ) -> SpeakerVerificationResult:
        """Convenience: create both embeddings and compare them."""
        reference = self.create_embedding(reference_audio)
        test = self.create_embedding(test_audio)
        return self.compare_embeddings(reference, test)