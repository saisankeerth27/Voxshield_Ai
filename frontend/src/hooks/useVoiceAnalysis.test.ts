import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useVoiceAnalysis } from "./useVoiceAnalysis";
import { audioService } from "../services/audioService";

vi.mock("../services/audioService", () => ({
  audioService: {
    upload: vi.fn(),
    preprocess: vi.fn(),
    runDeepfake: vi.fn(),
    getProfileStatus: vi.fn(),
    runSpeakerVerification: vi.fn(),
    runRisk: vi.fn(),
    get: vi.fn(),
  },
}));

const mockUpload = vi.mocked(audioService.upload);
const mockPreprocess = vi.mocked(audioService.preprocess);
const mockDeepfake = vi.mocked(audioService.runDeepfake);
const mockProfileStatus = vi.mocked(audioService.getProfileStatus);
const mockSpeaker = vi.mocked(audioService.runSpeakerVerification);
const mockRisk = vi.mocked(audioService.runRisk);

function baseResponses() {
  mockUpload.mockResolvedValue({
    success: true,
    analysis_id: "u1",
    filename: "mic.webm",
    status: "UPLOADED",
    message: "ok",
    source: "MICROPHONE",
  });
  mockPreprocess.mockResolvedValue({
    success: true,
    analysis_id: "u1",
    status: "READY_FOR_ANALYSIS",
    audio: { sample_rate: 16000, channels: 1, duration_seconds: 2 },
    message: "prepared",
  });
  mockDeepfake.mockResolvedValue({
    analysis_id: "u1",
    status: "DEEPFAKE_ANALYZED",
    ai_probability: 0.91,
    real_probability: 0.09,
    predicted_class: "synthetic",
    model: { name: "wav2vec2", version: "test" },
    device: "cpu",
    processing_time_seconds: 0.1,
    message: "detected",
  });
  mockProfileStatus.mockResolvedValue({
    available: true,
    has_profile: true,
    profile: null,
    message: "profile",
  });
  mockSpeaker.mockResolvedValue({
    analysis_id: "u1",
    status: "SPEAKER_ANALYZED",
    speaker_verification_status: "VERIFIED",
    verified: true,
    similarity_score: 0.98,
    speaker_model: "ecapa",
    speaker_model_version: "test",
    speaker_processing_time: 0.2,
    speaker_device: "cpu",
    speaker_error: null,
    reference_profile_id: "p1",
    reference_name: "Speaker One",
    message: "verified",
  });
  mockRisk.mockResolvedValue({
    analysis_id: "u1",
    status: "RISK_CALCULATED",
    risk_status: "CALCULATED",
    risk_score: 0.83,
    risk_level: "HIGH",
    explanation: "high ai probability",
    recommendation: "additional verification recommended",
    risk_processing_time: 0.05,
    risk_engine_version: "1.0",
    message: "risked",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  baseResponses();
});

describe("useVoiceAnalysis microphone pipeline", () => {
  it("runs the full chain in order and marks each stage done", async () => {
    const { result } = renderHook(() => useVoiceAnalysis());

    await act(async () => {
      await result.current.runMicrophonePipeline("u1");
    });

    expect(mockPreprocess).toHaveBeenCalledWith("u1");
    expect(mockDeepfake).toHaveBeenCalledWith("u1");
    expect(mockProfileStatus).toHaveBeenCalled();
    expect(mockSpeaker).toHaveBeenCalledWith("u1");
    expect(mockRisk).toHaveBeenCalledWith("u1");

    // Order matters: risk cannot start before speaker, speaker before deepfake.
    const order = [
      ...vi.mocked(audioService.preprocess).mock.invocationCallOrder,
      ...vi.mocked(audioService.runDeepfake).mock.invocationCallOrder,
      ...vi.mocked(audioService.runSpeakerVerification).mock.invocationCallOrder,
      ...vi.mocked(audioService.runRisk).mock.invocationCallOrder,
    ];
    expect(
      order[1] > order[0] && order[2] > order[1] && order[3] > order[2],
    ).toBe(true);

    expect(result.current.prepare.phase).toBe("done");
    expect(result.current.detect.phase).toBe("done");
    expect(result.current.verify.phase).toBe("done");
    expect(result.current.risk.phase).toBe("done");

    // Final result is the real backend value — never fabricated.
    expect(result.current.risk.result?.risk_level).toBe("HIGH");
    expect(result.current.risk.result?.risk_score).toBe(0.83);
  });

  it("skips speaker verification when no profile exists, without running risk", async () => {
    mockProfileStatus.mockResolvedValue({
      available: true,
      has_profile: false,
      profile: null,
      message: "no profile",
    });
    const { result } = renderHook(() => useVoiceAnalysis());

    await act(async () => {
      await result.current.runMicrophonePipeline("u1");
    });

    expect(result.current.detect.phase).toBe("done");
    expect(result.current.verify.phase).toBe("skipped");
    expect(result.current.risk.phase).toBe("idle");
    expect(mockSpeaker).not.toHaveBeenCalled();
    expect(mockRisk).not.toHaveBeenCalled();
  });

  it("stops the chain when a stage fails and surfaces the backend error", async () => {
    mockDeepfake.mockRejectedValue(new Error("Deepfake model unavailable"));
    const { result } = renderHook(() => useVoiceAnalysis());

    await act(async () => {
      await result.current.runMicrophonePipeline("u1");
    });

    expect(result.current.prepare.phase).toBe("done");
    expect(result.current.detect.phase).toBe("error");
    expect(result.current.verify.phase).toBe("idle");
    expect(result.current.risk.phase).toBe("idle");
    expect(mockSpeaker).not.toHaveBeenCalled();
    expect(mockRisk).not.toHaveBeenCalled();
  });
});

describe("useVoiceAnalysis manual stage runs", () => {
  it("runs risk only after deepfake and speaker results exist", async () => {
    const { result } = renderHook(() => useVoiceAnalysis());

    await act(async () => {
      await result.current.runPreprocess("u1");
    });
    await act(async () => {
      await result.current.runDeepfake("u1");
    });
    await act(async () => {
      await result.current.runVerify("u1");
    });

    expect(vi.mocked(audioService.runRisk)).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.runRisk("u1");
    });
    expect(result.current.risk.phase).toBe("done");
    expect(result.current.risk.result?.risk_level).toBe("HIGH");
  });
});