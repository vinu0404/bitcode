from fastapi import APIRouter, Depends, Query
from sqlalchemy import String, cast, or_
from sqlalchemy.orm import Session, selectinload

from app.deps import get_current_user, get_db
from app.errors import NotFoundError
from app.models.problem import Problem, ProblemStatus
from app.models.submission import Result, Submission, SubmitMode
from app.models.user import User
from app.pagination import Pagination, pagination
from app.schemas.page import Page
from app.schemas.problem import ProblemDetail, ProblemListItem, SubmissionListItem, TestCaseOut
from app.services.progress import (
    get_acceptance,
    get_attempted_problem_ids,
    get_solved_problem_ids,
    problem_status,
)

router = APIRouter(prefix="/api/problems", tags=["problems"])


@router.get("", response_model=Page[ProblemListItem])
def list_problems(
    domain: str | None = Query(None, pattern="^(vlsi|embedded|communication|others)$"),
    difficulty: str | None = Query(None, pattern="^(easy|medium|hard)$"),
    language: str | None = Query(None, pattern="^(sv|v)$"),
    status: str | None = Query(None, pattern="^(solved|attempted|new)$"),
    topic: str | None = None,  # topic slug
    q: str | None = None,  # title or number
    page: Pagination = Depends(pagination),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Page[ProblemListItem]:
    # selectinload, not joinedload, for `topics`: a many-to-many collection
    # on many parent rows. joinedload would repeat each problem once per
    # topic before the ORM dedupes; selectinload adds one IN query instead.
    query = db.query(Problem).filter(Problem.status == ProblemStatus.published).options(selectinload(Problem.topics))
    if domain:
        query = query.filter(Problem.domain == domain)
    if difficulty:
        query = query.filter(Problem.difficulty == difficulty)
    if language:
        query = query.filter(Problem.language == language)
    if topic:
        query = query.filter(Problem.topics.any(slug=topic))
    if q:
        q = q.strip()
        # Plain ILIKE: the catalogue is admin-curated and small, so a trigram
        # index would solve a scale problem this table does not have. A
        # numeric query also matches the problem number ("42" finds 0042).
        conditions = [Problem.title.ilike(f"%{q}%")]
        if q.isdigit():
            conditions.append(cast(Problem.number, String).like(f"%{int(q)}%"))
        query = query.filter(or_(*conditions))

    solved = get_solved_problem_ids(db, user.id)
    attempted = get_attempted_problem_ids(db, user.id)
    # SQLAlchemy renders an empty IN as a false predicate, so no special case.
    if status == "solved":
        query = query.filter(Problem.id.in_(list(solved)))
    elif status == "attempted":
        query = query.filter(Problem.id.in_(list(attempted - solved)))
    elif status == "new":
        query = query.filter(Problem.id.notin_(list(attempted | solved)))

    total = query.count()
    problems = query.order_by(Problem.number).offset(page.offset).limit(page.limit).all()
    acceptance = get_acceptance(db, [p.id for p in problems])

    items = [
        ProblemListItem(
            id=p.id,
            slug=p.slug,
            number=p.number,
            title=p.title,
            domain=p.domain,
            language=p.language,
            difficulty=p.difficulty,
            kind=p.kind.value,
            status=problem_status(p.id, solved, attempted),
            acceptance=acceptance.get(p.id),
            topics=p.topics,
        )
        for p in problems
    ]
    return Page[ProblemListItem](items=items, total=total, limit=page.limit, offset=page.offset)


def _constraint_lines(problem: Problem) -> list[str]:
    lines: list[str] = []
    reset = (problem.constraints or {}).get("reset")
    if reset:
        timing = "synchronous" if reset.get("sync") else "asynchronous"
        level = "active-high" if reset.get("active_high", True) else "active-low"
        lines.append(f"reset is {timing} and {level}")
    if problem.kind.value == "combinational":
        lines.append("combinational only: no posedge or negedge")
    lines.append("no initial blocks and no # delays")
    lines.append("no $display, $monitor, $write, $strobe or $dump tasks")
    banned = (problem.constraints or {}).get("banned_tasks") or []
    if banned:
        lines.append("also banned: " + ", ".join(banned))
    return lines


@router.get("/{slug}", response_model=ProblemDetail)
def get_problem(slug: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ProblemDetail:
    # Selects Problem, its topics and its test metadata, never problem_assets,
    # so a student-facing query cannot leak the testbench or reference.
    problem = (
        db.query(Problem)
        .options(selectinload(Problem.topics), selectinload(Problem.tests))
        .filter(Problem.slug == slug, Problem.status == ProblemStatus.published)
        .first()
    )
    if not problem:
        raise NotFoundError("Problem not found.")

    solved = get_solved_problem_ids(db, user.id)
    attempted = get_attempted_problem_ids(db, user.id)
    tests = [
        TestCaseOut(number=i, id=t.test_id, visible=t.visible, name=t.purpose if t.visible else None)
        for i, t in enumerate(problem.tests, 1)
    ]
    return ProblemDetail(
        id=problem.id,
        slug=problem.slug,
        number=problem.number,
        title=problem.title,
        domain=problem.domain,
        language=problem.language,
        difficulty=problem.difficulty,
        kind=problem.kind.value,
        statement_md=problem.statement_md,
        starter_code=problem.starter_code,
        interface=problem.interface,
        constraints=_constraint_lines(problem),
        rubric=problem.rubric,
        sample_tests=problem.sample_tests,
        hints=problem.hints or [],
        tests=tests,
        status=problem_status(problem.id, solved, attempted),
        topics=problem.topics,
    )


@router.get("/{slug}/submissions", response_model=Page[SubmissionListItem])
def list_my_submissions(
    slug: str,
    page: Pagination = Depends(pagination),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Page[SubmissionListItem]:
    """The current user's own submits for one problem, newest first."""
    problem_id = db.query(Problem.id).filter(Problem.slug == slug, Problem.status == ProblemStatus.published).scalar()
    if problem_id is None:
        raise NotFoundError("Problem not found.")
    query = (
        db.query(Submission, Result)
        .join(Result, Result.submission_id == Submission.id)
        .filter(Submission.user_id == user.id, Submission.problem_id == problem_id, Submission.mode == SubmitMode.submit)
    )
    total = query.count()
    rows = query.order_by(Submission.created_at.desc()).offset(page.offset).limit(page.limit).all()
    items = [
        SubmissionListItem(
            id=s.id,
            created_at=s.created_at,
            verdict=r.verdict.value,
            verdict_word=r.verdict_word or "",
            passed=r.passed,
            total=r.total,
            score=r.score,
            sim_ms=r.sim_ms,
        )
        for s, r in rows
    ]
    return Page[SubmissionListItem](items=items, total=total, limit=page.limit, offset=page.offset)
