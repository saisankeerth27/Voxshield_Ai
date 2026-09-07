import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AudioLines,
  BrainCircuit,
  FileText,
  Fingerprint,
  Gauge,
  History,
  Radar,
  Server,
  ShieldAlert,
  ScanLine,
} from "lucide-react";
import MetricCard from "../components/MetricCard";
import RiskAlert from "../components/RiskAlert";
import StatusBadge from "../components/StatusBadge";
import { useBackendHealth } from "../hooks/useBackendHealth";
import { audioService } from "../services/audioService";
import { formatTimestamp, formatFileSize } from "../utils/format";
import type { AudioAnalysis } from "../types/analysis";

function formatProbability(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Not analyzed";
  return `${(value * 100).toFixed(1)}%`;
}

function detectionStatus(analysis: AudioAnalysis | null): string {
  if (!analysis?.deepfake_label) return "Not analyzed";
  return analysis.deepfake_label === "synthetic"
    ? "Synthetic voice"
    : "Real voice";
}

function formatSimilarity(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Not analyzed";
  return value.toFixed(4);
}

function formatRiskScore(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Not analyzed";
  return value.toFixed(2);
}

function MetricSection({ analysis }: { analysis: AudioAnalysis | null }) {
  const ai = analysis?.ai_probability ?? null;
  const real = analysis?.real_probability ?? null;
  const similarity = analysis?.speaker_similarity ?? null;
  const verified = analysis?.speaker_verified ?? null;
  const riskScore = analysis?.risk_score ?? null;
  const riskLevel = analysis?.risk_level ?? null;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MetricCard
        label="AI Generated Probability"
        value={formatProbability(ai)}
        status={ai === null ? "idle" : ai >= 0.8 ? "danger" : "ok"}
        icon={<BrainCircuit className="h-5 w-5" />}
      />
      <MetricCard
        label="Real Voice Probability"
        value={formatProbability(real)}
        status={real === null ? "idle" : real >= 0.8 ? "ok" : "warn"}
        icon={<AudioLines className="h-5 w-5" />}
      />
      <MetricCard
        label="Detection Status"
        value={detectionStatus(analysis)}
        status={analysis?.deepfake_label === "synthetic" ? "danger" : analysis?.deepfake_label ? "ok" : "idle"}
        icon={<ShieldAlert className="h-5 w-5" />}
      />
      <MetricCard
        label="Speaker Similarity"
        value={
          verified === null
            ? "Not analyzed"
            : `${formatSimilarity(similarity)} (${verified ? "Matches" : "No match"})`
        }
        status={similarity === null ? "idle" : verified === true ? "ok" : "warn"}
        icon={<Fingerprint className="h-5 w-5" />}
      />
      <MetricCard
        label="Risk Score"
        value={
          riskScore === null
            ? "Not analyzed"
            : `${formatRiskScore(riskScore)} (${riskLevel ?? "—"})`
        }
        status={
          riskScore === null
            ? "idle"
            : riskLevel === "HIGH"
              ? "danger"
              : riskLevel === "MEDIUM"
                ? "warn"
                : "ok"
        }
        icon={<Gauge className="h-5 w-5" />}
      />
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: typeof Radar;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-surface-light p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-300">
          <Icon className="h-5 w-5 text-emerald-400" />
          <h2 className="font-semibold">{title}</h2>
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

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
      return "warn";
    default:
      return "idle";
  }
}

/**
 * Main dashboard. Deepfake metrics reflect real stored model predictions
 * (no fabricated values); capabilities not implemented yet read
 * "Not analyzed". The Latest Analysis panel shows the most recent record.
 */
