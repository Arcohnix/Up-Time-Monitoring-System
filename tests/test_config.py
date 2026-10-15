from app.core.config import Settings


def test_settings_defaults():
    """Verify default application configuration values."""
    settings = Settings()
    assert settings.PROJECT_NAME == "Uptime Monitoring System"
    assert settings.API_V1_STR == "/api/v1"
    assert settings.POSTGRES_PORT == 5432
    assert "postgresql+asyncpg://" in settings.async_database_url


def test_settings_custom_database_url():
    """Verify custom DATABASE_URL handling and asyncpg prefix normalization."""
    # Already has postgresql+asyncpg
    custom = Settings(DATABASE_URL="postgresql+asyncpg://user:pass@db:5432/mydb")
    assert custom.async_database_url == "postgresql+asyncpg://user:pass@db:5432/mydb"

    # Needs postgresql:// normalization
    custom_norm = Settings(DATABASE_URL="postgresql://user:pass@db:5432/mydb")
    assert custom_norm.async_database_url == "postgresql+asyncpg://user:pass@db:5432/mydb"
