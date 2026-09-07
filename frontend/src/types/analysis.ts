export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type AnalysisStatus =
  | "UPLOADED"
  | "PREPROCESSING"
  | "READY_FOR_ANALYSIS"
  | "PROCESSING"
  | "COMPLETED"
  | "DEEPFAKE_ANALYZED"
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
  ai_probability: number | null;
  real_probability: number | null;
  deepfake_label: string | null;
  deepfake_model: string | null;
  deepfake_model_version: string | null;
  deepfake_processing_time: number | null;
  deepfake_device: string | null;
  deepfake_error: string | null;
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

export interface DeepfakeRunResponse {
  analysis_id: string;
  status: AnalysisStatus;
  ai_probability: number;
  real_probability: number;
  predicted_class: string;
  model: { name: string | null; version: string | null };
  device: string;
  processing_time_seconds: number;
  message: string;
}

export interface DeepfakeResultResponse {
  analysis_id: string;
  status: AnalysisStatus;
  ai_probability: number | null;
  real_probability: number | null;
  predicted_class: string | null;
  model: { name: string | null; version: string | null };
  device: string | null;
  processing_time_seconds: number | null;
  deepfake_error: string | null;
}

export interface AnalysisStatusResponse {
  available: boolean;
  deepfake: boolean;
  message: string;
}
