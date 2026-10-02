"""Stage 4; score. A pure function of (rubric, declared tests, test outcomes).

No model, no I/O, nothing probabilistic. Two identical submissions always
receive identical scores.

The "interface" bucket (and any bucket with zero declared tests) is scored
by compile success alone; this mirrors the rubrics in the problem spec,
where "correct module name and ports" is awarded once the design binds
cleanly, not by a dedicated hidden test.
"""

from __future__ import annotations

from app.engine.types import ScoreResult, TestOutcome


def score_submission(
    rubric: dict[str, int],
    tests_by_bucket: dict[str, list[str]],  # bucket -> [test_id, ...]
    outcomes: list[TestOutcome],
    compile_ok: bool,
) -> ScoreResult:
    outcome_by_id = {o.id: o for o in outcomes}
    breakdown: dict[str, int] = {}

    for bucket, points in rubric.items():
        test_ids = tests_by_bucket.get(bucket, [])
        if not test_ids:
            # Interface-style bucket: awarded on clean compile.
            breakdown[bucket] = points if compile_ok else 0
            continue

        passed = sum(1 for tid in test_ids if outcome_by_id.get(tid) and outcome_by_id[tid].status == "PASS")
        total = len(test_ids)
        breakdown[bucket] = round(points * passed / total) if total else 0

    return ScoreResult(total=sum(breakdown.values()), breakdown=breakdown)
