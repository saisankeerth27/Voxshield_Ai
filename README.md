# Voxshield_Ai

**VoiceShield — AI-Powered Voice Cloning & Impersonation Attack Detection System**

A FastAPI + React application that detects voice-cloning and impersonation
attacks. Uploaded audio is validated, preprocessed into a normalized
format (mono, 16 kHz WAV), and prepared for downstream AI analysis.

## Architecture

| Layer | Location | Status |
| --- | --- | --- |
| Frontend (React + Vite + Tailwind) | `VoiceShield/frontend` | Phase 2 complete |
| Backend API (FastAPI + PostgreSQL) | `VoiceShield/backend` | Phase 2 complete |
| Audio upload pipeline | `VoiceShield/backend/app` | Phase 2 complete |
| Audio preprocessing pipeline | `VoiceShield/backend/app/audio` | Phase 3 |

## Phases

- **Phase 1** — Application foundation: page routing, health check, CORS.
- **Phase 2** — Audio upload pipeline: validation, UUID storage, analysis
  records, status lifecycle, history/dashboard UI.
- **Phase 3** — Audio preprocessing: FFmpeg decode, mono conversion,
  16 kHz resampling, amplitude normalization, silence handling, quality
  validation, processed-audio storage and streaming.
- **Phase 4** (planned) — Deepfake voice detection (no AI in earlier phases).

## Run (development)

```bash
# Backend
cd VoiceShield/backend
python -m venv venv
venv\Scripts\activate            # Windows
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000

# Frontend
cd ../frontend
npm install
npm run dev
```

API docs: http://localhost:8000/docs