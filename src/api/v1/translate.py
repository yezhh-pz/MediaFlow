from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional
from loguru import logger

from src.models.schemas import SubtitleSegment, TaskResponse
from src.services.translator.llm_translator import llm_translator
from src.services.task_manager import task_manager
import asyncio

router = APIRouter(prefix="/translate", tags=["Translator"])

class TranslateRequest(BaseModel):
    segments: List[SubtitleSegment]
    target_language: str = "Chinese"
    mode: str = "standard" # standard, reflect

class TranslateResponse(BaseModel):
    task_id: str
    status: str
    segments: Optional[List[SubtitleSegment]] = None

async def run_translation_task(task_id: str, req: TranslateRequest):
    """
    Background translation task.
    """
    try:
        await task_manager.update_task(task_id, status="running", message="Starting translation...")
        
        loop = asyncio.get_running_loop()
        
        def progress_callback(progress: int, message: str):
             asyncio.run_coroutine_threadsafe(
                task_manager.update_task(task_id, progress=float(progress), message=message),
                loop
            )

        # Run translation in executor (network bound mostly but good practice)
        result_segments = await loop.run_in_executor(
            None,
            lambda: llm_translator.translate_segments(
                segments=req.segments,
                target_language=req.target_language,
                mode=req.mode,
                progress_callback=progress_callback
            )
        )
        
        # Serialize results
        serialized_segments = [seg.dict() for seg in result_segments]
        
        await task_manager.update_task(
            task_id,
            status="completed",
            progress=100.0,
            message="Translation completed",
            result={"segments": serialized_segments}
        )
        logger.success(f"Translation Task {task_id} completed.")
        
    except Exception as e:
        logger.error(f"Translation Task {task_id} failed: {e}")
        await task_manager.update_task(task_id, status="failed", error=str(e))

@router.post("/", response_model=TranslateResponse)
async def translate_subtitles(req: TranslateRequest, background_tasks: BackgroundTasks):
    """
    Submit a translation task.
    """
    try:
        task_id = task_manager.create_task(
            task_type="translate",
            initial_message="Queued",
            task_name=f"Translate to {req.target_language}",
            request_params={"mode": req.mode, "count": len(req.segments)}
        )
        
        background_tasks.add_task(run_translation_task, task_id, req)
        
        return TranslateResponse(task_id=task_id, status="pending")
        
    except Exception as e:
        logger.error(f"Failed to submit translation task: {e}")
        raise HTTPException(status_code=500, detail=str(e))
