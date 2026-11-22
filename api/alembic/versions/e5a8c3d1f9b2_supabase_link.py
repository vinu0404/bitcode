"""link users to Supabase accounts

  - users.supabase_id: the Supabase auth uid of a linked account. Unique,
    nullable: accounts made with an email and password have none.
  - users.display_name, users.avatar_url: copied from the Supabase profile
    (Google name and photo) the first time a linked user signs in.
  - users.password_hash is now nullable: an account created through Supabase
    has no Bitcode password until its owner sets one. Login treats a missing
    hash as "incorrect email or password".

Revision ID: e5a8c3d1f9b2
Revises: d3f7b9a2c1e5
Create Date: 2026-11-23
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "e5a8c3d1f9b2"
down_revision = "d3f7b9a2c1e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("supabase_id", UUID(as_uuid=True), nullable=True))
    op.create_unique_constraint("uq_users_supabase_id", "users", ["supabase_id"])
    op.add_column("users", sa.Column("display_name", sa.String(), nullable=True))
    op.add_column("users", sa.Column("avatar_url", sa.String(), nullable=True))
    op.alter_column("users", "password_hash", existing_type=sa.String(), nullable=True)


def downgrade() -> None:
    # Accounts with no password cannot satisfy NOT NULL: give them an
    # unusable hash so the downgrade does not fail on live data.
    op.execute("UPDATE users SET password_hash = '!' WHERE password_hash IS NULL")
    op.alter_column("users", "password_hash", existing_type=sa.String(), nullable=False)
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "display_name")
    op.drop_constraint("uq_users_supabase_id", "users", type_="unique")
    op.drop_column("users", "supabase_id")
