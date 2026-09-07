import { useCallback, useEffect, useRef, useState } from "react";
import { formatLabelFromMime } from "../utils/audioValidation";
import type { SelectedAudio } from "../types/audio";

type RecorderStatus = "idle" | "recording" | "stopped" | "error";

/** Hard cap on recording length. Chrome's MediaRecorder is trimmed to this. */
export const MAX_RECORDING_SECONDS = 60;

const MIME_PREFERENCE = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

const UNSUPPORTED_MESSAGE =
  "Microphone recording is not supported in this browser. Please use a modern browser or upload an audio file instead.";
const PERMISSION_DENIED_MESSAGE =
  "Microphone access was denied. Please allow microphone access and try again.";
const RECORDING_FAILED_MESSAGE =
  "Recording failed. Please check your microphone and try again.";

export interface RecorderSupport {
  supported: boolean;
  reason: string | null;
}

/** Standard browser APIs only; returns why recording is unavailable. */
export function getRecorderSupport(): RecorderSupport {
  if (typeof window === "undefined") {
    return { supported: false, reason: UNSUPPORTED_MESSAGE };
  }
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== "function"
  ) {
    return { supported: false, reason: UNSUPPORTED_MESSAGE };
  }
  if (typeof window.MediaRecorder !== "function") {
    return { supported: false, reason: UNSUPPORTED_MESSAGE };
  }
  return { supported: true, reason: null };
}

export interface Recorder {
  status: RecorderStatus;
  /** True only while capturing; the mic input is not streamed anywhere else. */
  isRecording: boolean;
  recording: SelectedAudio | null;
  /** Elapsed recording time in seconds (ticks during recording). */
  elapsedSeconds: number;
  /** Configured recording ceiling (MAX_RECORDING_SECONDS). */
  maxDurationSeconds: number;
  support: RecorderSupport;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  clear: () => void;
}

/**
 * Microphone recorder built on `getUserMedia` + `MediaRecorder`.
 *
 * Mic permission is requested lazily — only when `start()` is called, never
 * on page load. Recording auto-stops at MAX_RECORDING_SECONDS. The blob is
 * kept locally; nothing is sent to any server until an explicit upload.
 */
export function useRecorder(): Recorder {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [recording, setRecording] = useState<SelectedAudio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const [support] = useState<RecorderSupport>(() => getRecorderSupport());

  const finishRecording = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    finishRecording();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // MediaRecorder may throw if stopped after an error; ignore.
      }
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, [finishRecording]);

  // Auto-stop when the maximum recording duration is reached.
  useEffect(() => {
    if (status !== "recording") {
      return;
    }
    if (elapsedSeconds >= MAX_RECORDING_SECONDS) {
      stop();
    }
  }, [elapsedSeconds, status, stop]);

  // Cleanup on unmount so the mic indicator never stays on.
  useEffect(() => {
    return () => {
      finishRecording();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [finishRecording]);

  const start = useCallback(async () => {
    setError(null);
    setStatus("recording");
    setRecording(null);
    setElapsedSeconds(0);
    chunksRef.current = [];

    if (!support.supported) {
      setError(support.reason ?? UNSUPPORTED_MESSAGE);
      setStatus("error");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name =
        err instanceof DOMException ? err.name : err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError(PERMISSION_DENIED_MESSAGE);
      } else if (
        name === "NotFoundError" ||
        name === "DevicesNotFoundError" ||
        name === "OverconstrainedError"
      ) {
        setError(RECORDING_FAILED_MESSAGE);
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setError(RECORDING_FAILED_MESSAGE);
      } else {
        setError(RECORDING_FAILED_MESSAGE);
      }
      setStatus("error");
      return;
    }

    streamRef.current = stream;

    const mimeType = MIME_PREFERENCE.find((type) =>
      window.MediaRecorder.isTypeSupported(type),
    );

    let recorder: MediaRecorder;
    try {
      recorder = mimeType
        ? new window.MediaRecorder(stream, { mimeType })
        : new window.MediaRecorder(stream);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setError(RECORDING_FAILED_MESSAGE);
      setStatus("error");
      return;
    }
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      finishRecording();
      const startedAt = startedAtRef.current;
      startedAtRef.current = null;
      const chunks = chunksRef.current;
      const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.size, 0);

      if (totalBytes === 0) {
        setRecording(null);
        setError("Empty recording. Please record some audio first.");
        setStatus("error");
        return;
      }

      const blob = new Blob(chunks, {
        type: recorder.mimeType || "audio/webm",
      });
      const url = URL.createObjectURL(blob);
      const recordedSeconds =
        startedAt !== null
          ? Math.round((Date.now() - startedAt) / 1000)
          : Math.round(elapsedSeconds);

      setRecording({
        name: "microphone-recording",
        blob,
        url,
        durationSeconds: Math.max(1, recordedSeconds),
        format: formatLabelFromMime(recorder.mimeType || "audio/webm"),
      });
      setStatus("stopped");
      setElapsedSeconds(0);
    };

    recorder.onerror = () => {
      finishRecording();
      setError(RECORDING_FAILED_MESSAGE);
      setStatus("error");
      stop();
    };

    startedAtRef.current = Date.now();
    setElapsedSeconds(0);
    try {
      recorder.start();
    } catch {
      finishRecording();
      setError(RECORDING_FAILED_MESSAGE);
      setStatus("error");
      stop();
    }

    timerRef.current = window.setInterval(() => {
      if (startedAtRef.current !== null) {
        setElapsedSeconds(
          Math.min(
            MAX_RECORDING_SECONDS,
            Math.floor((Date.now() - startedAtRef.current) / 1000),
          ),
        );
      }
    }, 250);
  }, [finishRecording, stop, support.supported, support.reason]);

  const clear = useCallback(() => {
    finishRecording();
    if (recording?.url) {
      URL.revokeObjectURL(recording.url);
    }
    setRecording(null);
    setError(null);
    setStatus("idle");
    setElapsedSeconds(0);
  }, [finishRecording, recording?.url]);

  return {
    status,
    isRecording: status === "recording",
    recording,
    elapsedSeconds,
    maxDurationSeconds: MAX_RECORDING_SECONDS,
    support,
    error,
    start,
    stop,
    clear,
  };
}

export default useRecorder;