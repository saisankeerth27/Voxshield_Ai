"""Unit tests for the risk fusion engine.

Covers the 8 required scenarios plus score validation, determinism, and the
cosine-similarity to [0,1] transformation. Pure computation - no DB, no ML.
"""

import pytest

from app.services.risk_engine import RiskEngine, RiskInputs

LOW_MAX = 0.39
MEDIUM_MAX = 0.69
DEEPFAKE_WEIGHT = 0.60
SPEAKER_WEIGHT = 0.40


@pytest.fixture()
def engine():
    return RiskEngine()


def _calc(engine, ai, similarity):
    return engine.evaluate(
        RiskInputs(ai_probability=ai, speaker_similarity=similarity)
    )


def test_case1_low_ai_low_similarity_is_low(engine):
    result = _calc(engine, 0.05, 0.10)
    assert result.status == "CALCULATED"
    assert result.risk_level == "LOW"
    assert 0.0 <= result.risk_score <= LOW_MAX
    assert result.explanation
    assert result.recommendation
    assert result.engine_version


def test_case2_high_ai_high_similarity_is_high(engine):
    result = _calc(engine, 0.95, 0.90)
    assert result.status == "CALCULATED"
    assert result.risk_level == "HIGH"
    assert result.risk_score >= 0.70


def test_case3_medium_ai_medium_similarity_is_medium(engine):
    result = _calc(engine, 0.50, 0.50)
    assert result.status == "CALCULATED"
    assert result.risk_level == "MEDIUM"
    assert LOW_MAX < result.risk_score <= MEDIUM_MAX


def test_case4_high_ai_low_similarity_not_full_speaker_impersonation(engine):
    result = _calc(engine, 0.95, 0.10)
    assert result.status == "CALCULATED"
    # Synthetic concern is elevated but speaker impersonation is weak.
    assert result.risk_level in ("MEDIUM", "HIGH")
    # It must be strictly lower than the high-ai + high-sim case.
    high_both = _calc(engine, 0.95, 0.90)
    assert result.risk_score < high_both.risk_score
    assert "impersonat" in result.explanation.lower()


def test_case5_low_ai_high_similarity_is_not_high(engine):
    result = _calc(engine, 0.05, 0.95)
    assert result.status == "CALCULATED"
    assert result.risk_level == "LOW"
    # High similarity alone must NOT spike risk when AI probability is low.
    assert result.risk_score <= LOW_MAX


def test_case6_missing_ai_is_incomplete(engine):
    result = engine.evaluate(RiskInputs(ai_probability=None, speaker_similarity=0.8))
    assert result.status == "INCOMPLETE"
    assert result.risk_score is None
    assert result.risk_level is None
    assert "deepfake" in result.explanation.lower()


def test_case7_missing_similarity_is_incomplete(engine):
    result = engine.evaluate(RiskInputs(ai_probability=0.8, speaker_similarity=None))
    assert result.status == "INCOMPLETE"
    assert result.risk_score is None
    assert "speaker" in result.explanation.lower()


def test_case8_both_missing_is_incomplete(engine):
    result = engine.evaluate(RiskInputs())
    assert result.status == "INCOMPLETE"
    assert result.risk_score is None
    assert "deepfake" in result.explanation.lower()
    assert "speaker" in result.explanation.lower()


def test_score_range_always_between_0_and_1(engine):
    for ai in (0.0, 0.01, 0.5, 0.99, 1.0):
        for sim in (-1.0, -0.5, 0.0, 0.5, 1.0):
            result = _calc(engine, ai, sim)
            assert 0.0 <= result.risk_score <= 1.0


def test_deterministic_same_inputs(engine):
    a = _calc(engine, 0.7, 0.75)
    b = _calc(engine, 0.7, 0.75)
    assert a.risk_score == b.risk_score
    assert a.risk_level == b.risk_level
    assert a.explanation == b.explanation


def test_rejects_invalid_ai_out_of_range(engine):
    with pytest.raises(ValueError):
        _calc(engine, -0.1, 0.5)
    with pytest.raises(ValueError):
        _calc(engine, 1.1, 0.5)


def test_rejects_invalid_similarity_out_of_range(engine):
    with pytest.raises(ValueError):
        _calc(engine, 0.5, -1.1)
    with pytest.raises(ValueError):
        _calc(engine, 0.5, 1.1)


def test_rejects_non_finite_values(engine):
    with pytest.raises(ValueError):
        _calc(engine, float("nan"), 0.5)
    with pytest.raises(ValueError):
        _calc(engine, 0.5, float("inf"))


def test_cosine_similarity_negative_maps_to_lower_risk(engine):
    result = _calc(engine, 0.9, -1.0)
    # -1 similarity -> impersonation contribution 0; score = only AI term.
    expected = DEEPFAKE_WEIGHT * 0.9
    assert result.risk_score == pytest.approx(expected, abs=1e-6)


def test_neutral_similarity_maps_to_intermediate(engine):
    # 0.0 similarity -> 0.5 risk on the [0,1] scale.
    result = _calc(engine, 1.0, 0.0)
    expected = DEEPFAKE_WEIGHT * 1.0 + SPEAKER_WEIGHT * (1.0 * 0.5)
    assert result.risk_score == pytest.approx(expected, abs=1e-6)


def test_boundary_high_similarity_equals_ai_component_max(engine):
    result = _calc(engine, 1.0, 1.0)
    expected = DEEPFAKE_WEIGHT + SPEAKER_WEIGHT  # = 1.0
    assert result.risk_score == pytest.approx(expected, abs=1e-6)
    assert result.risk_score == 1.0


def test_engine_version_reported(engine):
    result = _calc(engine, 0.8, 0.8)
    assert result.engine_version == engine.version
