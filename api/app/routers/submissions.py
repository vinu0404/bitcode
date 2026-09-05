import dataclasses

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload, selectinload

from app.config import settings
from app.deps import get_current_user, get_db
from app.engine.grader import grade_submission, run_custom_vectors
from app.engine.loader import problem_spec_from_orm
from app.errors import ForbiddenError, NotFoundError
from app.models.problem import Problem, ProblemStatus
from app.models.submission import Result, Submission, SubmitMode
from app.models.user import User
from app.ratelimit import rate_limit
from app.schemas.grade import GradeResponse, RunResponse
from app.schemas.submission import RunRequest, SubmitRequest

router = APIRouter(prefix="/api/submissions", tags=["submissions"])


def _load_published_problem(db: Session, slug: str) -> Problem:
    problem = (
        db.query(Problem)
        .options(joinedload(Problem.asset), selectinload(Problem.tests))
        .filter(Problem.slug == slug, Problem.status == ProblemStatus.published)
        .first()
    )
    if not problem:
        raise NotFoundError("Problem not found.")
    return problem


@router.post("", response_model=GradeResponse, dependencies=[Depends(rate_limit("submit", settings.rate_submit_per_min))])
def submit(body: SubmitRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> GradeResponse:
    problem = _load_published_problem(db, body.problem_slug)
    spec = problem_spec_from_orm(problem)

    result = grade_submission(spec, body.code)

    submission = Submission(user_id=user.id, problem_id=problem.id, code=body.code, mode=SubmitMode.submit)
    db.add(submission)
    db.flush()

    db.add(
        Result(
            submission_id=submission.id,
            verdict=result.verdict,
            score=result.score.total if result.score else None,
            score_breakdown=result.score.breakdown if result.score else None,
            passed=result.simulation.passed if result.simulation else None,
            total=result.simulation.total if result.simulation else None,
            compile_ok=result.compile.ok,
            compile_log=result.compile.errors,
            tests=[dataclasses.asdict(t) for t in result.simulation.tests] if result.simulation else None,
            ai_feedback=dataclasses.asdict(result.ai_feedback) if result.ai_feedback else None,
            sim_ms=result.simulation.duration_ms if result.simulation else None,
        )
    )
    db.commit()

    return GradeResponse(
        submission_id=str(submission.id),
        mode="submit",
        verdict=result.verdict,
        compile=result.compile,
        simulation=result.simulation,
        score=result.score,
        ai_feedback=result.ai_feedback,
    )


@router.post("/run", response_model=RunResponse, dependencies=[Depends(rate_limit("run", settings.rate_run_per_min))])
def run(body: RunRequest, db: Session = Depends(get_db), _user: User = Depends(get_current_user)) -> RunResponse:
    problem = _load_published_problem(db, body.problem_slug)
    spec = problem_spec_from_orm(problem)
    result = run_custom_vectors(spec, body.code, body.vectors)
    return RunResponse(
        compile=result.compile,
        ran=result.ran,
        timed_out=result.timed_out,
        comparisons=result.comparisons,
        raw_log=result.raw_log,
        waveform=result.waveform,
    )


@router.get("/{submission_id}", response_model=GradeResponse)
def get_submission(submission_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> GradeResponse:
    submission = db.get(Submission, submission_id)
    if not submission:
        raise NotFoundError("Submission not found.")
    if submission.user_id != user.id and user.role.value != "admin":
        raise ForbiddenError("You may only view your own submissions.")
    r = submission.result
    if not r:
        raise NotFoundError("This submission has no result yet.")

    return GradeResponse(
        submission_id=str(submission.id),
        mode=submission.mode.value,
        verdict=r.verdict,
        compile={"ok": r.compile_ok, "errors": r.compile_log or "", "warnings": ""},
        simulation={"ran": r.tests is not None, "timed_out": False, "undefined_outputs": False,
                    "passed": r.passed or 0, "total": r.total or 0, "duration_ms": r.sim_ms or 0,
                    "tests": r.tests or []} if r.tests is not None else None,
        score={"total": r.score or 0, "breakdown": r.score_breakdown or {}} if r.score is not None else None,
        ai_feedback=r.ai_feedback,
    )
