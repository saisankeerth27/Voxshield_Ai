"""API tests for speaker profiles + verification with a mocked verifier.

The real SpeechBrain ECAPA model is never loaded here; ``get_verifier`` is
replaced with a content-driven fake so the full registration/verification
flow, statuses, persistence, and error paths are exercised without weights.
"""

import uuid

import pytest
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.exceptions import (
    SpeakerModelUnavailableError,
    SpeakerVerificationError,
)
from app.ml import speaker_verifier_manager
from app.models.audio import AudioAnalysis
from app.models.speaker import SpeakerProfile
from tests.helpers import make_sine_wave_bytes
from tests.speaker_fakes import FakeSpeakerVerifier

REFERENCE = ("ref.wav", make_sine_wave_bytes(duration_seconds=2.0, frequency_hz=440), "audio/wav")
ANALYSIS_SAME = ("voice.wav", make_sine_wave_bytes(duration_seconds=2.0, frequency_hz=440), "audio/wav")
ANALYSIS_DIFF = ("voice2.wav", make_sine_wave_bytes(duration_seconds=2.0, frequency_hz=880), "audio/wav")


@pytest.fixture(autouse=True)
def _isolated_state(test_engine):
    """Each test starts from an empty profile/analysis state."""
    with Session(test_engine) as session:
        session.execute(delete(SpeakerProfile))
        session.execute(delete(AudioAnalysis))
        session.commit()
    yield


@pytest.fixture()
def fake_verifier(monkeypatch):
    verifier = FakeSpeakerVerifier()
    monkeypatch.setattr(speaker_verifier_manager, "get_verifier", lambda: verifier)
    return verifier


def _register_profile(client, file=REFERENCE, name="Speaker One"):
    return client.post(
        "/profile",
        data={"speaker_name": name},
        files={"reference_audio": file},
    )


def _upload_and_preprocess(client, file) -> str:
    upload = client.post("/audio/upload", files={"file": file})
    assert upload.status_code == 200
    analysis_id = upload.json()["analysis_id"]
    pre = client.post(f"/audio/{analysis_id}/preprocess")
    assert pre.status_code == 200
    return analysis_id


class TestProfileRegistration:
    def test_register_success_returns_metadata_no_embedding(
        self, client, fake_verifier
    ):
        response = _register_profile(client)
        assert response.status_code == 200
        body = response.json()
        assert body["name"] == "Speaker One"
        assert body["embedding_dim"] == 8
        assert body["model_name"] == "fake-ecapa-speaker"
        assert body["model_version"] == "test-0.0.1"
        assert "embedding" not in body and "embedding_bytes" not in body

        listed = client.get("/profile").json()
        assert listed["has_profile"] is True
        assert listed["count"] == 1
        assert listed["items"][0]["profile_id"] == body["profile_id"]

    def test_register_requires_reference_audio(self, client, fake_verifier):
        response = client.post("/profile", data={"speaker_name": "Alone"})
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "bad_request"

    def test_register_requires_name(self, client, fake_verifier):
        response = client.post(
            "/profile",
            data={"speaker_name": "   "},
            files={"reference_audio": REFERENCE},
        )
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "bad_request"

    def test_register_replaces_previous_profile(self, client, fake_verifier):
        first = _register_profile(client, name="Alice")
        assert first.status_code == 200

        response = _register_profile(
            client,
            file=("ref2.wav", make_sine_wave_bytes(duration_seconds=2.0, frequency_hz=880), "audio/wav"),
            name="Bob",
        )
        assert response.status_code == 200
        listed = client.get("/profile").json()
        assert listed["count"] == 1
        assert listed["items"][0]["name"] == "Bob"

    def test_register_cleans_up_temporary_analysis(
        self, client, fake_verifier
    ):
        upload = client.post("/audio/upload", files={"file": ANALYSIS_DIFF})
        assert upload.status_code == 200
        assert client.get("/audio").json()["total"] == 1

        response = _register_profile(client)
        assert response.status_code == 200
        # The registration's own temporary analysis is deleted; the total
        # did not grow (no temp-record leak).
        assert client.get("/audio").json()["total"] == 1

    def test_profile_status_no_profile(self, client, fake_verifier):
        body = client.get("/profile/status").json()
        assert body["has_profile"] is False
        assert body["profile"] is None


class TestProfileDelete:
    def test_delete_profile(self, client, fake_verifier):
        response = _register_profile(client)
        profile_id = response.json()["profile_id"]

        deleted = client.delete(f"/profile/{profile_id}")
        assert deleted.status_code == 200
        assert deleted.json()["success"] is True

        listed = client.get("/profile").json()
        assert listed["count"] == 0
        assert listed["has_profile"] is False

    def test_delete_missing_profile_404(self, client, fake_verifier):
        response = client.delete(f"/profile/{uuid.uuid4()}")
        assert response.status_code == 404


