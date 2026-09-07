# VoiceShield

**AI-Powered Voice Cloning & Impersonation Attack Detection System**

VoiceShield detects potential AI-generated (deepfake) voices and speaker
impersonation in short voice samples. It analyzes a sample through a
multi-stage pipeline and produces a clear **LOW / MEDIUM / HIGH** risk
verdict.

> Treat every voice as an untrusted security signal.

## Project Description

VoiceShield takes an audio file — or a live microphone recording — and runs
it through a deterministic detection pipeline:

```
Audio (file or mic)
    ↓
Preprocessing          FFmpeg decode, mono downmix, 16 kHz resample,
                       normalization, silence removal, quality validation
    ↓
Deepfake Detection     Wav2Vec2-based classifier → AI / real probability
    ↓
Speaker Verification   ECAPA-TDNN embedding → cosine similarity vs. a
                       registered voiceprint
    ↓
Risk Fusion            Deterministic heuristic → risk score + severity
    ↓
Details + HTML Report  Per-stage results and a printable report
```

All ML predictions come from real model inference. There are **no
hardcoded or fabricated results** anywhere in the backend or frontend; if a
model is unavailable the API returns a service error rather than a fake
answer.

## Features

- **Audio upload** — WAV, MP3, M4A, OGG, and WebM accepted; extension,
  MIME, and size validation; UUID storage names (user filenames are never
  used on disk).
- **Microphone recording** — browser `getUserMedia` + `MediaRecorder`
  (WebM/Opus), 60-second cap, permission requested only on start,
  recordings flow through the same pipeline marked `source=MICROPHONE`.
- **Deepfake detection** — `garystafford/wav2vec2-deepfake-voice-detector`
  (long audio is segmented for inference).
- **Speaker verification** — SpeechBrain `ECAPA-TDNN` (VoxCeleb) cosine
  similarity against a registered voiceprint. Embeddings are stored
  backend-only and **never returned to the frontend**.
- **Risk fusion** — deterministic, transparent heuristic combining deepfake
  probability (60%) and speaker similarity (40%) into a single risk score,
  with an explanation and recommendation.
- **Details page** — full per-stage results with reference metadata.
- **Printable report** — a backend-generated HTML report rendered in an
  isolated view for print / save-as-PDF.
- **History & dashboard** — paginated detection history with Mic/Upload
  badges, latest-analysis summary, risk status, and backend health.
- **Health endpoint** — reports application, database, and model loading
  state.

## Technology Stack

| Layer      | Technology                                                                 |
| ---------- | -------------------------------------------------------------------------- |
| Frontend   | React, TypeScript, Vite, Tailwind CSS, React Router, Axios, lucide-react   |
| Backend    | Python, FastAPI, Uvicorn, SQLAlchemy, Pydantic                              |
| Database   | PostgreSQL (default) / SQLite (tests)                                       |
| Audio      | FFmpeg (with `imageio-ffmpeg` fallback), Librosa, NumPy, SoundFile          |
| AI/ML      | PyTorch, Hugging Face Transformers (Wav2Vec2), SpeechBrain (ECAPA-TDNN)    |

## Security Notes

- Uploads are stored under generated UUID filenames and are **not** mounted
  as static files; only processed audio is streamed back through an
  authenticated-by-ID endpoint.
- Speaker embeddings persist server-side only and are never serialized in
  any API response.
- CORS is restricted to local development origins.
- `.env` files are gitignored — only documented `.env.example` files are
  committed. Model weights, uploads, processed audio, and databases are
  gitignored.

## Running Locally

Docker is **not** required. PostgreSQL must be installed and running
locally (or point `DATABASE_URL` at any reachable PostgreSQL instance).

### 1. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate      # Windows
source venv/bin/activate   # macOS / Linux

