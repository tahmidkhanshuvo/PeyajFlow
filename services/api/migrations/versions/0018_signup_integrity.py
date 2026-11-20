"""Preserve existing logins and enforce signup identity constraints.

Revision ID: 0018_signup
Revises: 0017_signup_nid
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0018_signup"
down_revision: str | Sequence[str] | None = "0017_signup_nid"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_unique_constraint("users_phone_key", "users", ["phone"])
    op.create_check_constraint(
        "user_verification_status",
        "users",
        "verification_status in ('pending', 'verified', 'rejected')",
    )
    op.execute(
        "UPDATE users SET nid = translate(nid, '০১২৩৪৫৬৭৮৯', '0123456789') "
        "WHERE nid ~ '[০-৯]'"
    )
    # Accounts created before public signup already had access to their workspace.
    op.execute("UPDATE users SET verification_status = 'verified' WHERE nid IS NULL")


def downgrade() -> None:
    op.drop_constraint("user_verification_status", "users", type_="check")
    op.drop_constraint("users_phone_key", "users", type_="unique")
