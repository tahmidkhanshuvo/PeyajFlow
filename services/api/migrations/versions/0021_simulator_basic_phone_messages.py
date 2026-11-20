"""Add the simulated basic phone's SMS thread.

Revision ID: 0021_simulator
Revises: 0020_otp
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0021_simulator"
down_revision: str | Sequence[str] | None = "0020_otp"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sim_messages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("membership_id", sa.Uuid(), nullable=False),
        sa.Column("direction", sa.String(length=3), nullable=False),
        sa.Column("body", sa.String(length=700), nullable=False),
        sa.Column("alert_id", sa.Uuid(), nullable=True),
        sa.Column("offer_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("direction IN ('in', 'out')", name="sim_message_direction"),
        sa.ForeignKeyConstraint(["membership_id"], ["memberships.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("membership_id", "alert_id", name="uq_sim_message_alert"),
    )
    op.create_index(
        op.f("ix_sim_messages_membership_id"),
        "sim_messages",
        ["membership_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_sim_messages_membership_id"), table_name="sim_messages")
    op.drop_table("sim_messages")
