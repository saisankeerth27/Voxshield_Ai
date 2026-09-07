import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  History,
  Radar,
  ScanLine,
  Server,
  ShieldAlert,
} from "lucide-react";
import RiskAlert from "../components/RiskAlert";
import StatusBadge from "../components/StatusBadge";
import { useBackendHealth } from "../hooks/useBackendHealth";
import { audioService } from "../services/audioService";
import { formatFileSize, formatTimestamp } from "../utils/format";
import type { AudioAnalysis, RiskLevel } from "../types/analysis";

function formatProbability(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Not analyzed";
  return `${(value * 100).toFixed(1)}%`;
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

function riskMeta(level: RiskLevel | null): {
  label: string;
  text: string;
  chip: string;
} {
  switch (level) {
    case "HIGH":
      return {
        label: "HIGH",
        text: "text-red-400",
        chip: "border-red-500/40 bg-red-500/10",
      };
    case "MEDIUM":
      return {
        label: "MEDIUM",
        text: "text-amber-400",
        chip: "border-amber-500/40 bg-amber-500/10",
      };
    case "LOW":
      return {
        label: "LOW",
        text: "text-emerald-400",
        chip: "border-emerald-500/40 bg-emerald-500/10",
      };
    default:
      return { label: "Not calculated", text: "text-slate-500", chip: "border-slate-600 bg-surface" };
  }
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

/**
 * Main dashboard. Every number comes from the database — no fabricated
 * statistics. The top summary shows the most recent analysis at a glance.
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

  const meta = riskMeta(latest?.risk_level ?? null);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
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

      {/* Latest analysis summary */}
      <section className="mt-8 rounded-xl border border-white/5 bg-surface-light p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-300">
            <Radar className="h-5 w-5 text-emerald-400" />
            <h2 className="font-semibold">Latest Analysis</h2>
          </div>
          <StatusBadge
            label={
              historyLoading
                ? "Loading…"
                : latest
                  ? latest.status
                  : "No analyses"
            }
            variant={latest ? statusVariant(latest.status) : "idle"}
          />
        </div>

        {historyLoading ? (
          <p className="mt-4 text-sm text-slate-400">Loading latest upload…</p>
        ) : !latest ? (
          <p className="mt-4 text-sm text-slate-400">
            No analyses yet. Upload or record a voice sample to begin.
          </p>
        ) : (
          <div className="mt-4">
            <p className="truncate font-medium text-slate-200">
              {latest.filename}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-500">
              <span>{formatFileSize(latest.file_size)}</span>
              <span>{formatTimestamp(latest.created_at)}</span>
            </div>

            <div className={`mt-4 flex flex-wrap items-center gap-6 rounded-xl border p-4 ${meta.chip}`}>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Risk</p>
                <p className={`text-2xl font-extrabold ${meta.text}`}>{meta.label}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">AI Detection</p>
                <p className="mt-0.5 font-mono text-lg font-bold text-slate-100">
                  {formatProbability(latest.ai_probability)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Speaker Verification</p>
                <p className="mt-0.5 font-mono text-lg font-bold text-slate-100">
                  {latest.speaker_similarity !== null
                    ? `${(latest.speaker_similarity * 100).toFixed(1)}%`
                    : "Not verified"}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                to={`/analysis/${latest.analysis_id}`}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-surface hover:bg-emerald-400 transition-colors"
              >
                <FileText className="h-4 w-4" />
                Full Details
              </Link>
            </div>
          </div>
        )}
      </section>

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

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
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
                ? "No analysis history yet. Analyze a voice sample to get started."
                : `${historyCount} uploaded audio record${historyCount === 1 ? "" : "s"} stored.`}
          </p>
        </SectionCard>

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
              Audio upload &amp; preprocessing: Operational
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              AI voice detection: Operational
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Speaker verification: Operational
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Risk assessment: Operational
            </li>
          </ul>
        </SectionCard>
      </div>

      <p className="mt-6 text-center text-xs text-slate-600">
        <ShieldAlert className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
        VoiceShield provides AI-assisted risk assessment. Results are not
        absolute proof of identity, fraud, or malicious intent.
      </p>
    </div>
  );
}