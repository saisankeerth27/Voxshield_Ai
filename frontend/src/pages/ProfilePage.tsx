import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Fingerprint,
  Loader2,
  Trash2,
  TriangleAlert,
  Upload,
  UserRound,
} from "lucide-react";
import { audioService } from "../services/audioService";
import { getApiErrorMessage } from "../utils/apiError";
import { formatDuration, formatTimestamp } from "../utils/format";
import FileDropzone from "../components/FileDropzone";
import StatusBadge from "../components/StatusBadge";
import type { SpeakerProfile } from "../types/analysis";

type RegistrationState = "idle" | "registering" | "success" | "error";

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<SpeakerProfile[]>([]);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [registration, setRegistration] = useState<RegistrationState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await audioService.getProfiles();
      setProfiles(result.items);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load the speaker profile."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasProfile = profiles.length > 0;
  const activeProfile = profiles[0] ?? null;

  const register = async () => {
    if (!file) return;
    setRegistration("registering");
    setProgress(0);
    setError(null);
    setSuccessMessage(null);
    try {
      await audioService.registerProfile(name.trim() || "Registered speaker", file, setProgress);
      setRegistration("success");
      setSuccessMessage("Voice profile registered. The reference recording was converted to a voiceprint and the original file was deleted.");
      setName("");
      setFile(null);
      await refresh();
    } catch (err) {
      setRegistration("error");
      setError(getApiErrorMessage(err, "Could not register the speaker profile."));
    }
  };

  const remove = async (profileId: string) => {
    setError(null);
    try {
      await audioService.deleteProfile(profileId);
      setSuccessMessage("Voice profile deleted. Its voiceprint was removed.");
      await refresh();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not delete the profile."));
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center gap-3">
        <Fingerprint className="h-6 w-6 text-emerald-400" />
        <h1 className="text-2xl font-bold">Voice Profile</h1>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        Register a reference voice to verify speakers against. Only the
        voiceprint embedding is stored - the raw recording is deleted once
        the profile is created.
      </p>

      {error ? (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      ) : null}

      {successMessage ? (
        <div className="mt-6 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="break-words">{successMessage}</span>
        </div>
      ) : null}

      {/* Current profile */}
      <div className="mt-8 rounded-xl border border-white/5 bg-surface-light p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-emerald-400" />
            <h2 className="font-semibold">Registered speaker</h2>
          </div>
          <StatusBadge
            label={loading ? "loading" : hasProfile ? "registered" : "not registered"}
            variant={hasProfile ? "ok" : "idle"}
          />
        </div>

        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
            <span className="text-sm">Loading profile…</span>
          </div>
        ) : !activeProfile ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-600 p-6 text-center">
            <Fingerprint className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-3 text-sm text-slate-400">
              No voice profile registered yet.
            </p>
          </div>
        ) : (
          <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-surface-light/60 p-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-slate-500">Name</dt>
              <dd className="mt-0.5 font-medium text-slate-200">
                {activeProfile.name}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Voiceprint dim</dt>
              <dd className="mt-0.5 font-mono text-slate-300">
                {activeProfile.embedding_dim}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Reference length</dt>
              <dd className="mt-0.5 text-slate-300">
                {activeProfile.duration_seconds
                  ? formatDuration(activeProfile.duration_seconds)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Registered</dt>
              <dd className="mt-0.5 text-slate-300">
                {formatTimestamp(activeProfile.created_at)}
              </dd>
            </div>
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-xs text-slate-500">Model</dt>
              <dd className="mt-0.5 truncate font-mono text-[11px] text-slate-300">
                {activeProfile.model_name} · {activeProfile.model_version}
              </dd>
            </div>
          </dl>
        )}
      </div>

      {/* Registration panel */}
      <div className="mt-6 rounded-xl border border-white/5 bg-surface-light p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-emerald-400" />
            <h2 className="font-semibold">
              {hasProfile ? "Replace voice profile" : "Register voice profile"}
            </h2>
          </div>
        </div>

        <div className="mt-3 space-y-3">
          <div>
            <label
              htmlFor="speaker-name"
              className="block text-xs font-medium text-slate-400"
            >
              Speaker name
            </label>
            <input
              id="speaker-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Executive — Test Caller"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-surface px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <FileDropzone
            onFileSelected={setFile}
            disabled={registration === "registering"}
          />

          {file ? (
            <p className="text-xs text-slate-500">
              Reference:{" "}
              <span className="font-medium text-slate-300">{file.name}</span> (
              {(file.size / 1024).toFixed(1)} KB)
            </p>
          ) : null}

          {registration === "registering" ? (
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-300">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                  Extracting voiceprint…
                </span>
                <span className="text-slate-400">
                  {Math.round(progress * 100)}%
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </div>
          ) : null}

          {registration === "error" ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium">Registration failed</p>
                <p className="mt-0.5 break-words text-xs">
                  {error ?? "Please try a different reference recording."}
                </p>
              </div>
            </div>
          ) : null}

          <button
            onClick={() => void register()}
            disabled={!file || registration === "registering"}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-surface hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 enabled:transition-colors"
          >
            <Upload className="h-4 w-4" />
            {hasProfile ? "Replace Profile" : "Register Profile"}
          </button>
        </div>
      </div>

      {activeProfile ? (
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => void remove(activeProfile.profile_id)}
            className="flex items-center gap-2 rounded-lg border border-red-500/40 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete Voice Profile
          </button>
        </div>
      ) : null}
    </div>
  );
}