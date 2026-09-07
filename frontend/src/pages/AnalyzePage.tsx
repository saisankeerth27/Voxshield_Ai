import { useEffect, useState } from "react";
import {
  AudioLines,
  BrainCircuit,
  CheckCircle2,
  FileUp,
  Loader2,
  Mic,
  ScanLine,
  Square,
  TriangleAlert,
  Wand2,
} from "lucide-react";
import { useRecorder } from "../hooks/useRecorder";
import { useUploadFlow } from "../hooks/useUploadFlow";
import { audioService } from "../services/audioService";
import { formatDuration, formatFileSize } from "../utils/format";
import { getApiErrorMessage } from "../utils/apiError";
import AudioPlayer from "../components/AudioPlayer";
import AudioWaveform from "../components/AudioWaveform";
import SpectrogramViewer from "../components/SpectrogramViewer";
import StatusBadge from "../components/StatusBadge";
import FileDropzone from "../components/FileDropzone";
import type {
  AudioPreprocessResponse,
  DeepfakeRunResponse,
} from "../types/analysis";
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

interface PrepareState {
  phase: "idle" | "preparing" | "done" | "error";
  result: AudioPreprocessResponse | null;
  error: string | null;
}

interface DetectState {
  phase: "idle" | "detecting" | "done" | "error";
  result: DeepfakeRunResponse | null;
  error: string | null;
}

const INITIAL_PREPARE: PrepareState = {
  phase: "idle",
  result: null,
  error: null,
};

const INITIAL_DETECT: DetectState = {
  phase: "idle",
  result: null,
  error: null,
};

function formatSampleRate(rate: number | null): string {
  return rate ? `${(rate / 1000).toFixed(rate % 1000 === 0 ? 0 : 1)} kHz` : "—";
}

function formatChannels(channels: number | null): string {
  return channels === 2 ? "Stereo" : channels === 1 ? "Mono" : "—";
}

function formatProbability(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Not analyzed";
  return `${(value * 100).toFixed(1)}%`;
}

function ProbabilityBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number | null;
  color: string;
}) {
  const pct = value === null ? 0 : Math.round(value * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono text-slate-200">
          {formatProbability(value)}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function detectionVerdict(result: DeepfakeRunResponse): {
  label: string;
  color: string;
} {
  if (result.ai_probability >= 0.8) {
    return { label: "The model indicates AI-generated (synthetic) speech", color: "text-red-400" };
  }
  if (result.ai_probability <= 0.2) {
    return { label: "The model indicates human speech", color: "text-emerald-400" };
  }
  return { label: "The model is not confident either way", color: "text-amber-400" };
}

function AnalysisResultPanel({ result }: { result: DeepfakeRunResponse | null }) {
  if (!result) {
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
            <p className="text-sm text-slate-400">Real Voice Probability</p>
            <p className="mt-1 text-xl font-bold text-slate-300">Not analyzed</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Detection Status</p>
            <p className="mt-1 text-xl font-bold text-slate-300">Not analyzed</p>
          </div>
        </div>
        <div className="mt-4">
          <SpectrogramViewer />
        </div>
      </div>
    );
  }

  const verdict = detectionVerdict(result);
  return (
    <div className="rounded-xl border border-white/5 bg-surface-light p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-5 w-5 text-emerald-400" />
          <h2 className="text-lg font-semibold">Deepfake Detection</h2>
        </div>
        <StatusBadge
          label={result.status}
          variant="ok"
        />
      </div>

      <div className="mt-4 space-y-3">
        <ProbabilityBar
          label="AI Generated Probability"
          value={result.ai_probability}
          color="bg-red-400"
        />
        <ProbabilityBar
          label="Real (Human) Probability"
          value={result.real_probability}
          color="bg-emerald-400"
        />
      </div>

      <p className={`mt-4 text-sm font-medium ${verdict.color}`}>
        {verdict.label}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        This is a model estimate, not proof. Detection can be wrong on short,
        noisy, or heavily processed audio.
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-surface-light/60 p-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-slate-500">Model</dt>
          <dd className="mt-0.5 truncate font-mono text-[11px] text-slate-300">
            {result.model.name ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Device</dt>
          <dd className="mt-0.5 font-medium text-slate-200">{result.device}</dd>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-xs text-slate-500">Processing time</dt>
          <dd className="mt-0.5 font-medium text-slate-200">
            {result.processing_time_seconds.toFixed(1)} s
          </dd>
        </div>
      </dl>
    </div>
  );
}

function AnalysisProgress({
  uploaded,
  preparing,
  prepared,
  detecting,
  detected,
}: {
  uploaded: boolean;
  preparing: boolean;
  prepared: boolean;
  detecting: boolean;
  detected: boolean;
}) {
  const steps = [
    { label: "Upload audio", done: uploaded, active: false },
    { label: "Prepare audio", done: prepared, active: preparing },
    { label: "Deepfake detection", done: detected, active: detecting },
  ];
  return (
    <div className="rounded-xl border border-white/5 bg-surface-light p-4">
      <div className="flex items-center gap-2">
        <ScanLine className="h-4 w-4 text-emerald-400" />
        <h3 className="text-sm font-semibold text-slate-200">
          Analysis progress
        </h3>
      </div>
      <ol className="mt-3 space-y-2">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center gap-2 text-sm">
            {step.done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : step.active ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-400" />
            ) : (
              <span className="h-4 w-4 shrink-0 rounded-full border border-slate-600" />
            )}
            <span className={step.done ? "text-slate-200" : "text-slate-400"}>
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function AnalyzePage() {
  const [tab, setTab] = useState<"upload" | "record">("upload");
  const recorder = useRecorder();
  const upload = useUploadFlow();
  const [prepare, setPrepare] = useState<PrepareState>(INITIAL_PREPARE);
  const [detect, setDetect] = useState<DetectState>(INITIAL_DETECT);

  const uploadError = upload.state === "ERROR" ? upload.error : null;

  useEffect(() => {
    setPrepare(INITIAL_PREPARE);
    setDetect(INITIAL_DETECT);
  }, [upload.uploadResult?.analysis_id]);

  const runPreprocess = async () => {
    if (!upload.uploadResult) return;
    const analysisId = upload.uploadResult.analysis_id;
    setPrepare({ phase: "preparing", result: null, error: null });
    try {
      const result = await audioService.preprocess(analysisId);
      setPrepare({ phase: "done", result, error: null });
    } catch (err) {
      const message = getApiErrorMessage(err, "Preprocessing failed");
      setPrepare({ phase: "error", result: null, error: message });
    }
  };

  const runDeepfake = async () => {
    if (!upload.uploadResult) return;
    const analysisId = upload.uploadResult.analysis_id;
    setDetect({ phase: "detecting", result: null, error: null });
    try {
      const result = await audioService.runDeepfake(analysisId);
      setDetect({ phase: "done", result, error: null });
    } catch (err) {
      const message = getApiErrorMessage(err, "Deepfake detection failed");
      setDetect({ phase: "error", result: null, error: message });
    }
  };

  const processedUrl = prepare.result
    ? audioService.processedUrl(prepare.result.analysis_id)
    : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">Voice Analysis</h1>
      <p className="mt-1 text-sm text-slate-400">
        Upload audio, prepare it, and run AI deepfake detection. Additional
        ML capabilities arrive in later phases.
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

      {upload.state === "UPLOADED" ? (
        <div className="mt-6 max-w-md">
          <AnalysisProgress
            uploaded
            preparing={prepare.phase === "preparing"}
            prepared={prepare.phase === "done"}
            detecting={detect.phase === "detecting"}
            detected={detect.phase === "done"}
          />
        </div>
      ) : null}

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

            {/* Prepare audio step */}
            {upload.state === "UPLOADED" && upload.uploadResult ? (
              <div className="mt-4 rounded-xl border border-white/5 bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-5 w-5 text-emerald-400" />
                    <h3 className="font-semibold text-slate-200">
                      Prepare Audio
                    </h3>
                  </div>
                  {prepare.phase === "done" && prepare.result ? (
                    <StatusBadge label={prepare.result.status} variant="ok" />
                  ) : null}
                </div>

                {prepare.phase === "idle" ? (
                  <>
                    <p className="mt-2 text-xs text-slate-500">
                      Convert the upload to a mono, 16 kHz WAV with normalized
                      levels — ready for deepfake analysis.
                    </p>
                    <button
                      onClick={() => void runPreprocess()}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-surface hover:bg-emerald-400 transition-colors"
                    >
                      <Wand2 className="h-4 w-4" />
                      Prepare Audio for Analysis
                    </button>
                  </>
                ) : null}

                {prepare.phase === "preparing" ? (
                  <div className="mt-3 flex items-center gap-2 text-slate-300">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                    <span className="text-sm">Preparing audio…</span>
                  </div>
                ) : null}

                {prepare.phase === "done" && prepare.result ? (
                  <div className="mt-3">
                    <dl className="grid grid-cols-3 gap-3 rounded-lg bg-surface-light/60 p-3 text-sm">
                      <div>
                        <dt className="text-xs text-slate-500">Sample rate</dt>
                        <dd className="mt-0.5 font-medium text-slate-200">
                          {formatSampleRate(prepare.result.audio.sample_rate)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Channels</dt>
                        <dd className="mt-0.5 font-medium text-slate-200">
                          {formatChannels(prepare.result.audio.channels)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-500">Duration</dt>
                        <dd className="mt-0.5 font-medium text-slate-200">
                          {prepare.result.audio.duration_seconds
                            ? formatDuration(
                                prepare.result.audio.duration_seconds,
                              )
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      {prepare.result.message}
                    </p>
                  </div>
                ) : null}

                {prepare.phase === "error" ? (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium">Preprocessing failed</p>
                      <p className="mt-0.5 break-words text-xs">
                        {prepare.error}
                      </p>
                      <button
                        onClick={() => void runPreprocess()}
                        className="mt-2 rounded-md border border-red-500/40 px-3 py-1 text-xs font-medium hover:bg-red-500/20 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                ) : null}

                {prepare.phase === "done" && processedUrl ? (
                  <div className="mt-3">
                    <p className="text-xs text-slate-500">Processed audio</p>
                    <AudioPlayer audioUrl={processedUrl} />
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Detect AI voice step */}
            {upload.state === "UPLOADED" &&
            upload.uploadResult &&
            prepare.phase === "done" ? (
              <div className="mt-4 rounded-xl border border-white/5 bg-surface p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5 text-emerald-400" />
                    <h3 className="font-semibold text-slate-200">
                      Deepfake Detection
                    </h3>
                  </div>
                  {detect.phase === "done" && detect.result ? (
                    <StatusBadge
                      label={detect.result.status}
                      variant="ok"
                    />
                  ) : null}
                </div>

                {detect.phase === "idle" ? (
                  <>
                    <p className="mt-2 text-xs text-slate-500">
                      Run the Wav2Vec2 deepfake model to estimate whether this
                      audio is AI-generated (synthetic) or human speech.
                    </p>
                    <button
                      onClick={() => void runDeepfake()}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-400 transition-colors"
                    >
                      <BrainCircuit className="h-4 w-4" />
                      Detect AI Voice
                    </button>
                  </>
                ) : null}

                {detect.phase === "detecting" ? (
                  <div className="mt-3 flex items-center gap-2 text-slate-300">
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                    <span className="text-sm">Analyzing voice…</span>
                  </div>
                ) : null}

                {detect.phase === "done" && detect.result ? (
                  <div className="mt-3 space-y-3">
                    <ProbabilityBar
                      label="AI Generated Probability"
                      value={detect.result.ai_probability}
                      color="bg-red-400"
                    />
                    <ProbabilityBar
                      label="Real (Human) Probability"
                      value={detect.result.real_probability}
                      color="bg-emerald-400"
                    />
                    <p
                      className={`text-sm font-medium ${detectionVerdict(detect.result).color}`}
                    >
                      {detectionVerdict(detect.result).label}
                    </p>
                    <p className="text-xs text-slate-500">
                      Model estimate using{" "}
                      <span className="font-mono">
                        {detect.result.model.name ?? "unknown model"}
                      </span>{" "}
                      · {detect.result.device} ·{" "}
                      {detect.result.processing_time_seconds.toFixed(1)} s
                    </p>
                  </div>
                ) : null}

                {detect.phase === "error" ? (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium">Deepfake detection could not run</p>
                      <p className="mt-0.5 break-words text-xs">{detect.error}</p>
                      <button
                        onClick={() => void runDeepfake()}
                        className="mt-2 rounded-md border border-red-500/40 px-3 py-1 text-xs font-medium hover:bg-red-500/20 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                ) : null}
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
        <AnalysisResultPanel result={detect.result} />
      </div>
    </div>
  );
}