"""Test helper functions shared across test modules."""

import struct


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