"""The gate described in the design doc §7, run as plain pytest instead of
through the admin API; this is what CI (or a pre-deploy check) runs
against every problem in `app/seed/problems/`, and it is exactly what the
admin `/validate` endpoint runs against a problem authored through the UI.

Three checks per problem:
  1. reference.sv scores exactly 100
  2. an empty stub (right ports, no logic) scores below 100
  3. declared test ids reconcile with what the simulator actually prints
"""

import json
from pathlib import Path

import pytest

from app.engine.grader import grade_submission
from app.engine.loader import problem_spec_from_dict
from app.engine.stub import build_stub_module

SEED_DIR = Path(__file__).resolve().parents[1] / "problems"
SEED_FILES = sorted(SEED_DIR.glob("*.json"))


@pytest.fixture(scope="module", params=SEED_FILES, ids=lambda p: p.stem)
def problem(request):
    data = json.loads(request.param.read_text())
    return data, problem_spec_from_dict(data)


def test_rubric_sums_to_100(problem):
    data, _spec = problem
    assert sum(data["rubric"].values()) == 100, f"{data['slug']}: rubric does not sum to 100"


def test_every_test_bucket_is_a_rubric_bucket(problem):
    data, _spec = problem
    rubric_buckets = set(data["rubric"].keys())
    for t in data["tests"]:
        assert t["bucket"] in rubric_buckets, f"{data['slug']}: test {t['test_id']} references unknown bucket {t['bucket']!r}"


def test_reference_scores_exactly_100(problem):
    _data, spec = problem
    result = grade_submission(spec, spec.reference_sv, with_feedback=False)
    assert result.verdict == "CORRECT"
    assert result.score.total == 100


def test_stub_scores_below_100(problem):
    """The defect this catches: a testbench that never actually fails,
    which would silently award full marks to every student."""
    _data, spec = problem
    stub = build_stub_module(spec)
    result = grade_submission(spec, stub, with_feedback=False)
    assert result.score.total < 100


def test_declared_ids_reconcile_with_simulator_output(problem):
    _data, spec = problem
    result = grade_submission(spec, spec.reference_sv, with_feedback=False)
    declared_ids = {t.test_id for t in spec.tests}
    seen_ids = {o.id for o in result.simulation.tests}
    assert declared_ids == seen_ids, f"declared {declared_ids} != simulator {seen_ids}"
