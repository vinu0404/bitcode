"""Standalone entry point for the grading engine; no database, no HTTP.

    python -m app.engine.cli grade api/app/seed/problems/counter4.json my_solution.sv

This is build-order step 2: prove static check -> compile -> simulate ->
score works correctly before any web layer exists.
"""

from __future__ import annotations

import argparse
import dataclasses
import json
import sys
from pathlib import Path

from app.engine.grader import grade_submission
from app.engine.loader import problem_spec_from_dict


def _grade(args: argparse.Namespace) -> int:
    problem_data = json.loads(Path(args.problem_json).read_text())
    spec = problem_spec_from_dict(problem_data)
    code = Path(args.student_sv).read_text()

    result = grade_submission(spec, code, with_feedback=not args.no_feedback)
    print(json.dumps(dataclasses.asdict(result), indent=2, default=str))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(prog="python -m app.engine.cli")
    sub = parser.add_subparsers(dest="command", required=True)

    grade_p = sub.add_parser("grade", help="Grade a student .sv file against a problem JSON spec.")
    grade_p.add_argument("problem_json")
    grade_p.add_argument("student_sv")
    grade_p.add_argument("--no-feedback", action="store_true", help="Skip the AI feedback call.")
    grade_p.set_defaults(func=_grade)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
