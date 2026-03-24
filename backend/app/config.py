from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    GROQ_API_KEY: str = ""
    DATABASE_URL: str = "sqlite:///./expense_analyser.db"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    SMS_INGEST_TOKEN: str = ""   # optional Bearer token; set in .env to secure the ingest endpoint

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
