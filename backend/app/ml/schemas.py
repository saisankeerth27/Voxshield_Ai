"""Data structures produced by the deepfake detection layer."""

from dataclasses import dataclass


@dataclass(frozen=True)
class DeepfakePrediction:
    """A single inference result derived from actual model output."""

    ai_probability: float
    real_probability: float
    predicted_class: str
    model_name: str
    model_version: str
    device: str

    def as_dict(self) -> dict:
        """Plain-dict view used by the API layer."""
        return {
            "ai_probability": self.ai_probability,
            "real_probability": self.real_probability,
            "predicted_class": self.predicted_class,
            "model_name": self.model_name,
            "model_version": self.model_version,
            "device": self.device,
        }


@dataclass(frozen=True)
class DetectorStatus:
    """Reported model-manager state (accurate, never guessed)."""

    state: str  # "not_loaded" | "loading" | "loaded" | "unavailable"
    model_name: str | None = None
    model_version: str | None = None
    device: str | None = None