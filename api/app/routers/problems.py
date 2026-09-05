from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, selectinload

from app.deps import get_current_user, get_db
from app.errors import NotFoundError
from app.models.problem import Problem, ProblemStatus
from app.pagination import Pagination, pagination
from app.schemas.page import Page
from app.schemas.problem import ProblemDetail, ProblemListItem
from app.services.progress import get_solved_problem_ids
from app.models.user import User

router = APIRouter(prefix="/api/problems", tags=["problems"])


@router.get("", response_model=Page[ProblemListItem])
def list_problems(
    difficulty: str | None = None,
    topic: str | None = None,  # topic slug — powers the dashboard bubble filter
    q: str | None = None,  # free-text title search — powers the problems page search box
    page: Pagination = Depends(pagination),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Page[ProblemListItem]:
    # selectinload, not joinedload, for `topics`: it's a many-to-many
    # collection and this query returns many parent rows — joinedload
    # would duplicate each problem row once per topic it carries
    # (cartesian product) before the ORM dedupes it back down client-side;
    # selectinload issues one extra `WHERE problem_id IN (...)` query
    # instead and never multiplies rows on the wire.
    query = db.query(Problem).filter(Problem.status == ProblemStatus.published).options(selectinload(Problem.topics))
    if difficulty:
        query = query.filter(Problem.difficulty == difficulty)
    if topic:
        query = query.filter(Problem.topics.any(slug=topic))
    if q:
        # Title-only, plain ILIKE — the catalog is admin-curated and small
        # (tens, not millions, of rows); a trigram index would be solving
        # a scale problem this table doesn't have. Revisit if/when the
        # catalog or the search fields actually grow.
        query = query.filter(Problem.title.ilike(f"%{q}%"))

    total = query.count()
    problems = query.order_by(Problem.order_index).offset(page.offset).limit(page.limit).all()

    solved_ids = get_solved_problem_ids(db, user.id)

    items = [
        ProblemListItem(
            id=p.id, slug=p.slug, title=p.title, difficulty=p.difficulty, kind=p.kind.value,
            solved=p.id in solved_ids, topics=p.topics,
        )
        for p in problems
    ]
    return Page[ProblemListItem](items=items, total=total, limit=page.limit, offset=page.offset)


@router.get("/{slug}", response_model=ProblemDetail)
def get_problem(slug: str, db: Session = Depends(get_db), _user: User = Depends(get_current_user)) -> Problem:
    # Deliberately selects only Problem (+ topics) — never joins
    # problem_assets, so a student-facing query cannot leak the hidden
    # testbench or reference solution even by accident.
    problem = (
        db.query(Problem)
        .options(selectinload(Problem.topics))
        .filter(Problem.slug == slug, Problem.status == ProblemStatus.published)
        .first()
    )
    if not problem:
        raise NotFoundError("Problem not found.")
    return problem
