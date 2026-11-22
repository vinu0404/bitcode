import re

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Postgres
    database_url: str = "postgresql+psycopg://bitcode:bitcode@localhost:5432/bitcode"
    # Explicit rather than left to SQLAlchemy's defaults (5/10/-1): a
    # managed Postgres (Neon, Supabase, RDS) typically drops idle server-
    # side connections well under an hour, and pool_pre_ping alone only
    # catches that on next checkout, not proactively; pool_recycle forces
    # a periodic reconnect before that happens. Sized for a single free-
    # tier container (~2 vCPU), not a multi-instance deployment.
    db_pool_size: int = 5
    db_max_overflow: int = 10
    db_pool_recycle_seconds: int = 1800
    # Postgres schema holding every Bitcode table. Empty means the default
    # (public). Set it (e.g. "bitcode") when sharing a database with another
    # app, so table names such as "topic" or "profile" can never collide.
    database_schema: str = ""

    # Auth
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    bootstrap_admin_email: str = "admin@bitcode.local"
    bootstrap_admin_password: str = "change_me_local_only"

    # Supabase Auth (Google sign-in). The publishable key is public by design.
    supabase_url: str = ""
    supabase_publishable_key: str = ""

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4.1-mini"
    openai_timeout_seconds: int = 20
    openai_max_output_tokens: int = 400
    feedback_enabled: bool = True

    # Simulator sandbox
    iverilog_bin: str = "iverilog"
    vvp_bin: str = "vvp"
    sim_job_dir: str = "/tmp"
    sim_compile_timeout: int = 10
    sim_run_timeout: int = 10
    sim_cpu_seconds: int = 5
    sim_memory_mb: int = 256
    sim_max_output_bytes: int = 65536
    sim_max_concurrency: int = 3
    sim_max_code_bytes: int = 32768

    # Rate limits
    rate_run_per_min: int = 20
    rate_submit_per_min: int = 6

    # App
    api_port: int = 7860
    cors_origins: str = "http://localhost:3000"
    seed_on_boot: bool = True
    log_level: str = "INFO"

    @field_validator("database_schema")
    @classmethod
    def _schema_is_a_plain_identifier(cls, v: str) -> str:
        # It is interpolated into SET search_path / CREATE SCHEMA, so it must
        # be a bare identifier, never arbitrary SQL.
        if v and not re.fullmatch(r"[a-z_][a-z0-9_]{0,62}", v):
            raise ValueError("DATABASE_SCHEMA must be lowercase letters, digits and underscores")
        return v

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
