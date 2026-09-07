"""Service-layer tests for speaker profile registration and verification.

Focus on paths that are awkward to drive through the public API (e.g. a
stored-but-corrupt voiceprint, direct DB manipulation).
"""

import uuid

import pytest
from sqlalchemy.orm import Session

from app.core.exceptions import SpeakerVerificationError
from app.ml import speaker_verifier_manager
from app.models.speaker import SpeakerProfile
from app.services import speaker_service
from tests.helpers import make_sine_wave_bytes
from tests.speaker_fakes import FakeSpeakerVerifier

UPLOAD_SAME = ("voice.wav", make_sine_wave_bytes(duration_seconds=2.0, frequency_hz=440), "audio/wav")


@pytest.fixture(autouse=True)
def _clean_state(test_engine):
    from sqlalchemy import delete

    from app.models.audio import AudioAnalysis

    with Session(test_engine) as session:
        session.execute(delete(SpeakerProfile))
        session.execute(delete(AudioAnalysis))
        session.commit()
    yield


def _processed_analysis(client, test_engine) -> uuid.UUID:
    upload = client.post("/audio/upload", files={"file": UPLOAD_SAME})
    analysis_id = uuid.UUID(upload.json()["analysis_id"])
    pre = client.post(f"/audio/{analysis_id}/preprocess")
    assert pre.status_code == 200
    return analysis_id


def _seed_corrupt_profile(test_engine) -> SpeakerProfile:
    with Session(test_engine) as session:
        profile = SpeakerProfile(
            name="Corrupt",
            embedding_bytes=b"\x00\x01not-a-valid-embedding",
            embedding_dim=8,
            model_name="fake-ecapa-speaker",
            model_version="test-0.0.1",
            device="cpu",
            sample_rate=16000,
            duration_seconds=2.0,
            active=True,
        )
        session.add(profile)
        session.commit()
        session.refresh(profile)
        return profile


def test_corrupt_stored_profile_raises_and_marks_failed(
    client, test_engine, monkeypatch
):
    _seed_corrupt_profile(test_engine)
    verifier = FakeSpeakerVerifier()
    monkeypatch.setattr(speaker_verifier_manager, "get_verifier", lambda: verifier)
    analysis_id = _processed_analysis(client, test_engine)

    with pytest.raises(SpeakerVerificationError):
        speaker_service.run_speaker_verification(analysis_id, Session(test_engine))

    with Session(test_engine) as session:
        from app.models.audio import AudioAnalysis

        record = session.get(AudioAnalysis, analysis_id)
        assert record.speaker_verification_status == "FAILED"
        assert "corrupt" in record.speaker_error.lower()
        assert record.status == "READY_FOR_ANALYSIS"


def test_verification_without_profile_raises_not_found(client, test_engine, monkeypatch):
    verifier = FakeSpeakerVerifier()
    monkeypatch.setattr(speaker_verifier_manager, "get_verifier", lambda: verifier)
    analysis_id = _processed_analysis(client, test_engine)

    from app.core.exceptions import NotFoundError

    with pytest.raises(NotFoundError):
        speaker_service.run_speaker_verification(analysis_id, Session(test_engine))


def test_registration_uses_real_audio_content_for_embedding(client, test_engine, monkeypatch):
    verifier = FakeSpeakerVerifier()
    monkeypatch.setattr(speaker_verifier_manager, "get_verifier", lambda: verifier)

    profile = speaker_service.register_speaker_profile(
        "Speaker One", _upload_image_placeholder(), Session(test_engine)
    )
    assert profile.embedding_dim == 8
    assert profile.duration_seconds >= 1.0


def _upload_image_placeholder():
    from types import SimpleNamespace

    return SimpleNamespace(
        filename="ref.wav",
        content_type="audio/wav",
        file=SimpleNamespace(read=lambda: make_sine_wave_bytes(duration_seconds=2.0, frequency_hz=440)),
    )