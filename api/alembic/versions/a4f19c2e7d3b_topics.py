"""topics + problem_topics

Revision ID: a4f19c2e7d3b
Revises: 11320ccf9a7e
Create Date: 2026-09-02
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "a4f19c2e7d3b"
down_revision = "11320ccf9a7e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "topics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_topics_slug", "topics", ["slug"], unique=True)

    op.create_table(
        "problem_topics",
        sa.Column("problem_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("problems.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("topic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_index("ix_problem_topics_topic_id", "problem_topics", ["topic_id"])


def downgrade() -> None:
    op.drop_index("ix_problem_topics_topic_id", table_name="problem_topics")
    op.drop_table("problem_topics")
    op.drop_index("ix_topics_slug", table_name="topics")
    op.drop_table("topics")
