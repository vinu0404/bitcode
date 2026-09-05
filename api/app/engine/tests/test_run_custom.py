"""End-to-end test of POST /submissions/run's engine half: compiling the
student's module alongside a renamed reference.sv and comparing outputs
for student-supplied vectors. Requires the real iverilog/vvp sandbox."""

import json
from pathlib import Path

from app.engine.grader import run_custom_vectors
from app.engine.loader import problem_spec_from_dict

SEED_DIR = Path(__file__).resolve().parents[2] / "seed" / "problems"


def _spec(slug: str):
    data = json.loads((SEED_DIR / f"{slug}.json").read_text())
    return problem_spec_from_dict(data)


def test_combinational_matching_solution_all_match():
    spec = _spec("bitwise_xor8")
    result = run_custom_vectors(spec, spec.reference_sv, [{"a": "0x5A", "b": "0x5A"}, {"a": "0xFF", "b": "0x0F"}])
    assert result.compile.ok
    assert result.ran
    assert len(result.comparisons) == 2
    assert all(c.match for c in result.comparisons)
    assert result.comparisons[0].expected_output["y"] == "0"
    assert result.comparisons[1].expected_output["y"] == "f0"


def test_combinational_buggy_solution_reveals_diff_for_chosen_input():
    """This is the exact worked example from the design doc: the student
    picks a=0x5A, b=0x5A after a failed submission and sees the mismatch."""
    spec = _spec("bitwise_xor8")
    buggy = (
        "module bitwise_xor8 (\n"
        "    input  logic [7:0] a,\n"
        "    input  logic [7:0] b,\n"
        "    output logic [7:0] y\n"
        ");\n"
        "    assign y = a + b;\n"
        "endmodule\n"
    )
    result = run_custom_vectors(spec, buggy, [{"a": "0x5A", "b": "0x5A"}])
    assert result.compile.ok
    comparison = result.comparisons[0]
    assert comparison.match is False
    assert comparison.your_output["y"] == "b4"
    assert comparison.expected_output["y"] == "0"


def test_sequential_custom_vectors_by_cycle():
    spec = _spec("counter4")
    result = run_custom_vectors(
        spec, spec.reference_sv, [{"reset": "1"}, {"reset": "0"}, {"reset": "0"}, {"reset": "0"}]
    )
    assert result.compile.ok
    assert len(result.comparisons) == 4
    assert all(c.match for c in result.comparisons)
    assert result.comparisons[0].expected_output["count"] == "0"
    assert result.comparisons[3].expected_output["count"] == "3"


def test_run_rejects_banned_construct_without_compiling():
    spec = _spec("bitwise_xor8")
    code = 'module bitwise_xor8(input logic [7:0] a, b, output logic [7:0] y);\ninitial $system("x");\nendmodule\n'
    result = run_custom_vectors(spec, code, [{"a": "0x00", "b": "0x00"}])
    assert result.ran is False
    assert result.compile.ok is False
