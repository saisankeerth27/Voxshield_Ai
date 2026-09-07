import { ShieldCheck } from "lucide-react";
import type { AudioSource } from "../types/analysis";

interface RiskResultCardProps {
  aiProbability: number | null;
  speakerSimilarity: number | null;
  riskScore: number | null;
  riskLevel: string | null;
  explanation: string | null;
  recommendation: string | null;
  /** Total analysis time in seconds across all pipeline steps. */
  analysisTimeSeconds: number | null;
  /** Origin of the analyzed audio (UPLOAD or MICROPHONE). */
  source?: AudioSource | null;
}

const LEVEL_META: Record<
  string,
  { text: string; chip: string; summary: string }
> = {
  HIGH: {
    text: "text-red-400",
    chip: "border-red-500/40 bg-red-500/10",
    summary:
      "Potential AI-generated voice impersonation detected. Additional verification is recommended.",
  },
  MEDIUM: {
    text: "text-amber-400",
    chip: "border-amber-500/40 bg-amber-500/10",
    summary: "Some indicators require additional verification.",
  },
  LOW: {
    text: "text-emerald-400",
    chip: "border-emerald-500/40 bg-emerald-500/10",
    summary: "No strong indicators of AI-generated voice impersonation were detected.",
  },
};

const DISCLAIMER =
  "VoiceShield provides AI-assisted risk assessment. Results are not absolute proof of identity, fraud, or malicious intent.";

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return `${(value * 100).toFixed(0)}%`;
}

function formatTime(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return `${Number(value).toFixed(1)} seconds`;
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/5 bg-surface-light/60 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-xl font-bold text-slate-100">
        {value}
      </p>
    </div>
  );
}

/**
 * Reusable VOICE SECURITY RESULT card. Displays the stored analysis values
 * only — never hardcoded example numbers. The risk score is an MVP heuristic
 * (0–1 internally, shown here as a percentage), not a proven probability of
 * attack.
 */
export default function RiskResultCard({
  aiProbability,
  speakerSimilarity,
  riskScore,
  riskLevel,
  explanation,
  recommendation,
  analysisTimeSeconds,
  source,
}: RiskResultCardProps) {
  const meta = riskLevel ? LEVEL_META[riskLevel] : null;

  return (
    <div className="rounded-xl border border-white/5 bg-surface-light p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-400" />
          <h2 className="text-lg font-semibold">Voice Security Result</h2>
        </div>
      </div>

      {/* Prominent risk level banner */}
      <div
        className={`mt-4 flex items-center justify-between gap-4 rounded-xl border p-5 ${
          meta?.chip ?? "border-slate-600 bg-surface"
        }`}
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Risk Level
          </p>
          <p
            className={`mt-1 text-4xl font-extrabold ${meta?.text ?? "text-slate-300"}`}
          >
            {riskLevel ?? "—"}
          </p>
        </div>
        <p
          className={`max-w-[220px] text-right text-sm ${meta?.text ?? "text-slate-400"}`}
        >
          {meta?.summary ?? "No risk assessment available."}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric
          label="AI-generated probability"
          value={formatPercent(aiProbability)}
        />
        <Metric
          label="Speaker similarity"
          value={formatPercent(speakerSimilarity)}
        />
        <Metric label="Risk score" value={formatPercent(riskScore)} />
      </div>

      {explanation ? (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Why this result?
          </p>
          <p className="mt-1 text-sm text-slate-300">{explanation}</p>
        </div>
      ) : null}

      {recommendation ? (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Recommended action
          </p>
          <p className="mt-1 text-sm text-slate-300">{recommendation}</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
        <p className="text-xs text-slate-500">
          Audio source:{" "}
          <span className="font-medium text-slate-300">
            {source === "MICROPHONE" ? "Microphone" : source === "UPLOAD" ? "Upload" : "—"}
          </span>
        </p>
        <p className="text-xs text-slate-500">
          Analysis time:{" "}
          <span className="font-mono text-slate-300">
            {formatTime(analysisTimeSeconds)}
          </span>
        </p>
      </div>
      <p className="mt-3 text-xs text-slate-500">{DISCLAIMER}</p>
    </div>
  );
}