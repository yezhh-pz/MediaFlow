
from fastapi import APIRouter, HTTPException, Depends
from src.services.settings_manager import settings_manager, UserSettings, LLMProvider
from pydantic import BaseModel
from typing import List

router = APIRouter(prefix="/settings", tags=["Settings"])

class ActiveProviderRequest(BaseModel):
    provider_id: str

@router.get("/", response_model=UserSettings)
async def get_records():
    """Get all user settings."""
    return settings_manager.get_settings()

@router.post("/", response_model=UserSettings)
async def update_settings(settings: UserSettings):
    """
    Update all settings (full replace).
    BE CAREFUL: Client should send the full object.
    """
    try:
        settings_manager.update_settings(settings)
        return settings_manager.get_settings()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/active-provider")
async def set_active_provider(req: ActiveProviderRequest):
    """Set the active LLM provider by ID."""
    try:
        settings_manager.set_active_provider(req.provider_id)
        return {"status": "success", "active_provider_id": req.provider_id}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
