import dataclasses

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload, selectinload

from app.config import settings
from app.deps import get_current_user, get_db
from app.engine.grader import grade_submission, run_custom_vectors, run_visible_tests
from app.engine.loader import problem_spec_from_orm
from app.errors import ForbiddenError, NotFoundError
from app.models.problem import Problem, ProblemStatus, ProblemTest
from app.models.submission import Result, Submission, SubmitMode
from app.models.user import User
from app.ratelimit import rate_limit
from app.schemas.grade import CustomRunResponse, GradeResponse, RunResponse, TestOutcomeOut
from app.schemas.submission import CustomRunRequest, RunRequest, SubmitRequest

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


def _public_tests(outcomes: list[dict], tests: list[ProblemTest]) -> list[TestOutcomeOut]:
    """The one place a test outcome is shaped for a student. Visible tests
    keep their name and EXPECTED/GOT; hidden tests are reduced to number and
    status, so nothing a hidden check looks at can reach the browser."""
    by_id = {o["id"]: o for o in outcomes}
    out: list[TestOutcomeOut] = []
    for number, t in enumerate(tests, 1):
        o = by_id.get(t.test_id)
        status = o["status"] if o else "UNCERTAIN"
        if t.visible and o:
            out.append(
                TestOutcomeOut(
                    number=number, id=t.test_id, status=status, visible=True, name=t.purpose,
                    exp=o.get("exp"), got=o.get("got"), at_ns=o.get("at_ns"),
                )
            )
        else:
            out.append(TestOutcomeOut(number=number, id=t.test_id, status=status, visible=t.visible,
                                      name=t.purpose if t.visible else None))
    return out


@router.post("", response_model=GradeResponse, dependencies=[Depends(rate_limit("submit", settings.rate_submit_per_min))])
def submit(body: SubmitRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> GradeResponse:
    problem = _load_published_problem(db, body.problem_slug)
    spec = problem_spec_from_orm(problem)

    result = grade_submission(spec, body.code)

    submission = Submission(user_id=user.id, problem_id=problem.id, code=body.code, mode=SubmitMode.submit)
    db.add(submission)
    db.flush()

    outcomes = [dataclasses.asdict(t) for t in result.simulation.tests] if result.simulation else None
    db.add(
        Result(
            submission_id=submission.id,
            verdict=result.verdict,
            verdict_word=result.verdict_word,
            score=result.score.total if result.score else None,
            score_breakdown=result.score.breakdown if result.score else None,
            passed=result.simulation.passed if result.simulation else None,
            total=result.simulation.total if result.simulation else None,
            compile_ok=result.compile.ok,
            compile_log=result.compile.errors,
            tests=outcomes,
            ai_feedback=dataclasses.asdict(result.ai_feedback) if result.ai_feedback else None,
            sim_ms=result.simulation.duration_ms if result.simulation else None,
        )
    )
    db.commit()
    db.refresh(submission)

    simulation = None
    if result.simulation:
        sim = result.simulation
        simulation = {
            "ran": sim.ran, "timed_out": sim.timed_out, "undefined_outputs": sim.undefined_outputs,
            "passed": sim.passed, "total": sim.total, "duration_ms": sim.duration_ms,
            "tests": _public_tests(outcomes or [], problem.tests),
        }
    return GradeResponse(
        submission_id=str(submission.id),
        mode="submit",
        verdict=result.verdict,
        verdict_word=result.verdict_word,
        created_at=submission.created_at,
        compile=result.compile,
        simulation=simulation,
        score=result.score,
        ai_feedback=result.ai_feedback,
    )


@router.post("/run", response_model=RunResponse, dependencies=[Depends(rate_limit("run", settings.rate_run_per_min))])
def run(body: RunRequest, db: Session = Depends(get_db), _user: User = Depends(get_current_user)) -> RunResponse:
    """Run the problem's visible tests. Unscored and not stored."""
    problem = _load_published_problem(db, body.problem_slug)
    result = run_visible_tests(problem_spec_from_orm(problem), body.code)
    outcomes = [dataclasses.asdict(o) for o in result.tests]
    tests = [t for t in _public_tests(outcomes, problem.tests) if t.visible]
    return RunResponse(
        verdict_word=result.verdict_word,
        compile=result.compile,
        ran=result.ran,
        timed_out=result.timed_out,
        duration_ms=result.duration_ms,
        tests=tests,
        console=result.console,
        waveform=result.waveform,
    )


@router.post("/custom", response_model=CustomRunResponse, dependencies=[Depends(rate_limit("run", settings.rate_run_per_min))])
def run_custom(body: CustomRunRequest, db: Session = Depends(get_db), _user: User = Depends(get_current_user)) -> CustomRunResponse:
    """Compare the student's design against the reference on inputs the
    student typed in."""
    problem = _load_published_problem(db, body.problem_slug)
    result = run_custom_vectors(problem_spec_from_orm(problem), body.code, body.vectors)
    return CustomRunResponse(
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
    tests = db.query(ProblemTest).filter(ProblemTest.problem_id == submission.problem_id).order_by(ProblemTest.order_index).all()

    return GradeResponse(
        submission_id=str(submission.id),
        mode=submission.mode.value,
        verdict=r.verdict.value,
        verdict_word=r.verdict_word or "",
        created_at=submission.created_at,
        code=submission.code,
        compile={"ok": r.compile_ok, "errors": r.compile_log or "", "warnings": ""},
        simulation={"ran": r.tests is not None, "timed_out": r.verdict_word == "TIME LIMIT", "undefined_outputs": False,
                    "passed": r.passed or 0, "total": r.total or 0, "duration_ms": r.sim_ms or 0,
                    "tests": _public_tests(r.tests or [], tests)} if r.tests is not None else None,
        score={"total": r.score or 0, "breakdown": r.score_breakdown or {}} if r.score is not None else None,
        ai_feedback=r.ai_feedback,
    )
