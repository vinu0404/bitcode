"""performance indexes

Every index here is tied to a query that actually runs today; not
speculative. Before this migration:

  - `submissions` had ZERO indexes beyond its primary key. Postgres does
    NOT auto-index a foreign-key column (only the referenced side gets
    one); every "my submissions" / "have I solved this" / heatmap query
    (list_problems, admin list, /api/me/stats) was a full table scan on
    user_id.
  - `problems` had only a unique index on `slug`. Every list endpoint
    filters `status` and orders by `order_index`; also a full scan.
  - `problem_tests` had no index on `problem_id`, despite being read on
    every single grade call (`_load_published_problem` in both
    submissions.py and admin.py).

Deliberately NOT added: a bare `submissions.problem_id` index (nothing in
the codebase filters on it alone; always paired with user_id, which the
composite below already covers as its leading column), a `results.verdict`
index (always reached through a submissions.user_id-narrowed join, never
scanned globally), and anything on `problem_validations` (admin-only,
low-frequency, and its `problem.validations` collection is never read back
in application code; only appended to). Indexes cost write throughput and
storage; add one when a real query needs it, not by default.

Revision ID: c8e2a1f4b7d9
Revises: a4f19c2e7d3b
Create Date: 2026-09-02
"""

from alembic import op

revision = "c8e2a1f4b7d9"
down_revision = "a4f19c2e7d3b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_problems_status_order", "problems", ["status", "order_index"])
    op.create_index("ix_submissions_user_created", "submissions", ["user_id", "created_at"])
    op.create_index("ix_problem_tests_problem_id", "problem_tests", ["problem_id"])


def downgrade() -> None:
    op.drop_index("ix_problem_tests_problem_id", table_name="problem_tests")
    op.drop_index("ix_submissions_user_created", table_name="submissions")
    op.drop_index("ix_problems_status_order", table_name="problems")
