import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String, Table, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

# Many-to-many: a problem can carry more than one topic (e.g. counter4 is
# both "Sequential Logic" and "Counters"), and a topic spans many problems
# — the LeetCode-style bubble filter on the student dashboard reads off
# this table, not off `problems.kind` (which stays a structural fact about
# the circuit, not a study-taxonomy label).
problem_topics = Table(
    "problem_topics",
    Base.metadata,
    Column("problem_id", UUID(as_uuid=True), ForeignKey("problems.id", ondelete="CASCADE"), primary_key=True),
    Column("topic_id", UUID(as_uuid=True), ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True),
)


class ProblemStatus(str, enum.Enum):
    draft = "draft"
    validated = "validated"
    published = "published"
    archived = "archived"


class ProblemKind(str, enum.Enum):
    combinational = "combinational"
    sequential = "sequential"


class Problem(Base):
    __tablename__ = "problems"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    difficulty: Mapped[str] = mapped_column(String, nullable=False)  # easy | medium | hard
    kind: Mapped[ProblemKind] = mapped_column(Enum(ProblemKind, name="problem_kind"), nullable=False)
    statement_md: Mapped[str] = mapped_column(Text, nullable=False)
    starter_code: Mapped[str] = mapped_column(Text, nullable=False)
    interface: Mapped[dict] = mapped_column(JSONB, nullable=False)  # {module, ports:[{name,dir,width}]}
    constraints: Mapped[dict] = mapped_column(JSONB, nullable=False)  # {reset:{...}, banned_tasks:[...]}
    rubric: Mapped[dict] = mapped_column(JSONB, nullable=False)  # {interface:20, functional:70, semantics:10}
    sample_tests: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    status: Mapped[ProblemStatus] = mapped_column(
        Enum(ProblemStatus, name="problem_status"), nullable=False, default=ProblemStatus.draft
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    asset: Mapped["ProblemAsset | None"] = relationship(back_populates="problem", uselist=False, cascade="all, delete-orphan")
    tests: Mapped[list["ProblemTest"]] = relationship(back_populates="problem", cascade="all, delete-orphan", order_by="ProblemTest.order_index")
    validations: Mapped[list["ProblemValidation"]] = relationship(back_populates="problem", cascade="all, delete-orphan")
    topics: Mapped[list["Topic"]] = relationship(secondary=problem_topics, back_populates="problems", order_by="Topic.name")


class Topic(Base):
    """A study-taxonomy label ('Arithmetic', 'Counters', ...) — the bubble
    filter chips on the student dashboard. Created on the fly from the
    admin wizard (find-or-create by name), so adding problem #6 in a new
    area never requires a separate "manage topics" step first."""

    __tablename__ = "topics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    problems: Mapped[list["Problem"]] = relationship(secondary=problem_topics, back_populates="topics")


class ProblemAsset(Base):
    """Hidden material: testbench + reference solution.

    Deliberately its own table. No student-facing query joins this table,
    so leaking a hidden vector or the golden solution is a structural
    impossibility, not a rule someone has to remember to enforce.
    """

    __tablename__ = "problem_assets"

    problem_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("problems.id", ondelete="CASCADE"), primary_key=True)
    testbench_sv: Mapped[str] = mapped_column(Text, nullable=False)
    reference_sv: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    problem: Mapped["Problem"] = relationship(back_populates="asset")


class ProblemTest(Base):
    __tablename__ = "problem_tests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    problem_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False)
    test_id: Mapped[str] = mapped_column(String, nullable=False)  # 'T1'
    purpose: Mapped[str] = mapped_column(String, nullable=False)  # 'Same values cancel'
    category: Mapped[str] = mapped_column(String, nullable=False)  # reset|width|logic|timing|interface
    hint: Mapped[str] = mapped_column(Text, nullable=False)
    bucket: Mapped[str] = mapped_column(String, nullable=False)  # interface|functional|semantics
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    problem: Mapped["Problem"] = relationship(back_populates="tests")


class ProblemValidation(Base):
    __tablename__ = "problem_validations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    problem_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("problems.id", ondelete="CASCADE"), nullable=False)
    ok: Mapped[bool] = mapped_column(Boolean, nullable=False)
    ref_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    stub_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    log: Mapped[str | None] = mapped_column(Text, nullable=True)
    ran_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    problem: Mapped["Problem"] = relationship(back_populates="validations")
