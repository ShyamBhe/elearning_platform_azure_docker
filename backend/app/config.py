from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://lms:lms@localhost:5432/lms"
    secret_key: str = "change-me-in-production"
    access_token_minutes: int = 60 * 8
    cors_origins: str = "http://localhost:5173"
    first_admin_email: str = "admin@example.com"
    first_admin_password: str = "ChangeMe123!"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
