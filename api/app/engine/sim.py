"""Stages 2 & 3; compile with iverilog, simulate with vvp, sandboxed.

Everything that touches student code as an executable goes through this
module: subprocess only, rlimits on CPU/memory/file-size, a hard wall
timeout, output truncated at a byte cap, and the job directory always
removed. Compiling Verilog is far tamer than running arbitrary Python, but
it is still untrusted input, and this is the one place that matters.
"""

from __future__ import annotations

import re
import resource
import shutil
import subprocess
import tempfile
import threading
import time
from pathlib import Path

from app.config import settings
from app.engine.types import CompileResult, TestOutcome, VecComparison

# The optional `##AT <t>` prefix is added by `instrument_testbench` on Run,
# so each outcome carries the simulation time its check happened at.
_TEST_RE = re.compile(
    r"^(?:##AT\s+(\d+)\s+)?##TEST\s+(\S+)\s+(PASS|FAIL)(?:\s+exp=(\S+)\s+got=(\S+))?\s*$", re.MULTILINE
)
_DONE_RE = re.compile(r"^##DONE\s*$", re.MULTILINE)
_TIMEOUT_RE = re.compile(r"^##TIMEOUT\s*$", re.MULTILINE)
_X_OUTPUT_RE = re.compile(r"[xXzZ]{2,}")  # crude undefined-output smell in raw stdout

# Global concurrency cap: HF free tier is 2 vCPU. Guards compile+run as one unit.
_SIM_SEMAPHORE = threading.Semaphore(settings.sim_max_concurrency)


def _set_rlimits() -> None:
    cpu = settings.sim_cpu_seconds
    mem_bytes = settings.sim_memory_mb * 1024 * 1024
    resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu))
    resource.setrlimit(resource.RLIMIT_AS, (mem_bytes, mem_bytes))
    resource.setrlimit(resource.RLIMIT_FSIZE, (8 * 1024 * 1024, 8 * 1024 * 1024))
    resource.setrlimit(resource.RLIMIT_NPROC, (32, 32))


def _truncate(text: str) -> str:
    cap = settings.sim_max_output_bytes
    encoded = text.encode("utf-8", errors="replace")
    if len(encoded) <= cap:
        return text
    return encoded[:cap].decode("utf-8", errors="ignore") + "\n... [truncated]"


class SandboxRun:
    """One compile+simulate job in an isolated /tmp directory. `files` maps
    filename -> source; every key is passed to iverilog, in sorted order
    for a reproducible compile command. Two files (student.sv, tb.sv) for
    a normal grade; three (student.sv, ref.sv, tb.sv) for a `/run` custom
    comparison against the reference solution."""

    def __init__(self, files: dict[str, str]) -> None:
        self.files = files
        self.job_dir: Path | None = None

    def __enter__(self) -> "SandboxRun":
        self.job_dir = Path(tempfile.mkdtemp(prefix="bitcode-", dir=settings.sim_job_dir))
        for name, content in self.files.items():
            (self.job_dir / name).write_text(content)
        return self

    def __exit__(self, *exc: object) -> None:
        if self.job_dir and self.job_dir.exists():
            shutil.rmtree(self.job_dir, ignore_errors=True)

    def compile(self) -> CompileResult:
        assert self.job_dir is not None
        out_path = self.job_dir / "sim.vvp"
        started = time.monotonic()
        try:
            proc = subprocess.run(
                [settings.iverilog_bin, "-g2012", "-Wall", "-Wno-timescale", "-o", str(out_path), *sorted(self.files.keys())],
                cwd=self.job_dir,
                timeout=settings.sim_compile_timeout,
                capture_output=True,
                text=True,
            )
        except subprocess.TimeoutExpired:
            return CompileResult(ok=False, errors="Compilation timed out.")
        except FileNotFoundError:
            return CompileResult(ok=False, errors="iverilog is not installed in this environment.")

        return CompileResult(
            ok=proc.returncode == 0 and out_path.exists(),
            errors=_truncate(proc.stderr),
            warnings=_truncate(proc.stdout),
            duration_ms=int((time.monotonic() - started) * 1000),
        )

    def run(self) -> tuple[bool, str, int]:
        """Returns (timed_out, stdout, duration_ms).

        `timed_out` covers two distinct kills: the wall-clock `timeout=`
        below (a process that's merely slow), and RLIMIT_CPU/RLIMIT_AS
        killing the process with a signal well before that wall clock is
        reached (a zero-delay combinational loop spins pure CPU without
        ever blocking, so it dies by SIGXCPU, not by timing out; but it
        must be reported as uncertain either way)."""
        assert self.job_dir is not None
        vvp_path = self.job_dir / "sim.vvp"
        started = time.monotonic()
        try:
            proc = subprocess.run(
                [settings.vvp_bin, str(vvp_path)],
                cwd=self.job_dir,
                timeout=settings.sim_run_timeout,
                preexec_fn=_set_rlimits,
                capture_output=True,
                text=True,
            )
            duration_ms = int((time.monotonic() - started) * 1000)
            killed_by_rlimit = proc.returncode < 0  # negative == terminated by signal (SIGXCPU, SIGKILL, ...)
            return killed_by_rlimit, _truncate(proc.stdout + proc.stderr), duration_ms
        except subprocess.TimeoutExpired as e:
            duration_ms = int((time.monotonic() - started) * 1000)
            partial = (e.stdout or "") + (e.stderr or "")
            return True, _truncate(partial if isinstance(partial, str) else ""), duration_ms


