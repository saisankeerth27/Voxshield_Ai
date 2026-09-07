"""Tests for the audio upload pipeline (Phase 2).

Requires no ML models. Uploaded files are written to a temporary upload
directory that is cleaned up automatically.
"""

import uuid

import pytest
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models.audio import AudioAnalysis
from tests.helpers import (
    make_m4a_bytes,
    make_mp3_bytes,
    make_ogg_bytes,
    make_wav,
)

UPLOAD_FILE = {"file": ("sample.wav", make_wav(duration_seconds=0.5), "audio/wav")}


def test_upload_valid_wav(client):
    response = client.post("/audio/upload", files=UPLOAD_FILE)
    assert response.status_code == 200

    body = response.json()
    assert body["success"] is True
    assert body["status"] == "UPLOADED"
    assert body["message"] == "Audio uploaded successfully"
    assert "sample.wav" in body["filename"]

    # analysis_id must be a parseable UUID (unique server-side name).
    analysis_id = body["analysis_id"]
    assert uuid.UUID(analysis_id)


def test_upload_valid_wav_stores_duration(client):
    response = client.post(
        "/audio/upload",
        files={"file": ("voice.wav", make_wav(duration_seconds=1.0), "audio/wav")},
    )
    assert response.status_code == 200
    analysis_id = response.json()["analysis_id"]

    detail = client.get(f"/audio/{analysis_id}").json()
    assert detail["duration_seconds"] == pytest.approx(1.0, abs=0.01)


def test_upload_valid_mp3(client):
    response = client.post(
        "/audio/upload",
        files={"file": ("clip.mp3", make_mp3_bytes(duration_seconds=2.0), "audio/mpeg")},
    )
    assert response.status_code == 200
    assert response.json()["analysis_id"] is not None


def test_upload_valid_ogg(client):
    response = client.post(
        "/audio/upload",
        files={"file": ("clip.ogg", make_ogg_bytes(duration_seconds=2.0), "audio/ogg")},
    )
    assert response.status_code == 200
    assert response.json()["analysis_id"] is not None


def test_upload_valid_m4a(client):
    response = client.post(
        "/audio/upload",
        files={"file": ("clip.m4a", make_m4a_bytes(duration_seconds=2.0), "audio/mp4")},
    )
    assert response.status_code == 200
    assert response.json()["analysis_id"] is not None


def test_upload_corrupted_bytes_stored_then_fails_at_preprocess(client):
    # Validation checks extension/MIME/size, not content. The corruption is
    # caught downstream by the preprocessing decoder, never at upload time.
    response = client.post(
        "/audio/upload",
        files={"file": ("broken.wav", b"this is definitely not audio data", "audio/wav")},
    )
    assert response.status_code == 200
    analysis_id = response.json()["analysis_id"]

    pre = client.post(f"/audio/{analysis_id}/preprocess")
    assert pre.status_code == 400
    assert pre.json()["error"]["code"] == "bad_request"
    assert "Unable to decode" in pre.json()["error"]["message"]


def test_upload_invalid_extension(client):
    response = client.post(
        "/audio/upload",
        files={"file": ("notes.txt", b"not audio", "text/plain")},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "bad_request"
    assert "Unsupported audio format" in response.json()["error"]["message"]


def test_upload_oversized_file(client):
    # MAX_AUDIO_SIZE_MB is set to 1 in conftest.
    oversized = b"x" * (1 * 1024 * 1024 + 100)
    response = client.post(
        "/audio/upload",
        files={"file": ("big.wav", oversized, "audio/wav")},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "file_too_large"


def test_upload_empty_file(client):
    response = client.post(
        "/audio/upload",
        files={"file": ("empty.wav", b"", "audio/wav")},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "bad_request"
    assert "empty" in response.json()["error"]["message"].lower()


def test_upload_mime_mismatch_rejected(client):
    response = client.post(
        "/audio/upload",
        files={"file": ("voice.wav", make_wav(), "audio/mpeg")},
    )
    assert response.status_code == 400
    assert "does not match" in response.json()["error"]["message"]


def test_get_analysis_by_id(client):
    analysis_id = client.post("/audio/upload", files=UPLOAD_FILE).json()["analysis_id"]

    response = client.get(f"/audio/{analysis_id}")
    assert response.status_code == 200

    body = response.json()
    assert body["analysis_id"] == analysis_id
    assert body["filename"] == "sample.wav"
    assert body["file_size"] > 0
    assert body["mime_type"] == "audio/wav"
    assert body["status"] == "UPLOADED"
    assert "created_at" in body
    assert "updated_at" in body


def test_get_missing_analysis(client):
    response = client.get(f"/audio/{uuid.uuid4()}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_get_invalid_analysis_id(client):
    response = client.get("/audio/not-a-uuid")
    assert response.status_code == 422


def test_list_analyses_pagination(client):
    for _ in range(3):
        client.post("/audio/upload", files=UPLOAD_FILE)

    response = client.get("/audio?page=1&limit=2")
    assert response.status_code == 200
    body = response.json()
    assert body["page"] == 1
    assert body["limit"] == 2
    assert body["total"] >= 3
    assert len(body["items"]) == 2


def test_list_analyses_empty_database(client, test_engine):
    with Session(test_engine) as session:
        session.execute(delete(AudioAnalysis))
        session.commit()

    response = client.get("/audio?page=1&limit=10")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 0
    assert body["items"] == []


def test_delete_analysis(client):
    analysis_id = client.post("/audio/upload", files=UPLOAD_FILE).json()["analysis_id"]

    response = client.delete(f"/audio/{analysis_id}")
    assert response.status_code == 200
    assert response.json()["success"] is True

    # Record and stored file must both be gone.
    assert client.get(f"/audio/{analysis_id}").status_code == 404


def test_delete_missing_analysis(client):
    response = client.delete(f"/audio/{uuid.uuid4()}")
    assert response.status_code == 404