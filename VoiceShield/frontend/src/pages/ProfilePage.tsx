import { Fingerprint } from "lucide-react";

/**
 * Voice profile page. Speaker profile registration comes in a later phase.
 */
export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center gap-3">
        <Fingerprint className="h-6 w-6 text-emerald-400" />
        <h1 className="text-2xl font-bold">Voice Profile</h1>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        Register a reference voice to verify speakers against.
      </p>

      <div className="mt-8 rounded-xl border border-white/5 bg-surface-light p-10 text-center">
        <Fingerprint className="mx-auto h-10 w-10 text-slate-600" />
        <p className="mt-4 text-lg font-semibold text-slate-300">
          No voice profile registered
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Voice profile enrollment is implemented in a later phase.
        </p>
      </div>
    </div>
  );
}