"""Orchestrates the grading pipeline described in the design doc:

  1. static check   -> hard reject, no compile
  2. compile         -> iverilog
  3. simulate         -> vvp, parse ##TEST lines
  4. score            -> pure function of rubric + outcomes
  5. explain          -> LLM, skipped at a perfect score
 (6. persist is a router/DB concern, not part of the engine)

`grade_submission` takes a `ProblemSpec` and student code and returns a
`GradeResult` — nothing here touches FastAPI or SQLAlchemy.
"""

from __future__ import annotations

from app.config import settings
from app.engine import feedback as feedback_mod
from app.engine import sim
from app.engine import tbgen
from app.engine import vcdparse
from app.engine.score import score_submission
from app.engine.static_check import static_check
from app.engine.types import CompileResult, GradeResult, ProblemSpec, RunResult, ScoreResult, SimResult


def _zero_score(rubric: dict[str, int]) -> ScoreResult:
    return ScoreResult(total=0, breakdown={bucket: 0 for bucket in rubric})


def grade_submission(spec: ProblemSpec, code: str, *, with_feedback: bool = True) -> GradeResult:
    # Stage 1 — static check
    reject_reason = static_check(code, spec, settings.sim_max_code_bytes)
    if reject_reason:
        return GradeResult(
            verdict="INCORRECT",
            compile=CompileResult(ok=False, errors=reject_reason),
            simulation=None,
            score=_zero_score(spec.rubric),
            ai_feedback=None,
            static_reject_reason=reject_reason,
        )

    # Stages 2 & 3 — compile + simulate, sandboxed. Never captures a
    # waveform here — see sim.compile_and_run_files's docstring.
    compile_result, timed_out, undefined_outputs, stdout, duration_ms, _vcd = sim.compile_and_run(code, spec.testbench_sv)

    if not compile_result.ok:
        ai = feedback_mod.generate_feedback(spec.module, code, compile_result=compile_result) if with_feedback else None
        return GradeResult(
            verdict="INCORRECT",
            compile=compile_result,
            simulation=None,
            score=_zero_score(spec.rubric),
            ai_feedback=ai,
        )

    declared = {t.test_id: (t.category, t.purpose) for t in spec.tests}
    outcomes, saw_done = sim.parse_tests(stdout, declared)
    saw_timeout_marker = sim.saw_timeout_marker(stdout)

    passed = sum(1 for o in outcomes if o.status == "PASS")
    total = len(outcomes)

    simulation = SimResult(
        ran=True,
        timed_out=timed_out or saw_timeout_marker,
        undefined_outputs=undefined_outputs,
        passed=passed,
        total=total,
        duration_ms=duration_ms,
        tests=outcomes,
        raw_stdout=stdout,
    )

    tests_by_bucket: dict[str, list[str]] = {}
    for t in spec.tests:
        tests_by_bucket.setdefault(t.bucket, []).append(t.test_id)

    score = score_submission(spec.rubric, tests_by_bucket, outcomes, compile_ok=True)

    if simulation.timed_out or simulation.undefined_outputs or not saw_done:
        verdict = "NEEDS_VERIFICATION"
    elif score.total >= 100:
        verdict = "CORRECT"
    elif score.total <= 0:
        verdict = "INCORRECT"
    else:
        verdict = "PARTIAL"

    ai_feedback = None
    if with_feedback and verdict != "CORRECT":
        ai_feedback = feedback_mod.generate_feedback(spec.module, code, outcomes=outcomes)

    return GradeResult(
        verdict=verdict,
        compile=compile_result,
        simulation=simulation,
        score=score,
        ai_feedback=ai_feedback,
    )


def run_custom_vectors(spec: ProblemSpec, code: str, vectors: list[dict[str, str]]) -> RunResult:
    """Powers `POST /submissions/run` — tier 1 custom tests (design doc §4).
    Unscored: compiles the student's module alongside `reference.sv`
    (renamed to avoid a duplicate-module-name clash) and prints both
    outputs for each vector the student typed in. The reference *output*
    is revealed for an input the student chose; the reference *source*
    never is — it's never sent anywhere the student can read it.
    """
    reject_reason = static_check(code, spec, settings.sim_max_code_bytes)
    if reject_reason:
        return RunResult(compile=CompileResult(ok=False, errors=reject_reason), ran=False, timed_out=False)

    ref_module = f"{spec.module}__ref"
    ref_renamed = tbgen.rename_module(spec.reference_sv, spec.module, ref_module)
    try:
        custom_tb = tbgen.build_custom_tb(spec, vectors)
    except KeyError as exc:
        return RunResult(compile=CompileResult(ok=False, errors=f"Vector is missing required input {exc}."), ran=False, timed_out=False)
    except ValueError as exc:
        return RunResult(compile=CompileResult(ok=False, errors=f"Invalid vector value: {exc}"), ran=False, timed_out=False)

    files = {"student.sv": code, "ref.sv": ref_renamed, "tb.sv": custom_tb}
    # capture_vcd=True: safe here specifically because these are the
    # student's own inputs — nothing hidden to leak by showing the full
    # trace. Never done on /submit (see sim.compile_and_run_files).
    compile_result, timed_out, _undefined, stdout, _duration_ms, vcd_text = sim.compile_and_run_files(files, capture_vcd=True)

    if not compile_result.ok:
        return RunResult(compile=compile_result, ran=False, timed_out=False)

    comparisons = sim.parse_vectors(stdout)
    waveform = vcdparse.parse_vcd(vcd_text) if vcd_text else None
    return RunResult(
        compile=compile_result,
        ran=True,
        timed_out=timed_out or sim.saw_timeout_marker(stdout),
        comparisons=comparisons,
        raw_log=stdout,
        waveform=waveform,
    )
