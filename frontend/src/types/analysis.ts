export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type AnalysisStatus = "UPLOADED" | "PROCESSING" | "COMPLETED" | "FAILED";

export const MAX_UPLOAD_SIZE_MB = 25;
export const ALLOWED_EXTENSIONS = ["wav", "mp3", "m4a", "ogg"] as const;

export interface AudioUploadResponse {
  success: boolean;
  analysis_id: string;
  filename: string;
  status: AnalysisStatus;
  message: string;
}

export interface AudioAnalysis {
  analysis_id: string;
  filename: string;
  file_size: number;
  mime_type: string | null;
  duration_seconds: number | null;
  status: AnalysisStatus;
  created_at: string;
  updated_at: string;
}

export interface AudioListItem {
  analysis_id: string;
  filename: string;
  file_size: number;
  status: AnalysisStatus;
  created_at: string;
}

export interface AudioListResponse {
  items: AudioListItem[];
  page: number;
  limit: number;
  total: number;
}
