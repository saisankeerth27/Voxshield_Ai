"""Machine-learning layer for VoiceShield.

Responsibilities:
- abstract the real deepfake detection + speaker verification models
  behind stable interfaces
- load each model exactly once and keep it resident (never per-request)
- expose CPU/GPU device selection shared by both managers
- convert the Phase 3 processed audio into model-ready input
- return actual model scores (never fabricated values)

Nothing outside this package may depend on a concrete model class; the
rest of the application only speaks to ``DeepfakeDetector`` and
``SpeakerVerifier``.
"""

from app.ml.model_loader import deepfake_model_manager, speaker_verifier_manager

__all__ = ["deepfake_model_manager", "speaker_verifier_manager"]
