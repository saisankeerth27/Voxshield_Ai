import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReportPage from "./ReportPage";
import { audioService } from "../services/audioService";

vi.mock("../services/audioService", () => ({
  audioService: {
    getReport: vi.fn(),
    reportUrl: vi.fn((id: string) => `http://test-backend/analysis/${id}/report`),
  },
}));

const mockGetReport = vi.mocked(audioService.getReport);

function renderReport(analysisId = "analysis-1") {
  return render(
    <MemoryRouter initialEntries={[`/analysis/${analysisId}/report`]}>
      <Routes>
        <Route path="/analysis/:analysisId/report" element={<ReportPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ReportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the backend HTML report inside the print frame", async () => {
    mockGetReport.mockResolvedValue(
      "<html><body><h1>VoiceShield Analysis Report</h1><p>analysis-1</p></body></html>",
    );
    renderReport();

    await waitFor(() => {
      const frame = screen.getByTitle("Analysis report");
      expect(frame).toBeInTheDocument();
      expect(frame.getAttribute("srcdoc")).toContain("VoiceShield Analysis Report");
    });
  });

  it("provides a print/save-to-PDF action and a back link", async () => {
    mockGetReport.mockResolvedValue("<html><body>report</body></html>");
    renderReport();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Print \/ Save as PDF/ })).toBeEnabled();
    });
    expect(
      screen.getByRole("link", { name: "Back to details" }),
    ).toHaveAttribute("href", "/analysis/analysis-1");
  });

  it("shows an error message when the report cannot be loaded", async () => {
    mockGetReport.mockRejectedValue(new Error("network down"));
    renderReport();

    await screen.findByText("Unable to load the analysis report.");
    expect(screen.getAllByRole("link", { name: "Back to details" })).toHaveLength(1);
  });
});