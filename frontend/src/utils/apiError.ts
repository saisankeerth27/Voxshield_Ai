import { AxiosError } from "axios";
import type { ApiError } from "../types/api";

const NETWORK_MESSAGE =
  "Unable to connect to the backend. Please make sure the backend server is running.";
const SERVER_MESSAGE =
  "Something went wrong while processing the request. Please try again.";

/**
 * Extract a human-readable message from backend error responses.
 *
 * Technical details (e.g. "Network Error", HTTP 500) are translated into
 * plain language so end users never see raw stack traces. Backend-provided
 * messages (4xx validation etc.) are shown as-is. Detailed errors remain in
 * the backend logs.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    if (!error.response) {
      return NETWORK_MESSAGE;
    }
    const body = error.response.data as ApiError | undefined;
    if (body?.error?.message) {
      return body.error.message;
    }
    if (error.response.status >= 500) {
      return SERVER_MESSAGE;
    }
  }
  return fallback;
}

export default getApiErrorMessage;