"""Shared read-side queries used by more than one router (the problem
list's status and acceptance columns, the workspace header, and
/api/me/stats). Kept in one place so each query pattern, and the index it
depends on, has exactly one definition."""

from __future__ import annotations

import uuid

from sqlalchemy import case, distinct, func
from sqlalchemy.orm import Session

from app.models.submission import Result, Submission, SubmitMode, Verdict


def get_solved_problem_ids(db: Session, user_id: uuid.UUID) -> set[uuid.UUID]:
    """Every problem id this user has at least one CORRECT submission for.

    `submissions(user_id, created_at)` supplies the leading filter; the
    join to `results` resolves through its unique `submission_id` index.
    """
    rows = (
        db.query(distinct(Submission.problem_id))
        .join(Result, Result.submission_id == Submission.id)
        .filter(Submission.user_id == user_id, Result.verdict == Verdict.CORRECT)
        .all()
    )
    return {row[0] for row in rows}


def get_attempted_problem_ids(db: Session, user_id: uuid.UUID) -> set[uuid.UUID]:
    """Every problem id this user has submitted at least once, solved or not."""
    rows = (
        db.query(distinct(Submission.problem_id))
        .filter(Submission.user_id == user_id, Submission.mode == SubmitMode.submit)
        .all()
    )
    return {row[0] for row in rows}


def problem_status(problem_id: uuid.UUID, solved: set[uuid.UUID], attempted: set[uuid.UUID]) -> str:
    if problem_id in solved:
        return "solved"
    if problem_id in attempted:
        return "attempted"
    return "new"


def get_acceptance(db: Session, problem_ids: list[uuid.UUID]) -> dict[uuid.UUID, float]:
    """Accepted submits as a percentage of all submits, per problem, across
    every user. Served by `ix_submissions_problem_mode`. Problems nobody has
    submitted yet are absent from the result."""
    if not problem_ids:
        return {}
    rows = (
        db.query(
            Submission.problem_id,
            func.count(Submission.id),
            func.sum(case((Result.verdict == Verdict.CORRECT, 1), else_=0)),
        )
        .join(Result, Result.submission_id == Submission.id)
        .filter(Submission.problem_id.in_(problem_ids), Submission.mode == SubmitMode.submit)
        .group_by(Submission.problem_id)
        .all()
    )
    return {pid: round(100.0 * (accepted or 0) / total, 1) for pid, total, accepted in rows if total}
