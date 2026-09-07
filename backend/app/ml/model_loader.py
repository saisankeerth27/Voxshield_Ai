"""Deepfake model manager: load once, keep resident, report status.

The application must never load the model per request. This manager:

- resolves the device (auto / cpu / cuda) at load time and logs it
- downloads via Hugging Face Hub into ``MODEL_CACHE_DIR`` on first use
- holds the loaded detector in memory for subsequent requests
- marks the model ``unavailable`` if loading fails and never fabricates
  a result
- is thread-safe so a background load at startup and per-request lazy
  loads do not race
"""

import logging
import threading

from app.core.config import settings
from app.core.exceptions import (
    DeepfakeModelUnavailableError,
    SpeakerModelUnavailableError,
)
from app.ml.base import DeepfakeDetector, SpeakerVerifier
from app.ml.schemas import DetectorStatus

logger = logging.getLogger("voiceshield.ml")


def _resolve_device(requested_raw: str | None) -> str:
    """auto -> GPU if CUDA is available, otherwise CPU. Shared by managers."""
    import torch

    requested = (requested_raw or "auto").strip().lower()
    if requested == "cuda":
        if torch.cuda.is_available():
            return "cuda"
        logger.warning(
            "MODEL_DEVICE=cuda requested but CUDA is unavailable; using CPU"
        )
        return "cpu"
    if requested == "cpu":
        return "cpu"
    # auto
    if torch.cuda.is_available():
        logger.info("Device: CUDA")
        return "cuda"
    logger.info("Device: CPU")
    return "cpu"


class DeepfakeModelManager:
    """Owns the lifetime of the loaded detector."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._detector: DeepfakeDetector | None = None
        self._state: str = "not_loaded"
        self._device: str | None = None
        self._name: str | None = None
        self._version: str | None = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def status(self) -> DetectorStatus:
        """Accurate current state (never claims loaded when it is not)."""
        with self._lock:
            return DetectorStatus(
                state=self._state,
                model_name=self._name,
                model_version=self._version,
                device=self._device,
            )

    def get_detector(self) -> DeepfakeDetector:
        """Return a ready detector, loading it if necessary.

        Raises ``DeepfakeModelUnavailableError`` (HTTP 503) when the model
        cannot be loaded - the caller must not produce a prediction then.
        """
        with self._lock:
            if self._detector is not None:
                return self._detector
            self._load_unlocked()
            assert self._detector is not None
            return self._detector

    def load_in_background(self) -> None:
        """Best-effort startup load so the first request is fast.

        The model state is reported accurately; a failed background load
        simply leaves the manager ``unavailable`` and a later request will
        surface the 503 error.
        """
        def _load_async() -> None:
            try:
                self.get_detector()
            except Exception:
                pass  # state already recorded; requests will surface it

        thread = threading.Thread(target=_load_async, daemon=True, name="df-model-load")
        thread.start()

    def force_reload(self) -> DeepfakeDetector:
        """Drop any cached detector and rebuild (used by tests/admin)."""
        with self._lock:
            self._detector = None
            self._state = "not_loaded"
            self._load_unlocked()
            assert self._detector is not None
            return self._detector

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------
    def _load_unlocked(self) -> None:
        self._state = "loading"
        try:
            device = self._resolve_device()
            detector = self._build_detector(device)
        except Exception:
            self._state = "unavailable"
            logger.exception(
                "Deepfake model failed to load model=%s",
                settings.deepfake_model_name,
            )
            raise DeepfakeModelUnavailableError() from None

        self._detector = detector
        self._state = "loaded"
        self._device = device
        self._name = detector.name
        self._version = detector.version
        logger.info(
            "Deepfake model loaded model=%s revision=%s device=%s",
            detector.name,
            detector.version,
            device,
        )

    def _resolve_device(self) -> str:
        return _resolve_device(settings.model_device)

    def _build_detector(self, device: str) -> DeepfakeDetector:
        from transformers import (
            AutoFeatureExtractor,
            AutoModelForAudioClassification,
        )

        name = settings.deepfake_model_name
        cache_dir = settings.model_cache_dir or None

        feature_extractor = AutoFeatureExtractor.from_pretrained(
            name, cache_dir=cache_dir
        )
        model = AutoModelForAudioClassification.from_pretrained(
            name, cache_dir=cache_dir, local_files_only=False
        )
        model.to(device)
        model.eval()

        from app.ml.deepfake_detector import Wav2Vec2DeepfakeDetector

        return Wav2Vec2DeepfakeDetector(
            model=model, feature_extractor=feature_extractor, device=device
        )


deepfake_model_manager = DeepfakeModelManager()


class SpeakerVerifierManager:
    """Owns the lifetime of the loaded speaker verification model."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._verifier: SpeakerVerifier | None = None
        self._state: str = "not_loaded"
        self._device: str | None = None
        self._name: str | None = None
        self._version: str | None = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def status(self) -> DetectorStatus:
        with self._lock:
            return DetectorStatus(
                state=self._state,
                model_name=self._name,
                model_version=self._version,
                device=self._device,
            )

    def get_verifier(self) -> SpeakerVerifier:
        """Return a ready verifier, loading it if necessary.

        Raises ``SpeakerModelUnavailableError`` (HTTP 503) when the model
        cannot be loaded - the caller must not produce a result then.
        """
        with self._lock:
            if self._verifier is not None:
                return self._verifier
            self._load_unlocked()
            assert self._verifier is not None
            return self._verifier

    def load_in_background(self) -> None:
        """Best-effort startup load so the first request is fast."""

        def _load_async() -> None:
            try:
                self.get_verifier()
            except Exception:
                pass  # state already recorded; requests will surface it

        thread = threading.Thread(
            target=_load_async, daemon=True, name="speaker-model-load"
        )
        thread.start()

    def force_reload(self) -> SpeakerVerifier:
        with self._lock:
            self._verifier = None
            self._state = "not_loaded"
            self._load_unlocked()
            assert self._verifier is not None
            return self._verifier

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------
    def _load_unlocked(self) -> None:
        self._state = "loading"
        try:
            device = _resolve_device(settings.model_device)
            verifier = self._build_verifier(device)
        except Exception:
            self._state = "unavailable"
            logger.exception(
                "Speaker model failed to load model=%s",
                settings.speaker_model_name,
            )
            raise SpeakerModelUnavailableError() from None

        self._verifier = verifier
        self._state = "loaded"
        self._device = device
        self._name = verifier.name
        self._version = verifier.version
        logger.info(
            "Speaker model loaded model=%s revision=%s device=%s",
            verifier.name,
            verifier.version,
            device,
        )

    def _build_verifier(self, device: str) -> SpeakerVerifier:
        from speechbrain.inference.speaker import EncoderClassifier
        from speechbrain.utils.fetching import LocalStrategy

        name = settings.speaker_model_name
        savedir = settings.speaker_model_savedir or None

        encoder = EncoderClassifier.from_hparams(
            source=name,
            savedir=savedir,
            run_opts={"device": device},
            local_strategy=LocalStrategy.COPY_SKIP_CACHE,
        )

        from app.ml.speaker_verifier import ECAPASpeakerVerifier

        return ECAPASpeakerVerifier(
            encoder=encoder, device=device, name=name
        )


speaker_verifier_manager = SpeakerVerifierManager()