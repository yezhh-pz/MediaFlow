import asyncio
from fastapi import APIRouter, HTTPException, BackgroundTasks
from src.models.schemas import TranscribeRequest, TaskResponse
from src.services.asr import asr_service
from src.services.task_manager import task_manager
from loguru import logger

router = APIRouter(prefix="/transcribe", tags=["Transcription"])

async def run_transcription_task(task_id: str, req: TranscribeRequest):
    """
    Background worker function for transcription.
    """
    try:
        # Update status to running
        await task_manager.update_task(task_id, status="running", message="Starting transcription...")
        
        # Get event loop for thread-safe progress updates
        loop = asyncio.get_running_loop()
        
        def sync_progress_callback(progress: int, message: str):
            asyncio.run_coroutine_threadsafe(
                task_manager.update_task(task_id, progress=float(progress), message=message),
                loop
            )

        # Run the blocking transcription in a separate thread
        # We use run_in_executor to avoid blocking the main event loop
        result = await asyncio.get_running_loop().run_in_executor(
            None, 
            lambda: asr_service.transcribe(
                audio_path=req.audio_path,
                model_name=req.model,
                device=req.device,
                language=req.language,
                task_id=task_id,
                progress_callback=sync_progress_callback
            )
        )
        
        # Update task with result
        await task_manager.update_task(
            task_id, 
            status="completed", 
            progress=100.0, 
            message="Transcribed successfully",
            result=result.dict()
        )
        logger.success(f"Task {task_id} completed.")

    except Exception as e:
        logger.error(f"Task {task_id} failed: {e}")
        await task_manager.update_task(
            task_id, 
            status="failed", 
            message=str(e),
            error=str(e)
        )

@router.post("/", response_model=TaskResponse)
async def transcribe_audio(req: TranscribeRequest, background_tasks: BackgroundTasks):
    """
    Start an asynchronous transcription task.
    Returns a Task ID to track progress.
    """
    try:
        # Create Task
        task_id = task_manager.create_task(
            task_type="transcribe",
            initial_message="Queued",
            task_name=f"Transcribe {req.audio_path.split('/')[-1] or 'Audio'}",
            request_params=req.dict()
        )
        
        # Dispatch Background Task
        background_tasks.add_task(run_transcription_task, task_id, req)
        
        return TaskResponse(task_id=task_id, status="pending")

    except Exception as e:
        logger.error(f"Failed to submit task: {e}")
        raise HTTPException(status_code=500, detail=str(e))
