"""Unit tests for the ML detector layer (no model download).

Uses stub model/feature-extractor objects to validate the probability
math, label mapping, chunk aggregation, and input guards. Requires torch
(installed) but never downloads weights.
"""

from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from app.core.config import settings
from app.core.exceptions import DeepfakeDetectionError, DeepfakeInputError
from tests.deepfake_fakes import (
    StubModel,
    make_detector_from_logits,
    write_valid_wav,
)


def test_build_detector_reads_label_map():
    detector, model = make_detector_from_logits()
    assert detector.labels == ("real", "fake")
    assert detector.name == "garystafford/wav2vec2-deepfake-voice-detector"


def test_build_detector_missing_labels_raises():
    model = StubModel({}, [[1.0, 1.0]])
    from app.ml.deepfake_detector import Wav2Vec2DeepfakeDetector
    from tests.deepfake_fakes import StubFeatureExtractor

    with pytest.raises(DeepfakeDetectionError):
        Wav2Vec2DeepfakeDetector(model, StubFeatureExtractor(), "cpu")


def test_predict_probabilities_valid_and_sum_one(tmp_path):
    detector, _ = make_detector_from_logits(logits=[[1.0, 3.0]])
    path = write_valid_wav(tmp_path / "a.wav")

    pred = detector.predict(path)

    assert 0.0 <= pred.ai_probability <= 1.0
    assert 0.0 <= pred.real_probability <= 1.0
    assert round(pred.ai_probability + pred.real_probability, 6) == 1.0
    # softmax([1.0, 3.0]) -> fake prob ~0.8808
    assert pred.ai_probability == pytest.approx(0.880797, abs=1e-4)
    assert pred.predicted_class == "synthetic"
    assert pred.device == "cpu"


def test_predict_real_class_mapping(tmp_path):
    detector, _ = make_detector_from_logits(logits=[[3.0, 1.0]])
    path = write_valid_wav(tmp_path / "a.wav")

    pred = detector.predict(path)

    assert pred.ai_probability == pytest.approx(0.119203, abs=1e-4)
    assert pred.predicted_class == "real"


def test_long_audio_aggregates_segment_probabilities(tmp_path, monkeypatch):
    # Two 1s windows scoring fake/unfake -> mean ai_probability.
    monkeypatch.setattr(settings, "model_chunk_seconds", 1)
    monkeypatch.setattr(settings, "model_overlap_seconds", 0)
    detector, model = make_detector_from_logits(
        logits=[[1.0, 3.0], [3.0, 1.0]]
    )
    path = write_valid_wav(tmp_path / "a.wav", duration=2.0)

    pred = detector.predict(path)

    assert model.calls == 2
    expect = 0.5 * (0.880797 + 0.119203)
    assert pred.ai_probability == pytest.approx(expect, abs=1e-3)


def test_invalid_sample_rate_rejected(tmp_path):
    import numpy as np

    detector, _ = make_detector_from_logits()
    path = tmp_path / "wrong.wav"
    t = np.arange(16000) / 44100
    sf.write(str(path), 0.5 * np.sin(2 * np.pi * 440 * t), 44100, subtype="PCM_16")

    with pytest.raises(DeepfakeInputError):
        detector.predict(path)


def test_corrupted_audio_rejected(tmp_path):
    detector, _ = make_detector_from_logits()
    path = tmp_path / "bad.wav"
    path.write_bytes(b"not audio at all")

    with pytest.raises(DeepfakeInputError):
        detector.predict(path)


def test_missing_audio_rejected(tmp_path):
    detector, _ = make_detector_from_logits()
    with pytest.raises(DeepfakeInputError):
        detector.predict(tmp_path / "absent.wav")


def test_audio_too_short_rejected(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "model_min_chunk_seconds", 0.5)
    detector, _ = make_detector_from_logits()
    path = write_valid_wav(tmp_path / "a.wav", duration=0.2)

    with pytest.raises(DeepfakeInputError):
        detector.predict(path)