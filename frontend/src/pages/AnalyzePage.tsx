import { useState } from "react";
import {
  AudioLines,
  CheckCircle2,
  FileUp,
  Loader2,
  Mic,
  ScanLine,
  Square,
  TriangleAlert,
} from "lucide-react";
import { useRecorder } from "../hooks/useRecorder";
import { useUploadFlow } from "../hooks/useUploadFlow";
import { formatDuration, formatFileSize } from "../utils/format";
import AudioPlayer from "../components/AudioPlayer";
import AudioWaveform from "../components/AudioWaveform";
import SpectrogramViewer from "../components/SpectrogramViewer";
import StatusBadge from "../components/StatusBadge";
import FileDropzone from "../components/FileDropzone";
import type { UploadFlowState } from "../types/audio";

const statusVariantFor = (
  state: UploadFlowState,
): "ok" | "warn" | "danger" | "idle" => {
  switch (state) {
    case "UPLOADED":
      return "ok";
    case "ERROR":
      return "danger";
    case "UPLOADING":
    case "SELECTED":
      return "warn";
    default:
      return "idle";
  }
};

const statusLabelFor = (state: UploadFlowState): string => {
  switch (state) {
    case "UPLOADED":
      return "Uploaded";
    case "UPLOADING":
      return "Uploading";
    case "SELECTED":
      return "Selected";
    case "ERROR":
      return "Upload failed";
    default:
      return "No file";
  }
};

function AnalysisResultPlaceholder() {
  return (
    <div className="rounded-xl border border-white/5 bg-surface-light p-6">
      <div className="flex items-center gap-2">
        <AudioLines className="h-5 w-5 text-emerald-400" />
        <h2 className="text-lg font-semibold">Analysis Result</h2>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-sm text-slate-400">AI Generated Probability</p>
          <p className="mt-1 text-xl font-bold text-slate-300">Not analyzed</p>
        </div>
        <div>
          <p className="text-sm text-slate-400">Speaker Similarity</p>
          <p className="mt-1 text-xl font-bold text-slate-300">Not analyzed</p>
        </div>
        <div>
          <p className="text-sm text-slate-400">Risk Level</p>
          <p className="mt-1 text-xl font-bold text-slate-300">Not analyzed</p>
        </div>
      </div>
      <div className="mt-4">
        <SpectrogramViewer />
      </div>
    </div>
  );
}

