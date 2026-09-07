"""ECAPA-TDNN speaker verification via SpeechBrain.

Model: ``speechbrain/spkrec-ecapa-voxceleb`` (verified 2024-09)
- architecture: ECAPA-TDNN speaker recognition (Desplanques et al., 2020)
- task: speaker verification / identification (text-independent)
- input: 16 kHz mono raw waveform (Phase 3 processed WAV at 16 kHz)
- embedding: fixed 192-dim, L2-normalized here before storage/comparison
- the model card documents verification via cosine similarity between
  speaker embeddings; cosine is computed explicitly below.
- license: Apache-2.0

Compatibility notes (verified against installed packages):
- ``EncoderClassifier.encode_batch`` returns shape ``(1, 1, 192)``.
- On Windows, ``local_strategy=LocalStrategy.COPY_SKIP_CACHE`` avoids the
  symlink privilege error in SpeechBrain's fetch layer.
- torchaudio is used only for its tensor handling; waveforms are read
  with soundfile (no torchcodec dependency required).
"""

import logging
from pathlib import Path

import numpy as np

from app.core.config import settings
from app.core.exceptions import (
    DeepfakeInputError,
    SpeakerEmbeddingError,
    SpeakerInputError,
    SpeakerVerificationError,
)
from app.ml.base import SpeakerVerifier
from app.ml.preprocessing import load_processed_waveform
from app.ml.schemas import SpeakerEmbedding, SpeakerVerificationResult

logger = logging.getLogger("voiceshield.ml")


def _fallback_version() -> str:
    """Version label when the checkpoint revision cannot be resolved."""
    try:
        import speechbrain

        return f"speechbrain-{speechbrain.__version__}"
    except Exception:
        return "unknown-speechbrain"


def _resolve_model_version(model_name: str) -> str:
    """Best-effort HF checkpoint revision; falls back to a package label."""
    try:
        from huggingface_hub import HfApi

        return str(HfApi().model_info(model_name).sha)
    except Exception:
        return _fallback_version()


class ECAPASpeakerVerifier(SpeakerVerifier):
    """SpeechBrain ECAPA-TDNN backed implementation.

    The encoder object is injected so unit tests can run with a lightweight
    stub that implements ``encode_batch`` (no giant download).
    """

    def __init__(
        self, encoder, device: str, name: str | None = None,
        version: str | None = None, embedding_dim: int | None = None,
    ) -> None:
        self._encoder = encoder
        self._device = device
        self._name = name or settings.speaker_model_name
        self._version = version or _resolve_model_version(self._name)
        self._embedding_dim = embedding_dim

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
    def embedding_dim(self) -> int:
        return self._embedding_dim

    def create_embedding(self, audio_path: Path) -> SpeakerEmbedding:
        """Generate an embedding from a validated 16 kHz mono processed WAV."""
        import torch

        try:
            waveform = load_processed_waveform(audio_path)
        except DeepfakeInputError as exc:
            raise SpeakerInputError(exc.detail) from None

        if waveform.size / 16000 < settings.min_speaker_duration_seconds:
            raise SpeakerInputError(
                "Audio is too short to generate a reliable speaker embedding."
            )

        try:
            tensor = torch.tensor(waveform, dtype=torch.float32).unsqueeze(0)
            with torch.inference_mode():
                encoded = self._encoder.encode_batch(tensor)
            vector = (
                encoded.squeeze().float().detach().cpu().numpy().astype(np.float32)
            )
        except Exception:
            logger.exception("Speaker embedding generation failed")
            raise SpeakerVerificationError(
                "Speaker embedding generation failed for the supplied audio."
            ) from None

        if vector.size == 0 or vector.ndim != 1:
            raise SpeakerVerificationError(
                "Speaker model returned an invalid embedding."
            )

        if self._embedding_dim is not None and vector.size != self._embedding_dim:
            logger.warning(
                "Speaker embedding dimension drifted expected=%s got=%s",
                self._embedding_dim,
                vector.size,
            )

        # L2-normalize so cosine similarity is a simple normalized dot
        # product. Audio embeddings from encode_batch are not unit-norm.
        norm = float(np.linalg.norm(vector))
        if not np.isfinite(norm) or norm <= 0:
            raise SpeakerVerificationError(
                "Speaker model returned a degenerate embedding."
            )
        vector = vector / norm

        return SpeakerEmbedding(
            vector=vector,
            model_name=self._name,
            model_version=self._version,
            device=self._device,
            embedding_dim=int(vector.size),
        )

    def compare_embeddings(
        self, reference: SpeakerEmbedding, test: SpeakerEmbedding
    ) -> SpeakerVerificationResult:
        """Actual cosine similarity between two speaker embeddings.

        Threshold application is documented as an uncalibrated MVP
        configuration (see ``settings.speaker_similarity_threshold``).
        """
        if reference.embedding_dim != test.embedding_dim:
            raise SpeakerEmbeddingError(
                "Reference and test embeddings have different dimensions "
                f"({reference.embedding_dim} vs {test.embedding_dim})."
            )

        a = reference.vector.astype(np.float64)
        b = test.vector.astype(np.float64)
        denom = float(np.linalg.norm(a) * np.linalg.norm(b))
        if not np.isfinite(denom) or denom <= 0:
            raise SpeakerEmbeddingError(
                "Cannot compare embeddings with zero norm."
            )
        cosine = float(np.clip(np.dot(a, b) / denom, -1.0, 1.0))
        similarity = round(cosine, 6)
        verified = similarity >= settings.speaker_similarity_threshold

        logger.info(
            "Speaker verification similarity=%.4f threshold=%.4f verified=%s",
            similarity,
            settings.speaker_similarity_threshold,
            verified,
        )
        return SpeakerVerificationResult(
            similarity=similarity,
            verified=bool(verified),
            embedding_model=self._name,
            embedding_model_version=self._version,
            device=self._device,
        )