interface RiskIndicatorProps {
  level: string | null | undefined;
}

const levels: Record<
  string,
  { dot: string; label: string; textClass: string; badgeClass: string }
> = {
  HIGH: {
    dot: "🔴",
    label: "HIGH",
    textClass: "text-red-400",
    badgeClass: "border-red-500/40 bg-red-500/10",
  },
  MEDIUM: {
    dot: "🟡",
    label: "MEDIUM",
    textClass: "text-amber-400",
    badgeClass: "border-amber-500/40 bg-amber-500/10",
  },
  LOW: {
    dot: "🟢",
    label: "LOW",
    textClass: "text-emerald-400",
    badgeClass: "border-emerald-500/40 bg-emerald-500/10",
  },
};

/**
 * Simple risk level indicator. Always shows both a symbol and a text label
 * so the level is never communicated by colour alone.
 */
export default function RiskIndicator({
  level,
}: RiskIndicatorProps) {
  const config = level ? levels[level.toUpperCase()] : undefined;
  if (!config) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-500/40 bg-slate-500/10 px-3 py-1 text-xs font-semibold text-slate-400">
        <span aria-hidden>⚪</span>
        NOT CALCULATED
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${config.badgeClass} ${config.textClass}`}
      role="status"
      aria-label={`Risk level: ${config.label}`}
    >
      <span aria-hidden>{config.dot}</span>
      {config.label} RISK
    </span>
  );
}