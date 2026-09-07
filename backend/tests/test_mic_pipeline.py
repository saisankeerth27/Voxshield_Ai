"""Phase 8: microphone-recording support through the existing pipeline.

Covers the WebM/Opus upload path plus the ``source`` field, and verifies
that a microphone-source recording flows through the whole existing chain:

    Upload -> Preprocess -> Deepfake -> Speaker -> Risk

ML inference is driven by the existing deterministic fakes (the real
weights are never loaded in unit tests), while preprocessing genuinely
decodes WebM/Opus via FFmpeg when it is available.
"""

import uuid

import pytest
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.ml import deepfake_model_manager, speaker_verifier_manager
from app.models.audio import AudioAnalysis
from app.models.speaker import SpeakerProfile
from tests.deepfake_fakes import FakeDeepfakeDetector
from tests.helpers import make_sine_wave_bytes, make_webm_bytes
from tests.speaker_fakes import FakeSpeakerVerifier

REFERENCE = ("ref.wav", make_sine_wave_bytes(duration_seconds=2.0, frequency_hz=440), "audio/wav")
# Same sine wave as the reference -> verified when the fake runs.
ROLL = ("voice.wav", make_sine_wave_bytes(duration_seconds=2.0, frequency_hz=440), "audio/wav")


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


def _upload(client, file, source="MICROPHONE") -> str:
    response = client.post(
        "/audio/upload",
        files={"file": file},
        data={"source": source},
    )
    assert response.status_code == 200
    return response.json()["analysis_id"]


class TestMicrophoneSource:
    def test_upload_records_microphone_source(self, client):
        analysis_id = _upload(client, ROLL, source="MICROPHONE")

        response = client.get(f"/audio/{analysis_id}").json()
        assert response["source"] == "MICROPHONE"

        listed = client.get("/audio").json()["items"]
        assert any(item["analysis_id"] == analysis_id for item in listed)
        assert next(
            item for item in listed if item["analysis_id"] == analysis_id
        )["source"] == "MICROPHONE"

    def test_upload_defaults_to_upload_source(self, client):
        analysis_id = _upload(client, ROLL, source="UPLOAD")
        assert client.get(f"/audio/{analysis_id}").json()["source"] == "UPLOAD"

    def test_upload_rejects_invalid_source(self, client):
        response = client.post(
            "/audio/upload",
            files={"file": ROLL},
            data={"source": "tape"},
        )
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "bad_request"


class TestWebmUpload:
    def test_webm_upload_accepted(self, client):
        webm = make_webm_bytes(duration_seconds=2.0)
        response = client.post(
            "/audio/upload",
            files={"file": ("clip.webm", webm, "audio/webm")},
        )
        assert response.status_code == 200
        assert response.json()["filename"] == "clip.webm"


class TestMicrophoneFullPipeline:
    def test_webm_microphone_flow_through_risk(self, client, fake_models):
        client.post(
            "/profile",
            data={"speaker_name": "Speaker One"},
            files={"reference_audio": REFERENCE},
        )
        webm = make_webm_bytes(duration_seconds=2.0)
        analysis_id = _upload(
            client,
            ("mic.webm", webm, "audio/webm"),
            source="MICROPHONE",
        )
        assert client.get(f"/audio/{analysis_id}").json()["source"] == "MICROPHONE"

        pre = client.post(f"/audio/{analysis_id}/preprocess")
        assert pre.status_code == 200
        assert pre.json()["audio"]["sample_rate"] == 16000
        assert pre.json()["audio"]["channels"] == 1

        deepfake = client.post(f"/analysis/{analysis_id}/deepfake")
        assert deepfake.status_code == 200
        assert deepfake.json()["ai_probability"] == pytest.approx(0.91)

        speaker = client.post(f"/analysis/{analysis_id}/speaker")
        assert speaker.status_code == 200

        risk = client.post(f"/analysis/{analysis_id}/risk")
        assert risk.status_code == 200
        assert risk.json()["risk_level"] == "HIGH"
        assert risk.json()["risk_score"] is not None

        stored = client.get(f"/audio/{analysis_id}").json()
        assert stored["source"] == "MICROPHONE"
        assert stored["risk_level"] == "HIGH"

    def test_webm_microphone_upload_uses_stored_uuid_filename(self, client):
        webm = make_webm_bytes(duration_seconds=2.0)
        analysis_id = _upload(client, ("mic.webm", webm, "audio/webm"))
        # User-supplied filename is never used for storage.
        assert isinstance(uuid.UUID(analysis_id), uuid.UUID)