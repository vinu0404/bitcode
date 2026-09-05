import subprocess

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.db import SessionLocal
from app.errors import register_error_handlers
from app.routers import admin, auth, me, problems, submissions

app = FastAPI(title="BitCode Grader", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

app.include_router(auth.router)
app.include_router(problems.router)
app.include_router(submissions.router)
app.include_router(admin.router)
app.include_router(me.router)


@app.get("/health")
def health() -> dict:
    """Liveness — the process is up. No dependency checks here."""
    return {"status": "ok"}


@app.get("/ready")
def ready() -> dict:
    """Readiness — the two things grading actually needs: the database,
    and iverilog. HF Spaces / a load balancer should gate traffic on this,
    not /health."""
    checks: dict[str, str] = {}

    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as exc:  # noqa: BLE001
        checks["database"] = f"error: {exc}"
    finally:
        db.close()

    try:
        proc = subprocess.run([settings.iverilog_bin, "-V"], capture_output=True, text=True, timeout=5)
        checks["iverilog"] = "ok" if proc.returncode == 0 else f"error: exit {proc.returncode}"
    except Exception as exc:  # noqa: BLE001
        checks["iverilog"] = f"error: {exc}"

    healthy = all(v == "ok" for v in checks.values())
    return {"status": "ok" if healthy else "degraded", "checks": checks}
