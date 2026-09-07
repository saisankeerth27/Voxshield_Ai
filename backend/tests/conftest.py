"""Test fixtures.

Tests run against an in-memory SQLite database (dependency override) and
an isolated temporary upload directory. No PostgreSQL or real storage is
touched, so tests are fast and require no ML models.
"""

import os
import shutil
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Configure env BEFORE importing the app so settings pick up test values.
os.environ["MAX_AUDIO_SIZE_MB"] = "1"
_test_upload_dir = tempfile.mkdtemp(prefix="voiceshield_test_uploads_")
os.environ["UPLOAD_DIR"] = _test_upload_dir

from app.database.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _cleanup_upload_dir():
    yield
    shutil.rmtree(_test_upload_dir, ignore_errors=True)


@pytest.fixture(scope="session")
def test_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture(scope="session")
def client(test_engine):
    testing_session = sessionmaker(bind=test_engine, autocommit=False, autoflush=False)

    def override_get_db():
        db = testing_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    # TestClient without context manager: lifespan (real-DB init) is skipped.
    return TestClient(app)