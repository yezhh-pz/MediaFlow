
import json
import os
from pathlib import Path
from typing import List, Optional, Dict
from pydantic import BaseModel, Field
from loguru import logger
from src.config import settings

class LLMProvider(BaseModel):
    id: str = Field(..., description="Unique Identifier")
    name: str = Field(..., description="Display Name")
    base_url: str
    api_key: str
    model: str
    is_active: bool = False

class UserSettings(BaseModel):
    llm_providers: List[LLMProvider] = []
    default_download_path: Optional[str] = None
    language: str = "zh"

class SettingsManager:
    _instance = None
    _file_path = settings.BASE_DIR / "data" / "user_settings.json"

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SettingsManager, cls).__new__(cls)
            cls._instance.initialize()
        return cls._instance

    def initialize(self):
        self._settings = UserSettings()
        self._load()

    def _load(self):
        if self._file_path.exists():
            try:
                with open(self._file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._settings = UserSettings(**data)
                logger.info(f"Loaded settings from {self._file_path}")
            except Exception as e:
                logger.error(f"Failed to load settings: {e}")
                # Fallback to defaults or .env migration
                self._migrate_from_env()
        else:
            self._migrate_from_env()
            self.save()

    def _migrate_from_env(self):
        """One-time migration from .env to json settings if json is missing."""
        logger.info("Migrating settings from .env...")
        api_key = settings.LLM_API_KEY
        base_url = settings.LLM_BASE_URL
        model = settings.LLM_MODEL
        
        if api_key:
            provider = LLMProvider(
                id="default_env",
                name="Default (env)",
                base_url=base_url,
                api_key=api_key,
                model=model,
                is_active=True
            )
            self._settings.llm_providers.append(provider)

    def save(self):
        self._file_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with open(self._file_path, "w", encoding="utf-8") as f:
                f.write(self._settings.model_dump_json(indent=2)) # Pydantic V2
        except AttributeError:
             # Pydantic V1 fallback just in case
             with open(self._file_path, "w", encoding="utf-8") as f:
                f.write(self._settings.json(indent=2))
        except Exception as e:
            logger.error(f"Failed to save settings: {e}")

    def get_settings(self) -> UserSettings:
        return self._settings

    def update_settings(self, new_settings: UserSettings):
        self._settings = new_settings
        self.save()
        logger.info("Settings updated and saved.")

    def get_active_llm_provider(self) -> Optional[LLMProvider]:
        for p in self._settings.llm_providers:
            if p.is_active:
                return p
        return None
    
    def set_active_provider(self, provider_id: str):
        found = False
        for p in self._settings.llm_providers:
            if p.id == provider_id:
                p.is_active = True
                found = True
            else:
                p.is_active = False
        
        if found:
            self.save()
        else:
            raise ValueError(f"Provider {provider_id} not found")

settings_manager = SettingsManager()
