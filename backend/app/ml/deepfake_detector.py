"""Wav2Vec2-based deepfake / synthetic speech detector.

Model: ``garystafford/wav2vec2-deepfake-voice-detector``
- architecture: Wav2Vec2ForSequenceClassification (0.3B params)
- input: raw 16 kHz mono waveform (Phase 3 processed WAV)
- output: logits over 2 classes with ``id2label {0: 'real', 1: 'fake'}``
  (verified from the model's own ``config.json`` on Hugging Face)
- softmax is applied to logits to obtain probabilities

Design notes:
- The transformer/feature-extractor are injected via the constructor so
  unit tests can run with lightweight stubs (no giant download).
- Inference runs inside ``torch.inference_mode()`` (no gradients).
- Long audio is segmented and per-window probabilities are averaged
  (see ``app.ml.preprocessing`` for the documented policy).
"""

from pathlib import Path

import numpy as np

from app.core.config import settings
from app.core.exceptions import DeepfakeDetectionError, DeepfakeInputError
from app.ml.base import DeepfakeDetector
from app.ml.preprocessing import (
    load_processed_waveform,
    chunk_waveform,
    min_inference_duration_seconds,
)
from app.ml.schemas import DeepfakePrediction

# Public-facing class names for the model's raw labels.
PUBLIC_CLASS_NAMES = {"real": "real", "fake": "synthetic", "spoof": "synthetic"}
SILENCE_LABEL_SENTINELS = {"fake", "spoof"}
TARGET_SAMPLE_RATE = 16000


class Wav2Vec2DeepfakeDetector(DeepfakeDetector):
    """Concrete ``DeepfakeDetector`` backed by a Wav2Vec2 audio classifier."""

    def __init__(self, model, feature_extractor, device: str) -> None:
        self._model = model
        self._feature_extractor = feature_extractor
        self._device = device
        self._name = str(settings.deepfake_model_name)
        self._version = self._resolve_version()
        self._id2label: dict[int, str] | None = getattr(
            getattr(model, "config", None), "id2label", None
        )
        if not self._id2label:
            raise DeepfakeDetectionError(
                "Model does not expose class label configuration."
            )

    @property
    def name(self) -> str:
        return self._name

    @property
    def version(self) -> str:
        return self._version

    @property
    def device(self) -> str:
        return self._device

    @property
    def labels(self) -> tuple[str, ...]:
        return tuple(str(self._id2label[i]) for i in sorted(self._id2label))

    def _resolve_version(self) -> str:
        """Best-effort model revision (HF commit sha); falls back to 'main'."""
        try:
            from huggingface_hub import HfApi

            return str(HfApi().model_info(self._name).sha)
        except Exception:
            return "main"

    def predict(self, audio_path: Path) -> DeepfakePrediction:
        """Run real inference and return actual model probabilities."""
        import torch

        waveform = load_processed_waveform(audio_path)
        if waveform.size / TARGET_SAMPLE_RATE < min_inference_duration_seconds():
            raise DeepfakeInputError(
                "Processed audio is too short for model inference."
            )

        windows = chunk_waveform(
            waveform,
            chunk_seconds=settings.model_chunk_seconds,
            overlap_seconds=settings.model_overlap_seconds,
        )

        segment_probs: list[np.ndarray] = []
        try:
            with torch.inference_mode():
                for window in windows:
                    inputs = self._feature_extractor(
                        window,
                        sampling_rate=TARGET_SAMPLE_RATE,
                        return_tensors="pt",
                    )
                    inputs = {k: v.to(self._device) for k, v in inputs.items()}
                    logits = self._model(**inputs).logits
                    probs = torch.softmax(logits.float(), dim=-1).detach().cpu()
                    segment_probs.append(probs[0].numpy())
        except DeepfakeInputError:
            raise
        except Exception:
            raise DeepfakeDetectionError(
                "Model inference failed for the supplied audio."
            ) from None

        if not segment_probs:
            raise DeepfakeDetectionError(
                "Model produced no output for the supplied audio."
            )

        probs_array = np.mean(np.stack(segment_probs), axis=0)  # per-class probs
        fake_index = self._fake_class_index()
        if fake_index is None or fake_index >= len(probs_array):
            raise DeepfakeDetectionError(
                "Model output does not expose a synthetic-speech class."
            )

        ai_probability = round(float(probs_array[fake_index]), 6)
        real_probability = round(float(1.0 - ai_probability), 6)

        predicted_class = self._classify(probs_array)
        return DeepfakePrediction(
            ai_probability=ai_probability,
            real_probability=real_probability,
            predicted_class=predicted_class,
            model_name=self.name,
            model_version=self.version,
            device=self.device,
        )

    def _fake_class_index(self) -> int | None:
        """Index of the synthetic/fake class per the model's id2label."""
        for index, raw_label in self._id2label.items():
            if str(raw_label).lower() in SILENCE_LABEL_SENTINELS:
                return int(index)
        return None

    def _classify(self, probs: np.ndarray) -> str:
        """Map softmax probabilities to a public class name.

        The model's own ``id2label`` defines class order (verified as
        ``{0: 'real', 1: 'fake'}``). ``public`` names are derived so the
        API speaks about "synthetic" instead of raw dataset labels.
        """
        index = int(np.argmax(probs))
        raw_label = str(self._id2label[index])
        return PUBLIC_CLASS_NAMES.get(raw_label, raw_label)