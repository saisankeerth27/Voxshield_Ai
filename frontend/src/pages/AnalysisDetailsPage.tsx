import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  AudioLines,
  BrainCircuit,
  CheckCircle2,
  FileDown,
  FileUp,
  Fingerprint,
  Gauge,
  Loader2,
  Mic,
  ShieldAlert,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { audioService } from "../services/audioService";
import { getApiErrorMessage } from "../utils/apiError";
import {
  formatDuration,
  formatFileSize,
  formatTimestamp,
} from "../utils/format";
import StatusBadge from "../components/StatusBadge";
import MetricBar from "../components/MetricBar";
import AudioWaveform from "../components/AudioWaveform";
import type {
  AnalysisDetails,
  AnalysisStageStatus,
  AudioSource,
} from "../types/analysis";

const STAGE_LABELS: Record<keyof AnalysisDetails["timeline"], string> = {
  uploaded: "Upload",
  preprocessed: "Preprocessing",
  deepfake: "Deepfake detection",
  speaker: "Speaker verification",
  risk: "Risk assessment",
  completed: "Completion",
};

function statusVariant(status: string): "ok" | "warn" | "danger" | "idle" {
  switch (status) {
    case "COMPLETED":
    case "DEEPFAKE_ANALYZED":
    case "SPEAKER_ANALYZED":
    case "RISK_CALCULATED":
      return "ok";
    case "FAILED":
      return "danger";
    case "PROCESSING":
    case "PREPROCESSING":
      return "warn";
    default:
      return "idle";
  }
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return `${(value * 100).toFixed(1)}%`;
}

function formatSimilarity(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(4);
}

function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(2);
}

function formatSeconds(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return `${Number(value).toFixed(2)} s`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-white/5 py-2 last:border-b-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-right font-mono text-sm text-slate-200">
        {value}
      </span>
    </div>
  );
}

