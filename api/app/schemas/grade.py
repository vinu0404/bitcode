"""Response shapes mirroring the design doc's §8 JSON schema. Simulation
truth and model opinion are always separate top-level objects, never
merged into one number the frontend (or a student) could confuse."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict

# Every nested schema below is validated straight off the engine's plain
# dataclasses (CompileResult, SimResult, ScoreResult, AiFeedback, ...);
# from_attributes lets pydantic read them by attribute instead of
# requiring a dict, so the routers can pass a GradeResult's fields through
# unconverted.
_FROM_ATTRS = ConfigDict(from_attributes=True)


class CompileOut(BaseModel):
    model_config = _FROM_ATTRS
    ok: bool
    errors: str
    warnings: str
    duration_ms: int = 0


class TestOutcomeOut(BaseModel):
    """One test result as the student sees it. For a hidden test only
    `number`, `id` and `status` are ever filled; the router clears the rest
    (see submissions._public_tests)."""

    number: int  # 1-based position in the problem's test list: TEST 03
    id: str
    status: str  # PASS | FAIL | UNCERTAIN
    visible: bool
    name: str | None = None  # behaviour name, e.g. "wraps from 15 to 0"
    exp: str | None = None
    got: str | None = None
    at_ns: float | None = None


class SimulationOut(BaseModel):
    model_config = _FROM_ATTRS
    ran: bool
    timed_out: bool
    undefined_outputs: bool
    passed: int
    total: int
    duration_ms: int
    tests: list[TestOutcomeOut]


class ScoreOut(BaseModel):
    model_config = _FROM_ATTRS
    total: int
    breakdown: dict[str, int]


class AiFeedbackOut(BaseModel):
    model_config = _FROM_ATTRS
    summary: str
    hint: str
    confidence: str
    model: str
    generated: bool


class GradeResponse(BaseModel):
    submission_id: str
    mode: str
    verdict: str
    verdict_word: str
    created_at: datetime | None = None
    code: str | None = None  # only on GET of a past submission, to restore it into the editor
    compile: CompileOut
    simulation: SimulationOut | None
    score: ScoreOut | None
    ai_feedback: AiFeedbackOut | None


class VecComparisonOut(BaseModel):
    model_config = _FROM_ATTRS
    inputs: dict[str, str]
    your_output: dict[str, str]
    expected_output: dict[str, str]
    match: bool


class WaveSignalOut(BaseModel):
    model_config = _FROM_ATTRS
    name: str
    width: int
    changes: list[list]  # [[time, value], ...]; value is "0"/"1"/"x"/"z" or a binary string for buses
    kind: str = ""  # clock | input | output


class WaveformOut(BaseModel):
    model_config = _FROM_ATTRS
    end_time: int | float  # nanoseconds
    signals: list[WaveSignalOut]


class CustomRunResponse(BaseModel):
    compile: CompileOut
    ran: bool
    timed_out: bool
    comparisons: list[VecComparisonOut]
    # The student's own inputs have nothing hidden to protect, so the full
    # log and waveform are safe here. See RunResult's docstring.
    raw_log: str = ""
    waveform: WaveformOut | None = None


class ConsoleLineOut(BaseModel):
    model_config = _FROM_ATTRS
    time: str
    source: str  # CC | TB | SIM
    level: str  # info | warn | error
    text: str
    line: int | None = None


class RunResponse(BaseModel):
    """Run: the visible tests only, with console and a waveform cut at the
    last visible check. See grader.run_visible_tests."""

    verdict_word: str  # PASSED | WRONG ANSWER | COMPILE ERROR | TIME LIMIT | RUNTIME ERROR
    compile: CompileOut
    ran: bool
    timed_out: bool
    duration_ms: int
    tests: list[TestOutcomeOut]
    console: list[ConsoleLineOut]
    waveform: WaveformOut | None = None
