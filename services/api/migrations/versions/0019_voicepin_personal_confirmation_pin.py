"""Add a personal voice PIN that confirms changes for real accounts.

Revision ID: 0019_voicepin
Revises: 0018_signup
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0019_voicepin"
down_revision: str | Sequence[str] | None = "0018_signup"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "voice_pins",
        sa.Column("membership_id", sa.Uuid(), nullable=False),
        sa.Column("pin_digest", sa.String(length=97), nullable=False),
        sa.Column("failures", sa.Integer(), nullable=False),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("failures >= 0", name="voice_pin_failures"),
        sa.ForeignKeyConstraint(["membership_id"], ["memberships.id"]),
        sa.PrimaryKeyConstraint("membership_id"),
    )


def downgrade() -> None:
    op.drop_table("voice_pins")
