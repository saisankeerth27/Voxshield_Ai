import { useEffect, useState } from "react";
import healthApi from "../services/healthApi";

interface UseHealthResult {
  backendOnline: boolean;
  loading: boolean;
}

/**
 * Polls the backend health endpoint to expose connectivity status.
 */
export function useBackendHealth(intervalMs = 15000): UseHealthResult {
  const [backendOnline, setBackendOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const check = async () => {
      try {
        const status = await healthApi.getStatus();
        if (active) {
          setBackendOnline(status.status === "healthy");
        }
      } catch {
        if (active) {
          setBackendOnline(false);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void check();
    const id = setInterval(check, intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return { backendOnline, loading };
}