export default function DashboardPage() {
  const { backendOnline, loading } = useBackendHealth();
  const [latest, setLatest] = useState<AudioAnalysis | null>(null);
  const [historyCount, setHistoryCount] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    if (!backendOnline) {
      setHistoryLoading(false);
      return;
    }
    let cancelled = false;
    audioService
      .list(1, 10)
      .then((data) => {
        if (cancelled) return;
        const first = data.items[0];
        if (!first) {
          setLatest(null);
          setHistoryCount(data.total);
          return;
        }
        setHistoryCount(data.total);
        return audioService.get(first.analysis_id).then((record) => {
          if (!cancelled) setLatest(record);
        });
      })
      .catch(() => {
        if (!cancelled) {
          setLatest(null);
          setHistoryCount(0);
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [backendOnline]);

  const latestStatusLabel = historyLoading
    ? "Loading…"
    : latest
      ? latest.status
      : "No uploads";

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Voice threat monitoring overview.
          </p>
        </div>
        <Link
          to="/analyze"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-surface hover:bg-emerald-400 transition-colors"
        >
          <ScanLine className="h-4 w-4" />
          Analyze Voice
        </Link>
      </div>

      <div className="mt-8">
        <MetricSection analysis={latest} />
      </div>

      {latest?.risk_level ? (
        <div className="mt-6">
          <RiskAlert
            riskLevel={latest.risk_level}
            aiProbability={latest.ai_probability}
            speakerSimilarity={latest.speaker_similarity}
            riskScore={latest.risk_score}
            linkTo={`/analyze?id=${latest.analysis_id}`}
            linkLabel="View Analysis"
          />
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <SectionCard
          icon={Radar}
          title="Latest Analysis"
          action={
            <StatusBadge
              label={latestStatusLabel}
              variant={latest ? statusVariant(latest.status) : "idle"}
            />
          }
        >
          {historyLoading ? (
            <p className="text-sm text-slate-400">Loading latest upload…</p>
          ) : latest ? (
            <div className="space-y-2 text-sm">
              <p className="truncate font-medium text-slate-200">
                {latest.filename}
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-slate-400">
                <span>{formatFileSize(latest.file_size)}</span>
                <span>{formatTimestamp(latest.created_at)}</span>
                <span className="font-mono text-xs">{latest.analysis_id}</span>
              </div>
              {latest.deepfake_label ? (
                <p
                  className={`mt-2 ${latest.deepfake_label === "synthetic" ? "text-red-400" : "text-emerald-400"}`}
                >
                  {latest.deepfake_label === "synthetic"
                    ? "The model indicates AI-generated (synthetic) speech."
                    : "The model indicates human speech."}{" "}
                  <span className="text-slate-500">
                    (AI {formatProbability(latest.ai_probability)} · Real{" "}
                    {formatProbability(latest.real_probability)})
                  </span>
                </p>
              ) : (
                <p className="mt-2 text-slate-500">
                  Uploaded and stored. Run deepfake detection from the Analyze
                  page.
                </p>
              )}
              {latest.speaker_similarity !== null ? (
                <p
                  className={`mt-1 ${latest.speaker_verified ? "text-emerald-400" : "text-amber-400"}`}
                >
                  {latest.speaker_verified
                    ? "Speaker matches the registered voiceprint."
                    : "Speaker does not match the registered voiceprint."}{" "}
                  <span className="text-slate-500">
                    (similarity {formatSimilarity(latest.speaker_similarity)})
                  </span>
                </p>
              ) : null}
              {latest.risk_level ? (
                <p
                  className={`mt-1 ${
                    latest.risk_level === "HIGH"
                      ? "text-red-400"
                      : latest.risk_level === "MEDIUM"
                        ? "text-amber-400"
                        : "text-emerald-400"
                  }`}
                >
                  Risk: {latest.risk_level} · score{" "}
                  {formatRiskScore(latest.risk_score)}
                </p>
              ) : null}
              <Link
                to={`/analyze?id=${latest.analysis_id}`}
                className="mt-2 inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 px-3 py-1.5 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/10"
              >
                <ScanLine className="h-4 w-4" />
                View Analysis
              </Link>
              <Link
                to={`/analysis/${latest.analysis_id}`}
                className="ml-2 inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:border-emerald-500/40 hover:text-emerald-400"
              >
                <FileText className="h-4 w-4" />
                Full Details
              </Link>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              No analyses yet. Upload or record an audio sample to begin.
            </p>
          )}
        </SectionCard>

        <SectionCard
          icon={ShieldAlert}
          title="Risk Status"
          action={
            <StatusBadge
              label={latest?.risk_level ?? "Idle"}
              variant={
                latest?.risk_level === "HIGH"
                  ? "danger"
                  : latest?.risk_level === "MEDIUM"
                    ? "warn"
                    : latest?.risk_level === "LOW"
                      ? "ok"
                      : "idle"
              }
            />
          }
        >
          {latest?.risk_level ? (
            <div className="space-y-2 text-sm">
              <p className="text-slate-300">
                Risk level:{" "}
                <span className="font-medium text-slate-200">
                  {latest.risk_level}
                </span>{" "}
                · <span className="text-slate-400">score</span>{" "}
                <span className="font-mono text-slate-200">
                  {formatRiskScore(latest.risk_score)}
                </span>
              </p>
              {latest.risk_explanation ? (
                <p className="text-slate-400">{latest.risk_explanation}</p>
              ) : null}
              <p className="pt-1 text-xs text-slate-500">
                Deterministic MVP heuristic combining the deepfake probability
                and speaker similarity — not a validated probability of attack.
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Risk assessment appears here after deepfake detection and speaker
              verification are completed.
            </p>
          )}
        </SectionCard>

        <SectionCard icon={AudioLines} title="Audio Visualization">
          <p className="text-sm text-slate-400">
            Waveform and spectrogram visualizations will appear after
            analysis.
          </p>
        </SectionCard>

        <SectionCard
          icon={History}
          title="Detection History"
          action={
            <Link to="/history" className="text-sm text-emerald-400 hover:underline">
              View all
            </Link>
          }
        >
          <p className="text-sm text-slate-400">
            {historyLoading
              ? "Loading history…"
              : historyCount === 0
                ? "No uploaded audio yet."
                : `${historyCount} uploaded audio record${historyCount === 1 ? "" : "s"} stored.`}
          </p>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard
          icon={Server}
          title="System Status"
          action={
            <StatusBadge
              label={loading ? "Checking…" : backendOnline ? "Backend online" : "Backend offline"}
              variant={backendOnline ? "ok" : "idle"}
            />
          }
        >
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Audio upload pipeline: Operational
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Audio preprocessing: Operational
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Deepfake voice detection: Operational
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Speaker verification: Operational
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Risk fusion engine: Operational
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-600" />
              Alerts + notifications: Pending (later phase)
            </li>
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}