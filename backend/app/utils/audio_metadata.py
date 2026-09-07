"""Lightweight audio metadata helpers.

Duration detection is done without any ML or heavy audio dependencies.
WAV duration is parsed directly from the RIFF/WAVE header (byte rate vs
data size). MP3, M4A, OGG, and WEBM require a decoder (e.g. FFmpeg) and are
deferred to Phase 3 — a ``None`` duration is returned rather than a fake
value.
"""

import struct


def detect_wav_duration(content: bytes) -> float | None:
    """Parse a PCM WAV header and return duration in seconds, or None.

    Returns ``None`` (never a fabricated value) if the header is malformed
    or the required chunks are missing.
    """
    if content[:4] != b"RIFF" or content[8:12] != b"WAVE":
        return None

    pos = 12
    byte_rate: int | None = None
    data_size: int | None = None

    while pos + 8 <= len(content):
        chunk_id = content[pos : pos + 4]
        (chunk_size,) = struct.unpack_from("<I", content, pos + 4)
        data_start = pos + 8

        if chunk_id == b"fmt " and chunk_size >= 16:
            if data_start + 12 <= len(content):
                (byte_rate,) = struct.unpack_from("<I", content, data_start + 8)
        elif chunk_id == b"data":
            data_size = chunk_size

        pos = data_start + chunk_size + (chunk_size % 2)
        if byte_rate and data_size:
            break

    if byte_rate and data_size and byte_rate > 0:
        return round(data_size / byte_rate, 3)
    return None


def detect_audio_duration(content: bytes, extension: str) -> float | None:
    """Return audio duration when it can be derived without dependencies.

    Only WAV is supported in this phase. MP3/M4A/OGG/WEBM return ``None``.
    """
    if extension == "wav":
        try:
            return detect_wav_duration(content)
        except (struct.error, IndexError):
            return None
    return None