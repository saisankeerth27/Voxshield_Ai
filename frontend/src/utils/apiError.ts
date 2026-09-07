import { AxiosError } from "axios";
import type { ApiError } from "../types/api";

/**
 * Extract a human-readable message from backend error responses.
 *
 * Falls back to reasonable defaults so callers never show "undefined".
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError && error.response?.data) {
    const body = error.response.data as ApiError;
    if (body.error?.message) {
      return body.error.message;
    }
  }
  return fallback;
}

export default getApiErrorMessage;