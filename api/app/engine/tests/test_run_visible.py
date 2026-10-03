"""Run: the visible tests against the real testbench, and the leak-safety
guarantees around it. Requires the real iverilog/vvp sandbox."""

import json
from dataclasses import replace
from pathlib import Path

import pytest

from app.engine.grader import run_visible_tests
from app.engine.loader import problem_spec_from_dict
from app.engine.validate import run_gate, visible_order_problem

SEED_DIR = Path(__file__).resolve().parents[2] / "seed" / "problems"
SLUGS = ["bitwise_xor8", "adder4", "mux4to1", "counter4", "shift_reg4"]


def _spec(slug: str):
    return problem_spec_from_dict(json.loads((SEED_DIR / f"{slug}.json").read_text()))


@pytest.mark.parametrize("slug", SLUGS)
def test_reference_passes_visible_tests_only(slug):
    spec = _spec(slug)
    result = run_visible_tests(spec, spec.reference_sv)
    visible = {t.test_id for t in spec.tests if t.visible}
    assert result.verdict_word == "PASSED"
    assert {o.id for o in result.tests} == visible
    assert all(o.at_ns is not None for o in result.tests)


@pytest.mark.parametrize("slug", SLUGS)
def test_waveform_stops_before_last_visible_check(slug):
    spec = _spec(slug)
    result = run_visible_tests(spec, spec.reference_sv)
    cutoff = max(o.at_ns for o in result.tests)
    assert result.waveform is not None
    assert result.waveform.end_time == cutoff
    port_names = {p.name for p in spec.ports}
    for sig in result.waveform.signals:
        assert sig.name in port_names
        assert all(t < cutoff for t, _ in sig.changes)


def test_console_never_mentions_hidden_tests():
    spec = _spec("counter4")
    result = run_visible_tests(spec, spec.reference_sv)
    text = " ".join(c.text for c in result.console)
    for t in spec.tests:
        if not t.visible:
            assert t.purpose not in text


def test_wrong_design_reports_expected_and_got():
    spec = _spec("counter4")
    buggy = spec.reference_sv.replace("count + 4'd1", "count + 4'd2")
    result = run_visible_tests(spec, buggy)
    assert result.verdict_word == "WRONG ANSWER"
    failed = [o for o in result.tests if o.status == "FAIL"]
    assert failed and failed[0].exp == "1" and failed[0].got == "2"


def test_print_in_design_is_a_compile_error_with_line():
    spec = _spec("bitwise_xor8")
    code = spec.reference_sv.replace("assign", 'always @(*) $display("%h", a);\n    assign', 1)
    result = run_visible_tests(spec, code)
    assert result.verdict_word == "COMPILE ERROR"
    assert result.console[0].line is not None


def test_gate_rejects_visible_test_after_hidden_one():
    spec = _spec("counter4")
    # T6 runs fourth in the bench; making it visible puts it after hidden T2.
    tests = [replace(t, visible=t.test_id in ("T1", "T6")) for t in spec.tests]
    bad = replace(spec, tests=tests)
    assert visible_order_problem(bad) is not None
    assert run_gate(bad).ok is False


def test_gate_rejects_no_visible_tests():
    spec = _spec("adder4")
    bad = replace(spec, tests=[replace(t, visible=False) for t in spec.tests])
    assert visible_order_problem(bad) == "mark at least one test as visible"
