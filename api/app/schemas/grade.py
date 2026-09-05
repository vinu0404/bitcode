"""Response shapes mirroring the design doc's §8 JSON schema. Simulation
truth and model opinion are always separate top-level objects — never
merged into one number the frontend (or a student) could confuse."""

from pydantic import BaseModel, ConfigDict

# Every nested schema below is validated straight off the engine's plain
# dataclasses (CompileResult, SimResult, ScoreResult, AiFeedback, ...) —
# from_attributes lets pydantic read them by attribute instead of
# requiring a dict, so the routers can pass a GradeResult's fields through
# unconverted.
_FROM_ATTRS = ConfigDict(from_attributes=True)


class CompileOut(BaseModel):
    model_config = _FROM_ATTRS
    ok: bool
    errors: str
    warnings: str


class TestOutcomeOut(BaseModel):
    model_config = _FROM_ATTRS
    id: str
    status: str  # PASS | FAIL | UNCERTAIN
    category: str
    purpose: str


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
    changes: list[list]  # [[time, value], ...] — value is "0"/"1"/"x"/"z" or a binary string for buses


class WaveformOut(BaseModel):
    model_config = _FROM_ATTRS
    end_time: int | float  # nanoseconds
    signals: list[WaveSignalOut]


class RunResponse(BaseModel):
    compile: CompileOut
    ran: bool
    timed_out: bool
    comparisons: list[VecComparisonOut]
    # Only ever populated on /run — see RunResult's docstring for why
    # /submit deliberately never fills these in.
    raw_log: str = ""
    waveform: WaveformOut | None = None
