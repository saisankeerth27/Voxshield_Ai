import { Gauge, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import StatusBadge from "./StatusBadge";
import type { RiskCalculateResponse } from "../types/analysis";

interface RiskAssessmentCardProps {
  phase: "idle" | "calculating" | "done" | "error";
  result: RiskCalculateResponse | null;
  error: string | null;
  disabled?: boolean;
  onCalculate?: () => void;
}

function riskVariant(
  level: string | null | undefined,
): "ok" | "warn" | "danger" | "idle" {
  switch (level) {
    case "LOW":
      return "ok";
    case "MEDIUM":
      return "warn";
    case "HIGH":
      return "danger";
    default:
      return "idle";
  }
}

function riskLevelLabel(level: string | null | undefined): string {
  switch (level) {
    case "LOW":
      return "Low risk";
    case "MEDIUM":
      return "Medium risk";
    case "HIGH":
      return "High risk";
    default:
      return "Not calculated";
  }
}

function formatRiskScore(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return value.toFixed(2);
}

/**
 * Risk fusion result card. The risk score is a deterministic MVP heuristic
 * (0.0–1.0) combining the deepfake probability and speaker similarity with
 * configurable weights — it is NOT a scientifically validated probability
 * of attack.
 */
export default function RiskAssessmentCard({
  phase,
  result,
  error,
  disabled = false,
  onCalculate,
}: RiskAssessmentCardProps) {
  return (
    <div className="rounded-xl border border-white/5 bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-emerald-400" />
          <h3 className="font-semibold text-slate-200">Risk Assessment</h3>
        </div>
        {phase === "done" && result ? (
          <StatusBadge
            label={result.risk_level ?? "Not calculated"}
            variant={riskVariant(result.risk_level)}
          />
        ) : null}
      </div>

      {phase === "idle" ? (
        <>
          <p className="mt-2 text-xs text-slate-500">
            Combine the deepfake probability and speaker verification into a
            single risk score. Weights and thresholds are configurable; the
            score is an MVP heuristic, not a validated probability of attack.
          </p>
          <button
            onClick={onCalculate}
            disabled={disabled}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-surface hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 enabled:transition-colors"
          >
            <ShieldCheck className="h-4 w-4" />
            Calculate Risk
          </button>
          {disabled ? (
            <p className="mt-2 text-xs text-amber-400">
              Complete deepfake detection and speaker verification first.
            </p>
          ) : null}
        </>
      ) : null}

      {phase === "calculating" ? (
        <div className="mt-3 flex items-center gap-2 text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
          <span className="text-sm">Calculating risk…</span>
        </div>
      ) : null}

      {phase === "done" && result ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg bg-surface-light/60 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Risk score (0–1)</span>
              <span className="font-mono text-slate-200">
                {formatRiskScore(result.risk_score)}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
              <div
                className={`h-full transition-all ${
                  result.risk_level === "HIGH"
                    ? "bg-red-400"
                    : result.risk_level === "MEDIUM"
                      ? "bg-amber-400"
                      : result.risk_level === "LOW"
                        ? "bg-emerald-400"
                        : "bg-slate-500"
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((result.risk_score ?? 0) * 100),
                  )}%`,
                }}
              />
            </div>
            <p className="mt-2 text-sm font-medium text-slate-200">
              {riskLevelLabel(result.risk_level)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {result.explanation}
            </p>
          </div>
          <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-slate-300">
            <span className="font-medium text-emerald-400">
              Recommendation:{" "}
            </span>
            {result.recommendation}
          </p>
          <p className="text-xs text-slate-500">
            {result.risk_engine_version ? (
              <>
                Risk engine v{result.risk_engine_version}
                {result.risk_processing_time !== null
                  ? ` · ${Number(result.risk_processing_time).toFixed(2)} s`
                  : ""}
              </>
            ) : (
              "Risk assessment not stored (see error)."
            )}
          </p>
        </div>
      ) : null}

      {phase === "error" ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium">Risk assessment could not run</p>
            <p className="mt-0.5 break-words text-xs">{error}</p>
            <button
              onClick={onCalculate}
              className="mt-2 rounded-md border border-red-500/40 px-3 py-1 text-xs font-medium hover:bg-red-500/20 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}