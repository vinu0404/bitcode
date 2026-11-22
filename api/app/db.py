from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,  # cheap SELECT 1 on checkout; catches a connection the DB already dropped
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_recycle=settings.db_pool_recycle_seconds,  # forces reconnect before a managed Postgres's idle-kill fires
    # No server-side prepared statements: they break behind a pooler such as
    # Supabase's (Supavisor), which can hand each statement a different backend.
    connect_args={"prepare_threshold": None},
)

if settings.database_schema:

    @event.listens_for(engine, "connect")
    def _use_bitcode_schema(dbapi_connection, _record) -> None:
        # Only this schema on the path, not "public" as a fallback: a shared
        # database's public tables must never answer for a missing Bitcode one.
        # Committed, or the pool's rollback-on-return would undo the SET.
        with dbapi_connection.cursor() as cur:
            cur.execute(f'SET search_path TO "{settings.database_schema}"')
        dbapi_connection.commit()

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
