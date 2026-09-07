"""Safe audio loading.

Responsibilities:
- verify the file exists and is a supported audio type
- decode WAV directly via SoundFile, other formats via FFmpeg
- report sample rate, channel count, duration, and sample count

No data is ever executed; FFmpeg only decodes and writes PCM to a pipe.
"""

import shutil
import subprocess
from dataclasses import dataclass
from functools import lru_cache
from io import BytesIO
from pathlib import Path

import numpy as np
import soundfile as sf

from app.core.config import settings
from app.core.exceptions import BadRequestError, FfmpegUnavailableError, NotFoundError
from app.utils.file_validation import ALLOWED_AUDIO_EXTENSIONS


class AudioLoader:
    """Load an audio file into an in-memory ``LoadedAudio`` object."""

    def load(self, audio_path: Path) -> "LoadedAudio":
        """Load audio and surface its technical properties.

        Raises a typed API error instead of crashing the server for missing
        files, unsupported formats, or corrupted/codec-incompatible audio.
        """
        if not audio_path.is_file():
            raise NotFoundError("Original audio file not found.")

        extension = audio_path.suffix.lower().lstrip(".")
        if extension not in ALLOWED_AUDIO_EXTENSIONS:
            raise BadRequestError("Unsupported audio format.")

        try:
            if extension == "wav":
                samples, sample_rate = self._load_wav(audio_path)
            else:
                samples, sample_rate = self._load_compressed(audio_path)
        except BadRequestError:
            raise
        except Exception:
            raise BadRequestError("Unable to decode the audio file.") from None

        channels = 1 if samples.ndim == 1 else samples.shape[1]
        if samples.ndim == 1:
            samples = samples.reshape(-1, 1)

        duration_seconds = samples.shape[0] / float(sample_rate)
        if samples.shape[0] == 0 or sample_rate <= 0:
            raise BadRequestError("Unable to decode the audio file.")

        return LoadedAudio(
            samples=samples,
            sample_rate=int(sample_rate),
            channels=channels,
            duration_seconds=round(duration_seconds, 3),
            sample_count=samples.shape[0],
        )

    @staticmethod
    def _load_wav(audio_path: Path) -> tuple[np.ndarray, int]:
        samples, sample_rate = sf.read(
            str(audio_path), dtype="float32", always_2d=True
        )
        return samples, sample_rate

    @staticmethod
    def _load_compressed(audio_path: Path) -> tuple[np.ndarray, int]:
        """Decode MP3/M4A/OGG to WAV bytes with FFmpeg, then read normally."""
        ffmpeg = find_ffmpeg_binary()
        command = [
            ffmpeg,
            "-v",
            "error",
            "-i",
            str(audio_path),
            "-map",
            "0:a:0",
            "-acodec",
            "pcm_s16le",
            "-f",
            "wav",
            "-",
        ]
        try:
            proc = subprocess.run(command, capture_output=True, timeout=120)
        except (OSError, subprocess.TimeoutExpired):
            raise BadRequestError("Unable to decode the audio file.") from None

        if proc.returncode != 0 or not proc.stdout:
            raise BadRequestError("Unable to decode the audio file.")

        with sf.SoundFile(BytesIO(proc.stdout)) as sound:
            samples = sound.read(dtype="float32", always_2d=True)
            return samples, sound.samplerate


@dataclass
class LoadedAudio:
    """Decoded audio plus its technical properties."""

    samples: np.ndarray  # shape (frames, channels), float32 in [-1, 1]
    sample_rate: int
    channels: int
    duration_seconds: float
    sample_count: int


@lru_cache(maxsize=1)
def find_ffmpeg_binary() -> str:
    """Resolve an FFmpeg binary: explicit path, PATH, then bundled fallback.

    A missing binary raises a clear configuration error - never a raw
    system stack trace.
    """
    if settings.ffmpeg_binary:
        candidate = Path(settings.ffmpeg_binary)
        if candidate.is_file():
            return str(candidate)
        raise FfmpegUnavailableError()

    on_path = shutil.which("ffmpeg")
    if on_path:
        return on_path

    try:
        import imageio_ffmpeg  # bundles a static FFmpeg binary

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        raise FfmpegUnavailableError() from None