"""Orchestrates the grading pipeline described in the design doc:

  1. static check   -> hard reject, no compile
  2. compile         -> iverilog
  3. simulate         -> vvp, parse ##TEST lines
  4. score            -> pure function of rubric + outcomes
  5. explain          -> LLM, skipped at a perfect score
 (6. persist is a router/DB concern, not part of the engine)

`grade_submission` takes a `ProblemSpec` and student code and returns a
`GradeResult`; nothing here touches FastAPI or SQLAlchemy.
"""

from __future__ import annotations

from app.config import settings
from app.engine import feedback as feedback_mod
from app.engine import sim
from app.engine import tbgen
from app.engine import vcdparse
from app.engine.score import score_submission
from app.engine.static_check import static_check
import re

from app.engine.types import (
    CompileResult,
    ConsoleLine,
    GradeResult,
    ProblemSpec,
    RunResult,
    ScoreResult,
    SimResult,
    TestOutcome,
    TestsRunResult,
    Waveform,
    WaveSignal,
)


def _zero_score(rubric: dict[str, int]) -> ScoreResult:
    return ScoreResult(total=0, breakdown={bucket: 0 for bucket in rubric})


def grade_submission(spec: ProblemSpec, code: str, *, with_feedback: bool = True) -> GradeResult:
    # Stage 1; static check
    reject_reason = static_check(code, spec, settings.sim_max_code_bytes)
    if reject_reason:
        return GradeResult(
            verdict="INCORRECT",
            compile=CompileResult(ok=False, errors=reject_reason),
            simulation=None,
            score=_zero_score(spec.rubric),
            ai_feedback=None,
            static_reject_reason=reject_reason,
            verdict_word="COMPILE ERROR",
        )

    # Stages 2 & 3; compile + simulate, sandboxed. Never captures a
    # waveform here; see sim.compile_and_run_files's docstring.
    compile_result, timed_out, undefined_outputs, stdout, duration_ms, _vcd = sim.compile_and_run(code, spec.testbench_sv)

    if not compile_result.ok:
        ai = feedback_mod.generate_feedback(spec.module, code, compile_result=compile_result) if with_feedback else None
        return GradeResult(
            verdict="INCORRECT",
            compile=compile_result,
            simulation=None,
            score=_zero_score(spec.rubric),
            ai_feedback=ai,
            verdict_word="COMPILE ERROR",
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

    all_passed = total > 0 and passed == total
    # The undefined-output smell is a crude regex over stdout; once every
    # test has printed PASS and the bench reached ##DONE, the checks
    # themselves are the stronger evidence.
    if simulation.timed_out or not saw_done or (simulation.undefined_outputs and not all_passed):
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
        verdict_word=_verdict_word(simulation.timed_out, saw_done, all_passed),
    )


def _verdict_word(timed_out: bool, saw_done: bool, all_passed: bool) -> str:
    if timed_out:
        return "TIME LIMIT"
    if not saw_done:
        return "RUNTIME ERROR"
    return "ACCEPTED" if all_passed else "WRONG ANSWER"


