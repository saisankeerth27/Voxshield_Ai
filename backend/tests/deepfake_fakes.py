"""Lightweight detector fakes for unit/API tests (no model download).

``FakeDeepfakeDetector`` implements the ``DeepfakeDetector`` interface
with deterministic predictions so tests can verify API flow, label
mapping, and probability arithmetic without touching Hugging Face.
"""

from pathlib import Path
from types import SimpleNamespace

import numpy as np
import torch

from app.ml.base import DeepfakeDetector
from app.ml.schemas import DeepfakePrediction


class StubConfig:
    def __init__(self, id2label: dict[int, str]) -> None:
        self.id2label = id2label


class StubFeatureExtractor:
    """Mimics Wav2Vec2 feature extraction: raw float32 window as tensor."""

    def __call__(self, waveform, sampling_rate=None, return_tensors=None):
        tensor = torch.tensor(np.asarray(waveform, dtype=np.float32))
        return {"input_values": tensor.unsqueeze(0)}


class StubModel:
    """Returns configurable logits per call, shape (1, num_classes)."""

    def __init__(self, id2label: dict[int, str], logits: list[list[float]]):
        self.config = StubConfig(id2label)
        self._logits = logits
        self.calls = 0

    def __call__(self, **inputs):
        self.calls += 1
        idx = min(self.calls - 1, len(self._logits) - 1)
        tensor = torch.tensor([self._logits[idx]], dtype=torch.float32)
        return SimpleNamespace(logits=tensor)


class FakeDeepfakeDetector(DeepfakeDetector):
    """Pre-computed deterministic prediction. Tracks call count."""

    def __init__(
        self,
        ai_probability: float = 0.91,
        predicted_class: str = "synthetic",
        device: str = "cpu",
        raises: Exception | None = None,
    ) -> None:
        self.ai_probability = ai_probability
        self.predicted_class = predicted_class
        self.device_name = device
        self._raises = raises
        self.predict_calls = 0

    @property
    def name(self) -> str:
        return "fake-deepfake-detector"

    @property
    def version(self) -> str:
        return "test-0.0.1"

    @property
    def device(self) -> str:
        return self.device_name

    @property
    def labels(self) -> tuple[str, ...]:
        return ("real", "fake")

    def predict(self, audio_path: Path) -> DeepfakePrediction:
        self.predict_calls += 1
        if self._raises is not None:
            raise self._raises
        real = round(1.0 - self.ai_probability, 6)
        return DeepfakePrediction(
            ai_probability=self.ai_probability,
            real_probability=real,
            predicted_class=self.predicted_class,
            model_name=self.name,
            model_version=self.version,
            device=self.device,
        )


def make_detector_from_logits(
    id2label: dict[int, str] | None = None,
    logits: list[list[float]] | None = None,
    device: str = "cpu",
):
    """Build a real ``Wav2Vec2DeepfakeDetector`` around stub model parts."""
    from app.ml.deepfake_detector import Wav2Vec2DeepfakeDetector

    id2label = id2label or {0: "real", 1: "fake"}
    logits = logits or [[1.0, 3.0]]
    model = StubModel(id2label, logits)
    extractor = StubFeatureExtractor()
    return Wav2Vec2DeepfakeDetector(model, extractor, device), model


def write_valid_wav(path: Path, duration: float = 2.0) -> Path:
    """Write a real non-silent 16 kHz mono WAV for inference tests."""
    import soundfile as sf

    sr = 16000
    frames = int(duration * sr)
    t = np.arange(frames) / sr
    samples = 0.5 * np.sin(2 * np.pi * 440 * t)
    sf.write(str(path), samples, sr, subtype="PCM_16")
    return path