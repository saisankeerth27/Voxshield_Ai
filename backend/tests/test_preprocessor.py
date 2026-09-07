"""Unit tests for the audio preprocessing pipeline (Phase 3).

These run the real pipeline against temporary fixture files, requiring no
ML models and no PostgreSQL.
"""

import uuid
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from app.audio.loader import find_ffmpeg_binary
from app.audio.preprocessor import AudioPreprocessor
from app.core.exceptions import (
    BadRequestError,
    FfmpegUnavailableError,
    NotFoundError,
)
from app.core.config import settings
from tests.helpers import (
    make_mp3_bytes,
    make_sine_wave_bytes,
    make_stereo_sine_wave,
    make_wav,
    write_wav_temp,
)

TARGET_RATE = 16000


@pytest.fixture()
def preprocessor() -> AudioPreprocessor:
    return AudioPreprocessor()


def _write(tmp_path: Path, data: bytes, name: str = "input.wav") -> Path:
    path = tmp_path / name
    path.write_bytes(data)
    return path


def test_preprocess_valid_mono_wav(preprocessor, tmp_path):
    path = _write(tmp_path, make_sine_wave_bytes(duration_seconds=2.0))

    result = preprocessor.preprocess(path)

    assert result.original_sample_rate == TARGET_RATE
    assert result.original_channels == 1
    assert result.processed_sample_rate == TARGET_RATE
    assert result.processed_channels == 1
    assert result.processed_duration_seconds == pytest.approx(2.0, abs=0.05)
    assert result.processed_path.exists()
    assert result.processed_path.suffix == ".wav"

    samples, sample_rate = sf.read(str(result.processed_path))
    assert sample_rate == TARGET_RATE
    assert samples.ndim == 1
    assert float(np.max(np.abs(samples))) == pytest.approx(0.9, rel=0.02)


def test_preprocess_stereo_downmixed_to_mono(preprocessor, tmp_path):
    path = _write(
        tmp_path,
        make_stereo_sine_wave(duration_seconds=2.0, sample_rate=44100),
    )

    result = preprocessor.preprocess(path)

    assert result.original_channels == 2
    assert result.original_sample_rate == 44100
    assert result.processed_channels == 1
    assert result.processed_sample_rate == TARGET_RATE
    assert result.processed_duration_seconds == pytest.approx(2.0, abs=0.05)


def test_preprocess_48k_resampled_to_target(preprocessor, tmp_path):
    src = write_wav_temp(duration_seconds=1.5, sample_rate=48000, suffix="_48k")
    path = Path(src)

    result = preprocessor.preprocess(path)

    assert result.original_sample_rate == 48000
    assert result.processed_sample_rate == TARGET_RATE
    assert result.processed_duration_seconds == pytest.approx(1.5, abs=0.05)


def test_preprocess_already_16k_no_resample(preprocessor, tmp_path):
    path = _write(tmp_path, make_sine_wave_bytes(duration_seconds=1.5, sample_rate=16000))

    result = preprocessor.preprocess(path)

    assert result.processed_sample_rate == TARGET_RATE
    assert result.processed_duration_seconds == pytest.approx(1.5, abs=0.05)


def test_preprocess_mp3_decoded(preprocessor, tmp_path):
    mp3_data = make_mp3_bytes(duration_seconds=2.0)
    path = _write(tmp_path, mp3_data, name="input.mp3")

    result = preprocessor.preprocess(path)

    assert result.processed_sample_rate == TARGET_RATE
    assert result.processed_channels == 1
    assert result.processed_path.exists()
    assert result.original_sample_rate is not None


def test_preprocess_silent_audio_rejected(preprocessor, tmp_path):
    path = _write(tmp_path, make_wav(duration_seconds=2.0))

    with pytest.raises(BadRequestError) as exc:
        preprocessor.preprocess(path)
    assert "insufficient speech signal" in exc.value.detail


def test_preprocess_too_short_rejected(preprocessor, tmp_path):
    path = _write(tmp_path, make_sine_wave_bytes(duration_seconds=0.4))

    with pytest.raises(BadRequestError) as exc:
        preprocessor.preprocess(path)
    assert "too short" in exc.value.detail


def test_preprocess_too_long_rejected(preprocessor, tmp_path):
    path = _write(tmp_path, make_sine_wave_bytes(duration_seconds=6.0))

    with pytest.raises(BadRequestError) as exc:
        preprocessor.preprocess(path)
    assert "too long" in exc.value.detail


def test_preprocess_corrupted_wav_rejected(preprocessor, tmp_path):
    path = _write(tmp_path, b"this is definitely not audio data")

    with pytest.raises(BadRequestError) as exc:
        preprocessor.preprocess(path)
    assert "Unable to decode" in exc.value.detail


def test_preprocess_missing_file_raises_not_found(preprocessor, tmp_path):
    missing = tmp_path / f"missing-{uuid.uuid4().hex}.wav"

    with pytest.raises(NotFoundError):
        preprocessor.preprocess(missing)


def test_find_ffmpeg_prefers_explicit_path(monkeypatch, tmp_path):
    dummy = tmp_path / "ffmpeg.exe"
    dummy.write_bytes(b"placeholder")

    monkeypatch.setattr(settings, "ffmpeg_binary", str(dummy))
    find_ffmpeg_binary.cache_clear()
    try:
        assert find_ffmpeg_binary() == str(dummy)
    finally:
        find_ffmpeg_binary.cache_clear()


def test_find_ffmpeg_raises_when_explicit_path_invalid(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "ffmpeg_binary", str(tmp_path / "gone.exe"))
    find_ffmpeg_binary.cache_clear()
    try:
        with pytest.raises(FfmpegUnavailableError):
            find_ffmpeg_binary()
    finally:
        find_ffmpeg_binary.cache_clear()