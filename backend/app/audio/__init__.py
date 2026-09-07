"""Audio preprocessing package.

Phase 4 consumes the ``PreprocessingResult.processed_path`` - it never
needs to know how the original audio was uploaded or converted.
"""

from app.audio.preprocessor import AudioPreprocessor, PreprocessingResult

__all__ = ["AudioPreprocessor", "PreprocessingResult"]