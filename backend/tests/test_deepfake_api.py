"""API tests for deepfake analysis endpoints with a mocked detector.

The real model is never downloaded here; ``get_detector`` is replaced with
a deterministic fake so the flow, storage, status transitions, and error
paths are fully exercised without ML weights.
"""

import uuid

import pytest

from app.core.exceptions import DeepfakeDetectionError, DeepfakeModelUnavailableError
from app.ml import deepfake_model_manager
from app.services import analysis_service
from tests.deepfake_fakes import FakeDeepfakeDetector
from tests.helpers import make_sine_wave_bytes

VALID_SINE = ("voice.wav", make_sine_wave_bytes(duration_seconds=2.0), "audio/wav")


@pytest.fixture()
def fake_detector(monkeypatch):
    detector = FakeDeepfakeDetector(ai_probability=0.91, predicted_class="synthetic")
    monkeypatch.setattr(deepfake_model_manager, "get_detector", lambda: detector)
    return detector


def _upload(client, file=VALID_SINE) -> str:
    response = client.post("/audio/upload", files={"file": file})
    assert response.status_code == 200
    return response.json()["analysis_id"]


def _upload_and_preprocess(client, file=VALID_SINE) -> str:
    analysis_id = _upload(client, file)
    pre = client.post(f"/audio/{analysis_id}/preprocess")
    assert pre.status_code == 200
    return analysis_id


def test_deepfake_requires_preprocessing(client, fake_detector):
    analysis_id = _upload(client)

    response = client.post(f"/analysis/{analysis_id}/deepfake")

    assert response.status_code == 400
    body = response.json()
    assert body["error"]["code"] == "bad_request"
    assert "must be preprocessed" in body["error"]["message"]


def test_deepfake_result_before_analysis(client, fake_detector):
    analysis_id = _upload(client)

    response = client.get(f"/analysis/{analysis_id}/deepfake")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "UPLOADED"
    assert body["ai_probability"] is None
    assert body["predicted_class"] is None


def test_deepfake_success_stores_and_returns(client, fake_detector):
    analysis_id = _upload_and_preprocess(client)

    response = client.post(f"/analysis/{analysis_id}/deepfake")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "DEEPFAKE_ANALYZED"
    assert body["ai_probability"] == pytest.approx(0.91)
    assert body["real_probability"] == pytest.approx(0.09)
    assert body["predicted_class"] == "synthetic"
    assert body["model"]["name"] == "fake-deepfake-detector"
    assert body["device"] == "cpu"
    assert body["processing_time_seconds"] >= 0

    stored = client.get(f"/audio/{analysis_id}").json()
    assert stored["status"] == "DEEPFAKE_ANALYZED"
    assert stored["ai_probability"] == pytest.approx(0.91)
    assert stored["deepfake_label"] == "synthetic"
    assert stored["deepfake_model"] == "fake-deepfake-detector"

    result = client.get(f"/analysis/{analysis_id}/deepfake").json()
    assert result["ai_probability"] == pytest.approx(0.91)
    assert result["status"] == "DEEPFAKE_ANALYZED"


def test_deepfake_idempotent_no_rerun(client, fake_detector):
    analysis_id = _upload_and_preprocess(client)

    first = client.post(f"/analysis/{analysis_id}/deepfake")
    assert first.status_code == 200
    calls_after_first = fake_detector.predict_calls

    second = client.post(f"/analysis/{analysis_id}/deepfake")
    assert second.status_code == 200
    assert fake_detector.predict_calls == calls_after_first


def test_deepfake_model_unavailable_returns_503(client, monkeypatch):
    analysis_id = _upload_and_preprocess(client)

    def unavailable():
        raise DeepfakeModelUnavailableError()

    monkeypatch.setattr(deepfake_model_manager, "get_detector", unavailable)

    response = client.post(f"/analysis/{analysis_id}/deepfake")
    assert response.status_code == 503
    assert (
        response.json()["error"]["code"] == "deepfake_model_unavailable"
    )

    record = client.get(f"/audio/{analysis_id}").json()
    # Record is NOT marked fake-failed; it stays analysable-ready.
    assert record["status"] == "READY_FOR_ANALYSIS"
    assert record["deepfake_error"] is None


def test_deepfake_inference_failure_marks_failed(client, fake_detector, monkeypatch):
    analysis_id = _upload_and_preprocess(client)

    def failing_predict(audio_path):
        raise DeepfakeDetectionError("Model inference failed for the supplied audio.")

    monkeypatch.setattr(fake_detector, "predict", failing_predict)

    response = client.post(f"/analysis/{analysis_id}/deepfake")
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "deepfake_detection_failed"

    record = client.get(f"/audio/{analysis_id}").json()
    assert record["status"] == "FAILED"
    assert "failed" in record["deepfake_error"].lower()


def test_deepfake_missing_analysis_404(client, fake_detector):
    response = client.post(f"/analysis/{uuid.uuid4()}/deepfake")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_deepfake_invalid_id_422(client):
    response = client.post("/analysis/not-a-uuid/deepfake")
    assert response.status_code == 422


def test_deepfake_url_is_id_restricted(client, fake_detector):
    """Path traversal / arbitrary file paths must not be accepted."""
    response = client.post("/analysis/..%2F..%2Fsecret/deepfake")
    assert response.status_code in (404, 422)


def test_analysis_status_reports_deepfake(client, fake_detector, monkeypatch):
    from app.ml.schemas import DetectorStatus

    monkeypatch.setattr(
        deepfake_model_manager,
        "status",
        lambda: DetectorStatus(
            state="loaded", model_name="fake-deepfake-detector", device="cpu"
        ),
    )

    response = client.get("/analysis/status")
    assert response.status_code == 200
    body = response.json()
    assert body["available"] is True
    assert body["deepfake"] is True