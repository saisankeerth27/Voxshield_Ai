import { useCallback, useRef, useState } from "react";
import type { AudioUploadResponse } from "../types/analysis";
import type { SelectedAudio, UploadFlowState } from "../types/audio";
import { validateAudioFile } from "../utils/audioValidation";
import { loadAudioDuration } from "../utils/audio";
import { getApiErrorMessage } from "../utils/apiError";
import { audioService } from "../services/audioService";

export interface UseUploadFlowOptions {
  onUploaded?: (response: AudioUploadResponse) => void;
}

export interface UploadFlow {
  state: UploadFlowState;
  file: File | null;
  selectedAudio: SelectedAudio | null;
  error: string | null;
  progress: number;
  uploadResult: AudioUploadResponse | null;
  selectFile: (file: File) => void;
  startUpload: () => Promise<void>;
  clear: () => void;
}

/**
 * Manages the upload state machine on the Analyze page:
 * IDLE → SELECTED → UPLOADING → UPLOADED | ERROR.
 *
 * Validates the file up front and measures duration client-side for a
 * responsive preview. Upload progress is surfaced for the UI progress bar.
 */
export function useUploadFlow(options: UseUploadFlowOptions = {}): UploadFlow {
  const [state, setState] = useState<UploadFlowState>("IDLE");
  const [file, setFile] = useState<File | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<SelectedAudio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<AudioUploadResponse | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const clear = useCallback(() => {
    setState("IDLE");
    setFile(null);
    setSelectedAudio(null);
    setError(null);
    setProgress(0);
    setUploadResult(null);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const selectFile = useCallback((selected: File) => {
    const result = validateAudioFile(selected);
    if (!result.valid || result.error) {
      clear();
      setError(result.error ?? "Invalid audio file.");
      setState("ERROR");
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const url = URL.createObjectURL(selected);
    objectUrlRef.current = url;

    setError(null);
    setFile(selected);
    setState("SELECTED");
    setUploadResult(null);

    void loadAudioDuration(selected).then((duration) => {
      setSelectedAudio({
        name: selected.name,
        blob: selected,
        url,
        durationSeconds: duration ?? 0,
        format: selected.type || selected.name.split(".").pop() || "audio",
      });
    });
  }, [clear]);

  const startUpload = useCallback(async () => {
    if (!file) {
      return;
    }
    setState("UPLOADING");
    setProgress(0);
    setError(null);
    try {
      const response = await audioService.upload(
        file,
        (value) => setProgress(value),
      );
      setUploadResult(response);
      setState("UPLOADED");
      options.onUploaded?.(response);
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to upload the audio. Please try again."));
      setState("ERROR");
    }
  }, [file, options]);

  return {
    state,
    file,
    selectedAudio,
    error,
    progress,
    uploadResult,
    selectFile,
    startUpload,
    clear,
  };
}

export default useUploadFlow;