import { describe, expect, it } from "vitest";
import {
  formatLabelFromMime,
  validateAudioFile,
} from "./audioValidation";

describe("webm microphone recordings", () => {
  it("accepts a .webm opus-encoded recording", () => {
    const blob = new Blob(["mic-audio"], { type: "audio/webm;codecs=opus" });
    const file = new File([blob], "microphone-recording.webm", {
      type: "audio/webm;codecs=opus",
    });

    const result = validateAudioFile(file);
    expect(result.valid).toBe(true);
  });

  it("formats webm MIME labels into a readable value", () => {
    expect(formatLabelFromMime("audio/webm")).toBe("webm");
    expect(formatLabelFromMime("audio/webm;codecs=opus")).toBe("webm");
  });

  it("rejects non-audio uploads as before", () => {
    const file = new File(["nope"], "scan.pdf", { type: "application/pdf" });
    const result = validateAudioFile(file);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Unsupported file type");
  });
});