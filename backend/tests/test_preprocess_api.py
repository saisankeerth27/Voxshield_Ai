"""Tests for the preprocessing API endpoints (Phase 3).

Endpoints: POST /audio/{id}/preprocess, GET /audio/{id}/preprocess,
GET /audio/{id}/processed. Uses real in-memory SQLite + temp storage.
"""

import uuid
from pathlib import Path

import pytest

from app.core.config import settings
from tests.helpers import make_sine_wave_bytes, make_wav

VALID_SINE = ("voice.wav", make_sine_wave_bytes(duration_seconds=2.0), "audio/wav")


def _upload(client, file: tuple) -> str:
    response = client.post("/audio/upload", files={"file": file})
    assert response.status_code == 200
    return response.json()["analysis_id"]


def _preprocess(client, analysis_id: str, expected_status: int, expected_code: str):
    response = client.post(f"/audio/{analysis_id}/preprocess")
    assert response.status_code == expected_status
    body = response.json()
    if expected_status == 200:
        return body
    assert body["error"]["code"] == expected_code
    return body


def test_preprocess_success(client):
    analysis_id = _upload(client, VALID_SINE)

    body = _preprocess(client, analysis_id, 200, "")
    assert body["success"] is True
    assert body["analysis_id"] == analysis_id
    assert body["status"] == "READY_FOR_ANALYSIS"
    assert body["audio"]["sample_rate"] == 16000
    assert body["audio"]["channels"] == 1
    assert body["audio"]["duration_seconds"] == pytest.approx(2.0, abs=0.05)
    assert "completed successfully" in body["message"]


def test_preprocess_is_idempotent(client):
    analysis_id = _upload(client, VALID_SINE)

    first = _preprocess(client, analysis_id, 200, "")
    second = _preprocess(client, analysis_id, 200, "")
    assert second["status"] == "READY_FOR_ANALYSIS"

    detail = client.get(f"/audio/{analysis_id}").json()
    assert detail["processed_filename"] is not None


def test_preprocess_status_endpoint(client):
    analysis_id = _upload(client, VALID_SINE)

    before = client.get(f"/audio/{analysis_id}/preprocess")
    assert before.status_code == 200
    assert before.json()["status"] == "UPLOADED"
    assert before.json()["original"]["sample_rate"] is None

    _preprocess(client, analysis_id, 200, "")

    after = client.get(f"/audio/{analysis_id}/preprocess").json()
    assert after["status"] == "READY_FOR_ANALYSIS"
    assert after["original"]["sample_rate"] == 16000
    assert after["processed"]["sample_rate"] == 16000
    assert after["processed"]["channels"] == 1
    assert after["processed"]["duration_seconds"] == pytest.approx(2.0, abs=0.05)
    assert after["preprocessing_error"] is None


def test_processed_audio_streamed_as_wav(client):
    analysis_id = _upload(client, VALID_SINE)
    _preprocess(client, analysis_id, 200, "")

    response = client.get(f"/audio/{analysis_id}/processed")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("audio/wav")
    assert response.content.startswith(b"RIFF")
    assert len(response.content) > 100


def test_processed_before_preprocess_returns_404(client):
    analysis_id = _upload(client, VALID_SINE)

    response = client.get(f"/audio/{analysis_id}/processed")
    assert response.status_code == 404


def test_preprocess_missing_analysis_returns_404(client):
    response = client.post(f"/audio/{uuid.uuid4()}/preprocess")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_preprocess_when_original_file_missing_returns_404(client):
    analysis_id = _upload(client, VALID_SINE)

    stored = _newest_file_in(Path(settings.upload_dir))
    assert stored is not None
    stored.unlink()

    response = client.post(f"/audio/{analysis_id}/preprocess")
    assert response.status_code == 404
    assert "Original audio file" in response.json()["error"]["message"]

    failed = client.get(f"/audio/{analysis_id}").json()
    assert failed["status"] == "UPLOADED"


def _newest_file_in(directory: Path) -> Path | None:
    files = [p for p in directory.glob("*") if p.is_file()]
    if not files:
        return None
    return max(files, key=lambda p: p.stat().st_mtime)


def test_preprocess_silent_audio_fails_with_400(client):
    silent = ("silent.wav", make_wav(duration_seconds=2.0), "audio/wav")
    analysis_id = _upload(client, silent)

    response = client.post(f"/audio/{analysis_id}/preprocess")
    assert response.status_code == 400
    body = response.json()
    assert body["error"]["code"] == "bad_request"
    assert "insufficient speech signal" in body["error"]["message"]

    failed = client.get(f"/audio/{analysis_id}").json()
    assert failed["status"] == "FAILED"
    assert "insufficient speech signal" in failed["preprocessing_error"]


def test_preprocess_too_short_fails_with_400(client):
    short = ("short.wav", make_sine_wave_bytes(duration_seconds=0.4), "audio/wav")
    analysis_id = _upload(client, short)

    response = client.post(f"/audio/{analysis_id}/preprocess")
    assert response.status_code == 400
    assert "too short" in response.json()["error"]["message"]


def test_delete_removes_processed_file(client):
    analysis_id = _upload(client, VALID_SINE)
    _preprocess(client, analysis_id, 200, "")
    detail = client.get(f"/audio/{analysis_id}").json()
    processed_file = Path(settings.processed_audio_dir) / detail["processed_filename"]
    assert processed_file.exists()

    response = client.delete(f"/audio/{analysis_id}")
    assert response.status_code == 200

    assert not processed_file.exists()
    assert client.get(f"/audio/{analysis_id}/processed").status_code == 404
    assert client.get(f"/audio/{analysis_id}").status_code == 404