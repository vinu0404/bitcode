from pydantic import BaseModel, Field


class SubmitRequest(BaseModel):
    problem_slug: str
    code: str = Field(min_length=1)


class RunRequest(BaseModel):
    problem_slug: str
    code: str = Field(min_length=1)


class CustomRunRequest(BaseModel):
    problem_slug: str
    code: str = Field(min_length=1)
    vectors: list[dict[str, str]] = Field(default_factory=list, max_length=50)
