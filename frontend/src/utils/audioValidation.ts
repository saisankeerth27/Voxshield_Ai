import {
  ALLOWED_EXTENSIONS,
  MAX_UPLOAD_SIZE_MB,
} from "../types/analysis";
import type { AudioValidationResult } from "../types/audio";

const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

const mimeToExtension: Record<string, string> = {
  "audio/wav": "wav",
  "audio/wave": "wav",
  "audio/x-wav": "wav",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
  "audio/webm": "ogg",
};

/**
 * Validate a selected audio file against allowed extensions, MIME type,
 * and size limits. Returned error messages are human-readable.
 */
export function validateAudioFile(file: File): AudioValidationResult {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (!ALLOWED_EXTENSIONS.includes(extension as (typeof ALLOWED_EXTENSIONS)[number])) {
    return {
      valid: false,
      error: `Unsupported file type ".${extension}". Please use: ${ALLOWED_EXTENSIONS.join(", ")}.`,
    };
  }

  if (file.type) {
    const mapped = mimeToExtension[file.type];
    if (mapped && mapped !== extension) {
      return {
        valid: false,
        error: "The file's type does not match its extension.",
      };
    }
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return {
      valid: false,
      error: `File is too large. Maximum size is ${MAX_UPLOAD_SIZE_MB} MB.`,
    };
  }

  return { valid: true };
}

/**
 * Derive a human-readable format label from a MIME type for display.
 */
export function formatLabelFromMime(mime: string): string {
  return mimeToExtension[mime] ?? "audio";
}
