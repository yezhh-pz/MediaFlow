from fastapi import APIRouter, HTTPException, BackgroundTasks
from src.services.task_manager import task_manager
from src.core.pipeline import pipeline_runner
from src.models.schemas import PipelineRequest, TranscribeRequest
from src.api.v1.transcribe import run_transcription_task

router = APIRouter(prefix="/tasks", tags=["Tasks"])

@router.post("/cancel-all")
async def cancel_all_tasks():
    """Cancel all active tasks."""
    count = await task_manager.cancel_all_tasks()
    return {"message": f"Marked {count} tasks for cancellation", "count": count}

@router.post("/{task_id}/resume")
async def resume_task(task_id: str, background_tasks: BackgroundTasks):
    """Resume a paused/cancelled/failed task."""
    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if not task.request_params:
         raise HTTPException(status_code=400, detail="Cannot resume task: Missing parameters")

    if task.status == "running":
        return {"message": "Task is already running", "status": "running"}

    # Reset task state
    await task_manager.update_task(task_id, status="pending", message="Resuming...", error=None, result=None, cancelled=False)
    
    try:
        if task.type == "transcribe":
            req = TranscribeRequest(**task.request_params)
            background_tasks.add_task(run_transcription_task, task_id, req)
        else:
            # Default to pipeline/download
            req = PipelineRequest(**task.request_params)
            background_tasks.add_task(pipeline_runner.run, req.steps, task_id)
            
    except Exception as e:
         raise HTTPException(status_code=500, detail=f"Failed to restart task: {e}")

    return {"message": "Task resumed", "status": "pending"}

@router.delete("/{task_id}")
async def delete_task(task_id: str):
    """Delete a task (remove from list)."""
    success = await task_manager.delete_task(task_id)
    if not success:
         raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted", "task_id": task_id}

@router.delete("/")
async def delete_all_tasks():
    """Delete ALL tasks."""
    count = await task_manager.delete_all_tasks()
    return {"message": f"Deleted {count} tasks", "count": count}
