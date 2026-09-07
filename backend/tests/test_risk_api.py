"""API tests for the risk fusion endpoints with mocked ML verifiers.

The real deepfake / ECAPA models are never loaded. Deepfake is driven by the
existing fake detector and speaker by the content-driven fake verifier, so
the full upload -> preprocess -> deepfake -> speaker -> risk flow is
exercised deterministically without weights.
"""

import uuid

import pytest
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.ml import deepfake_model_manager, speaker_verifier_manager
from app.models.audio import AudioAnalysis
from app.models.speaker import SpeakerProfile
from tests.deepfake_fakes import FakeDeepfakeDetector
from tests.helpers import make_sine_wave_bytes
from tests.speaker_fakes import FakeSpeakerVerifier

REFERENCE = ("ref.wav", make_sine_wave_bytes(duration_seconds=2.0, frequency_hz=440), "audio/wav")
# Same speaker as reference -> high similarity when verified.
ANALYSIS_SAME = ("voice.wav", make_sine_wave_bytes(duration_seconds=2.0, frequency_hz=440), "audio/wav")


@pytest.fixture(autouse=True)
def _isolated_state(test_engine):
    with Session(test_engine) as session:
        session.execute(delete(SpeakerProfile))
        session.execute(delete(AudioAnalysis))
        session.commit()
    yield


@pytest.fixture()
def fake_models(monkeypatch):
    verifier = FakeSpeakerVerifier()
    monkeypatch.setattr(speaker_verifier_manager, "get_verifier", lambda: verifier)
    detector = FakeDeepfakeDetector(ai_probability=0.91, predicted_class="synthetic")
    monkeypatch.setattr(deepfake_model_manager, "get_detector", lambda: detector)
    return {"verifier": verifier, "detector": detector}


def _upload_and_preprocess(client, file) -> str:
    upload = client.post("/audio/upload", files={"file": file})
    assert upload.status_code == 200
    analysis_id = upload.json()["analysis_id"]
    pre = client.post(f"/audio/{analysis_id}/preprocess")
    assert pre.status_code == 200
    return analysis_id


def _full_analysis(client, fake_models):
    """Register profile, upload, preprocess, deepfake, speaker -> RISK-ready."""
    client.post("/profile", data={"speaker_name": "Speaker One"}, files={"reference_audio": REFERENCE})
    analysis_id = _upload_and_preprocess(client, ANALYSIS_SAME)
    assert client.post(f"/analysis/{analysis_id}/deepfake").status_code == 200
    assert client.post(f"/analysis/{analysis_id}/speaker").status_code == 200
    return analysis_id


class TestRiskArchitecture:
    def test_risk_uses_stored_values_only_not_client_inputs(
        self, client, fake_models
    ):
        """The endpoint accepts no body; risk derives solely from DB values."""
        analysis_id = _full_analysis(client, fake_models)
        # Attempt to post fabricated values is ignored / not accepted.
        response = client.post(
            f"/analysis/{analysis_id}/risk",
            json={"ai_probability": 0.01, "speaker_similarity": 0.01},
        )
        # Body is not part of the contract; result still reflects stored
        # values (ai=0.91, similarity=1.0 -> HIGH).
        assert response.status_code in (200, 422)
        if response.status_code == 200:
            assert response.json()["risk_level"] == "HIGH"


class TestRiskCalculation:
    def test_success_high_ai_high_similarity(self, client, fake_models):
        analysis_id = _full_analysis(client, fake_models)
        response = client.post(f"/analysis/{analysis_id}/risk")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "RISK_CALCULATED"
        assert body["risk_status"] == "CALCULATED"
        assert body["risk_level"] == "HIGH"
        assert body["risk_score"] is not None and 0.0 <= body["risk_score"] <= 1.0
        assert body["risk_engine_version"] == "1.0"
        assert body["explanation"]
        assert body["recommendation"]

        stored = client.get(f"/audio/{analysis_id}").json()
        assert stored["risk_score"] == body["risk_score"]
        assert stored["risk_level"] == "HIGH"
        assert stored["status"] == "RISK_CALCULATED"

        result = client.get(f"/analysis/{analysis_id}/risk").json()
        assert result["risk_level"] == "HIGH"
        assert result["risk_score"] == stored["risk_score"]

    def test_idempotent_no_recompute(self, client, fake_models):
        analysis_id = _full_analysis(client, fake_models)
        first = client.post(f"/analysis/{analysis_id}/risk")
        score_after_first = first.json()["risk_score"]

        second = client.post(f"/analysis/{analysis_id}/risk")
        assert second.status_code == 200
        assert second.json()["risk_score"] == score_after_first

    def test_low_ai_gives_low_risk(self, client, monkeypatch):
        monkeypatch.setattr(
            deepfake_model_manager,
            "get_detector",
            lambda: FakeDeepfakeDetector(ai_probability=0.05),
        )
        verifier = FakeSpeakerVerifier()
        monkeypatch.setattr(speaker_verifier_manager, "get_verifier", lambda: verifier)

        client.post("/profile", data={"speaker_name": "S"}, files={"reference_audio": REFERENCE})
        analysis_id = _upload_and_preprocess(client, ANALYSIS_SAME)
        assert client.post(f"/analysis/{analysis_id}/deepfake").status_code == 200
        assert client.post(f"/analysis/{analysis_id}/speaker").status_code == 200
        body = client.post(f"/analysis/{analysis_id}/risk").json()
        assert body["risk_level"] == "LOW"


class TestRiskIncomplete:
    def test_risk_without_any_analysis_requires_both(self, client, fake_models):
        analysis_id = _upload_and_preprocess(client, ANALYSIS_SAME)
        response = client.post(f"/analysis/{analysis_id}/risk")
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "incomplete_analysis"

    def test_risk_with_deepfake_only_is_incomplete(self, client, fake_models):
        analysis_id = _upload_and_preprocess(client, ANALYSIS_SAME)
        assert client.post(f"/analysis/{analysis_id}/deepfake").status_code == 200
        response = client.post(f"/analysis/{analysis_id}/risk")
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "incomplete_analysis"

    def test_risk_with_speaker_only_is_incomplete(self, client, fake_models):
        client.post("/profile", data={"speaker_name": "S"}, files={"reference_audio": REFERENCE})
        analysis_id = _upload_and_preprocess(client, ANALYSIS_SAME)
        assert client.post(f"/analysis/{analysis_id}/speaker").status_code == 200
        response = client.post(f"/analysis/{analysis_id}/risk")
        assert response.status_code == 400

    def test_risk_missing_analysis_404(self, client, fake_models):
        response = client.post(f"/analysis/{uuid.uuid4()}/risk")
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "not_found"

    def test_risk_invalid_id_422(self, client, fake_models):
        response = client.post("/analysis/not-a-uuid/risk")
        assert response.status_code == 422


class TestRiskGet:
    def test_get_risk_returns_nulls_before_calculation(self, client, fake_models):
        analysis_id = _upload_and_preprocess(client, ANALYSIS_SAME)
        body = client.get(f"/analysis/{analysis_id}/risk").json()
        assert body["risk_score"] is None
        assert body["risk_level"] is None

    def test_get_risk_missing_analysis_404(self, client, fake_models):
        response = client.get(f"/analysis/{uuid.uuid4()}/risk")
        assert response.status_code == 404
