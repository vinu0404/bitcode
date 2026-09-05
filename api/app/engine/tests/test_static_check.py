from app.engine.static_check import static_check
from app.engine.types import Port, ProblemSpec

COMB_SPEC = ProblemSpec(
    slug="x", module="x", kind="combinational", ports=[Port("a", "input", 1)],
    banned_tasks=[], rubric={"interface": 100}, tests=[], testbench_sv="", reference_sv="",
)

SEQ_SPEC = ProblemSpec(
    slug="x", module="x", kind="sequential", ports=[Port("clk", "input", 1)],
    banned_tasks=[], rubric={"interface": 100}, tests=[], testbench_sv="", reference_sv="",
)


def test_clean_code_passes():
    assert static_check("module x(); endmodule", COMB_SPEC, 10_000) is None


def test_banned_system_task_rejected():
    reason = static_check('initial $system("rm -rf /");', COMB_SPEC, 10_000)
    assert reason is not None


def test_banned_task_inside_comment_is_ignored():
    assert static_check("// $system is not really called here\nassign y = a;", COMB_SPEC, 10_000) is None


def test_initial_block_rejected_in_design():
    assert static_check("initial y = 0;", COMB_SPEC, 10_000) is not None


def test_delay_rejected_in_design():
    assert static_check("assign #5 y = a;", COMB_SPEC, 10_000) is not None


def test_posedge_rejected_for_combinational():
    assert static_check("always @(posedge clk) y <= a;", COMB_SPEC, 10_000) is not None


def test_posedge_allowed_for_sequential():
    assert static_check("always @(posedge clk) q <= d;", SEQ_SPEC, 10_000) is None


def test_oversize_submission_rejected():
    huge = "a" * 20
    assert static_check(huge, COMB_SPEC, max_bytes=10) is not None
