from fastapi import APIRouter, HTTPException, BackgroundTasks

from backend.core.container import container, Services
from backend.models.schemas import PipelineRequest
# Import registry and handlers to ensure they are registered
from backend.core.tasks.registry import TaskHandlerRegistry
import backend.core.tasks.handlers.transcribe_handler
import backend.core.tasks.handlers.synthesis_handler
import backend.core.tasks.handlers.pipeline_handler
import backend.core.tasks.handlers.preprocessing_handler
from loguru import logger

router = APIRouter(prefix="/tasks", tags=["Tasks"])


def _get_task_manager():
    return container.get(Services.TASK_MANAGER)


def _get_pipeline_runner():
    return container.get(Services.PIPELINE)


@router.get("/", response_model=list[dict])
async def list_tasks():
    """Get all tasks."""
    tm = _get_task_manager()
    return [task.dict() for task in tm.tasks.values()]


@router.get("/{task_id}", response_model=dict)
async def get_task(task_id: str):
    """Get task status."""
    task = _get_task_manager().get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task.dict()


@router.post("/cancel-all")
async def cancel_all_tasks():
    """Cancel all active tasks."""
    count = await _get_task_manager().cancel_all_tasks()
    return {"message": f"Marked {count} tasks for cancellation", "count": count}


@router.post("/{task_id}/resume")
async def resume_task(task_id: str, background_tasks: BackgroundTasks):
    """Resume a paused/cancelled/failed task."""
    tm = _get_task_manager()
    task = tm.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    if not task.request_params:
         raise HTTPException(status_code=400, detail="Cannot resume task: Missing parameters")

    if task.status == "running":
        return {"message": "Task is already running", "status": "running"}

    # Reset task state
    await tm.update_task(task_id, status="pending", message="Resuming...", error=None, result=None, cancelled=False)
    
    try:
        # OCP: Use Registry to find handler
        handler = TaskHandlerRegistry.get(task.type)
        if handler:
            handler.resume(task, background_tasks)
        else:
            # Fallback for legacy pipeline tasks that might not have a type or default type
            if not task.type or task.type == "pipeline":
                # Assuming generic pipeline if no handler found matched "pipeline"
                # But we registered "pipeline" in PipelineHandler.
                # If task.type is None/empty, we might want to default to pipeline?
                # For safety, let's explicitly check if generic pipeline handler works.
                logger.warning(f"No specific handler for task type '{task.type}'. defaulting to PipelineHandler.")
                # This might fail if params don't match PipelineRequest.
                # But previous code fallback was PipelineRequest.
                fallback_handler = TaskHandlerRegistry.get("pipeline")
                if fallback_handler:
                    fallback_handler.resume(task, background_tasks)
                else:
                    raise ValueError(f"No handler found for task type: {task.type}")
                    
    except Exception as e:
         logger.error(f"Resume failed: {e}")
         raise HTTPException(status_code=500, detail=f"Failed to restart task: {e}")

    return {"message": "Task resumed", "status": "pending"}


@router.delete("/{task_id}")
async def delete_task(task_id: str):
    """Delete a task (remove from list)."""
    success = await _get_task_manager().delete_task(task_id)
    if not success:
         raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task deleted", "task_id": task_id}


@router.delete("/")
async def delete_all_tasks():
    """Delete ALL tasks."""
    count = await _get_task_manager().delete_all_tasks()
    return {"message": f"Deleted {count} tasks", "count": count}
