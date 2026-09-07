import api from "./api";

/**
 * Voice profile service. Speaker profile registration and verification
 * arrive in later phases.
 */
export const profileService = {
  /** Check whether voice profiles are available yet. */
  async status(): Promise<{ available: boolean; message: string }> {
    const response = await api.get<{ available: boolean; message: string }>(
      "/profile/status"
    );
    return response.data;
  },
};

export default profileService;