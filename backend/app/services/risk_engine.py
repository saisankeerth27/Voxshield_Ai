"""Risk fusion engine.

Combines the two independent analysis signals produced in earlier phases:

* deepfake / AI-generated probability (``ai_probability`` in [0, 1])
* speaker verification cosine similarity (``speaker_similarity`` in [-1, 1])

into a single deterministic, explainable risk assessment.

IMPORTANT: This is an MVP *heuristic*, NOT a scientifically validated
probability of attack. The weights and level thresholds are configurable
and must be calibrated on representative validation data before any
security-critical deployment.

Design rationale
----------------
A cloned / impersonated voice shows up as high speaker similarity with a
high AI-generated probability. High similarity *alone* is not suspicious -
it may simply mean the audio genuinely belongs to the registered speaker.

So the risk score is NOT a plain average of the two signals. Instead the
speaker-similarity evidence is gated by the AI probability:

    impersonation_component = ai_probability * speaker_risk
    score = w_deepfake * ai_probability
          + w_speaker * impersonation_component

* If AI probability is low  -> impersonation_component is low regardless of
  similarity (a genuine, low-risk speaker is not flagged).
* If AI probability is high AND similarity is high -> impersonation_component
  is high -> score rises sharply.
* If AI probability is high AND similarity is low -> score reflects the
  synthetic-speech concern but does not claim speaker impersonation.

The speaker cosine similarity (in [-1, 1]) is mapped to a [0, 1] attack-risk
scale before use. This transformation is explicit: a similarity of -1 (very
dissimilar) maps to 0 risk, 0 maps to a neutral 0.5, and +1 (identical
voiceprint) maps to 1.
"""

import logging
import math
from dataclasses import dataclass
from typing import Any

from app.core.config import settings
from app.models.enums import RiskLevel

logger = logging.getLogger("voiceshield.risk")

EngineVersion = settings.risk_engine_version


@dataclass(frozen=True)
class RiskInputs:
    """Signals fed into the risk engine, sourced from stored DB results.

    ``None`` means a signal is not yet available; the engine will return an
    INCOMPLETE assessment until both required signals are present.
    """

    ai_probability: float | None = None
    real_probability: float | None = None
    speaker_similarity: float | None = None


@dataclass(frozen=True)
class RiskResult:
    """Outcome of a risk calculation."""

    status: str
    risk_score: float | None = None
    risk_level: str | None = None
    explanation: str | None = None
    recommendation: str | None = None
    engine_version: str | None = None


