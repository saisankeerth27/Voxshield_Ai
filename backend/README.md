# VoiceShield Backend

FastAPI backend for VoiceShield — AI-powered voice impersonation detection.

## Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

## Configuration

Copy `.env.example` to `.env` and set your local values.

```bash
cp .env.example .env
```

Key settings:

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | — | SQLAlchemy database URL (PostgreSQL) |
| `CORS_ORIGINS` | localhost dev origins | Comma-separated allowed origins |
| `MAX_AUDIO_SIZE_MB` | `25` | Maximum accepted upload size |
| `UPLOAD_DIR` | `uploads` | Temporary upload directory (git-ignored) |

The `audio_analyses` table is created automatically at startup
(`Base.metadata.create_all`) during development. There is no migrations
system yet; schema changes are handled manually in later phases.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Liveness probe |
| POST | `/audio/upload` | Upload an audio file (WAV, MP3, M4A, OGG) |
| GET | `/audio` | Paginated list of analysis records (`page`, `limit`) |
| GET | `/audio/{analysis_id}` | Single analysis record metadata |
| DELETE | `/audio/{analysis_id}` | Delete the record and its stored file |

Accepted formats: `.wav`, `.mp3`, `.m4a`, `.ogg`. Files are validated by
extension and MIME type and stored with a UUID-based filename in
`UPLOAD_DIR`; only metadata is returned to clients — never filesystem
paths.

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

## Tests

```bash
pytest
```

Tests run against an in-memory SQLite database and an isolated temporary
upload directory; no PostgreSQL or ML models are required.
