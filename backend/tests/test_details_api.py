"""Phase 9: analysis details endpoint and printable HTML report.

Tests cover:
- valid analysis ID → combined JSON payload
- invalid analysis ID → 404
- completed analysis → all stage values present
- failed analysis → error surfaced, later stages not completed
- incomplete analysis → only uploaded
- missing speaker profile → speaker status not performed
- HTML report → contains all sections and stored values
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
VOICE = ("voice.wav", make_sine_wave_bytes(duration_seconds=2.0, frequency_hz=440), "audio/wav")


@pytest.fixture(autouse=True)
def _isolated_state(test_engine):
    with Session(test_engine) as session:
        session.execute(delete(SpeakerProfile))
        session.execute(delete(AudioAnalysis))
        session.commit()
    yield


@pytest.fixture()
def fake_models(monkeypatch):
    monkeypatch.setattr(
        speaker_verifier_manager,
        "get_verifier",
        lambda: FakeSpeakerVerifier(),
    )
    monkeypatch.setattr(
        deepfake_model_manager,
        "get_detector",
        lambda: FakeDeepfakeDetector(ai_probability=0.85, predicted_class="real"),
    )


def _upload(client, file=VOICE, source="UPLOAD") -> str:
    r = client.post("/audio/upload", files={"file": file}, data={"source": source})
    assert r.status_code == 200
    return r.json()["analysis_id"]


def _upload_and_full_pipeline(client, fake_models) -> str:
    client.post(
        "/profile",
        data={"speaker_name": "Reporter"},
        files={"reference_audio": REFERENCE},
    )
    aid = _upload(client, source="MICROPHONE")
    client.post(f"/audio/{aid}/preprocess")
    client.post(f"/analysis/{aid}/deepfake")
    client.post(f"/analysis/{aid}/speaker")
    client.post(f"/analysis/{aid}/risk")
    return aid


# ── details endpoint ────────────────────────────────────────────


class TestAnalysisDetailsEndpoint:
    def test_valid_analysis_returns_combined_payload(self, client, fake_models):
        aid = _upload_and_full_pipeline(client, fake_models)
        r = client.get(f"/analysis/{aid}")
        assert r.status_code == 200
        body = r.json()

        assert body["analysis_id"] == aid
        assert body["source"] == "MICROPHONE"
        assert body["audio"]["filename"] == "voice.wav"
        assert body["deepfake"]["ai_probability"] == pytest.approx(0.85)
        assert body["deepfake"]["status"] == "completed"
        assert body["speaker"]["similarity"] is not None
        assert body["speaker"]["status"] == "completed"
        assert body["speaker"]["reference_name"] == "Reporter"
        assert body["risk"]["level"] is not None
        assert body["risk"]["status"] == "completed"
        assert "timeline" in body
        assert body["timeline"]["completed"]["status"] == "completed"

    def test_invalid_analysis_id_returns_404(self, client):
        r = client.get(f"/analysis/{uuid.uuid4()}")
        assert r.status_code == 404
        assert r.json()["error"]["code"] == "not_found"

    def test_incomplete_analysis_shows_not_started_stages(self, client):
        aid = _upload(client)
        r = client.get(f"/analysis/{aid}")
        body = r.json()
        assert body["status"] == "UPLOADED"
        assert body["deepfake"]["status"] == "not_started"
        assert body["speaker"]["status"] == "not_started"
        assert body["risk"]["status"] == "not_started"
        assert body["timeline"]["completed"]["status"] == "not_started"

    def test_failed_deepfake_shows_error_and_later_stages_not_started(
        self, client, monkeypatch
    ):
        monkeypatch.setattr(
            deepfake_model_manager,
            "get_detector",
            lambda: _FailingDetector(),
        )
        aid = _upload(client)
        client.post(f"/audio/{aid}/preprocess")
        r = client.post(f"/analysis/{aid}/deepfake")
        assert r.status_code in (400, 500)

        details = client.get(f"/analysis/{aid}").json()
        assert details["deepfake"]["status"] == "failed"
        assert details["deepfake"]["error"] is not None
        assert details["speaker"]["status"] == "not_started"
        assert details["risk"]["status"] == "not_started"

    def test_missing_speaker_profile_shows_not_performed(self, client, monkeypatch):
        monkeypatch.setattr(
            deepfake_model_manager,
            "get_detector",
            lambda: FakeDeepfakeDetector(ai_probability=0.5, predicted_class="real"),
        )
        aid = _upload(client)
        client.post(f"/audio/{aid}/preprocess")
        client.post(f"/analysis/{aid}/deepfake")
        r = client.post(f"/analysis/{aid}/speaker")
        assert r.status_code == 404

        details = client.get(f"/analysis/{aid}").json()
        assert details["speaker"]["status"] in ("not_started", "failed")
        assert details["speaker"]["reference_name"] is None


# ── HTML report ─────────────────────────────────────────────────


class TestAnalysisReport:
    def test_report_contains_all_sections(self, client, fake_models):
        aid = _upload_and_full_pipeline(client, fake_models)
        r = client.get(f"/analysis/{aid}/report")
        assert r.status_code == 200
        assert "text/html" in r.headers["content-type"]
        html = r.text
        assert "VoiceShield Analysis Report" in html
        assert "AI Detection" in html
        assert "Speaker Verification" in html
        assert "Risk Assessment" in html
        assert "Disclaimer" in html

    def test_report_shows_stored_values(self, client, fake_models):
        aid = _upload_and_full_pipeline(client, fake_models)
        html = client.get(f"/analysis/{aid}/report").text
        assert aid in html
        assert "85%" in html  # ai_probability 0.85
        assert "Reporter" in html  # reference_name
        assert "MICROPHONE" in html

    def test_report_for_invalid_id_returns_404(self, client):
        r = client.get(f"/analysis/{uuid.uuid4()}/report")
        assert r.status_code == 404

    def test_report_for_incomplete_analysis_still_works(self, client):
        aid = _upload(client)
        r = client.get(f"/analysis/{aid}/report")
        assert r.status_code == 200
        html = r.text
        assert "Not performed" in html  # speaker
        assert "—" in html  # missing values


class _FailingDetector:
    def predict(self, _path):
        raise RuntimeError("unexpected crash")
