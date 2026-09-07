import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Fingerprint,
  Loader2,
  Mic,
  Trash2,
  TriangleAlert,
  Upload,
  UserRound,
} from "lucide-react";
import { audioService } from "../services/audioService";
import { getApiErrorMessage } from "../utils/apiError";
import { formatTimestamp } from "../utils/format";
import FileDropzone from "../components/FileDropzone";
import useRecorder from "../hooks/useRecorder";
import type { SpeakerProfile } from "../types/analysis";

type RegistrationState = "idle" | "registering" | "success" | "error";

function sourceLabel(recordingName: string | null): string {
  return recordingName ?? "microphone-recording";
}

/**
 * Create a reference voice and manage the registered speaker profile.
 * Only the voiceprint embedding is stored — the raw recording is deleted
 * after processing.
 */
export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<SpeakerProfile[]>([]);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<"upload" | "record">("upload");
  const [registration, setRegistration] = useState<RegistrationState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const recorder = useRecorder();

  // Promote a finished recording into the file used for registration.
  useEffect(() => {
    if (source !== "record") return;
    const recording = recorder.recording;
    if (!recording || !recording.blob || recorder.status !== "stopped") return;
    const recordedFile = new File(
      [recording.blob],
      recording.name || "microphone-recording",
      { type: recording.blob.type || "audio/webm" },
    );
    setFile((prev) =>
      prev && prev.name === recordedFile.name && prev.size === recordedFile.size
        ? prev
        : recordedFile,
    );
  }, [recorder.recording, recorder.status, source]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await audioService.getProfiles();
      setProfiles(result.items);
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load the speaker profiles."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasProfile = profiles.length > 0;

  const clearReference = () => {
    setFile(null);
    recorder.clear();
  };

  const switchSource = (next: "upload" | "record") => {
    setSource(next);
    setFile(null);
    if (next === "record") {
      // pause any ongoing recording when switching away
      recorder.clear();
    }
  };

  const register = async () => {
    if (!file) return;
    setRegistration("registering");
    setProgress(0);
    setError(null);
    setSuccessMessage(null);
    try {
      await audioService.registerProfile(
        name.trim() || "Registered speaker",
        file,
        setProgress,
      );
      setRegistration("success");
      setSuccessMessage("Profile Created Successfully");
      setName("");
      setFile(null);
      recorder.clear();
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
        <h1 className="text-2xl font-bold">Speaker Profile</h1>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        Create a reference voice so speaker verification can compare live
        recordings against a known identity.
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

      {/* Create reference voice */}
      <div className="mt-8 rounded-xl border border-white/5 bg-surface-light p-6">
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-emerald-400" />
          <h2 className="font-semibold">Create Reference Voice</h2>
        </div>

        <div className="mt-4 space-y-4">
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

          {/* Upload or record */}
          <div className="flex items-center gap-1 rounded-lg bg-surface p-1">
            <button
              type="button"
              onClick={() => switchSource("upload")}
              aria-pressed={source === "upload"}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                source === "upload"
                  ? "bg-emerald-500 text-surface"
                  : "text-slate-300 hover:text-slate-100"
              }`}
            >
              <Upload className="h-4 w-4" />
              Upload Voice
            </button>
            <button
              type="button"
              onClick={() => switchSource("record")}
              aria-pressed={source === "record"}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                source === "record"
                  ? "bg-emerald-500 text-surface"
                  : "text-slate-300 hover:text-slate-100"
              }`}
            >
              <Mic className="h-4 w-4" />
              Record Voice
            </button>
          </div>

          {source === "upload" ? (
            <div>
              <FileDropzone
                onFileSelected={setFile}
                disabled={registration === "registering"}
              />
              {!file ? (
                <p className="mt-2 text-xs text-slate-500">
                  Tip: 10–20 seconds of clean speech gives the most reliable
                  reference.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-surface p-4">
              {!recorder.support.supported ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{recorder.support.reason}</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {!recorder.isRecording ? (
                    <button
                      type="button"
                      onClick={() => void recorder.start()}
                      disabled={registration === "registering"}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/40 px-4 py-2.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                    >
                      <Mic className="h-4 w-4" />
                      Start Recording
                    </button>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm text-red-400">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                        Recording… {recorder.elapsedSeconds}s /{" "}
                        {recorder.maxDurationSeconds}s
                      </span>
                      <button
                        type="button"
                        onClick={recorder.stop}
                        className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-400 transition-colors"
                      >
                        Stop
                      </button>
                    </div>
                  )}
                  {recorder.error ? (
                    <p className="text-xs text-red-400">{recorder.error}</p>
                  ) : null}
                  {recorder.recording ? (
                    <p className="text-xs text-slate-400">
                      Reference:{" "}
                      <span className="font-medium text-slate-200">
                        {sourceLabel(recorder.recording.name)} (
                        {recorder.recording.durationSeconds}s)
                      </span>
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {file ? (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-surface px-3 py-2 text-xs text-slate-300">
              <span className="truncate">
                Reference:{" "}
                <span className="font-medium">{file.name}</span> (
                {(file.size / 1024).toFixed(1)} KB)
              </span>
              <button
                type="button"
                onClick={clearReference}
                className="shrink-0 font-medium text-red-400 hover:underline"
              >
                Remove
              </button>
            </div>
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
            <UserRound className="h-4 w-4" />
            {hasProfile ? "Replace Profile" : "Create Profile"}
          </button>
        </div>
      </div>

      {/* Registered reference voices */}
      <div className="mt-6 rounded-xl border border-white/5 bg-surface-light p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-emerald-400" />
            <h2 className="font-semibold">Registered Reference Voices</h2>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
            <span className="text-sm">Loading profiles…</span>
          </div>
        ) : profiles.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">
            No speaker profiles yet. Create a reference profile to enable
            speaker verification.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {profiles.map((profile) => (
              <li
                key={profile.profile_id}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-surface p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-200">
                    {profile.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Created: {formatTimestamp(profile.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => void remove(profile.profile_id)}
                  className="flex shrink-0 items-center gap-1.5 rounded-md border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}