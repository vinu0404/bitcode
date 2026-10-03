"""design system fields

Adds what the problem list and workspace now show:

  - problems.number: the public, zero-padded id ("0042"). Unique, so it
    can be linked and searched. Backfilled from order_index here; the seed
    and the admin wizard own it from then on.
  - problems.domain: channel of the problem (vlsi | embedded |
    communication | others), which picks its colour across the UI.
  - problems.language: sv | v, the label on each row and the editor mode.
  - problems.hints: ordered list of short hint strings for the Hints tab.
  - problem_tests.visible: visible tests run on Run with full detail and a
    waveform; hidden ones only report a number and a status.
  - results.verdict_word: the word the UI shows (ACCEPTED, WRONG ANSWER,
    COMPILE ERROR, TIME LIMIT, RUNTIME ERROR). It depends on run facts
    (timeout, missing ##DONE) that results does not otherwise keep, so it
    is stored at grading time rather than derived later. Older rows are
    backfilled from verdict and compile_ok as closely as those allow.
  - ix_submissions_problem_mode: acceptance rate per problem groups every
    submit-mode submission by problem, which no existing index covers (the
    user_id composite cannot serve a problem-wide scan).

Revision ID: d3f7b9a2c1e5
Revises: c8e2a1f4b7d9
Create Date: 2026-10-02
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "d3f7b9a2c1e5"
down_revision = "c8e2a1f4b7d9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("problems", sa.Column("number", sa.Integer(), nullable=True))
    op.add_column("problems", sa.Column("domain", sa.String(), nullable=False, server_default="vlsi"))
    op.add_column("problems", sa.Column("language", sa.String(), nullable=False, server_default="sv"))
    op.add_column("problems", sa.Column("hints", JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")))
    op.execute(
        """
        UPDATE problems p SET number = ranked.n
        FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY order_index, created_at) AS n FROM problems) ranked
        WHERE p.id = ranked.id
        """
    )
    op.alter_column("problems", "number", nullable=False)
    op.create_unique_constraint("uq_problems_number", "problems", ["number"])
    op.create_check_constraint(
        "ck_problems_domain", "problems", "domain IN ('vlsi', 'embedded', 'communication', 'others')"
    )
    op.create_check_constraint("ck_problems_language", "problems", "language IN ('sv', 'v')")

    op.add_column(
        "problem_tests", sa.Column("visible", sa.Boolean(), nullable=False, server_default=sa.text("false"))
    )

    op.add_column("results", sa.Column("verdict_word", sa.String(), nullable=True))
    op.execute(
        """
        UPDATE results SET verdict_word = CASE
            WHEN NOT compile_ok THEN 'COMPILE ERROR'
            WHEN verdict = 'CORRECT' THEN 'ACCEPTED'
            WHEN verdict = 'NEEDS_VERIFICATION' THEN 'RUNTIME ERROR'
            ELSE 'WRONG ANSWER'
        END
        """
    )

    op.create_index("ix_submissions_problem_mode", "submissions", ["problem_id", "mode"])


def downgrade() -> None:
    op.drop_index("ix_submissions_problem_mode", table_name="submissions")
    op.drop_column("results", "verdict_word")
    op.drop_column("problem_tests", "visible")
    op.drop_constraint("ck_problems_language", "problems", type_="check")
    op.drop_constraint("ck_problems_domain", "problems", type_="check")
    op.drop_constraint("uq_problems_number", "problems", type_="unique")
    op.drop_column("problems", "hints")
    op.drop_column("problems", "language")
    op.drop_column("problems", "domain")
    op.drop_column("problems", "number")
