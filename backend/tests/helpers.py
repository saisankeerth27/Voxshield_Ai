"""Test helper functions shared across test modules."""

import math
import shutil
import struct

import pytest

pytest.importorskip("soundfile")

import numpy as np


def make_wav(duration_seconds: float = 0.5, sample_rate: int = 16000) -> bytes:
    """Build a minimal valid mono 16-bit PCM WAV file (no external deps)."""
    num_samples = int(duration_seconds * sample_rate)
    num_channels = 1
    bits_per_sample = 16
    byte_rate = sample_rate * num_channels * bits_per_sample // 8
    block_align = num_channels * bits_per_sample // 8
    data_size = num_samples * block_align

    # Silence as 16-bit PCM samples.
    pcm = b"\x00\x00" * num_samples

    fmt = struct.pack(
        "<HHIIHH",
        1,  # audio format: PCM
        num_channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
    )
    return b"".join(
        [
            b"RIFF",
            struct.pack("<I", 36 + data_size),
            b"WAVE",
            b"fmt ",
            struct.pack("<I", 16),
            fmt,
            b"data",
            struct.pack("<I", data_size),
            pcm[:data_size],
        ]
    )


def make_sine_wave_bytes(
    duration_seconds: float = 2.0,
    sample_rate: int = 16000,
    frequency_hz: float = 440.0,
    amplitude: float = 0.5,
) -> bytes:
    """Build a real, non-silent mono 16-bit PCM WAV (440 Hz sine wave)."""
    frames = int(duration_seconds * sample_rate)
    t = np.arange(frames) / sample_rate
    samples = (amplitude * np.sin(2 * np.pi * frequency_hz * t) * 32767).astype(
        np.int16
    )
    return _encode_stereo_or_mono_pcm(samples, sample_rate, num_channels=1)


def make_stereo_sine_wave(
    duration_seconds: float = 2.0,
    sample_rate: int = 44100,
) -> bytes:
    """Build a stereo 16-bit PCM WAV (left 440 Hz, right 880 Hz)."""
    frames = int(duration_seconds * sample_rate)
    t = np.arange(frames) / sample_rate
    left = (0.5 * np.sin(2 * np.pi * 440 * t) * 32767).astype(np.int16)
    right = (0.5 * np.sin(2 * np.pi * 880 * t) * 32767).astype(np.int16)
    stereo = np.stack([left, right], axis=1)
    return _encode_stereo_or_mono_pcm(stereo, sample_rate, num_channels=2)


def _encode_stereo_or_mono_pcm(
    samples: np.ndarray, sample_rate: int, num_channels: int
) -> bytes:
    bits_per_sample = 16
    byte_rate = sample_rate * num_channels * bits_per_sample // 8
    block_align = num_channels * bits_per_sample // 8
    pcm = samples.astype("<i2").tobytes()
    data_size = len(pcm)

    fmt = struct.pack(
        "<HHIIHH",
        1,
        num_channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
    )
    return b"".join(
        [
            b"RIFF",
            struct.pack("<I", 36 + data_size),
            b"WAVE",
            b"fmt ",
            struct.pack("<I", 16),
            fmt,
            b"data",
            struct.pack("<I", data_size),
            pcm,
        ]
    )


def make_mp3_bytes(duration_seconds: float = 2.0, sample_rate: int = 16000) -> bytes:
    """Encode a sine wave to MP3 via FFmpeg, skipping if unavailable."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        try:
            import imageio_ffmpeg

            ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            pytest.skip("FFmpeg is not available for MP3 test fixtures.")

    wav_path = write_wav_temp(duration_seconds, sample_rate, "_fixture")
    import subprocess

    proc = subprocess.run(
        [
            ffmpeg,
            "-v",
            "error",
            "-y",
            "-i",
            str(wav_path),
            "-acodec",
            "libmp3lame",
            "-f",
            "mp3",
            "-",
        ],
        capture_output=True,
        timeout=60,
    )
    if proc.returncode != 0 or not proc.stdout:
        pytest.skip("FFmpeg could not build an MP3 fixture: " + proc.stderr.decode())

    import os

    os.unlink(wav_path)
    return proc.stdout


def make_webm_bytes(duration_seconds: float = 2.0, sample_rate: int = 16000) -> bytes:
    """Encode a sine wave to WebM/Opus via FFmpeg, skipping if unavailable.

    Mirrors the browser's ``MediaRecorder`` output so the microphone upload
    path (WebM/Opus -> FFmpeg -> WAV) is exercised end-to-end in tests.
    """
    import subprocess

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        try:
            import imageio_ffmpeg

            ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            pytest.skip("FFmpeg is not available for WebM test fixtures.")

    wav_path = write_wav_temp(duration_seconds, sample_rate, "_webm_src")
    proc = subprocess.run(
        [
            ffmpeg,
            "-v",
            "error",
            "-y",
            "-i",
            str(wav_path),
            "-c:a",
            "libopus",
            "-f",
            "webm",
            "-",
        ],
        capture_output=True,
        timeout=60,
    )
    if proc.returncode != 0 or not proc.stdout:
        pytest.skip("FFmpeg could not build a WebM fixture: " + proc.stderr.decode())

    import os

    os.unlink(wav_path)
    return proc.stdout


def write_wav_temp(
    duration_seconds: float = 2.0,
    sample_rate: int = 16000,
    suffix: str = "",
) -> str:
    """Write a sine wave WAV to a temp file and return its path."""
    import os
    import tempfile

    import soundfile as sf

    fd, path = tempfile.mkstemp(suffix=f"{suffix}.wav")
    os.close(fd)
    frames = int(duration_seconds * sample_rate)
    t = np.arange(frames) / sample_rate
    samples = 0.5 * np.sin(2 * np.pi * 440 * t)
    sf.write(path, samples, sample_rate, subtype="PCM_16")
    return path