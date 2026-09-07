interface StatusBadgeProps {
  label: string;
  variant?: "ok" | "warn" | "danger" | "idle";
}

const variantStyles: Record<NonNullable<StatusBadgeProps["variant"]>, string> = {
  ok: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  warn: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  danger: "bg-red-500/15 text-red-400 border-red-500/30",
  idle: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

/**
 * Small colored status chip for risk levels and connection states.
 */
export default function StatusBadge({
  label,
  variant = "idle",
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${variantStyles[variant]}`}
    >
      {label}
    </span>
  );
}
