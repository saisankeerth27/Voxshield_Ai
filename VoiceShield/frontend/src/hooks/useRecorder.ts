import { useCallback, useRef, useState } from "react";
import { formatLabelFromMime } from "../utils/audioValidation";
import type { SelectedAudio } from "../types/audio";

type RecorderStatus = "idle" | "recording" | "stopped" | "error";

const MIME_PREFERENCE = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

/**
 * MediaRecorder hook — captures microphone audio in the browser.
 * No audio is sent anywhere; the recorded blob is kept locally.
 */
export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [recording, setRecording] = useState<SelectedAudio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStatus("recording");
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MIME_PREFERENCE.find((type) =>
        MediaRecorder.isTypeSupported(type)
      );

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const url = URL.createObjectURL(blob);
        setRecording({
          name: "microphone-recording",
          blob,
          url,
          durationSeconds: 0,
          format: formatLabelFromMime(recorder.mimeType || "audio/webm"),
        });
        setStatus("stopped");
      };

      recorder.onerror = () => {
        setError("Recording failed. Please check your microphone permissions.");
        setStatus("error");
        stop();
      };

      recorder.start();
    } catch {
      setError(
        "Unable to access the microphone. Check browser permissions and try again."
      );
      setStatus("error");
    }
  }, [stop]);

  const clear = useCallback(() => {
    setRecording(null);
    setError(null);
    setStatus("idle");
  }, []);

  return {
    status,
    recording,
    error,
    start,
    stop,
    clear,
  };
}