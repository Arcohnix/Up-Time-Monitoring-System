import pytest
from unittest.mock import AsyncMock
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.health import check_database_connectivity


@pytest.mark.asyncio
async def test_database_connectivity_success(test_session: AsyncSession):
    """Verify check_database_connectivity returns True on operational database."""
    is_connected = await check_database_connectivity(test_session)
    assert is_connected is True


@pytest.mark.asyncio
async def test_database_connectivity_failure():
    """Verify check_database_connectivity returns False when execution raises an error."""
    mock_session = AsyncMock(spec=AsyncSession)
    mock_session.execute.side_effect = ConnectionRefusedError("Database unreachable")

    is_connected = await check_database_connectivity(mock_session)
    assert is_connected is False