def run_custom_vectors(spec: ProblemSpec, code: str, vectors: list[dict[str, str]]) -> RunResult:
    """Powers `POST /submissions/run`; tier 1 custom tests (design doc §4).
    Unscored: compiles the student's module alongside `reference.sv`
    (renamed to avoid a duplicate-module-name clash) and prints both
    outputs for each vector the student typed in. The reference *output*
    is revealed for an input the student chose; the reference *source*
    never is; it's never sent anywhere the student can read it.
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
    # student's own inputs; nothing hidden to leak by showing the full
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


# ── Run: visible tests only ────────────────────────────────────────────

_DIAG_RE = re.compile(r"^(?P<file>[\w.]+):(?P<line>\d+):\s*(?P<kind>error|warning|sorry)?:?\s*(?P<msg>.*)$")


def _compile_console(compile_result: CompileResult) -> list[ConsoleLine]:
    """Turn iverilog's stderr/stdout into CC console lines. Only the
    student's own file keeps its line number; anything pointing into the
    testbench is reported without a location, since its source is hidden."""
    stamp = f"{compile_result.duration_ms}ms"
    lines: list[ConsoleLine] = []
    # iverilog writes warnings to stderr too, so a successful compile's
    # stderr is all warnings.
    err_level = "error" if not compile_result.ok else "warn"
    for raw, default_level in ((compile_result.errors, err_level), (compile_result.warnings, "warn")):
        for text in raw.splitlines():
            text = text.strip()
            if not text:
                continue
            if text.startswith(":") and lines:
                # Continuation of the previous diagnostic.
                lines[-1].text += " " + text.lstrip(": ").strip()
                continue
            m = _DIAG_RE.match(text)
            if m:
                level = {"error": "error", "sorry": "error", "warning": "warn"}.get(m.group("kind") or "", default_level)
                if m.group("file") == "student.sv":
                    lines.append(ConsoleLine(stamp, "CC", level, m.group("msg") or text, line=int(m.group("line"))))
                else:
                    lines.append(ConsoleLine(stamp, "CC", level, f"Test bench: {m.group('msg') or text}"))
            elif "I give up" in text or text.endswith("error(s) during elaboration."):
                lines.append(ConsoleLine(stamp, "CC", "error", text))
            else:
                lines.append(ConsoleLine(stamp, "CC", default_level, text))
    if compile_result.ok:
        lines.append(ConsoleLine(stamp, "CC", "info", f"Compiled student.sv in {compile_result.duration_ms}ms"))
    return lines


def _fmt_ns(ns: float | int) -> str:
    return f"{int(ns) if float(ns).is_integer() else ns}ns"


def _cut_waveform(wave: Waveform, spec: ProblemSpec, cutoff_ns: float | None) -> Waveform | None:
    """Keep only the problem's ports, in port order, and nothing at or after
    `cutoff_ns`. The cut is strict: the first hidden test may set its inputs
    in the very same timestep as the last visible check."""
    by_name = {s.name: s for s in wave.signals}
    out: list[WaveSignal] = []
    for port in spec.ports:
        sig = by_name.get(port.name)
        if sig is None:
            continue
        changes = sig.changes if cutoff_ns is None else [c for c in sig.changes if c[0] < cutoff_ns]
        kind = "clock" if port.dir == "input" and port.name in ("clk", "clock") else port.dir
        out.append(WaveSignal(name=sig.name, width=sig.width, changes=changes, kind=kind))
    if not out:
        return None
    end = wave.end_time if cutoff_ns is None else min(wave.end_time, cutoff_ns)
    return Waveform(end_time=end, signals=out)


def run_visible_tests(spec: ProblemSpec, code: str) -> TestsRunResult:
    """Powers Run: executes the problem's real testbench against the
    student's design but reports only the visible tests.

    Leak safety rests on three things. The validation gate guarantees every
    visible test executes before any hidden one. Hidden `##TEST` lines are
    dropped here and never returned. The waveform is cut at the last visible
    check, so no hidden stimulus or expected value reaches the browser; and
    static_check stops the design itself from printing or dumping.
    """
    visible = [t for t in spec.tests if t.visible]
    visible_ids = {t.test_id for t in visible}

    reject_reason = static_check(code, spec, settings.sim_max_code_bytes)
    if reject_reason:
        m = re.match(r"^Line (\d+):", reject_reason)
        console = [ConsoleLine("0ms", "CC", "error", reject_reason, line=int(m.group(1)) if m else None)]
        return TestsRunResult(
            compile=CompileResult(ok=False, errors=reject_reason),
            ran=False,
            timed_out=False,
            console=console,
            verdict_word="COMPILE ERROR",
        )

    top = sim.testbench_top_module(spec.testbench_sv, spec.module) or "tb"
    tb = sim.instrument_testbench(spec.testbench_sv, top)
    ns_per_unit = sim.testbench_ns_per_unit(spec.testbench_sv)

    compile_result, timed_out, _undef, stdout, duration_ms, vcd_text = sim.compile_and_run_files(
        {"student.sv": code, "tb.sv": tb}, capture_vcd=True
    )
    console = _compile_console(compile_result)
    if not compile_result.ok:
        return TestsRunResult(
            compile=compile_result, ran=False, timed_out=False, console=console, verdict_word="COMPILE ERROR"
        )

    declared = {t.test_id: (t.category, t.purpose) for t in visible}
    outcomes, _saw_done = sim.parse_tests(stdout, declared, ns_per_unit)
    # parse_tests only reports declared ids, so hidden lines are already gone.
    outcomes = [o for o in outcomes if o.id in visible_ids]

    reached = [o.at_ns for o in outcomes if o.at_ns is not None]
    all_reached = len(reached) == len(outcomes)
    has_hidden = len(visible_ids) < len(spec.tests)
    # If every visible check printed, cut there. If one never printed the
    # run died first, so nothing hidden had started and the whole trace is
    # safe to show.
    cutoff = max(reached) if (reached and all_reached and has_hidden) else None
    run_timed_out = (timed_out or sim.saw_timeout_marker(stdout)) and not all_reached

    for o in sorted(outcomes, key=lambda o: o.at_ns if o.at_ns is not None else float("inf")):
        if o.status == "UNCERTAIN":
            continue
        idx = next(i for i, t in enumerate(spec.tests, 1) if t.test_id == o.id)
        detail = f"TEST {idx:02d} {o.status}: {o.purpose}"
        if o.status == "FAIL" and o.exp is not None:
            detail += f" (expected {o.exp}, got {o.got})"
        console.append(ConsoleLine(_fmt_ns(o.at_ns or 0), "TB", "error" if o.status == "FAIL" else "info", detail))

    if run_timed_out:
        console.append(ConsoleLine(f"{duration_ms}ms", "SIM", "error", "Simulation hit the time limit before every visible test ran. Look for a loop with no clock edge."))
    elif not all_reached:
        console.append(ConsoleLine(f"{duration_ms}ms", "SIM", "error", "Simulation stopped before every visible test ran."))
    else:
        stop = _fmt_ns(cutoff) if cutoff is not None else "the end"
        console.append(ConsoleLine(f"{duration_ms}ms", "SIM", "info", f"Simulated to {stop} in {duration_ms}ms"))

    waveform = None
    if vcd_text:
        parsed = vcdparse.parse_vcd(vcd_text)
        if parsed is not None:
            waveform = _cut_waveform(parsed, spec, cutoff)

    if run_timed_out:
        word = "TIME LIMIT"
    elif not all_reached:
        word = "RUNTIME ERROR"
    elif all(o.status == "PASS" for o in outcomes):
        word = "PASSED"
    else:
        word = "WRONG ANSWER"

    return TestsRunResult(
        compile=compile_result,
        ran=True,
        timed_out=run_timed_out,
        tests=outcomes,
        console=console,
        waveform=waveform,
        duration_ms=duration_ms,
        verdict_word=word,
    )
