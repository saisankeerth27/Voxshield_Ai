import { useEffect, useState } from "react";
import {
  AudioLines,
  BrainCircuit,
  CheckCircle2,
  FileUp,
  Gauge,
  Loader2,
  Mic,
  ScanLine,
  ShieldCheck,
  Square,
  TriangleAlert,
  Users,
  Wand2,
} from "lucide-react";
import { useRecorder } from "../hooks/useRecorder";
import { useVoiceAnalysis } from "../hooks/useVoiceAnalysis";
import { audioService } from "../services/audioService";
import { formatDuration, formatFileSize, formatTimer } from "../utils/format";
import { getApiErrorMessage } from "../utils/apiError";
import AudioPlayer from "../components/AudioPlayer";
import AudioWaveform from "../components/AudioWaveform";
import SpectrogramViewer from "../components/SpectrogramViewer";
import StatusBadge from "../components/StatusBadge";
import FileDropzone from "../components/FileDropzone";
import RiskAlert from "../components/RiskAlert";
import RiskResultCard from "../components/RiskResultCard";
import type { DeepfakeRunResponse } from "../types/analysis";
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

type ProgressState =
  | "done"
  | "running"
  | "ready"
  | "waiting"
  | "skipped"
  | "error";

function AnalysisProgress({
  title,
  steps,
}: {
  title?: string;
  steps: { number: number; label: string; state: ProgressState }[];
}) {
  const statusLabel = (state: ProgressState): string => {
    switch (state) {
      case "done":
        return "Complete";
      case "running":
        return "In progress";
      case "ready":
        return "Ready";
      case "skipped":
        return "Unavailable";
      case "error":
        return "Failed";
      default:
        return "Waiting";
    }
  };

  const circleClass = (step: { number: number; state: ProgressState }): string => {
    switch (step.state) {
      case "done":
        return "bg-emerald-500 text-surface";
      case "running":
        return "border border-emerald-500 text-emerald-400";
      case "error":
        return "border border-red-500 text-red-400";
      case "skipped":
        return "border border-slate-600 text-slate-500";
      default:
        return "border border-slate-600 text-slate-500";
    }
  };

  const labelClass = (state: ProgressState): string => {
    switch (state) {
      case "done":
      case "running":
        return "text-slate-200";
      case "error":
        return "text-red-400";
      default:
        return "text-slate-400";
    }
  };

  const statusClass = (state: ProgressState): string => {
    switch (state) {
      case "done":
        return "text-emerald-400";
      case "running":
        return "text-emerald-400";
      case "error":
        return "text-red-400";
      case "skipped":
        return "text-slate-500";
      default:
        return "text-slate-500";
    }
  };

  return (
    <ol className="space-y-2 rounded-xl border border-white/5 bg-surface-light p-4">
      {title ? (
        <li className="pb-1 text-sm font-semibold text-emerald-400">
          <CheckCircle2 className="mr-1.5 inline h-4 w-4" />
          {title}
        </li>
      ) : null}
      {steps.map((step) => (
        <li key={step.number} className="flex items-center gap-3 text-sm">
          <span
            aria-hidden="true"
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${circleClass(step)}`}
          >
            {step.state === "done"
              ? "✓"
              : step.state === "skipped"
                ? "–"
                : step.state === "error"
                  ? "!"
                  : step.number}
          </span>
          <span className={labelClass(step.state)}>
            Step {step.number} · {step.label}
          </span>
          <span
            className={`ml-auto text-xs font-medium ${statusClass(step.state)}`}
          >
            {step.state === "running" ? (
              <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
            ) : null}
            {statusLabel(step.state)}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Near-real-time progress checklist driven by real backend responses. */
function buildProgressSteps(stages: {
  uploaded: boolean;
  prepare: string;
  detect: string;
  verify: string;
  risk: string;
}): { number: number; label: string; state: ProgressState }[] {
  const p = stages.prepare;
  const d = stages.detect;
  const v = stages.verify;
  const r = stages.risk;
  return [
    { number: 1, label: "Upload Audio", state: stages.uploaded ? "done" : "waiting" },
    {
      number: 2,
      label: "Prepare Audio",
      state: p === "done" ? "done" : p === "running" ? "running" : p === "error" ? "error" : stages.uploaded ? "ready" : "waiting",
    },
    {
      number: 3,
      label: "Detect AI Voice",
      state: d === "done" ? "done" : d === "running" ? "running" : d === "error" ? "error" : p === "done" ? "ready" : "waiting",
    },
    {
      number: 4,
      label: "Verify Speaker",
      state: v === "done" ? "done" : v === "running" ? "running" : v === "error" ? "error" : v === "skipped" ? "skipped" : d === "done" ? "ready" : "waiting",
    },
    {
      number: 5,
      label: "Calculate Risk",
      state: r === "done" ? "done" : r === "running" ? "running" : r === "error" ? "error" : d === "done" && v === "done" ? "ready" : "waiting",
    },
  ];
}

export default function AnalyzePage() {
  const [tab, setTab] = useState<"upload" | "record">("upload");
  const recorder = useRecorder();
  const analysis = useVoiceAnalysis();
  const upload = analysis.upload;
  const [micRunning, setMicRunning] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const uploadError = upload.state === "ERROR" ? upload.error : null;

  // "View Analysis" support: ?id=<analysis_id> loads a stored result.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) {
      return;
    }
    let cancelled = false;
    analysis
      .loadFromRecord(id)
      .catch(() => {
        if (!cancelled) {
          setLoadError("Unable to load the stored analysis. Please try again.");
        }
      });
    return () => {
      cancelled = true;
    };
    // Runs once on mount; hook callbacks are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh profile status once a file is uploaded and prepared, so the
  // speaker-verification gate stays accurate.
  useEffect(() => {
    if (upload.uploadResult && analysis.prepare.phase === "done") {
      void analysis.refreshProfileStatus();
    }
  }, [upload.uploadResult, analysis.prepare.phase, analysis.refreshProfileStatus]);

  const startMicrophoneAnalysis = async () => {
    const rec = recorder.recording;
    if (!rec) {
      return;
    }
    setMicRunning(true);
    setMicError(null);
    try {
      const ext = rec.format !== "audio" ? rec.format : "webm";
      const file = new File([rec.blob], `microphone-recording.${ext}`, {
        type: rec.blob.type || "audio/webm",
      });
      upload.selectFile(file);
      const response = await upload.startUpload("MICROPHONE");
      if (!response) {
        setMicError(
          upload.error ??
            "Analysis failed. Please try again.",
        );
        return;
      }
      await analysis.runMicrophonePipeline(response.analysis_id);
    } catch (err) {
      setMicError(
        getApiErrorMessage(err, "Analysis failed. Please try again."),
      );
    } finally {
      setMicRunning(false);
    }
  };

  const totalAnalysisTime = Number(
    (
      (analysis.detect.result?.processing_time_seconds ??
        analysis.loadedRecord?.deepfake_processing_time ??
        0) +
      (analysis.verify.result?.speaker_processing_time ??
        analysis.loadedRecord?.speaker_processing_time ??
        0) +
      (analysis.risk.result?.risk_processing_time ??
        analysis.loadedRecord?.risk_processing_time ??
        0)
    ).toFixed(2),
  );

  const riskCanRun =
    analysis.detect.phase === "done" && analysis.verify.phase === "done";
  const detectCanRun = analysis.prepare.phase === "done";
  const verifyCanRun =
    analysis.prepare.phase === "done" &&
    Boolean(analysis.verify.profile?.has_profile);

  const processedUrl = analysis.prepare.result
    ? audioService.processedUrl(analysis.prepare.result.analysis_id)
    : null;

  const resultSource =
    upload.uploadResult?.source ?? analysis.loadedRecord?.source ?? null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">Voice Analysis</h1>
      <p className="mt-1 text-sm text-slate-400">
        Upload audio or record from your microphone, then run AI deepfake
        detection and verify the speaker against a registered voiceprint.
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
          Upload Audio
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
          Record from Microphone
        </button>
      </div>

      {loadError ? (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      ) : null}

      {tab === "upload" && (upload.state === "UPLOADED" || analysis.risk.phase === "done") ? (
        <div className="mt-6 max-w-md">
          <AnalysisProgress
            steps={buildProgressSteps({
              uploaded: upload.state === "UPLOADED",
              prepare: analysis.prepare.phase,
              detect: analysis.detect.phase,
              verify: analysis.verify.phase,
              risk: analysis.risk.phase,
            })}
          />
        </div>
      ) : null}

      {tab === "upload" ? (() => {
        return (
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
                    {analysis.prepare.phase === "done" && analysis.prepare.result ? (
                      <StatusBadge label={analysis.prepare.result.status} variant="ok" />
                    ) : null}
                  </div>

                  {analysis.prepare.phase === "idle" ? (
                    <>
                      <p className="mt-2 text-xs text-slate-500">
                        Convert the upload to a mono, 16 kHz WAV with normalized
                        levels — ready for deepfake analysis.
                      </p>
                      <button
                        onClick={() => void analysis.runPreprocess()}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-surface hover:bg-emerald-400 transition-colors"
                      >
                        <Wand2 className="h-4 w-4" />
                        Prepare Audio for Analysis
                      </button>
                    </>
                  ) : null}

                  {analysis.prepare.phase === "running" ? (
                    <div className="mt-3 flex items-center gap-2 text-slate-300">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                      <span className="text-sm">Preparing audio…</span>
                    </div>
                  ) : null}

                  {analysis.prepare.phase === "done" && analysis.prepare.result ? (
                    <div className="mt-3">
                      <dl className="grid grid-cols-3 gap-3 rounded-lg bg-surface-light/60 p-3 text-sm">
                        <div>
                          <dt className="text-xs text-slate-500">Sample rate</dt>
                          <dd className="mt-0.5 font-medium text-slate-200">
                            {formatSampleRate(analysis.prepare.result.audio.sample_rate)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-500">Channels</dt>
                          <dd className="mt-0.5 font-medium text-slate-200">
                            {formatChannels(analysis.prepare.result.audio.channels)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-500">Duration</dt>
                          <dd className="mt-0.5 font-medium text-slate-200">
                            {analysis.prepare.result.audio.duration_seconds
                              ? formatDuration(
                                  analysis.prepare.result.audio.duration_seconds,
                                )
                              : "—"}
                          </dd>
                        </div>
                      </dl>
                      <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        {analysis.prepare.result.message}
                      </p>
                    </div>
                  ) : null}

                  {analysis.prepare.phase === "error" ? (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium">Audio preprocessing failed.</p>
                        <p className="mt-0.5 break-words text-xs">
                          {analysis.prepare.error}
                        </p>
                        <button
                          onClick={() => void analysis.runPreprocess()}
                          className="mt-2 rounded-md border border-red-500/40 px-3 py-1 text-xs font-medium hover:bg-red-500/20 transition-colors"
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {analysis.prepare.phase === "done" && processedUrl ? (
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
              analysis.prepare.phase === "done" ? (
                <div className="mt-4 rounded-xl border border-white/5 bg-surface p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <BrainCircuit className="h-5 w-5 text-emerald-400" />
                      <h3 className="font-semibold text-slate-200">
                        Deepfake Detection
                      </h3>
                    </div>
                    {analysis.detect.phase === "done" && analysis.detect.result ? (
                      <StatusBadge label={analysis.detect.result.status} variant="ok" />
                    ) : null}
                  </div>

                  {analysis.detect.phase === "idle" ? (
                    <>
                      <p className="mt-2 text-xs text-slate-500">
                        Run the Wav2Vec2 deepfake model to estimate whether this
                        audio is AI-generated (synthetic) or human speech.
                      </p>
                      <button
                        onClick={() => void analysis.runDeepfake()}
                        disabled={!detectCanRun}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40 enabled:transition-colors"
                      >
                        <BrainCircuit className="h-4 w-4" />
                        Detect AI Voice
                      </button>
                    </>
                  ) : null}

                  {analysis.detect.phase === "running" ? (
                    <div className="mt-3 flex items-center gap-2 text-slate-300">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                      <span className="text-sm">Analyzing voice…</span>
                    </div>
                  ) : null}

                  {analysis.detect.phase === "done" && analysis.detect.result ? (
                    <div className="mt-3 space-y-3">
                      <ProbabilityBar
                        label="AI Generated Probability"
                        value={analysis.detect.result.ai_probability}
                        color="bg-red-400"
                      />
                      <ProbabilityBar
                        label="Real (Human) Probability"
                        value={analysis.detect.result.real_probability}
                        color="bg-emerald-400"
                      />
                      <p
                        className={`text-sm font-medium ${detectionVerdict(analysis.detect.result).color}`}
                      >
                        {detectionVerdict(analysis.detect.result).label}
                      </p>
                      <p className="text-xs text-slate-500">
                        Model estimate using{" "}
                        <span className="font-mono">
                          {analysis.detect.result.model.name ?? "unknown model"}
                        </span>{" "}
                        · {analysis.detect.result.device} ·{" "}
                        {analysis.detect.result.processing_time_seconds.toFixed(1)}{" "}
                        s
                      </p>
                    </div>
                  ) : null}

                  {analysis.detect.phase === "error" ? (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium">Deepfake detection failed.</p>
                        <p className="mt-0.5 break-words text-xs">
                          {analysis.detect.error}
                        </p>
                        <button
                          onClick={() => void analysis.runDeepfake()}
                          className="mt-2 rounded-md border border-red-500/40 px-3 py-1 text-xs font-medium hover:bg-red-500/20 transition-colors"
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Verify speaker step */}
              {upload.state === "UPLOADED" &&
              upload.uploadResult &&
              analysis.prepare.phase === "done" ? (
                <div className="mt-4 rounded-xl border border-white/5 bg-surface p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-emerald-400" />
                      <h3 className="font-semibold text-slate-200">
                        Speaker Verification
                      </h3>
                    </div>
                    {analysis.verify.phase === "done" && analysis.verify.result ? (
                      <StatusBadge
                        label={
                          analysis.verify.result.verified === true
                            ? "VERIFIED"
                            : analysis.verify.result.verified === false
                              ? "NOT VERIFIED"
                              : analysis.verify.result.speaker_verification_status
                        }
                        variant={
                          analysis.verify.result.verified === true ? "ok" : "warn"
                        }
                      />
                    ) : null}
                  </div>

                  {analysis.verify.phase === "idle" ? (
                    <>
                      {analysis.verify.profile && !analysis.verify.profile.has_profile ? (
                        <p className="mt-2 text-xs text-amber-400">
                          No speaker profile is registered yet. Create one on the{" "}
                          <a
                            href="/profile"
                            className="underline underline-offset-2"
                          >
                            Speaker Profile
                          </a>{" "}
                          page first.
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">
                          Compare this audio's voiceprint to the registered
                          speaker ("
                          {analysis.verify.profile?.profile?.name ?? "—"}") using
                          the ECAPA-TDNN model's cosine similarity.
                        </p>
                      )}

                      <button
                        onClick={() => void analysis.runVerify()}
                        disabled={!verifyCanRun}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-surface hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 enabled:transition-colors"
                      >
                        <Users className="h-4 w-4" />
                        Verify Speaker
                      </button>
                    </>
                  ) : null}

                  {analysis.verify.phase === "running" ? (
                    <div className="mt-3 flex items-center gap-2 text-slate-300">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                      <span className="text-sm">Verifying speaker…</span>
                    </div>
                  ) : null}

                  {analysis.verify.phase === "done" && analysis.verify.result ? (
                    <div className="mt-3 space-y-3">
                      <div className="rounded-lg bg-surface-light/60 p-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">
                            Speaker similarity
                          </span>
                          <span className="font-mono text-slate-200">
                            {analysis.verify.result.similarity_score !== null
                              ? analysis.verify.result.similarity_score.toFixed(4)
                              : "—"}
                          </span>
                        </div>
                        <p
                          className={`mt-2 text-sm font-medium ${
                            analysis.verify.result.verified === true
                              ? "text-emerald-400"
                              : "text-amber-400"
                          }`}
                        >
                          {analysis.verify.result.verified === true
                            ? "Voiceprint matches the registered speaker"
                            : "Voiceprint does not match the registered speaker"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Cosine similarity vs. reference "
                          {analysis.verify.result.reference_name ??
                            "registered speaker"}
                          ". Threshold is an uncalibrated MVP default — tune it
                          before security-critical use.
                        </p>
                      </div>
                      <p className="text-xs text-slate-500">
                        {analysis.verify.result.speaker_model ? (
                          <>
                            Model{" "}
                            <span className="font-mono">
                              {analysis.verify.result.speaker_model}
                            </span>
                            {" · "}
                            {analysis.verify.result.speaker_device} ·{" "}
                            {Number(
                              analysis.verify.result.speaker_processing_time ?? 0,
                            ).toFixed(1)}{" "}
                            s
                          </>
                        ) : (
                          "No speaker result stored (see error)."
                        )}
                      </p>
                    </div>
                  ) : null}

                  {analysis.verify.phase === "error" ? (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium">
                          Speaker verification failed.
                        </p>
                        <p className="mt-0.5 break-words text-xs">
                          {analysis.verify.error}
                        </p>
                        <button
                          onClick={() => void analysis.runVerify()}
                          className="mt-2 rounded-md border border-red-500/40 px-3 py-1 text-xs font-medium hover:bg-red-500/20 transition-colors"
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {analysis.verify.phase === "skipped" ? (
                    <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
                      <p className="font-medium">Speaker verification unavailable</p>
                      <p className="mt-0.5 text-xs">
                        Create a speaker profile to enable impersonation
                        verification.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Risk assessment step */}
              {upload.state === "UPLOADED" &&
              upload.uploadResult &&
              analysis.prepare.phase === "done" ? (
                <div className="mt-4 rounded-xl border border-white/5 bg-surface p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Gauge className="h-5 w-5 text-emerald-400" />
                      <h3 className="font-semibold text-slate-200">
                        Step 5 · Calculate Risk
                      </h3>
                    </div>
                    {analysis.risk.phase === "done" && analysis.risk.result ? (
                      <StatusBadge
                        label={analysis.risk.result.risk_level ?? "Not calculated"}
                        variant={
                          analysis.risk.result.risk_level === "HIGH"
                            ? "danger"
                            : analysis.risk.result.risk_level === "MEDIUM"
                              ? "warn"
                              : analysis.risk.result.risk_level === "LOW"
                                ? "ok"
                                : "idle"
                        }
                      />
                    ) : null}
                  </div>

                  {analysis.risk.phase === "idle" ? (
                    <>
                      <p className="mt-2 text-xs text-slate-500">
                        Combine the deepfake probability and speaker
                        verification into a single risk score.
                      </p>
                      <button
                        onClick={() => void analysis.runRisk()}
                        disabled={!riskCanRun}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-surface hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 enabled:transition-colors"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        Calculate Risk
                      </button>
                      {!riskCanRun ? (
                        <p className="mt-2 text-xs text-amber-400">
                          {analysis.verify.phase === "skipped"
                            ? "Requires speaker verification, which is unavailable until a speaker profile is created."
                            : "Requires deepfake detection and speaker verification to be complete."}
                        </p>
                      ) : null}
                    </>
                  ) : null}

                  {analysis.risk.phase === "running" ? (
                    <div className="mt-3 flex items-center gap-2 text-slate-300">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                      <span className="text-sm">Analyzing voice…</span>
                    </div>
                  ) : null}

                  {analysis.risk.phase === "error" ? (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium">Risk calculation failed.</p>
                        <p className="mt-0.5 break-words text-xs">
                          {analysis.risk.error}
                        </p>
                        <button
                          onClick={() => void analysis.runRisk()}
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
                  onClick={analysis.clear}
                  disabled={
                    upload.state === "IDLE" || upload.state === "UPLOADING"
                  }
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

            {/* Record hint panel */}
            <div className="rounded-xl border border-white/5 bg-surface-light p-6">
              <div className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-emerald-400" />
                <h2 className="font-semibold">Record from Microphone</h2>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Prefer speaking instead of uploading a file? Use the Record tab
                on the left.
              </p>
              <div className="mt-6 flex flex-col items-center gap-4 py-8 text-slate-500">
                <AudioLines className="h-10 w-10" />
                <p className="max-w-xs text-center text-sm">
                  Captured audio goes through the exact same analysis pipeline:
                  upload → prepare → deepfake → speaker → risk.
                </p>
              </div>
            </div>
          </div>
        );
      })() : (
        <div className="mt-8 space-y-6">
          {/* Recorder card */}
          <div className="rounded-xl border border-white/5 bg-surface-light p-6">
            <div className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-emerald-400" />
              <h2 className="font-semibold">Record from Microphone</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Recorded audio is analyzed with the same pipeline used for file
              uploads.
            </p>

            {!recorder.support.supported ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">{recorder.support.reason}</p>
                  <p className="mt-1 text-xs">
                    Use the Upload Audio tab instead.
                  </p>
                </div>
              </div>
            ) : null}

            {recorder.error && !recorder.recording ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{recorder.error}</span>
              </div>
            ) : null}

            {recorder.isRecording ? (
              <div className="mt-4">
                <div className="flex items-center gap-2 text-red-400">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                  <span className="font-medium">Recording</span>
                  <span className="font-mono text-sm text-slate-300">
                    {formatTimer(recorder.elapsedSeconds)} /{" "}
                    {formatTimer(recorder.maxDurationSeconds)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Stops automatically at{" "}
                  {recorder.maxDurationSeconds} seconds.
                </p>
                <button
                  onClick={recorder.stop}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-red-500 px-4 py-3 text-sm font-semibold text-white hover:bg-red-400 transition-colors"
                >
                  <Square className="h-4 w-4" />
                  Stop Recording
                </button>
              </div>
            ) : null}

            {!recorder.isRecording && !recorder.recording ? (
              <div className="mt-4">
                <p className="text-xs text-slate-500">
                  Microphone permission is requested only after you click Start
                  Recording. Maximum length is{" "}
                  {recorder.maxDurationSeconds} seconds.
                </p>
                <button
                  onClick={() => void recorder.start()}
                  disabled={!recorder.support.supported}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-surface hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                >
                  <Mic className="h-4 w-4" />
                  Start Recording
                </button>
              </div>
            ) : null}

            {!recorder.isRecording && recorder.recording ? (
              <div className="mt-4">
                <div className="rounded-xl bg-surface p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-slate-200">
                      microphone-recording.{recorder.recording.format}
                    </p>
                    <span className="shrink-0 text-xs text-slate-400">
                      {formatDuration(recorder.recording.durationSeconds)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {recorder.recording.format.toUpperCase()} ·{" "}
                    {formatDuration(recorder.recording.durationSeconds)}
                  </p>
                  <AudioPlayer audioUrl={recorder.recording.url} />
                  <AudioWaveform audioUrl={recorder.recording.url} />
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={recorder.clear}
                    disabled={micRunning}
                    className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-300 hover:border-red-500/50 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                  >
                    Delete / Re-record
                  </button>
                  <button
                    onClick={() => void startMicrophoneAnalysis()}
                    disabled={micRunning}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-6 py-2.5 font-semibold text-surface hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                  >
                    {micRunning ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <ScanLine className="h-5 w-5" />
                    )}
                    {micRunning ? "Uploading…" : "Analyze Recording"}
                  </button>
                </div>
              </div>
            ) : null}

            {micError ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{micError}</span>
              </div>
            ) : null}
          </div>

          {/* Near-real-time progress checklist while a recording is analyzed */}
          {upload.state === "UPLOADED" ? (
            <div className="space-y-4">
              <AnalysisProgress
                title="Recording Complete"
                steps={buildProgressSteps({
                  uploaded: upload.state === "UPLOADED",
                  prepare: analysis.prepare.phase,
                  detect: analysis.detect.phase,
                  verify: analysis.verify.phase,
                  risk: analysis.risk.phase,
                })}
              />

              {analysis.verify.phase === "skipped" ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
                  <Users className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">Speaker verification unavailable</p>
                    <p className="mt-0.5 text-xs">
                      Create a speaker profile to enable impersonation
                      verification.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {analysis.risk.phase === "done" &&
      analysis.risk.result &&
      analysis.risk.result.risk_level ? (
        <div className="mt-8 space-y-4">
          <h2 className="text-xl font-bold">Voice Security Result</h2>
          <RiskResultCard
            aiProbability={
              analysis.detect.result?.ai_probability ??
              analysis.loadedRecord?.ai_probability ??
              null
            }
            speakerSimilarity={
              analysis.verify.result?.similarity_score ??
              analysis.loadedRecord?.speaker_similarity ??
              null
            }
            riskScore={analysis.risk.result.risk_score}
            riskLevel={analysis.risk.result.risk_level}
            explanation={analysis.risk.result.explanation}
            recommendation={analysis.risk.result.recommendation}
            analysisTimeSeconds={totalAnalysisTime}
            source={resultSource}
          />
          <RiskAlert
            riskLevel={analysis.risk.result.risk_level}
            aiProbability={
              analysis.detect.result?.ai_probability ??
              analysis.loadedRecord?.ai_probability ??
              null
            }
            speakerSimilarity={
              analysis.verify.result?.similarity_score ??
              analysis.loadedRecord?.speaker_similarity ??
              null
            }
            riskScore={analysis.risk.result.risk_score}
          />
        </div>
      ) : null}

      <div className="mt-6">
        <AnalysisResultPanel result={analysis.detect.result} />
      </div>
    </div>
  );
}