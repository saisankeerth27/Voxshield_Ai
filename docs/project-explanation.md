# VoiceShield — Project Explanation

VoiceShield is an AI-powered voice cloning & impersonation attack detection
tool. It analyzes a voice recording to (a) estimate whether it was AI-generated
and (b) compare it to a registered reference speaker, then fuses those signals
into a simple LOW / MEDIUM / HIGH impersonation-risk verdict.

## The problem

Voice cloning lets attackers impersonate executives, customers, or elected
officials in phone and media channels. Listeners cannot reliably tell a cloned
voice from the real speaker, so the risk is real for any organization that
acts on voice instructions.

## The solution

VoiceShield makes the decision data-driven:

1. **Analyze Voice** — upload a file or record from a microphone.
2. **Verify Speaker** — optionally compare against a registered reference voice.
3. **Assess Risk** — get a clear verdict with an explanation and a recommended
   action, plus a downloadable HTML report.

## Architecture

```
React (Vite + Tailwind)  ──HTTP/JSON──▶  FastAPI backend  ──▶  SQLite/PostgreSQL
        │                                    │
   Analyze / Dashboard /                 uploads + preprocessing
   History / Profile /                   AI voice detection (Wav2Vec2)
   Report pages                          speaker verification (ECAPA-TDNN)
                                         risk fusion engine
```

- **Frontend:** `frontend/` — React + React Router + Tailwind. Pages: Landing,
  Dashboard, Analyze, History, Speaker Profile, Analysis Details, Report.
- **Backend:** `backend/app/` — FastAPI. Core modules:
  - `routers/audio.py`, `routers/analysis.py`, `routers/profile.py` — HTTP layer.
  - `services/deepfake.py` — Wav2Vec2-based deepfake classification.
  - `services/speaker.py` — ECAPA-TDNN voiceprint + cosine similarity.
  - `services/preprocess.py` — normalize uploads to mono 16 kHz WAV.
  - `services/risk_engine.py` — heuristic fusion of detection + verification.
  - `services/report.py`, `metrics.py` — HTML report and timing instrumentation.
  - `.env.example` — configure `DATABASE_URL`, model paths, API keys.
- **Data:** SQLite by default (zero setup); PostgreSQL supported. Uploads are
  stored server-side and purged after preprocessing unless `KEEP_RAW=1`;
  speaker profiles store only the voiceprint embedding, never the raw audio.

## Actual ML models

| Capability | Model | Notes |
| --- | --- | --- |
| AI-generated voice detection | `facebook/wav2vec2-base` fine-tuned for synthetic/human classification | 16 kHz mono input; labels SYNTHETIC / HUMAN with a probability |
| Speaker verification | ECAPA-TDNN (SpeakerNet-style embedding) | Cosine similarity between voiceprints; match threshold configurable |
| Risk fusion | Rule-based heuristic | Score 0–1 → LOW / MEDIUM / HIGH + explanation + recommendation |

## Honest limitations

- **The risk score is an in-house heuristic**, not a published or calibrated
  metric. The UI explicitly labels it an estimate.
- Detection accuracy depends on the fine-tuned checkpoint and the audio type;
  results are **AI-assisted**, not absolute proof of identity or fraud.
- Without a reference profile, speaker verification is unavailable and risk is
  computed from the AI-detection signal alone (the UI says so).
- No authentication, multi-tenancy, or cloud deployment is included — the
  project is a hackathon demo, not a hardened production product.
- ML model downloads require internet on first run (cached under
  `backend/models/`).

## Reproducing / running

See `docs/demo-guide.md` for startup and a scripted walkthrough. `scripts/`
contains auxiliary tooling; `demo/audio/` has labeled sample clips.