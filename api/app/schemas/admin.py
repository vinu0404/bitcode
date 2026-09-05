import uuid

from pydantic import BaseModel, Field

from app.schemas.problem import TopicOut


class PortIn(BaseModel):
    name: str
    dir: str = Field(pattern="^(input|output)$")
    width: int = Field(ge=1, le=64)


class TestIn(BaseModel):
    test_id: str
    purpose: str
    category: str
    hint: str
    bucket: str


class ProblemCreate(BaseModel):
    slug: str = Field(pattern="^[a-z][a-z0-9_]*$")
    title: str
    difficulty: str = Field(pattern="^(easy|medium|hard)$")
    kind: str = Field(pattern="^(combinational|sequential)$")
    statement_md: str
    starter_code: str | None = None  # auto-generated from `ports` when omitted (design doc §7 step 2)
    ports: list[PortIn]
    rubric: dict[str, int]
    sample_tests: list[dict] = Field(default_factory=list)
    tests: list[TestIn] = Field(default_factory=list)
    banned_tasks: list[str] = Field(default_factory=list)
    reset_sync: bool | None = None
    reset_active_high: bool | None = None
    topics: list[str] = Field(default_factory=list)  # names — find-or-create, no separate "manage topics" step needed


class ProblemUpdate(BaseModel):
    """Same shape as create; PATCH replaces the editable fields wholesale
    and resets status to draft — see design doc §7."""

    title: str | None = None
    difficulty: str | None = None
    statement_md: str | None = None
    starter_code: str | None = None
    ports: list[PortIn] | None = None
    rubric: dict[str, int] | None = None
    sample_tests: list[dict] | None = None
    tests: list[TestIn] | None = None
    banned_tasks: list[str] | None = None
    topics: list[str] | None = None


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
    title: str
    difficulty: str
    kind: str
    status: str
    order_index: int
    rubric: dict[str, int]
    topics: list[TopicOut] = []

    model_config = {"from_attributes": True}