pip install -r requirements.txt
copy .env.example .env     # Windows
cp .env.example .env       # macOS / Linux
# edit .env and set DATABASE_URL
uvicorn app.main:app --reload --port 8000
```

- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

The first startup downloads the deepfake and speaker model weights into
`models/` (gitignored). This can take a while; the API reports model
loading state via `/health` in the meantime.

### 2. Frontend

```bash
cd frontend
npm install
copy .env.example .env     # Windows
cp .env.example .env       # macOS / Linux
npm run dev
```

Open http://localhost:5173

### 3. PostgreSQL

```sql
CREATE DATABASE voiceshield;
```

Tables and storage directories are created automatically at backend
startup.

## Demo Flow (2–3 minutes)

1. **Profile** — register a speaker voiceprint (a short "reference" audio
   clip). This powers speaker verification.
2. **Analyze** — upload a WAV/MP3/M4A/OGG file, or record from the
   microphone, then run each stage:
   - **Prepare audio** → preprocessing report.
   - **Detect AI voice** → AI probability, real probability, label.
   - **Verify speaker** → cosine similarity vs. the registered voiceprint
     (skipped with a clear message when no profile exists — never faked).
   - **Calculate risk** → risk score, severity, explanation, and
     recommendation.
3. **Details** — inspect per-stage results.
4. **Report** — open the printable HTML report and save as PDF.
5. **History / Dashboard** — confirm the record, detections, and risk
   appear stored from the database.

## Tests

Backend (SQLite in-memory, no models required — deterministic fakes):

```bash
cd backend
venv\Scripts\activate
python -m pytest tests/ -q
```

Frontend:

```bash
cd frontend
npm test -- --run
npm run build
```

## Project Structure

```
├── frontend/
│   └── src/
│       ├── components/   # Metric cards, badges, risk alert, dropzone
│       ├── pages/        # Dashboard, Analyze, History, Profile, Details, Report
│       ├── layouts/      # App shell
│       ├── services/     # API clients (audio, analysis, profile)
│       ├── hooks/        # useRecorder, useVoiceAnalysis, useBackendHealth
│       ├── types/        # audio, analysis, api
│       └── utils/        # validation, formatting, api errors
├── backend/
│   ├── app/
│   │   ├── api/routes/   # health, audio, analysis, profile
│   │   ├── audio/        # FFmpeg loader + preprocessing pipeline
│   │   ├── core/         # config, exceptions
│   │   ├── database/     # SQLAlchemy engine/session/base
│   │   ├── models/       # ORM models
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── services/     # business logic (audio, deepfake, speaker, risk)
│   │   ├── ml/           # load-once model managers + abstractions
│   │   └── main.py       # lifespan, CORS, exception handlers
│   ├── tests/            # pytest (SQLite in-memory)
│   └── requirements.txt
├── docs/                 # phase write-ups
└── scripts/
```

## Status

All implemented phases are complete and integrated:

- **Phase 1** — foundation: pages, routing, services, health endpoint.
- **Phase 2** — audio upload pipeline + history.
- **Phase 3** — audio preprocessing pipeline (decode, normalize, validate).
- **Phase 4** — deepfake voice detection (real Wav2Vec2 model).
- **Phase 5** — speaker verification (real ECAPA-TDNN model).
- **Phase 6** — risk fusion engine.
- **Phase 7** — dashboard & history enhancements.
- **Phase 8** — microphone recording & analysis.
- **Phase 9** — analysis details page + printable HTML report.
- **Phase 10** — final integration, hardening, and hackathon readiness.

## Limitations

- **Single-user / local application.** There is no login, registration, or
  authentication; session tokens and realtime alerting are out of scope.
- **Risk engine is a deterministic MVP heuristic**, not a validated
  probability of attack, and the speaker-similarity threshold and risk
  thresholds have **not** been calibrated for security-critical use.
- The ML models load at startup and run on CPU here (CUDA is not
  available in the demo environment), so first inference can be slow.
- PostgreSQL is used at runtime; the automated test suite runs against
  SQLite in-memory.

See [`docs/microphone-analysis.md`](docs/microphone-analysis.md) for the
microphone pipeline details.