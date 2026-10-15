"""rename timestamp to checked_at in check_results

Revision ID: 7d51f3f29e31
Revises: c91593879248
Create Date: 2026-10-15 15:46:43.038392

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '7d51f3f29e31'
down_revision: Union[str, Sequence[str], None] = 'c91593879248'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema safely by renaming column without data loss."""
    op.alter_column('check_results', 'timestamp', new_column_name='checked_at')
    op.drop_index('ix_check_results_timestamp', table_name='check_results')
    op.create_index(op.f('ix_check_results_checked_at'), 'check_results', ['checked_at'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('check_results', 'checked_at', new_column_name='timestamp')
    op.drop_index(op.f('ix_check_results_checked_at'), table_name='check_results')
    op.create_index('ix_check_results_timestamp', 'check_results', ['timestamp'], unique=False)
