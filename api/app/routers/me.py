"""Aggregates for the student's own dashboard — solved-by-difficulty ring,
topic bubbles, and the submission activity heatmap. Every number here is
derived live from `submissions`/`results`; no new fact-table beyond
`topics`/`problem_topics` was needed for this."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.deps import get_current_user, get_db
from app.models.problem import Problem, ProblemStatus
from app.models.submission import Submission
from app.models.user import User
from app.schemas.problem import TopicOut
from app.schemas.stats import DifficultyBucket, HeatmapDay, MeStats, TopicBucket
from app.services.progress import get_solved_problem_ids

router = APIRouter(prefix="/api/me", tags=["me"])

HEATMAP_WEEKS = 20
_DIFFICULTY_ORDER = {"easy": 0, "medium": 1, "hard": 2}


@router.get("/stats", response_model=MeStats)
def my_stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> MeStats:
    published = db.query(Problem).filter(Problem.status == ProblemStatus.published).options(selectinload(Problem.topics)).all()
    total_problems = len(published)

    solved_problem_ids = get_solved_problem_ids(db, user.id)
    published_ids = {p.id for p in published}
    total_solved = len(solved_problem_ids & published_ids)

    by_difficulty: dict[str, dict[str, int]] = defaultdict(lambda: {"solved": 0, "total": 0})
    by_topic: dict[str, dict] = {}
    for p in published:
        bucket = by_difficulty[p.difficulty]
        bucket["total"] += 1
        solved = p.id in solved_problem_ids
        if solved:
            bucket["solved"] += 1
        for t in p.topics:
            tb = by_topic.setdefault(str(t.id), {"topic": t, "solved": 0, "total": 0})
            tb["total"] += 1
            if solved:
                tb["solved"] += 1

    by_difficulty_out = [
        DifficultyBucket(difficulty=k, solved=v["solved"], total=v["total"])
        for k, v in sorted(by_difficulty.items(), key=lambda kv: _DIFFICULTY_ORDER.get(kv[0], 99))
    ]
    by_topic_out = [
        TopicBucket(topic=TopicOut.model_validate(v["topic"]), solved=v["solved"], total=v["total"])
        for v in sorted(by_topic.values(), key=lambda v: v["topic"].name)
    ]

    # Activity heatmap: submissions per calendar day (UTC), last HEATMAP_WEEKS.
    since = date.today() - timedelta(days=HEATMAP_WEEKS * 7 - 1)
    day_col = func.date(Submission.created_at)
    rows = (
        db.query(day_col.label("d"), func.count(Submission.id))
        .filter(Submission.user_id == user.id, day_col >= since)
        .group_by("d")
        .all()
    )
    counts = {(r[0].isoformat() if hasattr(r[0], "isoformat") else str(r[0])): r[1] for r in rows}

    heatmap: list[HeatmapDay] = []
    d = since
    today = date.today()
    while d <= today:
        heatmap.append(HeatmapDay(date=d.isoformat(), count=counts.get(d.isoformat(), 0)))
        d += timedelta(days=1)

    # Current streak: consecutive active days counting back from today — a
    # gap-free run counts even if today itself has no submission yet.
    idx = {h.date: h.count for h in heatmap}
    check = today
    if idx.get(check.isoformat(), 0) == 0:
        check -= timedelta(days=1)
    streak = 0
    while idx.get(check.isoformat(), 0) > 0:
        streak += 1
        check -= timedelta(days=1)

    return MeStats(
        total_solved=total_solved,
        total_problems=total_problems,
        by_difficulty=by_difficulty_out,
        by_topic=by_topic_out,
        heatmap=heatmap,
        current_streak=streak,
    )
