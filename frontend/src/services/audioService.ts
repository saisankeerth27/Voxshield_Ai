import { api, API_BASE_URL } from "./api";
import type {
  AnalysisStatusResponse,
  AudioAnalysis,
  AudioListResponse,
  AudioPreprocessResponse,
  AudioSource,
  AudioUploadResponse,
  DeepfakeResultResponse,
  DeepfakeRunResponse,
  PreprocessStatusResponse,
  SpeakerProfileDeleteResponse,
  SpeakerProfileListResponse,
  SpeakerProfileStatusResponse,
  SpeakerProfile,
  SpeakerResultResponse,
  SpeakerVerifyResponse,
  RiskCalculateResponse,
  RiskResultResponse,
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
   * Upload an audio file. ``source`` records where it came from
   * (UPLOAD or MICROPHONE) so history can tell them apart; it is stored
   * alongside the analysis without a separate table. ``onProgress``
   * receives a 0–1 proportion that can be rendered as a progress bar.
   */
  async upload(
    file: File,
    source: AudioSource = "UPLOAD",
    onProgress?: (progress: number) => void,
  ): Promise<AudioUploadResponse> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("source", source);
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

  /** Run the deepfake detector on preprocessed audio and store the result. */
  async runDeepfake(analysisId: string): Promise<DeepfakeRunResponse> {
    const response = await api.post<DeepfakeRunResponse>(
      `/analysis/${analysisId}/deepfake`,
      undefined,
      { timeout: 300000 },
    );
    return response.data;
  },

  /** Fetch the stored deepfake result without re-running inference. */
  async getDeepfakeResult(analysisId: string): Promise<DeepfakeResultResponse> {
    const response = await api.get<DeepfakeResultResponse>(
      `/analysis/${analysisId}/deepfake`,
    );
    return response.data;
  },

  /** Probe which analysis capabilities are currently available. */
  async getAnalysisStatus(): Promise<AnalysisStatusResponse> {
    const response = await api.get<AnalysisStatusResponse>("/analysis/status");
    return response.data;
  },

  /**
   * Register (or replace) the speaker profile from a reference recording.
   * The reference audio is deleted server-side after the voiceprint is
   * extracted; the embedding itself is never exposed to the client.
   */
  async registerProfile(
    name: string,
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<SpeakerProfile> {
    const formData = new FormData();
    formData.append("speaker_name", name);
    formData.append("reference_audio", file);
    const response = await api.post<SpeakerProfile>("/profile", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 300000,
      onUploadProgress: (event) => {
        if (event.total && onProgress) {
          onProgress(event.loaded / event.total);
        }
      },
    });
    return response.data;
  },

  /** List stored speaker profiles (metadata only - never the embedding). */
  async getProfiles(): Promise<SpeakerProfileListResponse> {
    const response = await api.get<SpeakerProfileListResponse>("/profile");
    return response.data;
  },

  /** Probe whether a speaker profile is currently registered. */
  async getProfileStatus(): Promise<SpeakerProfileStatusResponse> {
    const response = await api.get<SpeakerProfileStatusResponse>(
      "/profile/status",
    );
    return response.data;
  },

  /** Delete a profile and its stored voiceprint bytes. */
  async deleteProfile(profileId: string): Promise<SpeakerProfileDeleteResponse> {
    const response = await api.delete<SpeakerProfileDeleteResponse>(
      `/profile/${profileId}`,
    );
    return response.data;
  },

  /** Run speaker verification on a preprocessed analysis. */
  async runSpeakerVerification(analysisId: string): Promise<SpeakerVerifyResponse> {
    const response = await api.post<SpeakerVerifyResponse>(
      `/analysis/${analysisId}/speaker`,
      undefined,
      { timeout: 300000 },
    );
    return response.data;
  },

  /** Fetch the stored speaker result without re-running inference. */
  async getSpeakerResult(analysisId: string): Promise<SpeakerResultResponse> {
    const response = await api.get<SpeakerResultResponse>(
      `/analysis/${analysisId}/speaker`,
    );
    return response.data;
  },

  /**
   * Calculate risk from the STORED deepfake + speaker results. Only the
   * analysis id is sent; inputs are read server-side, never from the client.
   */
  async runRisk(analysisId: string): Promise<RiskCalculateResponse> {
    const response = await api.post<RiskCalculateResponse>(
      `/analysis/${analysisId}/risk`,
      undefined,
      { timeout: 60000 },
    );
    return response.data;
  },

  /** Fetch the stored risk result without recomputation. */
  async getRiskResult(analysisId: string): Promise<RiskResultResponse> {
    const response = await api.get<RiskResultResponse>(
      `/analysis/${analysisId}/risk`,
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