function StagePill({
  status,
  label,
}: {
  status: AnalysisStageStatus;
  label: string;
}) {
  const config = {
    completed: { icon: CheckCircle2, cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
    running: { icon: Loader2, cls: "text-sky-400 bg-sky-500/10 border-sky-500/30" },
    failed: { icon: XCircle, cls: "text-red-400 bg-red-500/10 border-red-500/30" },
    not_started: { icon: TriangleAlert, cls: "text-slate-500 bg-slate-500/10 border-slate-500/30" },
  }[status];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${config.cls}`}
    >
      <Icon className={`h-3.5 w-3.5 ${status === "running" ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
}

function SourceTag({ source }: { source: AudioSource }) {
  return source === "MICROPHONE" ? (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
      <Mic className="h-3.5 w-3.5 text-violet-400" />
      Microphone
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
      <FileUp className="h-3.5 w-3.5" />
      Upload
    </span>
  );
}

function SectionCard({
  icon: Icon,
  title,
  right,
  children,
}: {
  icon: typeof AudioLines;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/5 bg-surface-light p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-300">
          <Icon className="h-5 w-5 text-emerald-400" />
          <h2 className="font-semibold">{title}</h2>
        </div>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function NotImplementedNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-slate-500">
      {children}
    </p>
  );
}

export default function AnalysisDetailsPage() {
  const { analysisId = "" } = useParams<{ analysisId: string }>();
  const [details, setDetails] = useState<AnalysisDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotFound(false);
    audioService
      .getDetails(analysisId)
      .then((data) => {
        if (cancelled) return;
        setDetails(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.response?.status === 404) {
          setNotFound(true);
        } else {
          setError(getApiErrorMessage(err, "Unable to load analysis details."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [analysisId]);

  if (loading) {
    return (
      <div className="mx-auto flex max-w-5xl items-center justify-center px-4 py-24">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        <span className="ml-3 text-sm text-slate-400">Loading details…</span>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-400">
          Analysis not found. It may have been deleted.
        </div>
        <Link to="/history" className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-400 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to history
        </Link>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error ?? "Unable to load analysis details."}</span>
        </div>
        <Link to="/history" className="mt-4 inline-flex items-center gap-2 text-sm text-emerald-400 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to history
        </Link>
      </div>
    );
  }

  const { audio, deepfake, speaker, risk, timeline } = details;
  const aiColor = deepfake.ai_probability !== null && deepfake.ai_probability >= 0.8
    ? "bg-red-500"
    : "bg-emerald-500";
  const realColor = deepfake.real_probability !== null && deepfake.real_probability >= 0.8
    ? "bg-emerald-500"
    : "bg-amber-500";
  const similarityColor = speaker.similarity !== null && speaker.verified
    ? "bg-emerald-500"
    : "bg-amber-500";
  const riskColor = risk.level === "HIGH"
    ? "bg-red-500"
    : risk.level === "MEDIUM"
      ? "bg-amber-500"
      : "bg-emerald-500";

  const timelineEntries = (Object.keys(timeline) as (keyof AnalysisDetails["timeline"])[]).map(
    (key) => ({ key, stage: timeline[key] })
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/history"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-emerald-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to history
        </Link>
        <Link
          to={`/analysis/${details.analysis_id}/report`}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-emerald-400"
        >
          <FileDown className="h-4 w-4" />
          Download Report
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Analysis Details</h1>
        <StatusBadge label={details.status} variant={statusVariant(details.status)} />
        <SourceTag source={details.source} />
      </div>
      <p className="mt-1 font-mono text-xs text-slate-500">{details.analysis_id}</p>

      <div className="mt-6 grid gap-6">
        <SectionCard icon={AudioLines} title="Audio">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="truncate font-medium text-slate-200">{audio.filename}</p>
              <p className="mt-1 text-xs text-slate-500">
                Uploaded {formatTimestamp(details.created_at)}
              </p>
              <div className="mt-3 max-w-xs">
                <AudioWaveform
                  audioUrl={audioService.processedUrl(details.analysis_id)}
                  color="#34d399"
                />
              </div>
            </div>
            <div>
              <Row label="Size" value={formatFileSize(audio.file_size)} />
              <Row label="Duration" value={formatDuration(audio.duration_seconds ?? 0)} />
              <Row label="Sample rate" value={audio.processed_sample_rate ?? audio.original_sample_rate ?? "—"} />
              <Row label="Channels" value={audio.processed_channels ?? audio.original_channels ?? "—"} />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          icon={BrainCircuit}
          title="AI Detection"
          right={<StagePill status={deepfake.status} label={deepfake.status === "completed" ? "Completed" : deepfake.status === "failed" ? "Failed" : deepfake.status === "running" ? "Running" : "Not started"} />}
        >
          {deepfake.status === "completed" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-slate-500">AI-generated probability</span>
                  <span className="font-mono text-slate-200">{formatPercent(deepfake.ai_probability)}</span>
                </div>
                <MetricBar value={deepfake.ai_probability ?? 0} colorClass={aiColor} ariaLabel="AI-generated probability" />
                <div className="mt-3 flex items-baseline justify-between text-sm">
                  <span className="text-slate-500">Real voice probability</span>
                  <span className="font-mono text-slate-200">{formatPercent(deepfake.real_probability)}</span>
                </div>
                <MetricBar value={deepfake.real_probability ?? 0} colorClass={realColor} ariaLabel="Real voice probability" />
                <div className="mt-4">
                  <Row label="Prediction" value={deepfake.label === "synthetic" ? "Synthetic (AI-generated)" : deepfake.label === "real" ? "Real (human)" : "—"} />
                  <Row label="Model" value={deepfake.model ? `${deepfake.model}${deepfake.model_version ? ` v${deepfake.model_version}` : ""}` : "—"} />
                </div>
              </div>
              <div>
                <Row label="Processing time" value={formatSeconds(deepfake.processing_time)} />
                <Row label="Device" value={deepfake.device ?? "—"} />
              </div>
            </div>
          ) : deepfake.status === "failed" ? (
            <NotImplementedNote>
              <span className="text-red-400">Deepfake detection failed.</span>{" "}
              {deepfake.error ?? "No error detail recorded."}
            </NotImplementedNote>
          ) : (
            <NotImplementedNote>Deepfake detection was not performed for this record.</NotImplementedNote>
          )}
        </SectionCard>

        <SectionCard
          icon={Fingerprint}
          title="Speaker Verification"
          right={<StagePill status={speaker.status} label={speaker.status === "completed" ? "Completed" : speaker.status === "failed" ? "Failed" : speaker.status === "running" ? "Running" : "Not started"} />}
        >
          {speaker.status === "completed" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-slate-500">Reference speaker</span>
                  <span className="font-mono text-slate-200">{speaker.reference_name ?? "—"}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Speaker similarity measures how closely the analyzed voice matches the selected reference speaker.
                </p>
                <div className="mt-3 flex items-baseline justify-between text-sm">
                  <span className="text-slate-500">Similarity</span>
                  <span className="font-mono text-slate-200">
                    {formatSimilarity(speaker.similarity)} · {formatPercent(speaker.similarity)}
                  </span>
                </div>
                <MetricBar value={speaker.similarity ?? 0} colorClass={similarityColor} ariaLabel="Speaker similarity" />
                <div className="mt-4">
                  <Row label="Verification" value={speaker.verified ? "Voice matches the registered voiceprint" : "Voice does not match the registered voiceprint"} />
                  <Row label="Model" value={speaker.model ? `${speaker.model}${speaker.model_version ? ` v${speaker.model_version}` : ""}` : "—"} />
                </div>
              </div>
              <div>
                <Row label="Processing time" value={formatSeconds(speaker.processing_time)} />
                <Row label="Device" value={speaker.device ?? "—"} />
              </div>
            </div>
          ) : speaker.status === "failed" ? (
            <NotImplementedNote>
              <span className="text-red-400">Speaker verification failed.</span>{" "}
              {speaker.error ?? "No error detail recorded."}
            </NotImplementedNote>
          ) : (
            <NotImplementedNote>Speaker verification was not performed.</NotImplementedNote>
          )}
        </SectionCard>

        <SectionCard
          icon={Gauge}
          title="Risk Assessment"
          right={<StagePill status={risk.status} label={risk.status === "completed" ? "Completed" : risk.status === "failed" ? "Failed" : risk.status === "running" ? "Running" : "Not started"} />}
        >
          {risk.status === "completed" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-slate-500">Risk score</span>
                  <span className="font-mono text-slate-200">
                    {formatScore(risk.score)} · {formatPercent(risk.score)}
                  </span>
                </div>
                <MetricBar value={risk.score ?? 0} colorClass={riskColor} ariaLabel="Risk score" />
                <div className="mt-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-slate-500" />
                    <span className="text-sm text-slate-300">
                      Risk level:{" "}
                      <span className={
                        risk.level === "HIGH"
                          ? "font-semibold text-red-400"
                          : risk.level === "MEDIUM"
                            ? "font-semibold text-amber-400"
                            : "font-semibold text-emerald-400"
                      }>
                        {risk.level ?? "—"}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
              <div>
                {risk.explanation ? (
                  <>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Explanation</p>
                    <p className="mt-1 text-sm text-slate-300">{risk.explanation}</p>
                  </>
                ) : null}
                {risk.recommendation ? (
                  <>
                    <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">Recommendation</p>
                    <p className="mt-1 text-sm text-slate-300">{risk.recommendation}</p>
                  </>
                ) : null}
                <p className="mt-3 text-xs text-slate-500">
                  Estimate only — not a proven probability of attack.
                </p>
              </div>
            </div>
          ) : risk.status === "failed" ? (
            <NotImplementedNote>
              <span className="text-red-400">Risk assessment failed.</span>
            </NotImplementedNote>
          ) : (
            <NotImplementedNote>Risk assessment was not performed.</NotImplementedNote>
          )}
        </SectionCard>

        <SectionCard icon={AudioLines} title="Processing Timeline">
          <ul className="grid gap-2">
            {timelineEntries.map(({ key, stage }) => (
              <li key={key} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-2 last:border-b-0">
                <StagePill status={stage.status} label={STAGE_LABELS[key]} />
                <span className="text-xs text-slate-500">
                  {stage.status === "failed"
                    ? stage.error ?? "Failed"
                    : stage.status === "not_started"
                      ? "Not started"
                      : stage.message ?? ""}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}