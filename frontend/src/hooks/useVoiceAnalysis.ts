import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioAnalysis, AudioUploadResponse } from "../types/analysis";
import { audioService } from "../services/audioService";
import { getApiErrorMessage } from "../utils/apiError";
import { useUploadFlow, type UploadFlow } from "./useUploadFlow";
import type {
  AudioPreprocessResponse,
  DeepfakeRunResponse,
  RiskCalculateResponse,
  SpeakerProfileStatusResponse,
  SpeakerVerifyResponse,
} from "../types/analysis";

/** Lifecycle of a single pipeline stage, driven by real backend responses. */
export type StepPhase = "idle" | "running" | "done" | "error" | "skipped";

export interface PrepareStep {
  phase: StepPhase;
  result: AudioPreprocessResponse | null;
  error: string | null;
}

export interface DetectStep {
  phase: StepPhase;
  result: DeepfakeRunResponse | null;
  error: string | null;
}

export interface VerifyStep {
  phase: StepPhase;
  result: SpeakerVerifyResponse | null;
  error: string | null;
  profile: SpeakerProfileStatusResponse | null;
}

export interface RiskStep {
  phase: StepPhase;
  result: RiskCalculateResponse | null;
  error: string | null;
}

const INITIAL_PREPARE: PrepareStep = { phase: "idle", result: null, error: null };
const INITIAL_DETECT: DetectStep = { phase: "idle", result: null, error: null };
const INITIAL_VERIFY: VerifyStep = {
  phase: "idle",
  result: null,
  error: null,
  profile: null,
};
const INITIAL_RISK: RiskStep = { phase: "idle", result: null, error: null };

/** Build a risk response from a stored analysis record (no re-inference). */
function riskFromRecord(record: AudioAnalysis): RiskCalculateResponse {
  return {
    analysis_id: record.analysis_id,
    status: record.status,
    risk_status: record.risk_status ?? "CALCULATED",
    risk_score: record.risk_score,
    risk_level: record.risk_level,
    explanation: record.risk_explanation,
    recommendation: record.risk_recommendation,
    risk_processing_time: record.risk_processing_time,
    risk_engine_version: record.risk_engine_version,
    message: "Loaded from stored analysis",
  };
}

export function riskResultFromRecord(record: AudioAnalysis): RiskCalculateResponse {
  return riskFromRecord(record);
}

export interface VoiceAnalysis {
  /** Upload state machine (source-aware). */
  upload: UploadFlow;
  prepare: PrepareStep;
  detect: DetectStep;
  verify: VerifyStep;
  risk: RiskStep;
  loadedRecord: AudioAnalysis | null;
  /** The analysis being acted on, when an upload or stored record exists. */
  analysisId: string | null;
  runPreprocess: (analysisId?: string) => Promise<boolean>;
  runDeepfake: (analysisId?: string) => Promise<boolean>;
  runVerify: (analysisId?: string) => Promise<boolean>;
  runRisk: (analysisId?: string) => Promise<boolean>;
  /** Refreshes and returns the stored speaker profile status. */
  refreshProfileStatus: () => Promise<SpeakerProfileStatusResponse | null>;
  /**
   * Near-real-time microphone flow: once an analysis is uploaded, runs
   * preprocess -> deepfake -> speaker (only when a profile exists) -> risk,
   * updating each stage as the backend actually completes it. Returns early
   * on the first failure and never fabricates a completed stage.
   */
  runMicrophonePipeline: (analysisId?: string) => Promise<void>;
  /** Loads a stored record for `?id=` deep links. */
  loadFromRecord: (id: string) => Promise<void>;
  clear: () => void;
}

/**
 * Central analysis state for the /analyze page: the upload flow plus the
 * four post-upload stages (preprocess / deepfake / speaker / risk). Kept
 * deliberately small — no Redux or global store.
 */
