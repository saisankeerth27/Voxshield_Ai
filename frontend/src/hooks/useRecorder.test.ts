import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRecorderSupport,
  MAX_RECORDING_SECONDS,
  useRecorder,
} from "../hooks/useRecorder";

function makeStream() {
  const stop = vi.fn();
  return {
    getTracks: () => [{ stop }],
  } as unknown as MediaStream;
}

class FakeMediaRecorder {
  static isTypeSupported = vi.fn(() => true);
  state: RecordingState = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(_stream: MediaStream, options?: { mimeType?: string }) {
    if (options?.mimeType) {
      this.mimeType = options.mimeType;
    }
  }

  start(): void {
    this.state = "recording";
  }

  stop(): void {
    this.state = "inactive";
    queueMicrotask(() => {
      this.ondataavailable?.({
        data: new Blob(["some-audio-bytes"], { type: this.mimeType }),
      });
      this.onstop?.();
    });
  }
}

function stubRecorderBrowser() {
  (FakeMediaRecorder.isTypeSupported as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
  Object.defineProperty(window, "MediaRecorder", {
    configurable: true,
    writable: true,
    value: FakeMediaRecorder,
  });
}

let getUserMediaMock: ReturnType<typeof vi.fn>;

function stubGetUserMedia() {
  getUserMediaMock = vi.fn(() => Promise.resolve(makeStream()));
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: getUserMediaMock },
  });
}

function removeMediaDevices() {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: undefined,
  });
}

let originalMediaDevices: unknown;
const mediaRecorderDescriptor = Object.getOwnPropertyDescriptor(
  window,
  "MediaRecorder",
);

beforeEach(() => {
  vi.useFakeTimers();
  originalMediaDevices = navigator.mediaDevices;
  stubRecorderBrowser();
  stubGetUserMedia();
});

afterEach(() => {
  vi.useRealTimers();
  delete (window as any)["MediaRecorder"];
  if (mediaRecorderDescriptor) {
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: mediaRecorderDescriptor.value,
      writable: mediaRecorderDescriptor.writable,
    });
  }
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: originalMediaDevices,
  });
  vi.restoreAllMocks();
});

describe("recorder support detection", () => {
  it("reports supported on modern browsers", () => {
    stubRecorderBrowser();
    stubGetUserMedia();
    expect(getRecorderSupport()).toEqual({ supported: true, reason: null });
  });

  it("reports unsupported when mediaDevices is missing", () => {
    stubRecorderBrowser();
    removeMediaDevices();
    const support = getRecorderSupport();
    expect(support.supported).toBe(false);
    expect(support.reason).toContain("not supported in this browser");
  });

  it("reports unsupported when MediaRecorder is missing", () => {
    stubGetUserMedia();
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: undefined,
    });
    const support = getRecorderSupport();
    expect(support.supported).toBe(false);
    expect(support.reason).toContain("not supported in this browser");
  });

  it("does not request permission on page load", () => {
    renderHook(() => useRecorder());
    expect(getUserMediaMock).not.toHaveBeenCalled();
  });
});

describe("useRecorder start/stop", () => {
  it("requests permission and starts recording only on start()", async () => {
    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(getUserMediaMock).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("stops recording and produces a playable blob", async () => {
    const { result } = renderHook(() => useRecorder());
    await act(async () => {
      await result.current.start();
    });

    await act(async () => {
      result.current.stop();
      await Promise.resolve();
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.status).toBe("stopped");
    expect(result.current.recording).not.toBeNull();
    expect(result.current.recording?.blob.size).toBeGreaterThan(0);
    expect(result.current.recording?.url).toBeTruthy();
  });

  it("handles permission being denied", async () => {
    getUserMediaMock = vi.fn(() =>
      Promise.reject(
        new DOMException("Permission denied", "NotAllowedError"),
      ),
    );
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: getUserMediaMock },
    });

    const { result } = renderHook(() => useRecorder());
    await act(async () => {
      await result.current.start();
    });

    expect(result.current.error).toContain("Microphone access was denied");
    expect(result.current.status).toBe("error");
  });

  it("handles microphone being unavailable", async () => {
    getUserMediaMock = vi.fn(() =>
      Promise.reject(new DOMException("No device", "NotFoundError")),
    );
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: getUserMediaMock },
    });

    const { result } = renderHook(() => useRecorder());
    await act(async () => {
      await result.current.start();
    });

    expect(result.current.error).toBe(
      "Recording failed. Please check your microphone and try again.",
    );
  });

  it("report unsupported browser before requesting permission", async () => {
    stubRecorderBrowser();
    removeMediaDevices();
    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(getUserMediaMock).not.toHaveBeenCalled();
    expect(result.current.error).toContain("not supported in this browser");
  });
});

describe("useRecorder timer and limits", () => {
  it("ticks the recording timer while recording", async () => {
    const { result } = renderHook(() => useRecorder());
    await act(async () => {
      await result.current.start();
    });

    await act(async () => {
      vi.advanceTimersByTime(23000);
    });

    expect(result.current.elapsedSeconds).toBe(23);

    await act(async () => {
      result.current.stop();
      await Promise.resolve();
    });
  });

  it("auto-stops exactly at the maximum duration", async () => {
    const { result } = renderHook(() => useRecorder());
    await act(async () => {
      await result.current.start();
    });

    await act(async () => {
      vi.advanceTimersByTime(MAX_RECORDING_SECONDS * 1000);
    });
    // Elapsed clamps at the cap, auto-stop fires via the watchdog effect, and
    // the recorder fully stops (duration is preserved on the produced blob).
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isRecording).toBe(false);
    expect(result.current.status).toBe("stopped");
    expect(result.current.recording).not.toBeNull();
    expect(result.current.recording?.durationSeconds).toBe(
      MAX_RECORDING_SECONDS,
    );
  });

  it("records the elapsed duration on the blob", async () => {
    const { result } = renderHook(() => useRecorder());
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      vi.advanceTimersByTime(8000);
    });
    await act(async () => {
      result.current.stop();
      await Promise.resolve();
    });

    expect(result.current.recording?.durationSeconds).toBeGreaterThanOrEqual(1);
  });
});

describe("useRecorder empty recording", () => {
  it("rejects an empty recording instead of fabricating a result", async () => {
    const chase = FakeMediaRecorder.prototype.stop;
    FakeMediaRecorder.prototype.stop = function () {
      this.state = "inactive";
      this.onstop?.();
    };
    const { result } = renderHook(() => useRecorder());
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      result.current.stop();
      await Promise.resolve();
    });
    FakeMediaRecorder.prototype.stop = chase;

    expect(result.current.status).toBe("error");
    expect(result.current.error).toContain("Empty recording");
    expect(result.current.recording).toBeNull();
  });
});