from app.engine.score import score_submission
from app.engine.types import TestOutcome


def test_interface_bucket_awarded_on_compile_alone():
    result = score_submission(
        rubric={"interface": 20, "functional": 80},
        tests_by_bucket={"functional": ["T1"]},
        outcomes=[TestOutcome(id="T1", status="PASS")],
        compile_ok=True,
    )
    assert result.breakdown["interface"] == 20
    assert result.total == 100


def test_interface_bucket_zero_when_compile_fails():
    result = score_submission(
        rubric={"interface": 20, "functional": 80},
        tests_by_bucket={"functional": ["T1"]},
        outcomes=[],
        compile_ok=False,
    )
    assert result.breakdown["interface"] == 0
    assert result.breakdown["functional"] == 0
    assert result.total == 0


def test_partial_bucket_scales_by_pass_ratio():
    result = score_submission(
        rubric={"functional": 70},
        tests_by_bucket={"functional": ["T1", "T2", "T3"]},
        outcomes=[
            TestOutcome(id="T1", status="PASS"),
            TestOutcome(id="T2", status="FAIL"),
            TestOutcome(id="T3", status="PASS"),
        ],
        compile_ok=True,
    )
    # 2/3 * 70 = 46.67 -> rounds to 47, matching the worked example in the design doc
    assert result.breakdown["functional"] == 47


def test_uncertain_outcome_counts_as_not_passed():
    result = score_submission(
        rubric={"functional": 100},
        tests_by_bucket={"functional": ["T1", "T2"]},
        outcomes=[TestOutcome(id="T1", status="PASS"), TestOutcome(id="T2", status="UNCERTAIN")],
        compile_ok=True,
    )
    assert result.breakdown["functional"] == 50


def test_all_pass_sums_to_100():
    result = score_submission(
        rubric={"interface": 20, "functional": 70, "combinational": 10},
        tests_by_bucket={"functional": ["T1", "T2"]},
        outcomes=[TestOutcome(id="T1", status="PASS"), TestOutcome(id="T2", status="PASS")],
        compile_ok=True,
    )
    assert result.total == 100
