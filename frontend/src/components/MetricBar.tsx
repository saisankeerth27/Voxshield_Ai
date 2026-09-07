interface MetricBarProps {
  /** Proportion from 0 to 1 rendered as a horizontal fill. */
  value: number;
  /** Tailwind background color class for the filled portion. */
  colorClass: string;
  ariaLabel: string;
}

/**
 * Simple horizontal progress bar used for AI probability, speaker
 * similarity, and risk score on the analysis details page.
 */
export default function MetricBar({
  value,
  colorClass,
  ariaLabel,
}: MetricBarProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const pct = Math.round(clamped * 100);
  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 w-full overflow-hidden rounded-full bg-white/10"
    >
      <div className={`h-full ${colorClass}`} style={{ width: `${pct}%` }} />
    </div>
  );
}