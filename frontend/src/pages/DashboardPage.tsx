import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AudioLines,
  Fingerprint,
  Gauge,
  History,
  Radar,
  Server,
  ShieldAlert,
  ScanLine,
} from "lucide-react";
import MetricCard from "../components/MetricCard";
import StatusBadge from "../components/StatusBadge";
import { useBackendHealth } from "../hooks/useBackendHealth";
import { audioService } from "../services/audioService";
import { formatTimestamp, formatFileSize } from "../utils/format";
import type { AudioListItem } from "../types/analysis";

function MetricSection() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MetricCard
        label="AI Generated Probability"
        value="Not analyzed"
        icon={<Activity className="h-5 w-5" />}
      />
      <MetricCard
        label="Real Voice Probability"
        value="Not analyzed"
        icon={<AudioLines className="h-5 w-5" />}
      />
      <MetricCard
        label="Speaker Similarity"
        value="Not analyzed"
        icon={<Fingerprint className="h-5 w-5" />}
      />
      <MetricCard
        label="Risk Score"
        value="Not analyzed"
        icon={<Gauge className="h-5 w-5" />}
      />
      <MetricCard
        label="Risk Level"
        value="Not analyzed"
        icon={<ShieldAlert className="h-5 w-5" />}
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
  icon: typeof Activity;
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
 * Main dashboard. ML metric values intentionally read "Not analyzed" — no
 * fake predictions are generated. The Latest Analysis panel reflects the
 * most recent uploaded audio record (real data, not fabricated).
 */
export default function DashboardPage() {
  const { backendOnline, loading } = useBackendHealth();
  const [latest, setLatest] = useState<AudioListItem | null>(null);
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
        setLatest(data.items[0] ?? null);
        setHistoryCount(data.total);
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
        <MetricSection />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <SectionCard
          icon={Radar}
          title="Latest Analysis"
          action={
            <StatusBadge
              label={
                historyLoading
                  ? "Loading…"
                  : latest
                    ? latest.status
                    : "No uploads"
              }
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
              <p className="mt-2 text-slate-500">
                Uploaded and stored. AI analysis will be attached here in a
                later phase.
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              No audio has been uploaded yet. Start from the Analyze page.
            </p>
          )}
        </SectionCard>

        <SectionCard icon={ShieldAlert} title="Risk Status" action={<StatusBadge label="Idle" variant="idle" />}>
          <p className="text-sm text-slate-400">
            Risk assessment will appear here after audio is analyzed.
          </p>
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
              Audio upload pipeline: Operational (Phase 2)
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-600" />
              Deepfake voice detection: Pending (later phase)
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-600" />
              Speaker verification: Pending (later phase)
            </li>
            <li className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-600" />
              Risk fusion + alerts: Pending (later phase)
            </li>
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}