import { api, API_BASE_URL } from "./api";
import type {
  AudioAnalysis,
  AudioListResponse,
  AudioPreprocessResponse,
  AudioUploadResponse,
  PreprocessStatusResponse,
} from "../types/analysis";

/**
 * Audio service: upload, preprocess, fetch, list, and delete audio records.
 *
 * Handles multipart uploads with progress reporting; all other calls use
 * the shared JSON API client. Processed audio is streamed from a dedicated
 * endpoint so its storage location is never exposed as a URL.
 */
export const audioService = {
  /**
   * Upload an audio file. ``onProgress`` receives a 0–1 proportion that can
   * be rendered as a progress bar.
   */
  async upload(
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<AudioUploadResponse> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<AudioUploadResponse>(
      "/audio/upload",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
        onUploadProgress: (event) => {
          if (event.total && onProgress) {
            onProgress(event.loaded / event.total);
          }
        },
      },
    );
    return response.data;
  },

  /** Run the preprocessing pipeline. Sets status to READY_FOR_ANALYSIS. */
  async preprocess(analysisId: string): Promise<AudioPreprocessResponse> {
    const response = await api.post<AudioPreprocessResponse>(
      `/audio/${analysisId}/preprocess`,
    );
    return response.data;
  },

  /** Fetch preprocessing status and media metadata. */
  async getPreprocessingStatus(
    analysisId: string,
  ): Promise<PreprocessStatusResponse> {
    const response = await api.get<PreprocessStatusResponse>(
      `/audio/${analysisId}/preprocess`,
    );
    return response.data;
  },

  /** Absolute URL streaming the processed WAV for an analysis. */
  processedUrl(analysisId: string): string {
    return `${API_BASE_URL}/audio/${analysisId}/processed`;
  },

  /** Fetch metadata for a single analysis record. */
  async get(analysisId: string): Promise<AudioAnalysis> {
    const response = await api.get<AudioAnalysis>(`/audio/${analysisId}`);
    return response.data;
  },

  /** Delete an analysis record and its stored audio file. */
  async remove(analysisId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(
      `/audio/${analysisId}`,
    );
    return response.data;
  },

  /** Paginated list of analysis records, newest first. */
  async list(page = 1, limit = 10): Promise<AudioListResponse> {
    const response = await api.get<AudioListResponse>("/audio", {
      params: { page, limit },
    });
    return response.data;
  },
};

export default audioService;