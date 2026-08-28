"""Application configuration loaded from environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "development"
    database_url: str = "mysql+aiomysql://accord:accord@127.0.0.1:3306/accord"
    razorpay_key_id: str | None = None
    razorpay_key_secret: str | None = None
    razorpay_webhook_secret: str | None = None
    auth_secret: str = "development-only-change-this-auth-secret"

    model_config = SettingsConfigDict(env_file=("backend/.env", ".env"), extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