export function useVoiceAnalysis(): VoiceAnalysis {
  const upload = useUploadFlow();
  const [prepare, setPrepare] = useState<PrepareStep>(INITIAL_PREPARE);
  const [detect, setDetect] = useState<DetectStep>(INITIAL_DETECT);
  const [verify, setVerify] = useState<VerifyStep>(INITIAL_VERIFY);
  const [risk, setRisk] = useState<RiskStep>(INITIAL_RISK);
  const [loadedRecord, setLoadedRecord] = useState<AudioAnalysis | null>(null);
  const analysisIdRef = useRef<string | null>(null);

  const analysisId = upload.uploadResult?.analysis_id ?? null;

  useEffect(() => {
    analysisIdRef.current = analysisId;
  }, [analysisId]);

  // A new upload invalidates all downstream stages.
  useEffect(() => {
    setPrepare(INITIAL_PREPARE);
    setDetect(INITIAL_DETECT);
    setVerify(INITIAL_VERIFY);
    setRisk(INITIAL_RISK);
    setLoadedRecord(null);
  }, [analysisId]);

  const refreshProfileStatus = useCallback(async () => {
    try {
      const profile = await audioService.getProfileStatus();
      setVerify((prev) => ({ ...prev, profile }));
      return profile;
    } catch {
      setVerify((prev) => ({ ...prev, profile: null }));
      return null;
    }
  }, []);

  const runPreprocess = useCallback(async (targetId?: string): Promise<boolean> => {
    const id = targetId ?? analysisIdRef.current;
    if (!id) return false;
    setPrepare({ phase: "running", result: null, error: null });
    try {
      const result = await audioService.preprocess(id);
      setPrepare({ phase: "done", result, error: null });
      return true;
    } catch (err) {
      setPrepare({
        phase: "error",
        result: null,
        error: getApiErrorMessage(err, "Preprocessing failed"),
      });
      return false;
    }
  }, []);

  const runDeepfake = useCallback(async (targetId?: string): Promise<boolean> => {
    const id = targetId ?? analysisIdRef.current;
    if (!id) return false;
    setDetect({ phase: "running", result: null, error: null });
    try {
      const result = await audioService.runDeepfake(id);
      setDetect({ phase: "done", result, error: null });
      return true;
    } catch (err) {
      setDetect({
        phase: "error",
        result: null,
        error: getApiErrorMessage(err, "Deepfake detection failed"),
      });
      return false;
    }
  }, []);

  const runVerify = useCallback(
    async (targetId?: string): Promise<boolean> => {
      const id = targetId ?? analysisIdRef.current;
      if (!id) return false;
      setVerify((prev) => ({ ...prev, phase: "running", result: null, error: null }));
      try {
        const result = await audioService.runSpeakerVerification(id);
        setVerify((prev) => ({
          ...prev,
          phase: "done",
          result,
          error: null,
          profile: prev.profile,
        }));
        void refreshProfileStatus();
        return true;
      } catch (err) {
        const message = getApiErrorMessage(err, "Speaker verification failed");
        setVerify((prev) => ({ ...prev, phase: "error", result: null, error: message }));
        return false;
      }
    },
    [refreshProfileStatus],
  );

  const runRisk = useCallback(async (targetId?: string): Promise<boolean> => {
    const id = targetId ?? analysisIdRef.current;
    if (!id) return false;
    setRisk({ phase: "running", result: null, error: null });
    try {
      const result = await audioService.runRisk(id);
      setRisk({ phase: "done", result, error: null });
      return true;
    } catch (err) {
      setRisk({
        phase: "error",
        result: null,
        error: getApiErrorMessage(err, "Risk assessment failed"),
      });
      return false;
    }
  }, []);

  const runMicrophonePipeline = useCallback(
    async (targetId?: string): Promise<void> => {
      const id = targetId ?? analysisIdRef.current;
      if (!id) return;

      const prepared = await runPreprocess(id);
      if (!prepared) return;

      const detected = await runDeepfake(id);
      if (!detected) return;

      const profile = await refreshProfileStatus();
      if (!profile?.has_profile) {
        // No profile yet: speaker impersonation verification cannot run.
        // The stage is marked "skipped" (not done) so the UI shows the
        // dedicated unavailable message and risk never claims a result.
        setVerify((prev) => ({ ...prev, phase: "skipped" }));
        return;
      }

      const verified = await runVerify(id);
      if (!verified) return;

      await runRisk(id);
    },
    [runPreprocess, runDeepfake, refreshProfileStatus, runVerify, runRisk],
  );

  const loadFromRecord = useCallback(async (id: string): Promise<void> => {
    const record = await audioService.get(id);
    setLoadedRecord(record);
    setPrepare({
      phase: record.processed_filename ? "done" : "idle",
      result: null,
      error: null,
    });
    setDetect({
      phase: record.ai_probability !== null ? "done" : "idle",
      result: null,
      error: null,
    });
    setVerify({
      phase: record.speaker_similarity !== null ? "done" : "idle",
      result: null,
      error: null,
      profile: null,
    });
    setRisk(
      record.risk_level
        ? { phase: "done", result: riskFromRecord(record), error: null }
        : INITIAL_RISK,
    );
  }, []);

  const clear = useCallback(() => {
    upload.clear();
    setPrepare(INITIAL_PREPARE);
    setDetect(INITIAL_DETECT);
    setVerify(INITIAL_VERIFY);
    setRisk(INITIAL_RISK);
    setLoadedRecord(null);
  }, [upload]);

  return {
    upload,
    prepare,
    detect,
    verify,
    risk,
    loadedRecord,
    analysisId,
    runPreprocess,
    runDeepfake,
    runVerify,
    runRisk,
    refreshProfileStatus,
    runMicrophonePipeline,
    loadFromRecord,
    clear,
  };
}

export type { AudioUploadResponse };