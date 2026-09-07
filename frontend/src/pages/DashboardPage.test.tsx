import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "./DashboardPage";
import { audioService } from "../services/audioService";
import type { AudioAnalysis } from "../types/analysis";

vi.mock("../services/healthApi", () => ({
  default: {
    getStatus: vi.fn().mockResolvedValue({ status: "healthy" }),
  },
}));

vi.mock("../services/audioService", () => ({
  audioService: {
    list: vi.fn(),
    get: vi.fn(),
  },
}));

const RECORD: AudioAnalysis = {
  analysis_id: "analysis-7",
  filename: "recorded.webm",
  source: "MICROPHONE",
  file_size: 4096,
  mime_type: "audio/webm",
  duration_seconds: 5,
  status: "COMPLETED",
  original_sample_rate: 48000,
  original_channels: 1,
  processed_sample_rate: 16000,
  processed_channels: 1,
  processed_duration_seconds: 5,
  processed_filename: "recorded.wav",
  preprocessing_error: null,
  ai_probability: 0.93,
  real_probability: 0.07,
  deepfake_label: "synthetic",
  deepfake_model: "ast-w2v2",
  deepfake_model_version: "1.0",
  deepfake_processing_time: 2.4,
  deepfake_device: "cpu",
  deepfake_error: null,
  speaker_verification_status: "VERIFIED",
  speaker_similarity: 0.96,
  speaker_verified: true,
  speaker_model: "wespeaker",
  speaker_model_version: "1.0",
  speaker_processing_time: 1.8,
  speaker_device: "cpu",
  speaker_error: null,
  reference_profile_id: "profile-1",
  reference_name: "Reporter",
  risk_status: "CALCULATED",
  risk_score: 0.9,
  risk_level: "HIGH",
  risk_explanation: "Very high deepfake signal.",
  risk_recommendation: "Verify through a secondary channel.",
  risk_processing_time: 0.01,
  risk_engine_version: "1.0",
  created_at: "2026-01-01T10:00:00Z",
  updated_at: "2026-01-01T10:05:00Z",
};

describe("DashboardPage navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(audioService.list).mockResolvedValue({
      items: [{ analysis_id: RECORD.analysis_id } as AudioAnalysis],
      page: 1,
      limit: 10,
      total: 1,
    });
    vi.mocked(audioService.get).mockResolvedValue(RECORD);
  });

  it("links the latest analysis to its full details page", async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    const link = await screen.findByRole("link", { name: "Full Details" });
    expect(link).toHaveAttribute("href", "/analysis/analysis-7");
  });
});