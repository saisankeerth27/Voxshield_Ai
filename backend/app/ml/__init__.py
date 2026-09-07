"""Machine-learning layer for VoiceShield.

Responsibilities:
- abstract the real deepfake detection model behind a stable interface
- load the model exactly once and keep it resident (never per-request)
- expose CPU/GPU device selection
- convert the Phase 3 processed audio into model-ready input
- return actual model probabilities (never fabricated values)

Nothing outside this package may depend on a concrete model class; the
rest of the application only speaks to ``DeepfakeDetector``.
"""

from app.ml.model_loader import deepfake_model_manager

__all__ = ["deepfake_model_manager"]
