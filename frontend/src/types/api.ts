export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface HealthStatus {
  status: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
}

export interface ApiError {
  error: ApiErrorDetail;
}