export default function AnalyzePage() {
  const [tab, setTab] = useState<"upload" | "record">("upload");
  const recorder = useRecorder();
  const upload = useUploadFlow();

  const uploadError = upload.state === "ERROR" ? upload.error : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">Voice Analysis</h1>
      <p className="mt-1 text-sm text-slate-400">
        Upload audio to record it for analysis. Deepfake detection arrives in
        later phases.
      </p>

      {/* Source tabs */}
      <div className="mt-6 flex w-full max-w-md items-center rounded-lg border border-slate-700 bg-surface-light p-1">
        <button
          onClick={() => setTab("upload")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "upload"
              ? "bg-emerald-500 text-surface"
              : "text-slate-300 hover:text-slate-100"
          }`}
        >
          <FileUp className="h-4 w-4" />
          Upload File
        </button>
        <button
          onClick={() => setTab("record")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "record"
              ? "bg-emerald-500 text-surface"
              : "text-slate-300 hover:text-slate-100"
          }`}
        >
          <Mic className="h-4 w-4" />
          Record Audio
        </button>
      </div>

      {tab === "upload" ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Upload panel */}
          <div className="rounded-xl border border-white/5 bg-surface-light p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileUp className="h-5 w-5 text-emerald-400" />
                <h2 className="font-semibold">Upload Audio</h2>
              </div>
              <StatusBadge
                label={statusLabelFor(upload.state)}
                variant={statusVariantFor(upload.state)}
              />
            </div>

            <FileDropzone
              onFileSelected={upload.selectFile}
              error={uploadError}
              disabled={upload.state === "UPLOADING"}
            />

            {upload.selectedAudio ? (
              <div className="mt-4 rounded-xl bg-surface p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-slate-200">
                    {upload.selectedAudio.name}
                  </p>
                  <span className="shrink-0 text-xs text-slate-400">
                    {formatFileSize(upload.file?.size ?? 0)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {upload.selectedAudio.format.toUpperCase()} ·{" "}
                  {upload.selectedAudio.durationSeconds
                    ? formatDuration(upload.selectedAudio.durationSeconds)
                    : "Duration unknown"}
                </p>
                <AudioPlayer audioUrl={upload.selectedAudio.url} />
                <AudioWaveform audioUrl={upload.selectedAudio.url} />
              </div>
            ) : null}

            {/* Progress / success */}
            {upload.state === "UPLOADING" ? (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-300">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                    Uploading…
                  </span>
                  <span className="text-slate-400">
                    {Math.round(upload.progress * 100)}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.round(upload.progress * 100)}%` }}
                  />
                </div>
              </div>
            ) : null}

            {upload.state === "UPLOADED" && upload.uploadResult ? (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span className="font-semibold text-emerald-400">
                    {upload.uploadResult.message}
                  </span>
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-400">Analysis ID</dt>
                    <dd className="truncate font-mono text-emerald-300">
                      {upload.uploadResult.analysis_id}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-400">Filename</dt>
                    <dd className="truncate text-slate-200">
                      {upload.uploadResult.filename}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-400">Status</dt>
                    <dd className="text-slate-200">
                      <StatusBadge
                        label={upload.uploadResult.status}
                        variant="ok"
                      />
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={upload.clear}
                disabled={upload.state === "IDLE" || upload.state === "UPLOADING"}
                className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-300 hover:border-red-500/50 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-600 disabled:hover:text-slate-300 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => void upload.startUpload()}
                disabled={
                  upload.state !== "SELECTED" && upload.state !== "ERROR"
                }
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-6 py-2.5 font-semibold transition-colors ${
                  upload.state === "SELECTED" || upload.state === "ERROR"
                    ? "bg-emerald-500 text-surface hover:bg-emerald-400 cursor-pointer"
                    : "bg-slate-700/50 text-slate-500 cursor-not-allowed"
                }`}
              >
                <ScanLine className="h-5 w-5" />
                Upload for Analysis
              </button>
            </div>
          </div>

          {/* Record panel (placeholder in this phase) */}
          <div className="rounded-xl border border-white/5 bg-surface-light p-6">
            <div className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-emerald-400" />
              <h2 className="font-semibold">Record Audio</h2>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Use the Record tab above to capture audio from your microphone.
            </p>
            <div className="mt-6 flex flex-col items-center gap-4 py-8 text-slate-500">
              <AudioLines className="h-10 w-10" />
              <p className="max-w-xs text-center text-sm">
                Switch to the record tab to capture audio. Recording upload
                arrives in a later phase.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-8 rounded-xl border border-white/5 bg-surface-light p-6">
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-emerald-400" />
            <h2 className="font-semibold">Record Audio</h2>
          </div>

          {recorder.status === "recording" ? (
            <div className="mt-4 flex items-center gap-2 text-red-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <span className="font-medium">Recording…</span>
            </div>
          ) : null}

          {recorder.status !== "recording" ? (
            <button
              onClick={() => void recorder.start()}
              className="mt-4 w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-surface hover:bg-emerald-400 transition-colors"
            >
              Start Recording
            </button>
          ) : (
            <button
              onClick={recorder.stop}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-3 text-sm font-semibold text-white hover:bg-red-400 transition-colors"
            >
              <Square className="h-4 w-4" />
              Stop Recording
            </button>
          )}

          {recorder.error ? (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{recorder.error}</span>
            </div>
          ) : null}

          {recorder.recording && recorder.status !== "recording" ? (
            <div className="mt-4">
              <p className="text-sm text-slate-300">
                Recording ready, {recorder.recording.format} ·{" "}
                {formatDuration(recorder.recording.durationSeconds)}
              </p>
              <AudioPlayer audioUrl={recorder.recording.url} />
              <AudioWaveform audioUrl={recorder.recording.url} />
              <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-400">
                Recording upload is not available yet. Export the recording or
                use the upload tab with a recorded file.
              </p>
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-6">
        <AnalysisResultPlaceholder />
      </div>
    </div>
  );
}