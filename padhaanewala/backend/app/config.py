from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env.development",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    APP_ENV: Literal["development", "staging", "production"] = "development"
    APP_NAME: str = "Padhaanewala"
    APP_URL: str = "http://localhost:3000"
    API_URL: str = "http://localhost:8000"
    SECRET_KEY: str = "change-me"
    CORS_ORIGINS: str = "http://localhost:3000"
    TIMEZONE: str = "Asia/Kolkata"

    DB_HOST: str = "localhost"
    DB_PORT: int = 5433
    DB_NAME: str = "padhaanewala_dev"
    DB_USER: str = "padhaanewala"
    DB_PASSWORD: str = "dev_password_123"
    DATABASE_URL: str = (
        "postgresql+psycopg2://padhaanewala:dev_password_123@localhost:5433/padhaanewala_dev"
    )

    REDIS_URL: str = "redis://localhost:6379/0"

    JWT_SECRET_KEY: str = "change-me"
    JWT_REFRESH_SECRET_KEY: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    BCRYPT_ROUNDS: int = 12

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()