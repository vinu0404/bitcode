"""Shared read-side query used by more than one router (the student
problem list's "solved" flag, and /api/me/stats) — kept in one place so
the query pattern, and the index it depends on, has exactly one
definition to reason about, not two copies that can silently drift."""

from __future__ import annotations

import uuid

from sqlalchemy import distinct
from sqlalchemy.orm import Session

from app.models.submission import Result, Submission, Verdict


def get_solved_problem_ids(db: Session, user_id: uuid.UUID) -> set[uuid.UUID]:
    """Every problem id this user has at least one CORRECT submission for.

    `submissions(user_id, created_at)` supplies the leading filter; the
    join to `results` resolves through its unique `submission_id` index —
    no sequential scan on either table.
    """
    rows = (
        db.query(distinct(Submission.problem_id))
        .join(Result, Result.submission_id == Submission.id)
        .filter(Submission.user_id == user_id, Result.verdict == Verdict.CORRECT)
        .all()
    )
    return {row[0] for row in rows}