class TestSpeakerVerification:
    def test_verify_without_profile_404(self, client, fake_verifier):
        analysis_id = _upload_and_preprocess(client, ANALYSIS_SAME)

        response = client.post(f"/analysis/{analysis_id}/speaker")
        assert response.status_code == 404
        assert "profile" in response.json()["error"]["message"].lower()

        result = client.get(f"/analysis/{analysis_id}/speaker").json()
        assert result["speaker_verification_status"] is None
        assert result["similarity_score"] is None

    def test_verify_requires_preprocessing(self, client, fake_verifier):
        _register_profile(client)
        upload = client.post("/audio/upload", files={"file": ANALYSIS_SAME})
        analysis_id = upload.json()["analysis_id"]

        response = client.post(f"/analysis/{analysis_id}/speaker")
        assert response.status_code == 400
        assert "must be preprocessed" in response.json()["error"]["message"]

    def test_verify_success_matching_speaker(self, client, fake_verifier):
        _register_profile(client)
        analysis_id = _upload_and_preprocess(client, ANALYSIS_SAME)

        response = client.post(f"/analysis/{analysis_id}/speaker")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "SPEAKER_ANALYZED"
        assert body["speaker_verification_status"] == "VERIFIED"
        assert body["verified"] is True
        assert body["similarity_score"] == pytest.approx(1.0, abs=1e-6)
        assert body["speaker_model"] == "fake-ecapa-speaker"
        assert body["reference_name"] == "Speaker One"
        assert body["speaker_processing_time"] >= 0

        stored = client.get(f"/audio/{analysis_id}").json()
        assert stored["status"] == "SPEAKER_ANALYZED"
        assert stored["speaker_verification_status"] == "VERIFIED"
        assert stored["speaker_similarity"] == pytest.approx(1.0, abs=1e-6)
        assert stored["speaker_verified"] is True

        result = client.get(f"/analysis/{analysis_id}/speaker").json()
        assert result["verified"] is True
        assert result["similarity_score"] == pytest.approx(1.0, abs=1e-6)

    def test_verify_different_speaker_not_verified(self, client, fake_verifier):
        _register_profile(client)
        analysis_id = _upload_and_preprocess(client, ANALYSIS_DIFF)

        response = client.post(f"/analysis/{analysis_id}/speaker")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "SPEAKER_ANALYZED"
        assert body["verified"] is False
        assert body["similarity_score"] is not None
        assert body["similarity_score"] < 0.25

    def test_verify_idempotent_no_rerun(self, client, fake_verifier):
        _register_profile(client)
        analysis_id = _upload_and_preprocess(client, ANALYSIS_SAME)

        first = client.post(f"/analysis/{analysis_id}/speaker")
        assert first.status_code == 200
        calls_after_first = fake_verifier.create_calls

        second = client.post(f"/analysis/{analysis_id}/speaker")
        assert second.status_code == 200
        assert fake_verifier.create_calls == calls_after_first

    def test_verify_model_unavailable_503(self, client, fake_verifier, monkeypatch):
        _register_profile(client)
        analysis_id = _upload_and_preprocess(client, ANALYSIS_SAME)

        def unavailable():
            raise SpeakerModelUnavailableError()

        monkeypatch.setattr(speaker_verifier_manager, "get_verifier", unavailable)

        response = client.post(f"/analysis/{analysis_id}/speaker")
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "speaker_model_unavailable"

        record = client.get(f"/audio/{analysis_id}").json()
        # Record stays analysable-ready; deepfake result semantics untouched.
        assert record["status"] == "READY_FOR_ANALYSIS"
        assert record["speaker_verification_status"] is None
        assert record["speaker_error"] is None

    def test_verify_failure_marks_failed_keeps_state(self, client, fake_verifier, monkeypatch):
        _register_profile(client)
        analysis_id = _upload_and_preprocess(client, ANALYSIS_SAME)

        verifier = FakeSpeakerVerifier(raises=SpeakerVerificationError("Embedding failed"))
        monkeypatch.setattr(speaker_verifier_manager, "get_verifier", lambda: verifier)

        response = client.post(f"/analysis/{analysis_id}/speaker")
        assert response.status_code == 500
        assert response.json()["error"]["code"] == "speaker_verification_failed"

        record = client.get(f"/audio/{analysis_id}").json()
        assert record["speaker_verification_status"] == "FAILED"
        assert "failed" in record["speaker_error"].lower()
        # Top-level lifecycle status is NOT flipped because the deepfake
        # result (if any) remains valid.
        assert record["status"] == "READY_FOR_ANALYSIS"

    def test_verify_missing_analysis_404(self, client, fake_verifier):
        response = client.post(f"/analysis/{uuid.uuid4()}/speaker")
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "not_found"

    def test_verify_invalid_id_422(self, client, fake_verifier):
        response = client.post("/analysis/not-a-uuid/speaker")
        assert response.status_code == 422


class TestAnalysisStatus:
    def test_analysis_status_reports_speaker(self, client, fake_verifier, monkeypatch):
        from app.ml.schemas import DetectorStatus

        monkeypatch.setattr(
            speaker_verifier_manager,
            "status",
            lambda: DetectorStatus(
                state="loaded", model_name="fake-ecapa-speaker", device="cpu"
            ),
        )

        response = client.get("/analysis/status")
        assert response.status_code == 200
        body = response.json()
        assert body["available"] is True
        assert body["speaker"] is True