"""Add NID and verification for farmer/buyer signup

Revision ID: 0017_signup_nid
Revises: 0016_vision
Create Date: 2026-11-19 00:00:00

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0017_signup_nid"
down_revision = "0016_vision"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add NID column to users table
    op.add_column("users", sa.Column("nid", sa.String(20), unique=True))
    # Add verification status: 'pending' (default), 'verified', 'rejected'
    op.add_column(
        "users",
        sa.Column(
            "verification_status",
            sa.String(20),
            nullable=False,
            server_default="pending",
        ),
    )
    # Add verified_by and verified_at columns
    op.add_column(
        "users", sa.Column("verified_by", sa.Uuid(), sa.ForeignKey("memberships.id"))
    )
    op.add_column("users", sa.Column("verified_at", sa.DateTime(timezone=True)))
    # Add phone column to users
    op.add_column("users", sa.Column("phone", sa.String(20)))


def downgrade() -> None:
    op.drop_column("users", "phone")
    op.drop_column("users", "verified_at")
    op.drop_column("users", "verified_by")
    op.drop_column("users", "verification_status")
    op.drop_column("users", "nid")
