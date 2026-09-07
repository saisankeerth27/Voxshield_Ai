# Demo Audio Samples

Ready-to-use voice samples for a quick VoiceShield walkthrough. These are
provided for **demonstration purposes only** — VoiceShield does not ship with
or depend on any of them.

| File | What it is | Typical result |
| --- | --- | --- |
| `synthetic_tts.wav` | An AI-generated (text-to-speech) voice sample | Detected as synthetic — **HIGH** impersonation risk |
| `genuine_human.wav` | A real human voice recording | Detected as human — lower AI probability |
| `mic_capture.webm` | A human microphone recording (browser `MediaRecorder` output) | Detected as human; good for the record-from-microphone flow |
| `jfk.flac` | Public-domain human speech (JFK inaugural address) | Detected as human |

## Honest labeling

These files are bundled purely so a demo can start without hunting for audio.
They are **not** created by VoiceShield and their provenance is not asserted
here beyond the column above. For a fully in-house demo, record a fresh human
sample in the app (Record tab) and note that any recorded audio is uploaded
and stored by the backend like a normal analysis.

## Where to use them

- **Analyze page → Upload tab:** drop `synthetic_tts.wav` for a HIGH-risk
  showcase, or `genuine_human.wav` for a LOW/MEDIUM one.
- **Analyze page → Record tab:** record your own voice for the microphone
  flow (or upload `mic_capture.webm`).
- **Speaker Profile page:** upload `genuine_human.wav` (or a fresh recording)
  as the reference voice, then analyze the same speaker's audio to see a
  speaker *match*, or a different speaker / synthetic sample to see a *no match*.

See `docs/demo-guide.md` for the full scripted walkthrough.