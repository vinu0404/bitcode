from pydantic import BaseModel

from app.schemas.problem import TopicOut


class DifficultyBucket(BaseModel):
    difficulty: str
    solved: int
    total: int


class DomainBucket(BaseModel):
    domain: str  # vlsi | embedded | communication | others
    solved: int
    total: int


class TopicBucket(BaseModel):
    topic: TopicOut
    solved: int
    total: int


class HeatmapDay(BaseModel):
    date: str  # YYYY-MM-DD
    solved: int  # distinct problems accepted that day; drives the cell fill
    submissions: int  # every submit that day; drives the streak


class MeStats(BaseModel):
    total_solved: int
    total_attempted: int  # submitted at least once but not solved
    total_problems: int
    total_submissions: int
    by_difficulty: list[DifficultyBucket]
    by_domain: list[DomainBucket]  # all four domains, in domain order, even when empty
    by_topic: list[TopicBucket]
    heatmap: list[HeatmapDay]  # one entry per day, oldest first, whole weeks ending on today's week
    current_streak: int  # consecutive days with at least one submit
    longest_streak: int
