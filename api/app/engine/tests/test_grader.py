"""End-to-end engine tests against the real iverilog/vvp sandbox.

These require iverilog to be installed; they run inside the api Docker
image (`docker compose run --rm api pytest app/engine/tests -v`), not on
a bare host. `with_feedback=False` everywhere so these never depend on
network access or an OpenAI key.
"""

import json
from pathlib import Path

import pytest

from app.engine.grader import grade_submission
from app.engine.loader import problem_spec_from_dict
from app.engine.static_check import DEFAULT_BANNED_TASKS
from app.engine.stub import build_stub_module

SEED_DIR = Path(__file__).resolve().parents[2] / "seed" / "problems"
SLUGS = ["bitwise_xor8", "adder4", "mux4to1", "counter4", "shift_reg4"]


def _spec(slug: str):
    data = json.loads((SEED_DIR / f"{slug}.json").read_text())
    return data, problem_spec_from_dict(data)


@pytest.mark.parametrize("slug", SLUGS)
def test_reference_scores_exactly_100(slug):
    _, spec = _spec(slug)
    result = grade_submission(spec, spec.reference_sv, with_feedback=False)
    assert result.verdict == "CORRECT", result
    assert result.score.total == 100, result.score


@pytest.mark.parametrize("slug", SLUGS)
def test_empty_stub_scores_below_100(slug):
    """This is the admin validation gate's second check: a testbench that
    still awards full marks to a design with no logic never actually
    fails anything."""
    _, spec = _spec(slug)
    stub = build_stub_module(spec)
    result = grade_submission(spec, stub, with_feedback=False)
    assert result.score.total < 100, result.score


@pytest.mark.parametrize("slug", SLUGS)
def test_declared_test_ids_reconcile_with_simulator_output(slug):
    _, spec = _spec(slug)
    result = grade_submission(spec, spec.reference_sv, with_feedback=False)
    declared_ids = {t.test_id for t in spec.tests}
    seen_ids = {o.id for o in result.simulation.tests}
    assert declared_ids == seen_ids


def test_worked_example_wrong_operator():
    """The design-doc worked example: assign y = a + b; instead of a ^ b;"""
    _, spec = _spec("bitwise_xor8")
    buggy = (
        "module bitwise_xor8 (\n"
        "    input  logic [7:0] a,\n"
        "    input  logic [7:0] b,\n"
        "    output logic [7:0] y\n"
        ");\n"
        "    assign y = a + b;\n"
        "endmodule\n"
    )
    result = grade_submission(spec, buggy, with_feedback=False)
    assert result.verdict == "PARTIAL"
    assert result.score.breakdown["interface"] == 20
    assert result.score.breakdown["combinational"] == 10
    failed_ids = {o.id for o in result.simulation.tests if o.status == "FAIL"}
    assert failed_ids == {"T3", "T5", "T7"}


def test_banned_system_task_rejected_before_compiling():
    _, spec = _spec("bitwise_xor8")
    code = f'module bitwise_xor8(input logic [7:0] a, b, output logic [7:0] y);\n initial {DEFAULT_BANNED_TASKS[0]}("echo hi");\nendmodule\n'
    result = grade_submission(spec, code, with_feedback=False)
    assert result.verdict == "INCORRECT"
    assert result.static_reject_reason is not None
    assert result.simulation is None


def test_compile_error_returns_incorrect_with_stderr():
    _, spec = _spec("bitwise_xor8")
    broken = "module bitwise_xor8( this is not valid verilog"
    result = grade_submission(spec, broken, with_feedback=False)
    assert result.verdict == "INCORRECT"
    assert result.compile.ok is False
    assert result.score.total == 0


def test_self_inverting_output_is_x_not_a_hang():
    """A raw self-referencing NOT (`y = ~y`) is the naive way to picture an
    oscillating combinational loop, but 4-state simulation damps it: NOT
    of X is X, so it settles to X in one step instead of spinning the
    simulator. That settling; not a hang; is what actually happens, and
    it's still a real defect (undefined outputs), just via a different
    detector than the CPU-timeout one below."""
    _, spec = _spec("bitwise_xor8")
    code = (
        "module bitwise_xor8 (\n"
        "    input  logic [7:0] a,\n"
        "    input  logic [7:0] b,\n"
        "    output logic [7:0] y\n"
        ");\n"
        "    always @(*) y = ~y;\n"
        "endmodule\n"
    )
    result = grade_submission(spec, code, with_feedback=False)
    assert result.verdict == "NEEDS_VERIFICATION"
    assert result.simulation.undefined_outputs is True


def test_unbounded_loop_times_out():
    """`always @(*)` with a body that only ever reads/writes a variable
    private to the same process never actually triggers in this Icarus
    build; its auto-sensitivity inference elides self-only variables, a
    real quirk confirmed by hand before writing this test (a `count`
    incremented in such a loop stayed exactly 0). Reacting to an actual
    driven input (`always @(a)`) does trigger, and an unconditional
    `while(1)` inside genuinely spins the simulator's CPU forever; no
    #delay, no banned task, so static_check has nothing to reject. RLIMIT_CPU
    kills the vvp process well before the wall-clock subprocess timeout;
    sim.py must still report this as timed_out."""
    _, spec = _spec("bitwise_xor8")
    hang = (
        "module bitwise_xor8 (\n"
        "    input  logic [7:0] a,\n"
        "    input  logic [7:0] b,\n"
        "    output logic [7:0] y\n"
        ");\n"
        "    always @(a) begin\n"
        "        while (1) y = y + 1;\n"
        "    end\n"
        "endmodule\n"
    )
    result = grade_submission(spec, hang, with_feedback=False)
    assert result.verdict == "NEEDS_VERIFICATION"
    assert result.simulation.timed_out is True
