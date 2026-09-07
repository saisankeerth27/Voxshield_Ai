import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RiskResultCard from "./RiskResultCard";

describe("RiskResultCard", () => {
  it("renders real backend values and marks the microphone source", () => {
    render(
      <RiskResultCard
        aiProbability={0.91}
        speakerSimilarity={0.98}
        riskScore={0.83}
        riskLevel="HIGH"
        explanation="Deepfake confidence is very high."
        recommendation="Verify the caller through a secondary channel."
        analysisTimeSeconds={12.3}
        source="MICROPHONE"
      />,
    );

    expect(screen.getByText("Voice Security Result")).toBeInTheDocument();
    expect(screen.getByText("91%")).toBeInTheDocument();
    expect(screen.getByText("98%")).toBeInTheDocument();
    expect(screen.getByText("83%")).toBeInTheDocument();
    expect(screen.getByText("HIGH")).toBeInTheDocument();
    expect(screen.getByText("Microphone")).toBeInTheDocument();
    expect(screen.getByText("12.3 seconds")).toBeInTheDocument();
  });

  it("shows Upload for file-based analysis", () => {
    render(
      <RiskResultCard
        aiProbability={0.2}
        speakerSimilarity={0.5}
        riskScore={0.3}
        riskLevel="LOW"
        explanation={null}
        recommendation={null}
        analysisTimeSeconds={null}
        source="UPLOAD"
      />,
    );

    expect(screen.getByText("Upload")).toBeInTheDocument();
  });
});