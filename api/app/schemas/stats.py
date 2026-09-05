from pydantic import BaseModel
from app.schemas.problem import TopicOut


class DifficultyBucket(BaseModel):
    difficulty: str
    solved: int
    total: int


class TopicBucket(BaseModel):
    topic: TopicOut
    solved: int
    total: int


class HeatmapDay(BaseModel):
    date: str  # YYYY-MM-DD
    count: int


class MeStats(BaseModel):
    total_solved: int
    total_problems: int
    by_difficulty: list[DifficultyBucket]
    by_topic: list[TopicBucket]
    heatmap: list[HeatmapDay]  # one entry per day, oldest first
    current_streak: int
