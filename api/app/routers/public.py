"""Unauthenticated, read-only endpoints for the marketing pages. Exposes only
what a visitor would see on the problem list anyway: number, title,
difficulty, domain. Never statements, tests or anything about grading."""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models.problem import Problem, ProblemStatus

router = APIRouter(prefix="/api/public", tags=["public"])


class PublicProblem(BaseModel):
    slug: str
    number: int
    title: str
    difficulty: str
    domain: str


class PublicCatalogue(BaseModel):
    total: int
    by_domain: dict[str, int]
    items: list[PublicProblem]


@router.get("/catalogue", response_model=PublicCatalogue)
def catalogue(limit: int = Query(4, ge=1, le=12), db: Session = Depends(get_db)) -> PublicCatalogue:
    published = db.query(Problem).filter(Problem.status == ProblemStatus.published)
    counts = dict(published.with_entities(Problem.domain, func.count(Problem.id)).group_by(Problem.domain).all())
    first = published.order_by(Problem.number).limit(limit).all()
    return PublicCatalogue(
        total=sum(counts.values()),
        by_domain=counts,
        items=[PublicProblem(slug=p.slug, number=p.number, title=p.title, difficulty=p.difficulty, domain=p.domain) for p in first],
    )