class RiskEngine:
    """Deterministic, configurable risk fusion engine.

    Pure computation - no I/O, no ML inference. Instantiating one per
    request is cheap, but ``evaluate`` is also safe to call concurrently.
    """

    def __init__(self) -> None:
        self.deepfake_weight = settings.deepfake_weight
        self.speaker_weight = settings.speaker_weight
        self.low_max = settings.risk_low_max
        self.medium_max = settings.risk_medium_max
        self.similarity_high = settings.speaker_similarity_high
        self.version = settings.risk_engine_version

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def evaluate(self, inputs: RiskInputs) -> RiskResult:
        """Compute a deterministic risk assessment from the given signals.

        Returns an INCOMPLETE assessment (no score) if either required
        signal is missing. Raised ValueError for values outside valid
        ranges instead of silently clamping, so callers surface corruption.
        """
        if inputs.ai_probability is None or inputs.speaker_similarity is None:
            return self._incomplete(inputs)

        ai = _coerce_probability(inputs.ai_probability, "ai_probability")
        if inputs.real_probability is not None:
            _coerce_probability(inputs.real_probability, "real_probability")
        similarity = self._normalise_similarity(inputs.speaker_similarity)

        score = self._score(ai, similarity)
        level = self._classify(score)
        explanation = self._explain(ai, similarity, level)
        recommendation = self._recommend(level)

        return RiskResult(
            status="CALCULATED",
            risk_score=round(score, 6),
            risk_level=level.value,
            explanation=explanation,
            recommendation=recommendation,
            engine_version=self.version,
        )

    # ------------------------------------------------------------------
    # Scoring internals (documented in docs/risk-engine.md)
    # ------------------------------------------------------------------
    def _normalise_similarity(self, similarity: float) -> float:
        """Map cosine similarity [-1, 1] to an impersonation-risk [0, 1].

        0 -> 0.5 so that a *neutral* similarity (identity unclear, neither
        matching nor mismatching) still contributes an intermediate risk when
        paired with high AI probability.
        """
        if not -1.0 <= similarity <= 1.0:
            raise ValueError("speaker_similarity must be in [-1, 1]")
        return float((similarity + 1.0) / 2.0)

    def _score(self, ai_probability: float, similarity_risk: float) -> float:
        """Weighted, gated combination of the two signals (see module doc)."""
        impersonation = ai_probability * similarity_risk
        raw = (
            self.deepfake_weight * ai_probability
            + self.speaker_weight * impersonation
        )
        return min(1.0, max(0.0, raw))

    def _classify(self, score: float) -> RiskLevel:
        if score <= self.low_max:
            return RiskLevel.LOW
        if score <= self.medium_max:
            return RiskLevel.MEDIUM
        return RiskLevel.HIGH

    # ------------------------------------------------------------------
    # Explanation generation
    # ------------------------------------------------------------------
    def _explain(
        self, ai_probability: float, similarity_risk: float, level: RiskLevel
    ) -> str:
        if level == RiskLevel.LOW:
            return (
                "Low AI-generated probability and weak (or no) match to the "
                "registered reference speaker. No strong evidence of "
                "synthetic speech or impersonation was found."
            )
        if level == RiskLevel.MEDIUM:
            if ai_probability >= 0.5 and similarity_risk >= self.similarity_high:
                return (
                    "Moderate AI-generated probability combined with "
                    "moderate-to-strong similarity to the registered "
                    "reference speaker. This pattern warrants additional "
                    "identity verification."
                )
            return (
                "Moderate AI-generated speech concern with comparatively "
                "limited evidence of impersonating the registered speaker. "
                "Additional identity verification is recommended."
            )
        # HIGH
        if similarity_risk >= self.similarity_high:
            return (
                "High synthetic-speech probability combined with strong "
                "similarity to the registered reference speaker. This "
                "pattern may indicate potential AI voice impersonation. "
                "Perform independent identity verification."
            )
        return (
            "High synthetic-speech probability was detected, but the "
            "evidence of impersonating the registered speaker is weaker. "
            "Synthetic audio may be present; treat the identity match with "
            "additional caution."
        )

    # ------------------------------------------------------------------
    # Recommendation generation
    # ------------------------------------------------------------------
    def _recommend(self, level: RiskLevel) -> str:
        if level == RiskLevel.LOW:
            return (
                "No strong evidence of synthetic speech or impersonation. "
                "Continue normal verification procedures."
            )
        if level == RiskLevel.MEDIUM:
            return (
                "Some suspicious indicators were detected. Perform "
                "additional identity verification."
            )
        return (
            "Potential AI-generated voice impersonation. Perform independent "
            "identity verification before taking any sensitive action."
        )

    def _incomplete(self, inputs: RiskInputs) -> RiskResult:
        missing = []
        if inputs.ai_probability is None:
            missing.append("deepfake detection")
        if inputs.speaker_similarity is None:
            missing.append("speaker verification")
        reason = " and ".join(missing)
        return RiskResult(
            status="INCOMPLETE",
            risk_score=None,
            risk_level=None,
            explanation=(
                f"Risk assessment is incomplete: {reason} result(s) missing."
            ),
            recommendation=(
                "Complete deepfake detection and speaker verification before "
                "calculating risk."
            ),
            engine_version=None,
        )


def _coerce_probability(value: float, name: str) -> float:
    """Validate and coerce a probability to [0, 1], rejecting bad values."""
    try:
        value = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} must be a number, got {value!r}") from exc
    if not math.isfinite(value):
        raise ValueError(f"{name} must be finite, got {value!r}")
    if not 0.0 <= value <= 1.0:
        raise ValueError(f"{name} must be in [0, 1], got {value!r}")
    return value
