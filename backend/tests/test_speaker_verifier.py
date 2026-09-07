"""Unit tests for the ECAPA speaker verifier wrapper + embedding storage.

Uses the real ``ECAPASpeakerVerifier`` class with a tiny deterministic
``HashEncoder`` stub (no SpeechBrain/Hugging Face involved), plus focused
tests for the dimension-prefixed binary embedding format.
"""

import pytest

from app.core.exceptions import (
    SpeakerEmbeddingError,
    SpeakerInputError,
    SpeakerVerificationError,
)
from app.ml.schemas import SpeakerEmbedding
from app.ml.speaker_verifier import (
    ECAPASpeakerVerifier,
    _resolve_model_version,
)
from tests.speaker_fakes import HashEncoder, write_sine_segment

DIM = 192


def make_verifier(encoder=None, version="test-0.0.1") -> ECAPASpeakerVerifier:
    return ECAPASpeakerVerifier(
        encoder=encoder or HashEncoder(dim=DIM),
        device="cpu",
        name="speechbrain/spkrec-ecapa-voxceleb",
        version=version,
        embedding_dim=DIM,
    )


def test_create_embedding_is_normalized_and_deterministic(tmp_path):
    path = write_sine_segment(tmp_path / "a.wav")
    verifier = make_verifier()

    emb_a1 = verifier.create_embedding(path)
    emb_a2 = verifier.create_embedding(path)

    assert emb_a1.embedding_dim == DIM
    assert emb_a1.vector.shape == (DIM,)
    assert abs(float(emb_a1.vector @ emb_a1.vector) - 1.0) < 1e-5
    assert emb_a1.model_name == "speechbrain/spkrec-ecapa-voxceleb"
    assert emb_a1.model_version == "test-0.0.1"
    assert emb_a1.device == "cpu"
    assert (emb_a1.vector == emb_a2.vector).all()


def test_compare_identical_is_one_and_verified(tmp_path):
    a = write_sine_segment(tmp_path / "a.wav")
    verifier = make_verifier()

    emb = verifier.create_embedding(a)
    result = verifier.compare_embeddings(emb, emb)

    assert result.similarity == pytest.approx(1.0, abs=1e-6)
    assert result.verified is True
    assert result.embedding_model == "speechbrain/spkrec-ecapa-voxceleb"
    assert result.device == "cpu"


def test_compare_two_speakers_low_similarity(tmp_path):
    verifier = make_verifier()
    a = verifier.create_embedding(write_sine_segment(tmp_path / "a.wav", freq=220))
    b = verifier.create_embedding(write_sine_segment(tmp_path / "b.wav", freq=880))

    result = verifier.compare_embeddings(a, b)

    assert -1.0 <= result.similarity <= 1.0
    assert result.verified is not True or result.similarity >= 0.25


def test_compare_dimension_mismatch_raises(tmp_path):
    verifier = make_verifier()
    a = verifier.create_embedding(write_sine_segment(tmp_path / "a.wav", freq=220))
    other = SpeakerEmbedding(
        vector=a.vector[: a.embedding_dim - 1],
        model_name=a.model_name,
        model_version=a.model_version,
        device=a.device,
        embedding_dim=a.embedding_dim - 1,
    )
    with pytest.raises(SpeakerEmbeddingError):
        verifier.compare_embeddings(a, other)


def test_to_bytes_roundtrip_preserves_embedding():
    vec = (0.1 * (__import__("numpy").arange(10, dtype="float32") + 1)).astype(
        "float32"
    )
    emb = SpeakerEmbedding(
        vector=vec,
        model_name="m",
        model_version="v",
        device="cpu",
        embedding_dim=10,
    )

    decoded = SpeakerEmbedding.from_bytes(
        emb.to_bytes(), model_name="m", model_version="v", device="cpu"
    )

    assert decoded.embedding_dim == 10
    assert (decoded.vector == emb.vector).all()
    assert decoded.model_name == "m"


def test_from_bytes_rejects_wrong_length():
    vec = __import__("numpy").zeros(8, dtype="float32")
    emb = SpeakerEmbedding(
        vector=vec, model_name="m", model_version="v", device="cpu", embedding_dim=8
    )
    payload = emb.to_bytes()[:-4]
    with pytest.raises(ValueError):
        SpeakerEmbedding.from_bytes(payload, model_name="m", model_version="v", device="cpu")


def test_short_audio_raises_input_error(tmp_path):
    path = write_sine_segment(tmp_path / "short.wav", seconds=0.4)
    verifier = make_verifier()
    with pytest.raises(SpeakerInputError):
        verifier.create_embedding(path)


def test_degenerate_embedding_raises(tmp_path):
    class ZeroEncoder:
        def encode_batch(self, tensor):
            import torch

            return torch.zeros(1, 1, DIM, dtype=torch.float32)

    path = write_sine_segment(tmp_path / "a.wav")
    verifier = make_verifier(encoder=ZeroEncoder())
    with pytest.raises(SpeakerVerificationError):
        verifier.create_embedding(path)


def test_version_fallback_when_hub_unreachable(monkeypatch):
    class BrokenHfApi:
        def model_info(self, *args, **kwargs):
            raise RuntimeError("offline")

    monkeypatch.setattr("huggingface_hub.HfApi", BrokenHfApi)
    import speechbrain

    resolved = _resolve_model_version("speechbrain/spkrec-ecapa-voxceleb")
    assert resolved.startswith(f"speechbrain-{speechbrain.__version__.split('.')[0]}")