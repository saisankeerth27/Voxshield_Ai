import api from "./api";

/**
 * Analysis service. Real analysis (deepfake detection, speaker verification,
 * risk fusion) arrives in later phases.
 */
export const analysisService = {
  /** Check whether the analysis pipeline is available yet. */
  async status(): Promise<{ available: boolean; message: string }> {
    const response = await api.get<{ available: boolean; message: string }>(
      "/analysis/status"
    );
    return response.data;
  },
};

export default analysisService;