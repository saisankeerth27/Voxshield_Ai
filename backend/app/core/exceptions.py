"""Centralized exception handling for the API.

Each exception maps to a specific HTTP status code and produces a
consistent JSON error envelope for the client. Internal details
(stack traces) are never exposed.
"""

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


class VoiceShieldError(Exception):
    """Base exception for all application-level errors."""

    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    code: str = "internal_error"
    detail: str = "An unexpected error occurred."

    def __init__(self, detail: str | None = None) -> None:
        if detail is not None:
            self.detail = detail
        super().__init__(self.detail)


class BadRequestError(VoiceShieldError):
    """400 - Request could not be understood."""

    status_code = status.HTTP_400_BAD_REQUEST
    code = "bad_request"


class NotFoundError(VoiceShieldError):
    """404 - Requested resource does not exist."""

    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"


class ValidationError(VoiceShieldError):
    """422 - Payload failed validation."""

    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    code = "validation_error"


class FileTooLargeError(VoiceShieldError):
    """413 - Uploaded file exceeds the configured maximum."""

    status_code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    code = "file_too_large"


class ConflictError(VoiceShieldError):
    """409 - Resource already exists / conflict with current state."""

    status_code = status.HTTP_409_CONFLICT
    code = "conflict"


class FfmpegUnavailableError(VoiceShieldError):
    """500 - FFmpeg binary could not be found on this system.

    This is a configuration error: the audio pipeline requires FFmpeg for
    non-WAV input formats.
    """

    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    code = "ffmpeg_unavailable"
    detail = "FFmpeg is not installed or could not be found."


class PreprocessingError(VoiceShieldError):
    """500 - Unexpected failure while preprocessing audio."""

    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    code = "preprocessing_failed"


class DeepfakeModelUnavailableError(VoiceShieldError):
    """503 - The deepfake detection model could not be loaded.

    Returned when model weights are missing, the download failed, or the
    configured model is unusable. Never returns a fabricated prediction.
    """

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "deepfake_model_unavailable"
    detail = "Deepfake detection model is currently unavailable."


class DeepfakeInputError(VoiceShieldError):
    """400 - Audio supplied to the model is invalid for inference."""

    status_code = status.HTTP_400_BAD_REQUEST
    code = "deepfake_input_error"


class DeepfakeDetectionError(VoiceShieldError):
    """500 - Unexpected failure during deepfake inference."""

    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    code = "deepfake_detection_failed"


class SpeakerModelUnavailableError(VoiceShieldError):
    """503 - The speaker recognition model could not be loaded."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "speaker_model_unavailable"
    detail = "Speaker recognition model is currently unavailable."


class SpeakerInputError(VoiceShieldError):
    """400 - Audio supplied to the speaker model is invalid."""

    status_code = status.HTTP_400_BAD_REQUEST
    code = "speaker_input_error"


class SpeakerVerificationError(VoiceShieldError):
    """500 - Unexpected failure while generating/verifying a speaker embedding."""

    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    code = "speaker_verification_failed"


class SpeakerEmbeddingError(VoiceShieldError):
    """500 - Invalid or incompatible stored embedding."""

    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    code = "speaker_embedding_invalid"


class IncompleteAnalysisError(VoiceShieldError):
    """400 - Required analysis results are missing for the requested operation."""

    status_code = status.HTTP_400_BAD_REQUEST
    code = "incomplete_analysis"


class ServiceUnavailableError(VoiceShieldError):
    """503 - Dependency (e.g. database) is unavailable."""

    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    code = "service_unavailable"


def _error_response(err: VoiceShieldError) -> JSONResponse:
    return JSONResponse(
        status_code=err.status_code,
        content={
            "error": {
                "code": err.code,
                "message": err.detail,
            }
        },
    )


def _unhandled_response(request: Request, exc: Exception) -> JSONResponse:
    """Generic handler: never leak internals to the client."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "internal_error",
                "message": "An unexpected error occurred.",
            }
        },
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Wire custom exception handlers onto the FastAPI app."""

    @app.exception_handler(VoiceShieldError)
    async def voice_shield_error_handler(
        request: Request, exc: VoiceShieldError
    ) -> JSONResponse:
        return _error_response(exc)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        return _unhandled_response(request, exc)
