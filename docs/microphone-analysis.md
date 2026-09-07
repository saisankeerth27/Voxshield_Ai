# Microphone Recording & Near-Real-Time Analysis

The Analyze page can run the detection pipeline on audio captured directly
from the browser microphone. This document explains how recording works,
what happens after you press **Analyze Recording**, and the limits of the
implementation.

## How recording works

- Recording uses the standard browser APIs `navigator.mediaDevices.getUserMedia`
  and `MediaRecorder` — no WebSocket, no server-side streaming, no audio ever
  leaves the browser until you explicitly analyze it.
- Microphone permission is requested **lazily**: only when you press
  **Start recording**, never on page load.
- Supported capture codecs are tried in order:
  `audio/webm;codecs=opus` → `audio/webm` → `audio/mp4` → `audio/ogg;codecs=opus`.
- Recordings are capped at **`MAX_RECORDING_SECONDS = 60`** (hard limit);
  the recorder auto-stops and a timer shows the elapsed time as `MM:SS`.
- If the browser lacks `getUserMedia`/`MediaRecorder`, the Record tab shows a
  clear message instead of querying hardware.
- An **empty** recording (no captured audio bytes) is rejected with
  "Empty recording…" — nothing is sent to the backend.
- The recorded blob stays in the browser as a playable preview until you
  choose **Analyze Recording** or **Delete**.

## What "Analyze Recording" runs

1. The WebM/Opus blob is wrapped as `microphone-recording.webm` and uploaded
   through the **existing** upload API with `source=MICROPHONE`.
2. Backend accepts WebM and decodes it with FFmpeg into a 16 kHz mono WAV via
   the same preprocessing pipeline used for file uploads.
3. The UI then runs the pipeline stages in order, updating each step with the
   **real** backend response:
   - `preprocess` → **done** once preprocessing is complete
   - `deepfake` → **done** once Wav2Vec2 classification returns
   - `speaker` → **done** only if a registered speaker profile exists; if no
     profile exists the stage is marked **skipped** ("unavailable") and the
     **risk** stage is not run. This is deliberate: it never claims a risk
     verdict without the underlying scores.
   - `risk` → **done** once the risk engine returns the fused verdict.

Stages can also fail (e.g. a model error) — a failed stage stops the chain and
surfaces the backend's error message; later stages are not marked done.

## Result & history

- The result card shows "Audio source: **Microphone**" and the same
  AI / speaker / risk metrics as file uploads.
- The record is stored with `source = 'MICROPHONE'` on the analysis row.
  The History page renders a **Mic** badge for such rows and **Upload** for
  file uploads.

## API

- `POST /audio/upload` accepts an optional form field `source` with values
  `UPLOAD` (default) or `MICROPHONE` (`400` if anything else).
- Upload / detail / list responses include the `source` value.
- Accepted audio extensions now include `.webm`.

## Limitations

- Supporting a *different* codec in the browser produces a WebM/Opus file —
  the 60 s cap is a product decision, not a MediaRecorder limit.
- Backend audio analysis is near-real-time (each stage is a network request +
  inference), not continuous streaming. There is no live transcription or
  ongoing microphone feed; the mic feed is fully stopped once recording ends.
- WAV/MP3 etc. files remain fully supported; the mic path simply re-uses the
  same pipeline and is marked as `MICROPHONE`.