"""add live documentation publishing.

Revision ID: 0022_docs
Revises: 0021_simulator
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0022_docs"
down_revision: str | Sequence[str] | None = "0021_simulator"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "documentation_settings",
        sa.Column("id", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("mode", sa.String(length=12), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("draft", sa.JSON(), nullable=True),
        sa.Column("published_version", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "mode in ('off', 'public', 'scheduled')", name="documentation_mode"
        ),
        sa.CheckConstraint("id = 1", name="documentation_singleton"),
        sa.CheckConstraint("starts_at < ends_at", name="documentation_window"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "documentation_versions",
        sa.Column("version", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("document", sa.JSON(), nullable=False),
        sa.Column("note", sa.String(length=240), nullable=False),
        sa.Column(
            "published_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("version"),
    )
    op.execute(
        """INSERT INTO documentation_settings
        (id, revision, mode, starts_at, ends_at, published_version)
        VALUES (1, 0, 'scheduled', TIMESTAMPTZ '2027-06-10 00:00:00+06:00',
                TIMESTAMPTZ '2027-06-15 00:00:00+06:00', 0)"""
    )


def downgrade() -> None:
    op.drop_table("documentation_versions")
    op.drop_table("documentation_settings")
