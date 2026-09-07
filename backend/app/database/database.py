"""SQLAlchemy database configuration.

Provides:
- engine: the SQLAlchemy engine bound to PostgreSQL
- SessionLocal: session factory for per-request sessions
- Base: declarative base for all ORM models
- get_db: FastAPI dependency yielding a session
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    class_=Session,
)


def get_db() -> Generator[Session, None, None]:
    """Yield a database session for the lifetime of a request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables defined by the ORM models.

    Called during application startup. Tables for detection history and
    voice profiles are added in later phases.
    """
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
