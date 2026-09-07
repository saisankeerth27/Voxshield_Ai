"""Tests for the model manager: load-once, CPU fallback, failure state."""

import pytest
import torch

from app.core.config import settings
from app.core.exceptions import DeepfakeModelUnavailableError
from app.ml import deepfake_model_manager
from tests.deepfake_fakes import FakeDeepfakeDetector


@pytest.fixture()
def reset_manager():
    deepfake_model_manager._detector = None
    deepfake_model_manager._state = "not_loaded"
    deepfake_model_manager._device = None
    deepfake_model_manager._name = None
    deepfake_model_manager._version = None
    yield
    deepfake_model_manager._detector = None
    deepfake_model_manager._state = "not_loaded"
    deepfake_model_manager._device = None
    deepfake_model_manager._name = None
    deepfake_model_manager._version = None


def test_automatic_cpu_fallback(reset_manager, monkeypatch):
    monkeypatch.setattr(settings, "model_device", "auto")
    monkeypatch.setattr(torch.cuda, "is_available", lambda: False)
    monkeypatch.setattr(
        deepfake_model_manager,
        "_build_detector",
        lambda device: FakeDeepfakeDetector(device=device),
    )

    detector = deepfake_model_manager.get_detector()
    assert detector.device == "cpu"
    assert deepfake_model_manager.status().state == "loaded"
    assert deepfake_model_manager.status().device == "cpu"


def test_cuda_requested_falls_back_to_cpu(reset_manager, monkeypatch):
    monkeypatch.setattr(settings, "model_device", "cuda")
    monkeypatch.setattr(torch.cuda, "is_available", lambda: False)
    monkeypatch.setattr(
        deepfake_model_manager,
        "_build_detector",
        lambda device: FakeDeepfakeDetector(device=device),
    )

    detector = deepfake_model_manager.get_detector()
    assert detector.device == "cpu"


def test_model_loaded_once_and_cached(reset_manager, monkeypatch):
    monkeypatch.setattr(settings, "model_device", "cpu")
    monkeypatch.setattr(torch.cuda, "is_available", lambda: False)
    builds = []

    def fake_build(device):
        builds.append(True)
        return FakeDeepfakeDetector(device=device)

    monkeypatch.setattr(deepfake_model_manager, "_build_detector", fake_build)

    first = deepfake_model_manager.get_detector()
    second = deepfake_model_manager.get_detector()
    assert first is second
    assert len(builds) == 1


def test_load_failure_marks_unavailable(reset_manager, monkeypatch):
    monkeypatch.setattr(settings, "model_device", "cpu")
    monkeypatch.setattr(torch.cuda, "is_available", lambda: False)

    def failing_build(device):
        raise RuntimeError("download failed")

    monkeypatch.setattr(deepfake_model_manager, "_build_detector", failing_build)

    with pytest.raises(DeepfakeModelUnavailableError):
        deepfake_model_manager.get_detector()

    status = deepfake_model_manager.status()
    assert status.state == "unavailable"
    assert status.model_name is None


def test_device_auto_prefers_cuda(reset_manager, monkeypatch):
    monkeypatch.setattr(settings, "model_device", "auto")
    monkeypatch.setattr(torch.cuda, "is_available", lambda: True)
    monkeypatch.setattr(
        deepfake_model_manager,
        "_build_detector",
        lambda device: FakeDeepfakeDetector(device=device),
    )

    detector = deepfake_model_manager.get_detector()
    assert detector.device == "cuda"