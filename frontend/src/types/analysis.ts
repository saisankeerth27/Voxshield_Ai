export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type AnalysisStatus =
  | "UPLOADED"
  | "PREPROCESSING"
  | "READY_FOR_ANALYSIS"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export const MAX_UPLOAD_SIZE_MB = 25;
export const ALLOWED_EXTENSIONS = ["wav", "mp3", "m4a", "ogg"] as const;

export interface AudioUploadResponse {
  success: boolean;
  analysis_id: string;
  filename: string;
  status: AnalysisStatus;
  message: string;
}

export interface AudioMetadataBrief {
  sample_rate: number | null;
  channels: number | null;
  duration_seconds: number | null;
}

export interface AudioPreprocessResponse {
  success: boolean;
  analysis_id: string;
  status: AnalysisStatus;
  audio: AudioMetadataBrief;
  message: string;
}

export interface PreprocessStatusResponse {
  analysis_id: string;
  status: AnalysisStatus;
  original: AudioMetadataBrief;
  processed: AudioMetadataBrief;
  preprocessing_error: string | null;
}

export interface AudioAnalysis {
  analysis_id: string;
  filename: string;
  file_size: number;
  mime_type: string | null;
  duration_seconds: number | null;
  status: AnalysisStatus;
  original_sample_rate: number | null;
  original_channels: number | null;
  processed_sample_rate: number | null;
  processed_channels: number | null;
  processed_duration_seconds: number | null;
  processed_filename: string | null;
  preprocessing_error: string | null;
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
