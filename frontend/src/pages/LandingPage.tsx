import { Link } from "react-router-dom";
import {
  Fingerprint,
  Gauge,
  Mic,
  ScanLine,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { useBackendHealth } from "../hooks/useBackendHealth";
import StatusBadge from "../components/StatusBadge";

const steps = [
  {
    icon: Mic,
    title: "1. Analyze Voice",
    description: "Upload an audio file or record from your microphone.",
  },
  {
    icon: Fingerprint,
    title: "2. Verify Speaker",
    description: "Compare the voice against a registered speaker profile.",
  },
  {
    icon: Gauge,
    title: "3. Assess Risk",
    description: "Get a clear LOW, MEDIUM, or HIGH impersonation risk.",
  },
];

const pipeline = [
  {
    title: "AI Voice Detection",
    description: "Identifies signals associated with AI-generated speech.",
  },
  {
    title: "Speaker Verification",
    description: "Measures similarity with the registered reference speaker.",
  },
  {
    title: "Risk Fusion",
    description: "Combines available signals into a simple risk assessment.",
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

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-4 text-center">
        <div className="mb-6 flex justify-center">
          <ShieldCheck className="h-16 w-16 text-emerald-400" />
        </div>
        <h1 className="text-5xl font-extrabold tracking-tight">
          Voice<span className="text-emerald-400">Shield</span>
        </h1>
        <p className="mt-4 text-xl text-slate-300">
          AI-Powered Voice Cloning &amp; Impersonation Attack Detection
        </p>
        <p className="mx-auto mt-4 max-w-xl text-base text-slate-400">
          Analyze a voice recording to detect potential AI-generated speech
          and compare it against a registered speaker profile.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/analyze"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-surface hover:bg-emerald-400 transition-colors sm:w-auto"
          >
            <ScanLine className="h-5 w-5" />
            Analyze Voice
          </Link>
          <Link
            to="/profile"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/40 px-6 py-3 font-semibold text-emerald-400 hover:bg-emerald-500/10 transition-colors sm:w-auto"
          >
            <Upload className="h-5 w-5" />
            Create Speaker Profile
          </Link>
        </div>
      </section>

      {/* 3-step explanation */}
      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.title}
              className="rounded-xl border border-white/5 bg-surface-light p-6"
            >
              <step.icon className="h-6 w-6 text-emerald-400" />
              <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How VoiceShield Works */}
      <section className="mx-auto max-w-3xl px-4 pb-20">
        <h2 className="text-center text-2xl font-bold">How VoiceShield Works</h2>
        <div className="mt-6 rounded-xl border border-white/5 bg-surface-light p-6">
          <ol className="space-y-2 text-sm text-slate-300">
            <li className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">
                1
              </span>
              Audio Input
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">
                2
              </span>
              Audio Preprocessing
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">
                3
              </span>
              AI Voice Detection + Speaker Verification
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">
                4
              </span>
              Risk Fusion
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">
                5
              </span>
              Risk Assessment
            </li>
          </ol>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {pipeline.map((item) => (
            <div key={item.title} className="rounded-xl border border-white/5 bg-surface-light p-4">
              <h3 className="text-sm font-semibold text-slate-200">{item.title}</h3>
              <p className="mt-1 text-xs text-slate-400">{item.description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}