import api from "./api";
import type {
  AudioAnalysis,
  AudioListResponse,
  AudioUploadResponse,
} from "../types/analysis";

/**
 * Audio service: upload, fetch, list, and delete audio analysis records.
 *
 * Handles multipart uploads with progress reporting; all other calls use
 * the shared JSON API client.
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