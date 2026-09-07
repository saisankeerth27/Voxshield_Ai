"""Basic health endpoint tests for Phase 1."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_200() -> None:
    response = client.get("/health")
    assert response.status_code == 200


def test_health_status_is_healthy() -> None:
    response = client.get("/health")
    assert response.json() == {"status": "healthy"}
