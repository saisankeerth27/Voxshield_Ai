"""Basic health endpoint tests for Phase 1."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_200() -> None:
    response = client.get("/health")
    assert response.status_code == 200


def test_health_status_is_healthy() -> None:
    response = client.get("/health")
    body = response.json()
    # Liveness first; model fields reflect the real (unloaded-in-tests) state.
    assert body["status"] == "healthy"
    assert body["deepfake_model"] in ("not_loaded", "loading", "loaded", "unavailable")
