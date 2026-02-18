from fastapi import BackgroundTasks
from backend.models.schemas import TranscribeRequest
from backend.models.task_model import Task
from backend.core.tasks.base import TaskHandler
from backend.core.tasks.registry import TaskHandlerRegistry
from backend.api.v1.transcribe import run_transcription_task
from loguru import logger

@TaskHandlerRegistry.register("transcribe")
class TranscribeHandler(TaskHandler):
    """Handles transcription tasks."""

    def resume(self, task: Task, background_tasks: BackgroundTasks) -> None:
        try:
            req = TranscribeRequest(**task.request_params)
            # Task model uses 'id', but run_transcription_task expects 'task_id' string
            background_tasks.add_task(run_transcription_task, task.id, req)
            logger.info(f"Resumed transcribe task {task.id}")
        except Exception as e:
            logger.error(f"Failed to resume transcribe task {task.id}: {e}")
            raise
