export type SupportedAudioFormat = "wav" | "mp3" | "m4a" | "ogg" | "webm";

export type UploadFlowState =
  | "IDLE"
  | "SELECTED"
  | "UPLOADING"
  | "UPLOADED"
  | "ERROR";

export interface SelectedAudio {
  name: string;
  blob: Blob;
  url: string;
  durationSeconds: number;
  format: string;
}

export interface AudioValidationResult {
  valid: boolean;
  error?: string;
}
