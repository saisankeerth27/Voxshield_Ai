"""Optional integration test that runs the REAL deepfake model.

Skipped by default. Enable with ``VOICESHIELD_REAL_TEST=1``. Downloads the
model from Hugging Face (cache: ``backend/models``) and runs a genuine
non-silent waveform through the full pipeline, verifying that real model
output is produced and synthesized into valid, human-readable fields.

The waveform is a speech-like signal (voiced harmonics + noise), NOT a
TTS generation, so no assertion is made about the predicted class itself;
only about the correctness of the output contract.
"""

import os
from pathlib import Path

import pytest

torch = pytest.importorskip("torch")

from app.core.config import settings  # noqa: E402
from app.ml import deepfake_model_manager  # noqa: E402

pytestmark = pytest.mark.skipif(
    os.environ.get("VOICESHIELD_REAL_TEST") != "1",
    reason="set VOICESHIELD_REAL_TEST=1 to run real-model integration tests",
)


@pytest.fixture(scope="module")
def detector():
    deepfake_model_manager._detector = None
    deepfake_model_manager._state = "not_loaded"
    yield deepfake_model_manager.get_detector()
    deepfake_model_manager._detector = None
    deepfake_model_manager._state = "not_loaded"


def _speech_like_wav(path: Path) -> Path:
    import numpy as np
    import soundfile as sf

    sr = 16000
    duration = 3.0
    t = np.arange(int(duration * sr)) / sr
    envelope = 0.5 + 0.5 * np.sin(2 * np.pi * 3.0 * t)
    voiced = envelope * np.sin(2 * np.pi * 160 * t)
    voiced += 0.12 * np.sin(2 * np.pi * 320 * t)
    signal = voiced + 0.05 * np.random.default_rng(3).standard_normal(voiced.size)
    sf.write(str(path), signal, sr, subtype="PCM_16")
    return path


def test_real_model_pipeline_contract(detector, tmp_path):
    path = _speech_like_wav(tmp_path / "input.wav")

    prediction = detector.predict(path)

    assert 0.0 <= prediction.ai_probability <= 1.0
    assert 0.0 <= prediction.real_probability <= 1.0
    assert round(prediction.ai_probability + prediction.real_probability, 6) == 1.0
    assert prediction.predicted_class in ("real", "synthetic")
    assert prediction.model_name == settings.deepfake_model_name
    assert prediction.device in ("cpu", "cuda")


def test_real_model_manager_status_loaded(detector):
    status = deepfake_model_manager.status()
    assert status.state == "loaded"
    assert status.device in ("cpu", "cuda")
    assert status.model_name == settings.deepfake_model_name