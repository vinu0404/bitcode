import psycopg
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.db import Base
from app.models import *  # noqa: F401,F403; registers every model on Base.metadata

TEST_DB = "bitcode_test"


@pytest.fixture(scope="session")
def _engine():
    """A throwaway database on the local Postgres, never the dev data."""
    url = make_url(settings.database_url)
    admin = psycopg.connect(url.set(drivername="postgresql", database="postgres").render_as_string(hide_password=False), autocommit=True)
    admin.execute(f'DROP DATABASE IF EXISTS "{TEST_DB}" WITH (FORCE)')
    admin.execute(f'CREATE DATABASE "{TEST_DB}"')
    engine = create_engine(url.set(database=TEST_DB), connect_args={"prepare_threshold": None})
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        # Stand-in for the main site's table in the shared Supabase database.
        conn.execute(text('CREATE TABLE public.profile (id text PRIMARY KEY, "isAdmin" boolean NOT NULL DEFAULT false)'))
    yield engine
    engine.dispose()
    admin.execute(f'DROP DATABASE IF EXISTS "{TEST_DB}" WITH (FORCE)')
    admin.close()


@pytest.fixture()
def db(_engine):
    session = sessionmaker(bind=_engine, autoflush=False)()
    yield session
    session.close()
    with _engine.begin() as conn:
        conn.execute(text("TRUNCATE users, refresh_tokens, public.profile CASCADE"))
