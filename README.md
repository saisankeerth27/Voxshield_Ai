# VoiceShield

**AI-Powered Real-Time Voice Cloning & Impersonation Attack Detection System**

VoiceShield is an AI-powered system for detecting potential synthetic voice
and impersonation attacks. It analyzes a voice sample and determines whether
it is genuine human speech, AI-generated/synthetic speech, or a potential
voice impersonation.

> Treat every voice as an untrusted security signal.

## Project Description

VoiceShield processes audio through a detection pipeline and produces an
impersonation-risk assessment for the user.

```
Audio
  ↓
Preprocessing
  ↓
Deepfake Detection
  ↓
Speaker Verification
  ↓
Risk Fusion
  ↓
Alert
  ↓
Dashboard
```

## Problem

AI voice cloning can make impersonation attacks more convincing. Voice
samples are used to spoof voice biometrics, run social-engineering scams
over phone calls, and forge audio evidence. Short voice samples are now
enough to clone a person's voice convincingly.

## Solution

VoiceShield combines two complementary signals into a single risk verdict:

1. **Deepfake Detection** — determines whether audio was AI-generated or
   manipulated.
2. **Speaker Verification** — compares a voice against a registered speaker
   profile to expose impersonation.

These signals are fused into a **risk score** with a clear
**LOW / MEDIUM / HIGH** classification, surfaced on the dashboard with
detection history.

## Current Phase

**Phase 3 — Audio Preprocessing Pipeline**

- Upload pipeline (Phase 2): validation, UUID storage, analysis records,
  history/dashboard UI.
- Audio preprocessing: FFmpeg decode, mono conversion, 16 kHz resampling,
  amplitude normalization, silence handling, quality validation,
  processed-audio storage + streaming.

**No AI predictions are generated yet.** Values display "Not analyzed"
until the ML phases arrive.

## Technology Stack

| Layer      | Technology                                                       |
| ---------- | ---------------------------------------------------------------- |
| Frontend   | React, TypeScript, Vite, Tailwind CSS, React Router, Axios, Recharts, Web Audio API, MediaRecorder API |
| Backend    | Python, FastAPI, Uvicorn, SQLAlchemy, Pydantic, python-dotenv    |
| Database   | PostgreSQL                                                       |
| Audio      | FFmpeg, Librosa, NumPy, SoundFile                               |
| AI/ML      | PyTorch, Wav2Vec2, SpeechBrain, ECAPA-TDNN (future phases)      |

## Running Locally

Docker is **NOT** required. PostgreSQL must be installed and running
locally.

### 1. Backend

```bash
cd backend
python -m venv venv
```

Windows:

```bash
venv\Scripts\activate
```

macOS / Linux:

```bash
source venv/bin/activate
```

Install dependencies and configure environment:

```bash
pip install -r requirements.txt
cp .env.example .env
# edit .env and set DATABASE_URL
```

Run the backend:

```bash
uvicorn app.main:app --reload --port 8000
```

- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173

### 3. PostgreSQL

Create the database:

```sql
CREATE DATABASE voiceshield;
```

## Project Structure

```
├── frontend/
│   └── src/
│       ├── components/   # Waveform, player, dropzone, badges
│       ├── pages/        # Landing, Dashboard, Analyze, History, Profile
│       ├── layouts/      # App shell
│       ├── services/     # api, audio, analysis, profile
│       ├── hooks/        # useRecorder, useUploadFlow, useBackendHealth
│       ├── types/        # audio, analysis, api
│       ├── utils/        # validation, formatting, api errors
│       └── assets/       # static assets
├── backend/
│   ├── app/
│   │   ├── api/routes/   # health, audio, analysis, profile
│   │   ├── audio/        # preprocessing pipeline (Phase 3)
│   │   ├── core/         # config, exceptions
│   │   ├── database/     # SQLAlchemy engine/session/base
│   │   ├── models/       # ORM models
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── services/     # business logic
│   │   ├── ml/           # ML abstractions (future phase)
│   │   ├── websocket/    # realtime (future phase)
│   │   └── main.py
│   ├── tests/            # pytest (SQLite in-memory)
│   └── requirements.txt
├── docs/
└── scripts/
```

## Status

- **Phase 1:** Project foundation — pages, routing, services, audio selection
  UI, health endpoint, database foundation.
- **Phase 2:** Audio upload pipeline — validation, storage, analysis records,
  history UI.
- **Phase 3 (current):** Audio preprocessing pipeline.
- **Later:** Deepfake detection (Wav2Vec2), speaker verification
  (ECAPA-TDNN), risk fusion, realtime WebSocket analysis, detection history,
  alerts.

This is a **single-user / local** application for now. There is no login,
registration, or authentication.