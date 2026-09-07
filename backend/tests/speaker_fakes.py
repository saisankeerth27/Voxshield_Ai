"""Lightweight speaker-model fakes for unit/API tests (no model download).

Two levels are provided:

- ``HashEncoder``: a tiny deterministic ``encode_batch`` stub used to drive
  the real ``ECAPASpeakerVerifier`` logic (normalization, dimension checks,
  cosine math) with no SpeechBrain dependency.
- ``FakeSpeakerVerifier``: a full ``SpeakerVerifier`` whose embeddings are
  derived from the actual audio content so profile-registration +
  verification flows behave like the real system (same audio -> similarity
  1, different audio -> low similarity).
"""

import hashlib
from pathlib import Path

import numpy as np
import soundfile as sf

from app.ml.base import SpeakerVerifier
from app.ml.schemas import SpeakerEmbedding, SpeakerVerificationResult

FAKE_SPEAKER_NAME = "fake-ecapa-speaker"
FAKE_SPEAKER_VERSION = "test-0.0.1"


class HashEncoder:
    """Deterministic embedding from waveform statistics + content hash."""

    def __init__(self, dim: int = 192) -> None:
        self.dim = dim

    def encode_batch(self, tensor):
        import torch

        x = tensor.squeeze(0).float()
        mean = float(x.mean())
        std = float(x.std()) if x.numel() > 1 else 0.0
        digest = hashlib.sha256(tensor.detach().numpy().tobytes()).digest()
        seed = np.frombuffer(digest, dtype=np.uint32)
        rng = np.random.default_rng(seed)
        base = rng.random(self.dim) - 0.5
        vec = base * (1.0 + abs(mean)) + std
        return torch.tensor(vec, dtype=torch.float32).reshape(1, 1, self.dim)


# Embedding vectors driven by the audio content so distinct recordings
# produce distinct, deterministic (quasi-random) embeddings, while the same
# content yields the exact same vector (cosine similarity -> 1.0).
def _embedding_from_wave(path: Path, dim: int = 8) -> SpeakerEmbedding:
    with sf.SoundFile(str(path)) as snd:
        wav = snd.read(dtype="float32", always_2d=True)[:, 0]
    if wav.size == 0:
        wav = np.zeros(1600, dtype=np.float32)
    digest = hashlib.sha256(wav.tobytes()).digest()
    seed = np.frombuffer(digest, dtype=np.uint32)
    rng = np.random.default_rng(seed)
    vec = (rng.random(dim) - 0.5).astype(np.float32)
    norm = float(np.linalg.norm(vec))
    if norm > 0:
        vec = vec / norm
    return SpeakerEmbedding(
        vector=vec,
        model_name=FAKE_SPEAKER_NAME,
        model_version=FAKE_SPEAKER_VERSION,
        device="cpu",
        embedding_dim=dim,
    )


class FakeSpeakerVerifier(SpeakerVerifier):
    """Deterministic speaker verifier over real audio-content embeddings."""

    def __init__(
        self,
        device: str = "cpu",
        similarity_override: float | None = None,
        raises: Exception | None = None,
        embedding_raises: Exception | None = None,
    ) -> None:
        self.device_name = device
        self.similarity_override = similarity_override
        self._raises = raises
        self._embedding_raises = embedding_raises
        self.create_calls = 0
        self.compare_calls = 0

    @property
    def name(self) -> str:
        return FAKE_SPEAKER_NAME

    @property
    def version(self) -> str:
        return FAKE_SPEAKER_VERSION

    @property
    def device(self) -> str:
        return self.device_name

    @property
    def embedding_dim(self) -> int:
        return 8

    def create_embedding(self, audio_path: Path) -> SpeakerEmbedding:
        self.create_calls += 1
        if self._embedding_raises is not None:
            raise self._embedding_raises
        return _embedding_from_wave(audio_path)

    def compare_embeddings(
        self, reference: SpeakerEmbedding, test: SpeakerEmbedding
    ) -> SpeakerVerificationResult:
        self.compare_calls += 1
        if self._raises is not None:
            raise self._raises
        if reference.embedding_dim != test.embedding_dim:
            raise ValueError("stub dimension mismatch")
        cosine = float(np.dot(reference.vector, test.vector))
        similarity = (
            self.similarity_override
            if self.similarity_override is not None
            else round(cosine, 6)
        )
        return SpeakerVerificationResult(
            similarity=similarity,
            verified=similarity >= 0.25,
            embedding_model=FAKE_SPEAKER_NAME,
            embedding_model_version=FAKE_SPEAKER_VERSION,
            device=self.device_name,
        )


def write_sine_segment(path: Path, seconds: float = 2.0, freq: float = 440.0) -> Path:
    """Write a real non-silent 16 kHz mono WAV (distinct content per freq)."""
    sr = 16000
    frames = int(seconds * sr)
    t = np.arange(frames) / sr
    samples = 0.45 * np.sin(2 * np.pi * freq * t)
    sf.write(str(path), samples.astype(np.float32), sr, subtype="PCM_16")
    return path