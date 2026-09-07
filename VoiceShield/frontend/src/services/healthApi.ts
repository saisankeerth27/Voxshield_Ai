import { api } from "./api";
import type { HealthStatus } from "../types/api";

/**
 * Health service — checks backend connectivity.
 * Used by the frontend to display backend connection status.
 */
export const healthApi = {
  async getStatus(): Promise<HealthStatus> {
    const response = await api.get<HealthStatus>("/health");
    return response.data;
  },
};

export default healthApi;
