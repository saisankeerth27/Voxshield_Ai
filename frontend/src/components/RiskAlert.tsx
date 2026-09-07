import { Link } from "react-router-dom";

interface RiskAlertProps {
  riskLevel: string | null;
  aiProbability?: number | null;
  speakerSimilarity?: number | null;
  riskScore?: number | null;
  /** Optional link target, e.g. `/analyze?id=<id>` for a View Analysis button. */
  linkTo?: string;
  linkLabel?: string;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return `${(value * 100).toFixed(0)}%`;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-mono text-base font-bold text-slate-100">{value}</p>
    </div>
  );
}

/**
 * Simple in-app risk alert. Frontend logic only — no notifications, no
 * external services. Shows HIGH / MEDIUM / LOW states based on `risk_level`.
 */
export default function RiskAlert({
  riskLevel,
  aiProbability,
  speakerSimilarity,
  riskScore,
  linkTo,
  linkLabel = "View Analysis",
}: RiskAlertProps) {
  if (!riskLevel) return null;

  const level = riskLevel.toUpperCase();

  if (level === "HIGH") {
    return (
      <div
        className="rounded-xl border border-red-500/40 bg-red-500/10 p-5"
        role="alert"
        aria-label="High risk detected"
      >
        <p className="flex items-center gap-2 text-lg font-bold text-red-400">
          <span aria-hidden>🚨</span> HIGH RISK DETECTED
        </p>
        <p className="mt-1 text-sm text-slate-300">
          Potential AI-generated voice impersonation detected.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Metric
            label="AI Probability"
            value={formatPercent(aiProbability)}
          />
          <Metric
            label="Speaker Similarity"
            value={formatPercent(speakerSimilarity)}
          />
          <Metric label="Risk Score" value={formatPercent(riskScore)} />
        </div>
        <p className="mt-3 text-sm font-medium text-red-300">
          Recommended Action:{" "}
          <span className="font-normal text-slate-300">
            Perform independent identity verification before taking any
            sensitive action.
          </span>
        </p>
        {linkTo ? (
          <Link
            to={linkTo}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-400"
          >
            {linkLabel}
          </Link>
        ) : null}
      </div>
    );
  }

  if (level === "MEDIUM") {
    return (
      <div
        className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5"
        role="alert"
        aria-label="Medium risk warning"
      >
        <p className="flex items-center gap-2 text-lg font-bold text-amber-400">
          <span aria-hidden>⚠️</span> MEDIUM RISK
        </p>
        <p className="mt-1 text-sm text-slate-300">
          Some suspicious indicators were detected. Additional verification is
          recommended.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Metric
            label="AI Probability"
            value={formatPercent(aiProbability)}
          />
          <Metric
            label="Speaker Similarity"
            value={formatPercent(speakerSimilarity)}
          />
          <Metric label="Risk Score" value={formatPercent(riskScore)} />
        </div>
        {linkTo ? (
          <Link
            to={linkTo}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-amber-400"
          >
            {linkLabel}
          </Link>
        ) : null}
      </div>
    );
  }

  // LOW
  return (
    <div
      className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5"
      role="status"
      aria-label="Low risk status"
    >
      <p className="flex items-center gap-2 text-lg font-bold text-emerald-400">
        <span aria-hidden>✓</span> LOW RISK
      </p>
      <p className="mt-1 text-sm text-slate-300">
        No strong evidence of synthetic voice or reference-speaker
        impersonation was detected.
      </p>
      <p className="mt-1 text-xs text-slate-400">
        This does not mean the voice is definitely genuine — continue normal
        verification procedures.
      </p>
      {linkTo ? (
        <Link
          to={linkTo}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-emerald-400"
        >
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}