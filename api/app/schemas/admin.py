import uuid

from pydantic import BaseModel, Field

from app.schemas.problem import TopicOut


class PortIn(BaseModel):
    name: str
    dir: str = Field(pattern="^(input|output)$")
    width: int = Field(ge=1, le=64)
    desc: str = ""  # shown in the statement's port table


class TestIn(BaseModel):
    test_id: str
    purpose: str
    category: str
    hint: str
    bucket: str
    visible: bool = False


class SampleIn(BaseModel):
    """One worked example shown in the statement: EXAMPLE 01 / INPUT, EXPECTED."""

    input: str = Field(min_length=1, max_length=300)
    expected: str = Field(min_length=1, max_length=300)


class ProblemCreate(BaseModel):
    slug: str = Field(pattern="^[a-z][a-z0-9_]*$")
    number: int | None = Field(default=None, ge=1, le=9999)  # next free number when omitted
    title: str
    domain: str = Field(default="vlsi", pattern="^(vlsi|embedded|communication|others)$")
    language: str = Field(default="sv", pattern="^(sv|v)$")
    hints: list[str] = Field(default_factory=list)
    difficulty: str = Field(pattern="^(easy|medium|hard)$")
    kind: str = Field(pattern="^(combinational|sequential)$")
    statement_md: str
    starter_code: str | None = None  # auto-generated from `ports` when omitted (design doc §7 step 2)
    ports: list[PortIn]
    rubric: dict[str, int]
    sample_tests: list[SampleIn] = Field(default_factory=list)
    tests: list[TestIn] = Field(default_factory=list)
    banned_tasks: list[str] = Field(default_factory=list)
    reset_sync: bool | None = None
    reset_active_high: bool | None = None
    topics: list[str] = Field(default_factory=list)  # names; find-or-create, no separate "manage topics" step needed


class ProblemUpdate(BaseModel):
    """Same shape as create; PATCH replaces the editable fields wholesale
    and resets status to draft; see design doc §7."""

    number: int | None = Field(default=None, ge=1, le=9999)
    title: str | None = None
    domain: str | None = Field(default=None, pattern="^(vlsi|embedded|communication|others)$")
    language: str | None = Field(default=None, pattern="^(sv|v)$")
    hints: list[str] | None = None
    difficulty: str | None = Field(default=None, pattern="^(easy|medium|hard)$")
    kind: str | None = Field(default=None, pattern="^(combinational|sequential)$")
    statement_md: str | None = None
    starter_code: str | None = None
    ports: list[PortIn] | None = None
    rubric: dict[str, int] | None = None
    sample_tests: list[SampleIn] | None = None
    tests: list[TestIn] | None = None
    banned_tasks: list[str] | None = None
    topics: list[str] | None = None
    # Sequential problems only. Null on both clears the reset constraint.
    reset_sync: bool | None = None
    reset_active_high: bool | None = None


class ProblemAssetsIn(BaseModel):
    testbench_sv: str
    reference_sv: str


class AiDraftOut(BaseModel):
    testbench_sv: str
    reference_sv: str


class ValidationOut(BaseModel):
    ok: bool
    ref_score: int | None
    stub_score: int | None
    log: str


class AdminProblemOut(BaseModel):
    id: uuid.UUID
    slug: str
    number: int
    title: str
    domain: str
    language: str
    difficulty: str
    kind: str
    status: str
    order_index: int
    rubric: dict[str, int]
    topics: list[TopicOut] = []

    model_config = {"from_attributes": True}


class AdminProblemDetail(AdminProblemOut):
    """Everything the editor needs to reopen a problem, hidden assets included.
    Admin only; the student endpoints never return this shape."""

    statement_md: str
    starter_code: str
    interface: dict
    constraints: dict
    sample_tests: list[dict]
    hints: list[str]
    tests: list[TestIn]
    testbench_sv: str
    reference_sv: str
    last_validation: "ValidationOut | None" = None


class AdminSummary(BaseModel):
    total: int
    by_status: dict[str, int]
