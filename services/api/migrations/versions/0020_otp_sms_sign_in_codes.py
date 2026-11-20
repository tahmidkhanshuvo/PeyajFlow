"""Add one-time SMS sign-in codes for operator-verified phone numbers.

Revision ID: 0020_otp
Revises: 0019_voicepin
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0020_otp"
down_revision: str | Sequence[str] | None = "0019_voicepin"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "otp_challenges",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("membership_id", sa.Uuid(), nullable=False),
        sa.Column("code_digest", sa.String(length=64), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("attempts >= 0", name="otp_attempts"),
        sa.ForeignKeyConstraint(["membership_id"], ["memberships.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_otp_challenges_membership_id"),
        "otp_challenges",
        ["membership_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_otp_challenges_membership_id"), table_name="otp_challenges")
    op.drop_table("otp_challenges")
