"""Aggregates for the Progress page: solved per domain and difficulty, the
26-week heatmap and the streak. Every number is derived live from
`submissions` and `results`; no separate fact table is needed."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import distinct, func
from sqlalchemy.orm import Session, selectinload

from app.deps import get_current_user, get_db
from app.models.problem import Problem, ProblemStatus
from app.models.submission import Result, Submission, SubmitMode, Verdict
from app.models.user import User
from app.schemas.problem import TopicOut
from app.schemas.stats import DifficultyBucket, DomainBucket, HeatmapDay, MeStats, TopicBucket
from app.services.progress import get_attempted_problem_ids, get_solved_problem_ids

router = APIRouter(prefix="/api/me", tags=["me"])

HEATMAP_WEEKS = 26
DOMAINS = ("vlsi", "embedded", "communication", "others")
_DIFFICULTY_ORDER = {"easy": 0, "medium": 1, "hard": 2}


def _day_key(value) -> str:  # noqa: ANN001  date from Postgres, or str from other drivers
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


@router.get("/stats", response_model=MeStats)
def my_stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> MeStats:
    published = db.query(Problem).filter(Problem.status == ProblemStatus.published).options(selectinload(Problem.topics)).all()
    published_ids = {p.id for p in published}

    solved_ids = get_solved_problem_ids(db, user.id) & published_ids
    attempted_ids = (get_attempted_problem_ids(db, user.id) & published_ids) - solved_ids

    by_difficulty: dict[str, dict[str, int]] = defaultdict(lambda: {"solved": 0, "total": 0})
    by_domain: dict[str, dict[str, int]] = {d: {"solved": 0, "total": 0} for d in DOMAINS}
    by_topic: dict[str, dict] = {}
    for p in published:
        solved = p.id in solved_ids
        for bucket in (by_difficulty[p.difficulty], by_domain.setdefault(p.domain, {"solved": 0, "total": 0})):
            bucket["total"] += 1
            bucket["solved"] += int(solved)
        for t in p.topics:
            tb = by_topic.setdefault(str(t.id), {"topic": t, "solved": 0, "total": 0})
            tb["total"] += 1
            tb["solved"] += int(solved)

    # Whole weeks, Monday first, so the grid's columns line up as weeks.
    today = date.today()
    since = today - timedelta(days=today.weekday()) - timedelta(weeks=HEATMAP_WEEKS - 1)
    day_col = func.date(Submission.created_at)
    base = db.query(day_col.label("d")).filter(
        Submission.user_id == user.id, Submission.mode == SubmitMode.submit, day_col >= since
    )
    submits = {
        _day_key(d): n
        for d, n in base.with_entities(day_col.label("d"), func.count(Submission.id)).group_by("d").all()
    }
    solves = {
        _day_key(d): n
        for d, n in base.join(Result, Result.submission_id == Submission.id)
        .filter(Result.verdict == Verdict.CORRECT)
        .with_entities(day_col.label("d"), func.count(distinct(Submission.problem_id)))
        .group_by("d")
        .all()
    }

    heatmap: list[HeatmapDay] = []
    d = since
    while d <= today:
        key = d.isoformat()
        heatmap.append(HeatmapDay(date=key, solved=solves.get(key, 0), submissions=submits.get(key, 0)))
        d += timedelta(days=1)

    # A streak still counts if today has no submit yet: it runs back from
    # yesterday in that case.
    active = [h.submissions > 0 for h in heatmap]
    i = len(active) - 1
    if i >= 0 and not active[i]:
        i -= 1
    current = 0
    while i >= 0 and active[i]:
        current += 1
        i -= 1
    longest = run = 0
    for on in active:
        run = run + 1 if on else 0
        longest = max(longest, run)

    total_submissions = (
        db.query(func.count(Submission.id))
        .filter(Submission.user_id == user.id, Submission.mode == SubmitMode.submit)
        .scalar()
        or 0
    )

    return MeStats(
        total_solved=len(solved_ids),
        total_attempted=len(attempted_ids),
        total_problems=len(published),
        total_submissions=total_submissions,
        by_difficulty=[
            DifficultyBucket(difficulty=k, solved=v["solved"], total=v["total"])
            for k, v in sorted(by_difficulty.items(), key=lambda kv: _DIFFICULTY_ORDER.get(kv[0], 99))
        ],
        by_domain=[DomainBucket(domain=k, solved=v["solved"], total=v["total"]) for k, v in by_domain.items()],
        by_topic=[
            TopicBucket(topic=TopicOut.model_validate(v["topic"]), solved=v["solved"], total=v["total"])
            for v in sorted(by_topic.values(), key=lambda v: v["topic"].name)
        ],
        heatmap=heatmap,
        current_streak=current,
        longest_streak=longest,
    )


class RecentItem(BaseModel):
    submission_id: str
    created_at: datetime
    slug: str
    number: int
    title: str
    domain: str
    verdict_word: str
    passed: int | None
    total: int | None


class NextUp(BaseModel):
    slug: str
    number: int
    title: str
    domain: str
    difficulty: str
    status: str  # attempted | new


class MeRecent(BaseModel):
    recent: list[RecentItem]
    next_up: NextUp | None


@router.get("/recent", response_model=MeRecent)
def my_recent(limit: int = Query(5, ge=1, le=20), db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> MeRecent:
    """The Progress page's "Recent attempts" and "Next up". Next up is the
    lowest-numbered published problem not yet solved, preferring one already
    attempted, so the page always points somewhere sensible."""
    rows = (
        db.query(Submission, Result, Problem)
        .join(Result, Result.submission_id == Submission.id)
        .join(Problem, Problem.id == Submission.problem_id)
        .filter(Submission.user_id == user.id, Submission.mode == SubmitMode.submit)
        .order_by(Submission.created_at.desc())
        .limit(limit)
        .all()
    )
    recent = [
        RecentItem(
            submission_id=str(s.id),
            created_at=s.created_at,
            slug=p.slug,
            number=p.number,
            title=p.title,
            domain=p.domain,
            verdict_word=r.verdict_word or "",
            passed=r.passed,
            total=r.total,
        )
        for s, r, p in rows
    ]

    solved = get_solved_problem_ids(db, user.id)
    attempted = get_attempted_problem_ids(db, user.id) - solved
    unsolved = (
        db.query(Problem)
        .filter(Problem.status == ProblemStatus.published, Problem.id.notin_(list(solved)))
        .order_by(Problem.number)
        .all()
    )
    pick = next((p for p in unsolved if p.id in attempted), None) or (unsolved[0] if unsolved else None)
    next_up = (
        NextUp(
            slug=pick.slug, number=pick.number, title=pick.title, domain=pick.domain, difficulty=pick.difficulty,
            status="attempted" if pick.id in attempted else "new",
        )
        if pick
        else None
    )
    return MeRecent(recent=recent, next_up=next_up)