def compile_and_run_files(
    files: dict[str, str], capture_vcd: bool = False
) -> tuple[CompileResult, bool, bool, str, int, str | None]:
    """Full sandboxed compile+run over an arbitrary file set.
    Returns (compile_result, timed_out, undefined_outputs, stdout, duration_ms, vcd_text).

    `vcd_text` is only ever populated when the caller passes capture_vcd=True
    *and* the testbench actually dumped one (only `/run`'s generated
    testbenches do; see tbgen.py). `/submit` never requests it: a waveform
    of a hidden test would hand the student its exact expected values,
    exactly what the anti-cheat design in the spec forbids."""
    with _SIM_SEMAPHORE:
        with SandboxRun(files) as sandbox:
            compile_result = sandbox.compile()
            if not compile_result.ok:
                return compile_result, False, False, "", 0, None

            timed_out, stdout, duration_ms = sandbox.run()
            undefined = bool(_X_OUTPUT_RE.search(stdout))

            vcd_text = None
            if capture_vcd:
                vcd_path = sandbox.job_dir / "dump.vcd"
                if vcd_path.exists():
                    vcd_text = _truncate(vcd_path.read_text(errors="replace"))

            return compile_result, timed_out, undefined, stdout, duration_ms, vcd_text


def compile_and_run(student_sv: str, testbench_sv: str) -> tuple[CompileResult, bool, bool, str, int, str | None]:
    """The normal two-file grading case: student module + hidden testbench.
    Never captures a waveform; see compile_and_run_files."""
    return compile_and_run_files({"student.sv": student_sv, "tb.sv": testbench_sv})


def parse_tests(
    stdout: str, declared: dict[str, tuple[str, str]], ns_per_unit: float = 1.0
) -> tuple[list[TestOutcome], bool]:
    """Parse ##TEST lines. `declared` maps test_id -> (category, purpose).

    Returns (outcomes, saw_done). Any declared test_id with no matching
    ##TEST line comes back as UNCERTAIN; this is what happens when a run
    times out partway through.
    """
    seen: dict[str, TestOutcome] = {}
    for m in _TEST_RE.finditer(stdout):
        at_raw, tid, status, exp, got = m.groups()
        category, purpose = declared.get(tid, ("", ""))
        at_ns = int(at_raw) * ns_per_unit if at_raw is not None else None
        seen[tid] = TestOutcome(
            id=tid, status=status, category=category, purpose=purpose, exp=exp, got=got, at_ns=at_ns
        )

    outcomes: list[TestOutcome] = []
    for tid, (category, purpose) in declared.items():
        if tid in seen:
            outcomes.append(seen[tid])
        else:
            outcomes.append(TestOutcome(id=tid, status="UNCERTAIN", category=category, purpose=purpose))

    saw_done = bool(_DONE_RE.search(stdout))
    return outcomes, saw_done


