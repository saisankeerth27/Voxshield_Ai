import { beforeEach, describe, expect, it, vi } from "vitest";
import { audioService } from "./audioService";
import { api } from "./api";

vi.mock("./api", () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  },
  API_BASE_URL: "http://test-backend",
}));

const mockPost = vi.mocked(api.post);

const APPROVED_RESPONSE = {
  success: true,
  analysis_id: "abc-123",
  filename: "mic.webm",
  status: "UPLOADED",
  message: "Audio uploaded successfully",
  source: "MICROPHONE",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPost.mockResolvedValue({ data: APPROVED_RESPONSE });
});

describe("audioService.upload source marking", () => {
  it("sends source=MICROPHONE for recorded audio", async () => {
    const blob = new Blob(["fake-opus"], { type: "audio/webm" });
    const file = new File([blob], "microphone-recording.webm", {
      type: "audio/webm",
    });

    const result = await audioService.upload(file, "MICROPHONE");

    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, formData] = mockPost.mock.calls[0] as [
      string,
      FormData,
      unknown,
    ];
    expect(url).toBe("/audio/upload");
    expect((formData.get("file") as File).name).toBe("microphone-recording.webm");
    expect(formData.get("source")).toBe("MICROPHONE");
    expect(result.source).toBe("MICROPHONE");
  });

  it("defaults to source=UPLOAD for file uploads", async () => {
    const file = new File(["x"], "voice.wav", { type: "audio/wav" });

    await audioService.upload(file);

    const [, formData] = mockPost.mock.calls[0] as [string, FormData, unknown];
    expect(formData.get("source")).toBe("UPLOAD");
  });
});