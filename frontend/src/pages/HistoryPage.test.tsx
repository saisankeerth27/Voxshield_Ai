import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HistoryPage from "./HistoryPage";
import { audioService } from "../services/audioService";
import type { AudioListItem } from "../types/analysis";

vi.mock("../services/audioService", () => ({
  audioService: {
    list: vi.fn(),
    remove: vi.fn(),
  },
}));

const mockList = vi.mocked(audioService.list);

const ITEM: AudioListItem = {
  analysis_id: "analysis-9",
  filename: "phone-call.wav",
  source: "UPLOAD",
  file_size: 1024,
  status: "COMPLETED",
  ai_probability: 0.88,
  deepfake_label: "synthetic",
  speaker_verification_status: "VERIFIED",
  speaker_similarity: 0.97,
  speaker_verified: true,
  risk_status: "CALCULATED",
  risk_score: 0.81,
  risk_level: "HIGH",
  created_at: "2026-01-01T10:00:00Z",
};

describe("HistoryPage navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({
      items: [ITEM],
      page: 1,
      limit: 10,
      total: 1,
    });
  });

  it("links each row to its analysis details page", async () => {
    render(
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>,
    );

    const link = await screen.findByRole("link", { name: "View details for phone-call.wav" });
    expect(link).toHaveAttribute("href", "/analysis/analysis-9");
  });
});