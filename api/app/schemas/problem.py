import uuid

from pydantic import BaseModel


class TopicOut(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    slug: str
    name: str


class ProblemListItem(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    difficulty: str
    kind: str
    solved: bool = False
    topics: list[TopicOut] = []


class ProblemDetail(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    slug: str
    title: str
    difficulty: str
    kind: str
    statement_md: str
    starter_code: str
    interface: dict  # {module, ports:[{name,dir,width}]} — needed to render the custom-test panel
    rubric: dict[str, int]
    sample_tests: list[dict]
    topics: list[TopicOut] = []