# ── Run instrumentation ────────────────────────────────────────────────
# Run executes the problem's real testbench, then shows only the visible
# tests. Two small rewrites make that possible without touching the stored
# testbench: every `##TEST` line gets the simulation time it was printed
# at, and the testbench module dumps its own top-level signals to a VCD.

_DISPLAY_TEST_RE = re.compile(r'\$display\(\s*"##TEST')
_TIMESCALE_RE = re.compile(r"`timescale\s+(\d+)\s*(fs|ps|ns|us|ms|s)\b")
_MODULE_RE = re.compile(r"\bmodule\s+(\w+)")
_ENDMODULE_RE = re.compile(r"\bendmodule\b")
_NS_PER_UNIT = {"fs": 1e-6, "ps": 1e-3, "ns": 1.0, "us": 1e3, "ms": 1e6, "s": 1e9}


def testbench_ns_per_unit(testbench_sv: str) -> float:
    """`$time` counts in the testbench module's own time unit. Icarus
    defaults to 1s when no `timescale is given."""
    m = _TIMESCALE_RE.search(testbench_sv)
    if not m:
        return 1e9
    return int(m.group(1)) * _NS_PER_UNIT[m.group(2)]


def testbench_test_order(testbench_sv: str) -> list[str]:
    """Test ids in the order their first `##TEST <id>` appears in the
    source. For the straight-line `initial` blocks every testbench uses,
    that is also execution order; the validation gate double-checks it
    against the timestamps of a real run."""
    order: list[str] = []
    for m in re.finditer(r"##TEST\s+(\w+)", testbench_sv):
        if m.group(1) not in order:
            order.append(m.group(1))
    return order


def instrument_testbench(testbench_sv: str, top_module: str) -> str:
    """Prefix each `##TEST` display with `##AT <$time>` and add a VCD dump
    of `top_module`'s own signals (depth 1, so nothing inside the DUT)."""
    out = _DISPLAY_TEST_RE.sub('$display("##AT %0d ##TEST', testbench_sv)
    # Every rewritten format string gained one `%0d`, so it needs `$time` as
    # its first argument: the closing quote of that string is followed by
    # either `,` (more args) or `)`.
    out = re.sub(r'(\$display\("##AT %0d ##TEST[^"]*")', r"\1, $time", out)

    start = None
    for m in _MODULE_RE.finditer(out):
        if m.group(1) == top_module:
            start = m.end()
            break
    if start is None:
        return out
    end = _ENDMODULE_RE.search(out, start)
    if end is None:
        return out
    dump = f'\n  initial begin\n    $dumpfile("dump.vcd");\n    $dumpvars(1, {top_module});\n  end\n'
    return out[: end.start()] + dump + out[end.start() :]


def testbench_top_module(testbench_sv: str, dut_module: str) -> str | None:
    for m in _MODULE_RE.finditer(testbench_sv):
        if m.group(1) != dut_module:
            return m.group(1)
    return None


def saw_timeout_marker(stdout: str) -> bool:
    return bool(_TIMEOUT_RE.search(stdout))


_VEC_RE = re.compile(r"^##VEC\s+(?:cycle:\d+\s+)?in:(.*?)\s+yours:(.*?)\s+expected:(.*?)\s+(MATCH|DIFF)\s*$", re.MULTILINE)
_KV_RE = re.compile(r"(\w+)=(\S+)")


def _parse_kv(group: str) -> dict[str, str]:
    return dict(_KV_RE.findall(group))


def parse_vectors(stdout: str) -> list[VecComparison]:
    out = []
    for m in _VEC_RE.finditer(stdout):
        in_group, yours_group, expected_group, verdict = m.groups()
        out.append(
            VecComparison(
                inputs=_parse_kv(in_group),
                your_output=_parse_kv(yours_group),
                expected_output=_parse_kv(expected_group),
                match=verdict == "MATCH",
            )
        )
    return out
