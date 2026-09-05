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


@dataclass
class TestOutcome:
    id: str
    status: str  # PASS | FAIL | UNCERTAIN
    category: str = ""
    purpose: str = ""
    exp: str | None = None
    got: str | None = None


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


@dataclass
class Waveform:
    end_time: int | float  # nanoseconds — converted from raw VCD ticks, see vcdparse.py
    signals: list[WaveSignal]


@dataclass
class RunResult:
    """Result of POST /submissions/run — unscored, compares against reference.sv live.

    `raw_log` and `waveform` are only ever populated here, never on a graded
    submission — the student's own vectors have nothing hidden to protect,
    so the full simulator output and a real waveform are safe to hand back.
    """

    compile: CompileResult
    ran: bool
    timed_out: bool
    comparisons: list[VecComparison] = field(default_factory=list)
    raw_log: str = ""
    waveform: Waveform | None = None
