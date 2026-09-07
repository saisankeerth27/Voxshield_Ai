import { Link } from "react-router-dom";
import { Mic, Fingerprint, Gauge, ShieldCheck } from "lucide-react";
import { useBackendHealth } from "../hooks/useBackendHealth";
import StatusBadge from "../components/StatusBadge";

const capabilities = [
  {
    icon: Mic,
    title: "AI Voice Detection",
    description:
      "Detects whether a voice sample was generated or manipulated by AI models.",
  },
  {
    icon: Fingerprint,
    title: "Speaker Verification",
    description:
      "Verifies a voice against a registered speaker profile to expose impersonation.",
  },
  {
    icon: Gauge,
    title: "Risk Assessment",
    description:
      "Fuses detection signals into a clear low, medium, or high impersonation risk score.",
  },
];

export default function LandingPage() {
  const { backendOnline, loading } = useBackendHealth();

  return (
    <div>
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="flex justify-end">
          <StatusBadge
            label={
              loading
                ? "Checking backend…"
                : backendOnline
                  ? "Backend online"
                  : "Backend offline"
            }
            variant={backendOnline ? "ok" : "idle"}
          />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 text-center">
        <div className="mb-6 flex justify-center">
          <ShieldCheck className="h-16 w-16 text-emerald-400" />
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight">
          Voice<span className="text-emerald-400">Shield</span>
        </h1>
        <p className="mt-4 text-xl text-slate-300">
          AI-Powered Voice Impersonation Detection
        </p>
        <p className="mt-2 text-sm italic text-slate-500">
          "Treat every voice as an untrusted security signal."
        </p>
        <Link
          to="/analyze"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-surface hover:bg-emerald-400 transition-colors"
        >
          <Mic className="h-5 w-5" />
          Start Voice Analysis
        </Link>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {capabilities.map((cap) => (
            <div
              key={cap.title}
              className="rounded-xl border border-white/5 bg-surface-light p-6"
            >
              <cap.icon className="h-6 w-6 text-emerald-400" />
              <h3 className="mt-4 text-lg font-semibold">{cap.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{cap.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
