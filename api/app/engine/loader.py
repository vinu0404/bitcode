"""Build a ProblemSpec from the JSON shape used by both the seed files
(`app/seed/problems/*.json`) and the CLI. Kept separate from `grader.py`
so the CLI can run against a bare JSON file with no database at all:
this is what build-order step 2 in the plan means by "engine standalone".
"""

from __future__ import annotations

from app.engine.types import Port, ProblemSpec, TestMeta


def problem_spec_from_orm(problem) -> ProblemSpec:  # noqa: ANN001; app.models.Problem, avoided to keep engine DB-free
    """Same construction as `problem_spec_from_dict`, but reading straight
    off SQLAlchemy rows. Requires `problem.asset` and `problem.tests` to be
    loaded. This is the ONLY place a router-side ORM row crosses into the
    engine's plain-dataclass world; the engine itself never imports
    SQLAlchemy."""
    interface = problem.interface
    ports = [Port(name=p["name"], dir=p["dir"], width=p["width"]) for p in interface["ports"]]
    tests = [
        TestMeta(
            test_id=t.test_id,
            purpose=t.purpose,
            category=t.category,
            hint=t.hint,
            bucket=t.bucket,
            visible=bool(t.visible),
        )
        for t in problem.tests
    ]
    return ProblemSpec(
        slug=problem.slug,
        module=interface["module"],
        kind=problem.kind.value if hasattr(problem.kind, "value") else problem.kind,
        ports=ports,
        banned_tasks=problem.constraints.get("banned_tasks", []),
        rubric=problem.rubric,
        tests=tests,
        testbench_sv=problem.asset.testbench_sv,
        reference_sv=problem.asset.reference_sv,
    )


def problem_spec_from_dict(data: dict) -> ProblemSpec:
    interface = data["interface"]
    ports = [Port(name=p["name"], dir=p["dir"], width=p["width"]) for p in interface["ports"]]
    tests = [
        TestMeta(
            test_id=t["test_id"],
            purpose=t["purpose"],
            category=t["category"],
            hint=t["hint"],
            bucket=t["bucket"],
            visible=bool(t.get("visible", False)),
        )
        for t in data["tests"]
    ]
    return ProblemSpec(
        slug=data["slug"],
        module=interface["module"],
        kind=data["kind"],
        ports=ports,
        banned_tasks=data.get("constraints", {}).get("banned_tasks", []),
        rubric=data["rubric"],
        tests=tests,
        testbench_sv=data["testbench_sv"],
        reference_sv=data["reference_sv"],
    )
