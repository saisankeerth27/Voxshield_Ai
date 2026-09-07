"""Reusable audio file validation utilities.

Validation is defense-in-depth: the file extension is never trusted on its
own; MIME type and size are checked as well. These functions raise typed
API errors so routes stay thin and messages stay consistent.
"""

from app.core.exceptions import BadRequestError, FileTooLargeError

ALLOWED_AUDIO_EXTENSIONS = {"wav", "mp3", "m4a", "ogg"}

MIME_TO_EXTENSION: dict[str, str] = {
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/x-wav": "wav",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/ogg": "ogg",
    "audio/opus": "ogg",
}


def extract_extension(filename: str) -> str:
    """Return the lowercased extension of a filename, or "" if none."""
    if "." not in filename:
        return ""
    return filename.rsplit(".", 1)[-1].lower()


def validate_extension(extension: str) -> None:
    """Reject unsupported or missing extensions."""
    if not extension or extension not in ALLOWED_AUDIO_EXTENSIONS:
        raise BadRequestError("Unsupported audio format.")


def validate_mime_type(mime_type: str | None, extension: str) -> None:
    """Reject a known MIME type that contradicts the file extension.

    Unknown or missing MIME types are tolerated because some clients
    submit ``application/octet-stream`` for valid audio files.
    """
    if not mime_type:
        return
    expected = MIME_TO_EXTENSION.get(mime_type)
    if expected and expected != extension:
        raise BadRequestError(
            "The audio file type does not match its extension."
        )


def validate_file_size(file_size: int, max_size_bytes: int) -> None:
    """Reject empty files and files exceeding the configured maximum."""
    if file_size <= 0:
        raise BadRequestError("Audio file is empty.")
    if file_size > max_size_bytes:
        raise FileTooLargeError("Audio file is too large.")


def validate_audio_upload(
    filename: str, mime_type: str | None, file_size: int, max_size_bytes: int
) -> str:
    """Run the full validation chain and return the validated extension."""
    extension = extract_extension(filename)
    validate_extension(extension)
    validate_mime_type(mime_type, extension)
    validate_file_size(file_size, max_size_bytes)
    return extension