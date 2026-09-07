import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  icon?: ReactNode;
  status?: "ok" | "warn" | "danger" | "idle";
}

const statusStyles: Record<NonNullable<MetricCardProps["status"]>, string> = {
  ok: "text-emerald-400",
  warn: "text-amber-400",
  danger: "text-red-400",
  idle: "text-slate-300",
};

/**
 * Reusable metric card used on the dashboard. Displays a placeholder value
 * with a color-coded status. Intentionally shows idle/placeholder data at
 * this phase — no fake ML predictions.
 */
export default function MetricCard({
  label,
  value,
  unit,
  icon,
  status = "idle",
}: MetricCardProps) {
  return (
    <div className="rounded-xl border border-white/5 bg-surface-light p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        {icon ? (
          <span className="text-slate-500">{icon}</span>
        ) : (
          <span className="h-2 w-2 rounded-full bg-slate-600" />
        )}
      </div>
      <div className={`mt-3 flex items-baseline gap-1 ${statusStyles[status]}`}>
        <span className={`font-bold ${value.length > 8 ? "text-xl" : "text-3xl"}`}>{value}</span>
        {unit ? <span className="text-sm">{unit}</span> : null}
      </div>
    </div>
  );
}
