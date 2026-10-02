"""The validation gate every problem passes before students can see it.

One implementation, used by both the admin Validate button and the seed
on boot, so a hand-edited seed file and a wizard-built problem are held to
exactly the same bar.

  1. The reference solution scores 100.
  2. An empty stub scores below 100 (the bench can actually fail).
  3. Every declared test id is printed by the bench, and nothing else.
  4. At least one visible test exists, and every visible test is checked
     before any hidden one, both in the bench source and in simulated
     time. Run cuts its waveform at the last visible check, so this is
     what keeps hidden stimuli out of the browser.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.engine import sim
from app.engine.grader import grade_submission, run_visible_tests
from app.engine.stub import build_stub_module
from app.engine.types import ProblemSpec


@dataclass
class GateResult:
    ok: bool
    ref_score: int
    stub_score: int
    log: str


def _ok(flag: bool) -> str:
    return "OK" if flag else "FAIL"


def visible_order_problem(spec: ProblemSpec) -> str | None:
    """Static half of check 4. Returns what is wrong, or None."""
    visible = [t.test_id for t in spec.tests if t.visible]
    if not visible:
        return "mark at least one test as visible"
    order = sim.testbench_test_order(spec.testbench_sv)
    position = {tid: i for i, tid in enumerate(order)}
    hidden = [t.test_id for t in spec.tests if not t.visible]
    if any(tid not in position for tid in visible + hidden):
        return "every test id must appear in a ##TEST line of the bench"
    if hidden and max(position[t] for t in visible) > min(position[t] for t in hidden):
        return f"visible tests must come first in the bench; bench order is {', '.join(order)}"
    return None


def run_gate(spec: ProblemSpec) -> GateResult:
    lines: list[str] = []

    ref = grade_submission(spec, spec.reference_sv, with_feedback=False)
    ref_score = ref.score.total if ref.score else 0
    check1 = ref.verdict == "CORRECT" and ref_score == 100
    lines.append(f"[1] reference scores 100: {_ok(check1)} (got {ref_score}, verdict {ref.verdict})")

    stub = grade_submission(spec, build_stub_module(spec), with_feedback=False)
    stub_score = stub.score.total if stub.score else 0
    check2 = stub_score < 100
    lines.append(f"[2] empty stub scores below 100: {_ok(check2)} (got {stub_score})")

    declared = {t.test_id for t in spec.tests}
    seen = {o.id for o in ref.simulation.tests if o.status != "UNCERTAIN"} if ref.simulation else set()
    check3 = declared == seen
    lines.append(f"[3] test ids reconcile: {_ok(check3)} (declared {sorted(declared)}, simulator {sorted(seen)})")

    problem = visible_order_problem(spec)
    if problem is None:
        # Dynamic half: the visible checks really do happen first in time.
        run = run_visible_tests(spec, spec.reference_sv)
        timed = run.verdict_word == "PASSED" and all(o.at_ns is not None for o in run.tests)
        if not timed:
            problem = f"reference does not pass the visible tests on Run ({run.verdict_word})"
        elif ref.simulation is not None:
            hidden_ids = {t.test_id for t in spec.tests if not t.visible}
            last_visible = max(o.at_ns for o in run.tests)
            hidden_ats = _hidden_check_times(spec, hidden_ids)
            if hidden_ats and min(hidden_ats) < last_visible:
                problem = "a hidden test is checked before the last visible one in simulated time"
    check4 = problem is None
    lines.append(f"[4] visible tests run first: {_ok(check4)}" + (f" ({problem})" if problem else ""))

    return GateResult(ok=check1 and check2 and check3 and check4, ref_score=ref_score, stub_score=stub_score, log="\n".join(lines))


def _hidden_check_times(spec: ProblemSpec, hidden_ids: set[str]) -> list[float]:
    """Simulated times of the hidden checks, from one instrumented run of the
    reference. Only the gate ever looks at these."""
    if not hidden_ids:
        return []
    top = sim.testbench_top_module(spec.testbench_sv, spec.module) or "tb"
    tb = sim.instrument_testbench(spec.testbench_sv, top)
    _c, _t, _u, stdout, _d, _v = sim.compile_and_run_files({"student.sv": spec.reference_sv, "tb.sv": tb})
    declared = {t.test_id: (t.category, t.purpose) for t in spec.tests if t.test_id in hidden_ids}
    outcomes, _ = sim.parse_tests(stdout, declared, sim.testbench_ns_per_unit(spec.testbench_sv))
    return [o.at_ns for o in outcomes if o.at_ns is not None]
