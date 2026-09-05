"""Runs on every container boot (see api/Dockerfile CMD), before uvicorn
starts. Idempotent: safe to run against an already-seeded database.

Every seed problem is pushed back through the SAME validation gate the
admin UI uses (design doc §7) before being marked published — this is a
safety net, not duplicate work: it catches a hand-edited seed JSON with a
broken testbench before any student ever sees the problem, exactly the
failure mode the gate exists to prevent.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from app.config import settings
from app.db import SessionLocal
from app.engine.grader import grade_submission
from app.engine.loader import problem_spec_from_dict
from app.engine.stub import build_stub_module
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


def _upsert_problem(db, data: dict, order_index: int) -> None:
    slug = data["slug"]
    problem = db.query(Problem).filter(Problem.slug == slug).first()
    is_new = problem is None
    if is_new:
        problem = Problem(slug=slug)
        db.add(problem)

    problem.title = data["title"]
    problem.difficulty = data["difficulty"]
    problem.kind = ProblemKind(data["kind"])
    problem.statement_md = data["statement_md"]
    problem.starter_code = data["starter_code"]
    problem.interface = data["interface"]
    problem.constraints = data.get("constraints", {})
    problem.rubric = data["rubric"]
    problem.sample_tests = data.get("sample_tests", [])
    problem.order_index = order_index
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
                category=t["category"], hint=t["hint"], bucket=t["bucket"], order_index=i,
            )
        )
    db.commit()
    db.refresh(problem)

    # Run the same gate the admin UI runs before publishing.
    spec = problem_spec_from_dict(data)
    ref_result = grade_submission(spec, spec.reference_sv, with_feedback=False)
    ref_score = ref_result.score.total if ref_result.score else 0
    ref_ok = ref_result.verdict == "CORRECT" and ref_score == 100

    stub_result = grade_submission(spec, build_stub_module(spec), with_feedback=False)
    stub_score = stub_result.score.total if stub_result.score else 0
    stub_ok = stub_score < 100

    declared_ids = {t.test_id for t in spec.tests}
    seen_ids = {o.id for o in ref_result.simulation.tests} if ref_result.simulation else set()
    ids_ok = declared_ids == seen_ids

    ok = ref_ok and stub_ok and ids_ok
    log = f"ref_score={ref_score} stub_score={stub_score} ids_ok={ids_ok}"
    db.add(ProblemValidation(problem_id=problem.id, ok=ok, ref_score=ref_score, stub_score=stub_score, log=log))
    problem.status = ProblemStatus.published if ok else ProblemStatus.draft
    db.commit()

    if ok:
        logger.info("Seeded %s: %s", slug, "published" if is_new else "re-validated + published")
    else:
        logger.warning("Seeded %s FAILED validation, left as draft: %s", slug, log)


def run() -> None:
    if not settings.seed_on_boot:
        logger.info("SEED_ON_BOOT is false — skipping.")
        return

    db = SessionLocal()
    try:
        _bootstrap_admin(db)
        seed_files = sorted(SEED_DIR.glob("*.json"))
        for i, path in enumerate(seed_files):
            data = json.loads(path.read_text())
            _upsert_problem(db, data, order_index=i)
        logger.info("Seed complete: %d problem(s) processed.", len(seed_files))
    finally:
        db.close()


if __name__ == "__main__":
    run()
