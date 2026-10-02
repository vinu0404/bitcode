"""Plain dataclasses shared across the grading engine.

Nothing in `app.engine` imports FastAPI or SQLAlchemy. Routers translate
ORM rows into these dataclasses at the boundary; the engine itself is a
pure function of (ProblemSpec, student code) -> GradeResult, which is what
makes it unit-testable without a database and reusable from the CLI.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Port:
    name: str
    dir: str  # "input" | "output"
    width: int


@dataclass
class TestMeta:
    test_id: str  # "T1"
    purpose: str  # "Same values cancel"
    category: str  # reset | width | logic | timing | interface
    hint: str
    bucket: str  # which rubric bucket this test's pass/fail feeds
    # Visible tests run on Run with full EXPECTED/GOT and a waveform; hidden
    # ones only ever report a number and a status. The validation gate
    # enforces that every visible test executes before any hidden one, so
    # a waveform cut at the last visible check can't contain hidden stimuli.
    visible: bool = False


@dataclass
class ProblemSpec:
    slug: str
    module: str
    kind: str  # "combinational" | "sequential"
    ports: list[Port]
    banned_tasks: list[str]
    rubric: dict[str, int]  # bucket -> points, must sum to 100
    tests: list[TestMeta]
    testbench_sv: str
    reference_sv: str


@dataclass
class CompileResult:
    ok: bool
    errors: str = ""
    warnings: str = ""
    duration_ms: int = 0


@dataclass
class TestOutcome:
    id: str
    status: str  # PASS | FAIL | UNCERTAIN
    category: str = ""
    purpose: str = ""
    exp: str | None = None
    got: str | None = None
    at_ns: float | None = None  # simulation time the test bench checked this test


@dataclass
class SimResult:
    ran: bool
    timed_out: bool
    undefined_outputs: bool
    passed: int
    total: int
    duration_ms: int
    tests: list[TestOutcome] = field(default_factory=list)
    raw_stdout: str = ""


@dataclass
class ScoreResult:
    total: int
    breakdown: dict[str, int]


@dataclass
class AiFeedback:
    summary: str
    hint: str
    confidence: str  # low | medium | high
    model: str
    generated: bool


@dataclass
class GradeResult:
    verdict: str  # CORRECT | PARTIAL | INCORRECT | NEEDS_VERIFICATION
    compile: CompileResult
    simulation: SimResult | None
    score: ScoreResult | None
    ai_feedback: AiFeedback | None
    static_reject_reason: str | None = None
    # The word the UI shows (design spec 6.4): ACCEPTED, WRONG ANSWER,
    # COMPILE ERROR, TIME LIMIT, RUNTIME ERROR. `verdict` stays the stored,
    # stats-facing value.
    verdict_word: str = ""


@dataclass
class VecComparison:
    inputs: dict[str, str]
    your_output: dict[str, str]
    expected_output: dict[str, str]
    match: bool


@dataclass
class WaveSignal:
    name: str
    width: int
    changes: list[list]  # [[time, value_as_binary_str_or_0/1/x/z], ...], time-ordered
    kind: str = ""  # clock | input | output, set by the caller from the problem's ports


@dataclass
class Waveform:
    end_time: int | float  # nanoseconds; converted from raw VCD ticks, see vcdparse.py
    signals: list[WaveSignal]


@dataclass
class RunResult:
    """Result of POST /submissions/run; unscored, compares against reference.sv live.

    `raw_log` and `waveform` are only ever populated here, never on a graded
    submission; the student's own vectors have nothing hidden to protect,
    so the full simulator output and a real waveform are safe to hand back.
    """

    compile: CompileResult
    ran: bool
    timed_out: bool
    comparisons: list[VecComparison] = field(default_factory=list)
    raw_log: str = ""
    waveform: Waveform | None = None


@dataclass
class ConsoleLine:
    time: str  # "8ms" for compiler lines, "40ns" (simulation time) for test bench lines
    source: str  # CC (compiler) | TB (test bench) | SIM (simulator)
    level: str  # info | warn | error
    text: str
    line: int | None = None  # line in the student's file, when the message points at one


@dataclass
class TestsRunResult:
    """Result of Run: the problem's visible tests only."""

    compile: CompileResult
    ran: bool
    timed_out: bool
    tests: list[TestOutcome] = field(default_factory=list)
    console: list[ConsoleLine] = field(default_factory=list)
    waveform: Waveform | None = None
    duration_ms: int = 0
    verdict_word: str = ""  # PASSED | WRONG ANSWER | COMPILE ERROR | TIME LIMIT | RUNTIME ERROR
