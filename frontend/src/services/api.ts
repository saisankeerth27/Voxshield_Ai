import axios, { type AxiosInstance } from "axios";

const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

/**
 * Centralized Axios instance for all API communication.
 *
 * All requests share a single base URL resolved from the environment
 * (VITE_API_BASE_URL), avoiding scattered hardcoded URLs across the app.
 */
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
