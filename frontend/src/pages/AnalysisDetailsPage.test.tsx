import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AnalysisDetailsPage from "./AnalysisDetailsPage";
import { audioService } from "../services/audioService";
import type { AnalysisDetails } from "../types/analysis";

vi.mock("../services/audioService", () => ({
  audioService: {
    getDetails: vi.fn(),
    processedUrl: vi.fn((id: string) => `http://test-backend/audio/${id}/processed`),
  },
}));

vi.mock("../components/AudioWaveform", () => ({
  default: () => <div data-testid="waveform" />,
}));

const mockGetDetails = vi.mocked(audioService.getDetails);

function makeCompletedDetails(): AnalysisDetails {
  return {
    analysis_id: "analysis-1",
    status: "COMPLETED",
    source: "UPLOAD",
    created_at: "2026-01-01T10:00:00Z",
    updated_at: "2026-01-01T10:01:00Z",
    audio: {
      filename: "call-center.wav",
      file_size: 250000,
      mime_type: "audio/wav",
      duration_seconds: 4.5,
      original_sample_rate: 44100,
      original_channels: 1,
      processed_sample_rate: 16000,
      processed_channels: 1,
      processed_duration_seconds: 4.5,
    },
    deepfake: {
      status: "completed",
      ai_probability: 0.9,
      real_probability: 0.1,
      label: "synthetic",
      model: "ast-w2v2",
      model_version: "1.0",
      processing_time: 3.2,
      device: "cpu",
      error: null,
    },
    speaker: {
      status: "completed",
      similarity: 0.94,
      verified: true,
      model: "wespeaker",
      model_version: "1.0",
      processing_time: 2.1,
      device: "cpu",
      reference_name: "Reporter",
      reference_profile_id: "profile-1",
      error: null,
    },
    risk: {
      status: "completed",
      score: 0.83,
      level: "HIGH",
      explanation: "High deepfake probability raises risk.",
      recommendation: "Verify the caller through a secondary channel.",
      processing_time: 0.001,
      engine_version: "1.0",
    },
    timeline: {
      uploaded: { status: "completed", error: null, message: "Uploaded" },
      preprocessed: { status: "completed", error: null, message: "Ready" },
      deepfake: { status: "completed", error: null, message: "Done" },
      speaker: { status: "completed", error: null, message: "Done" },
      risk: { status: "completed", error: null, message: "Done" },
      completed: { status: "completed", error: null, message: "Completed" },
    },
  };
}

function renderDetails(analysisId = "analysis-1") {
  return render(
    <MemoryRouter initialEntries={[`/analysis/${analysisId}`]}>
      <Routes>
        <Route path="/analysis/:analysisId" element={<AnalysisDetailsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AnalysisDetailsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the combined details payload with stored values", async () => {
    mockGetDetails.mockResolvedValue(makeCompletedDetails());
    renderDetails();

    await screen.findByText("Analysis Details");
    expect(screen.getByText("call-center.wav")).toBeInTheDocument();
    expect(screen.getByText("90.0%")).toBeInTheDocument();
    expect(screen.getByText("10.0%")).toBeInTheDocument();
    expect(screen.getByText("Reporter")).toBeInTheDocument();
    expect(screen.getByText("HIGH")).toBeInTheDocument();
    expect(screen.getByText("Synthetic (AI-generated)")).toBeInTheDocument();
    expect(screen.getByTestId("waveform")).toBeInTheDocument();
  });

  it("links to the printable report and back to history", async () => {
    mockGetDetails.mockResolvedValue(makeCompletedDetails());
    renderDetails();

    await screen.findByText("Analysis Details");
    expect(screen.getByRole("link", { name: "Download Report" })).toHaveAttribute(
      "href",
      "/analysis/analysis-1/report",
    );
    expect(screen.getByRole("link", { name: "Back to history" })).toHaveAttribute(
      "href",
      "/history",
    );
  });

  it("shows not-performed messaging for incomplete analyses", async () => {
    const incomplete = makeCompletedDetails();
    incomplete.status = "UPLOADED";
    incomplete.deepfake.status = "not_started";
    incomplete.deepfake.ai_probability = null;
    incomplete.speaker.status = "not_started";
    incomplete.risk.status = "not_started";
    mockGetDetails.mockResolvedValue(incomplete);

    renderDetails();
    await screen.findByText("Analysis Details");
    expect(
      screen.getByText("Deepfake detection was not performed for this record."),
    ).toBeInTheDocument();
    expect(screen.getByText("Speaker verification was not performed.")).toBeInTheDocument();
    expect(
      screen.getByText("Risk assessment was not performed."),
    ).toBeInTheDocument();
  });

  it("shows an explicit not-found message for deleted analyses", async () => {
    mockGetDetails.mockRejectedValue({ response: { status: 404 } });
    renderDetails("missing");

    await screen.findByText(/Analysis not found/);
  });

  it("shows a readable error when the backend cannot be reached", async () => {
    mockGetDetails.mockRejectedValue(new Error("network down"));
    renderDetails();

    await screen.findByText("Unable to load analysis details.");
  });
});