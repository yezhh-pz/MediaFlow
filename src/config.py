from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # App Info
    APP_NAME: str = "MediaFlow Core"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True
    
    # Server
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    
    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    TEMP_DIR: Path = BASE_DIR / "temp"
    MODEL_DIR: Path = BASE_DIR / "models"
    OUTPUT_DIR: Path = BASE_DIR / "output"
    BIN_DIR: Path = BASE_DIR / "bin"
    
    # Executables
    FFMPEG_PATH: str = "ffmpeg" # Default to system path

    # LLM Settings (Translator) - Must be set in .env file
    LLM_API_KEY: str = ""  # Required: Set VITE_LLM_API_KEY in .env
    LLM_BASE_URL: str = "https://api.openai.com/v1"
    LLM_MODEL: str = "gpt-3.5-turbo"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    def init_dirs(self):
        """Ensure critical directories exist."""
        for path in [self.TEMP_DIR, self.MODEL_DIR, self.OUTPUT_DIR, self.BIN_DIR]:
            path.mkdir(parents=True, exist_ok=True)

settings = Settings()
