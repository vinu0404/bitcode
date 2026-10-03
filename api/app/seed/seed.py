"""Runs on every container boot (see api/Dockerfile CMD), before uvicorn
starts. Idempotent: safe to run against an already-seeded database.

Every seed problem is pushed back through the SAME validation gate the
admin UI uses (design doc §7) before being marked published; this is a
safety net, not duplicate work: it catches a hand-edited seed JSON with a
broken testbench before any student ever sees the problem, exactly the
failure mode the gate exists to prevent.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from sqlalchemy import func

from app.config import settings
from app.db import SessionLocal
from app.engine.loader import problem_spec_from_dict
from app.engine.validate import run_gate
from app.models.problem import Problem, ProblemAsset, ProblemKind, ProblemStatus, ProblemTest, ProblemValidation, Topic
from app.models.user import User, UserRole
from app.security import hash_password

logger = logging.getLogger(__name__)
logging.basicConfig(level=settings.log_level)

SEED_DIR = Path(__file__).resolve().parent / "problems"


def _slugify(name: str) -> str:
    import re

    return re.sub(r"[^a-z0-9]+", "_", name.strip().lower()).strip("_")


def _resolve_topics(db, names: list[str]) -> list[Topic]:
    resolved = []
    for name in names:
        slug = _slugify(name)
        topic = db.query(Topic).filter(Topic.slug == slug).first()
        if not topic:
            topic = Topic(slug=slug, name=name)
            db.add(topic)
            db.flush()
        resolved.append(topic)
    return resolved


def _bootstrap_admin(db) -> None:
    email = settings.bootstrap_admin_email.lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        return
    db.add(
        User(
            email=email,
            password_hash=hash_password(settings.bootstrap_admin_password),
            role=UserRole.admin,
        )
    )
    db.commit()
    logger.info("Bootstrapped admin user %s", settings.bootstrap_admin_email)


def _free_number(db, number: int, slug: str) -> None:
    """A seed file owns its number. If some other problem holds it (an
    admin-created one, or a pre-migration backfill), move that one to the
    next free number rather than failing the boot."""
    holder = db.query(Problem).filter(Problem.number == number, Problem.slug != slug).first()
    if holder:
        holder.number = (db.query(func.max(Problem.number)).scalar() or 0) + 1
        holder.order_index = holder.number
        db.flush()


def _upsert_problem(db, data: dict) -> None:
    slug = data["slug"]
    number = data["number"]
    _free_number(db, number, slug)
    problem = db.query(Problem).filter(Problem.slug == slug).first()
    is_new = problem is None
    if is_new:
        problem = Problem(slug=slug)
        db.add(problem)

    problem.number = number
    problem.domain = data.get("domain", "vlsi")
    problem.language = data.get("language", "sv")
    problem.hints = data.get("hints", [])
    problem.title = data["title"]
    problem.difficulty = data["difficulty"]
    problem.kind = ProblemKind(data["kind"])
    problem.statement_md = data["statement_md"]
    problem.starter_code = data["starter_code"]
    problem.interface = data["interface"]
    problem.constraints = data.get("constraints", {})
    problem.rubric = data["rubric"]
    problem.sample_tests = data.get("sample_tests", [])
    problem.order_index = number
    problem.topics = _resolve_topics(db, data.get("topics", []))
    db.flush()

    if problem.asset:
        problem.asset.testbench_sv = data["testbench_sv"]
        problem.asset.reference_sv = data["reference_sv"]
    else:
        db.add(ProblemAsset(problem_id=problem.id, testbench_sv=data["testbench_sv"], reference_sv=data["reference_sv"]))

    db.query(ProblemTest).filter(ProblemTest.problem_id == problem.id).delete()
    for i, t in enumerate(data["tests"]):
        db.add(
            ProblemTest(
                problem_id=problem.id, test_id=t["test_id"], purpose=t["purpose"],
                category=t["category"], hint=t["hint"], bucket=t["bucket"],
                visible=bool(t.get("visible", False)), order_index=i,
            )
        )
    db.commit()
    db.refresh(problem)

    # Run the same gate the admin UI runs before publishing.
    gate = run_gate(problem_spec_from_dict(data))
    db.add(ProblemValidation(problem_id=problem.id, ok=gate.ok, ref_score=gate.ref_score, stub_score=gate.stub_score, log=gate.log))
    problem.status = ProblemStatus.published if gate.ok else ProblemStatus.draft
    db.commit()

    if gate.ok:
        logger.info("Seeded %s: %s", slug, "published" if is_new else "re-validated + published")
    else:
        logger.warning("Seeded %s FAILED validation, left as draft: %s", slug, gate.log)


def run() -> None:
    if not settings.seed_on_boot:
        logger.info("SEED_ON_BOOT is false; skipping.")
        return

    db = SessionLocal()
    try:
        _bootstrap_admin(db)
        seed_files = sorted(SEED_DIR.glob("*.json"))
        for path in seed_files:
            _upsert_problem(db, json.loads(path.read_text()))
        logger.info("Seed complete: %d problem(s) processed.", len(seed_files))
    finally:
        db.close()


if __name__ == "__main__":
    run()
