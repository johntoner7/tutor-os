from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    anthropic_api_key: str = ""
    pinecone_api_key: str
    allowed_origins: str = "http://localhost:5173"
    cache_max_size: int = 500

    # LLM provider — switch here without touching endpoint code
    llm_provider: Literal["anthropic", "deepseek"] = "anthropic"
    # Model string is provider-specific; override per-provider in .env
    llm_model: str = "claude-haiku-4-5-20251001"

    # DeepSeek credentials (only needed when llm_provider=deepseek)
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_expire_days: int = 30
    # In dev, magic link is returned in the response body instead of emailed
    debug_magic_link: bool = True

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]


settings = Settings()
