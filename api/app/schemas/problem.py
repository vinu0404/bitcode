import uuid
from datetime import datetime

from pydantic import BaseModel


class TopicOut(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    slug: str
    name: str


class ProblemListItem(BaseModel):
    id: uuid.UUID
    slug: str
    number: int
    title: str
    domain: str
    language: str
    difficulty: str
    kind: str
    status: str  # solved | attempted | new, for the current user
    acceptance: float | None  # share of all submits that were accepted, 0 to 100; None before any submit
    topics: list[TopicOut] = []


class TestCaseOut(BaseModel):
    """One row of the Tests list. Hidden tests carry only their number:
    what they check is part of what stays hidden."""

    number: int  # 1-based position, shown as TEST 03
    id: str
    visible: bool
    name: str | None  # behaviour name, visible tests only


class ProblemDetail(BaseModel):
    id: uuid.UUID
    slug: str
    number: int
    title: str
    domain: str
    language: str
    difficulty: str
    kind: str
    statement_md: str
    starter_code: str
    interface: dict  # {module, ports:[{name,dir,width}]}
    constraints: list[str]  # human-readable, one per line
    rubric: dict[str, int]
    sample_tests: list[dict]
    hints: list[str]
    tests: list[TestCaseOut]
    status: str
    topics: list[TopicOut] = []


class SubmissionListItem(BaseModel):
    id: uuid.UUID
    created_at: datetime
    verdict: str
    verdict_word: str
    passed: int | None
    total: int | None
    score: int | None
    sim_ms: int | None
