"""Optional integration test that runs the REAL ECAPA-TDNN speaker model.

Skipped by default. Enable with ``VOICESHIELD_REAL_TEST=1``. Uses the JFK
speech clip (``genuine_human.wav``, ../temp voiceshield_verify dir) split into
two halves for a same-speaker match and an MMS-TTS synthesis
(``synthetic_tts.wav``) for a cross-speaker mismatch.

We assert the qualitative behaviours that matter for the feature (same speaker
verifies at the configured threshold, different speaker does not) rather than
exact similarity numbers, and print the observed similarities for the report.
"""

import os
from pathlib import Path

import pytest

torch = pytest.importorskip("torch")

from app.core.config import settings  # noqa: E402
from app.ml import speaker_verifier_manager  # noqa: E402

pytestmark = pytest.mark.skipif(
    os.environ.get("VOICESHIELD_REAL_TEST") != "1",
    reason="set VOICESHIELD_REAL_TEST=1 to run real-model integration tests",
)

AUDIO_FIXTURES = (
    "C:/Users/23jr1/AppData/Local/Temp/voiceshield_verify/"
)
GENUINE = Path(AUDIO_FIXTURES, "genuine_human.wav")
SYNTHETIC = Path(AUDIO_FIXTURES, "synthetic_tts.wav")


@pytest.fixture(scope="module")
def verifier():
    speaker_verifier_manager._verifier = None
    speaker_verifier_manager._state = "not_loaded"
    yield speaker_verifier_manager.get_verifier()
    speaker_verifier_manager._verifier = None
    speaker_verifier_manager._state = "not_loaded"


@pytest.fixture(scope="module")
def jfk_halves(tmp_path_factory):
    import numpy as np
    import soundfile as sf

    wav, sr = sf.read(GENUINE, dtype="float32", always_2d=True)
    wav = wav[:, 0]
    assert sr == 16000, "fixture must be 16 kHz mono"
    assert wav.size >= 2 * sr, "fixture too short to split"
    half = wav.size // 2
    a = tmp_path_factory.mktemp("jfk") / "part_a.wav"
    b = tmp_path_factory.mktemp("jfk") / "part_b.wav"
    sf.write(str(a), wav[:half], sr, subtype="PCM_16")
    sf.write(str(b), wav[half:], sr, subtype="PCM_16")
    return a, b


def test_same_speaker_verifies(verifier, jfk_halves):
    a, b = jfk_halves
    result_a = verifier.compare_embeddings(
        verifier.create_embedding(a), verifier.create_embedding(b)
    )
    print(f"\nJFK half vs JFK half similarity: {result_a.similarity:.6f}")
    assert result_a.similarity >= 0.0
    assert result_a.similarity <= 1.0
    assert result_a.verified is True, (
        f"same-speaker similarity {result_a.similarity:.3f} below threshold {settings.speaker_similarity_threshold}"
    )


def test_different_speaker_not_verified(verifier, jfk_halves):
    a, _ = jfk_halves
    result_b = verifier.compare_embeddings(
        verifier.create_embedding(a), verifier.create_embedding(SYNTHETIC)
    )
    print(f"\nJFK vs synthetic-TTS similarity: {result_b.similarity:.6f}")
    assert result_b.similarity >= 0.0
    assert result_b.similarity <= 1.0
    assert result_b.verified is False, (
        f"different-speaker similarity {result_b.similarity:.3f} above threshold {settings.speaker_similarity_threshold}"
    )


def test_real_verifier_manager_status_loaded(verifier):
    status = speaker_verifier_manager.status()
    assert status.state == "loaded"
    assert status.device in ("cpu", "cuda")
    assert status.model_name == settings.speaker_model_name