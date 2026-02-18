from abc import ABC, abstractmethod
from fastapi import BackgroundTasks
from backend.models.task_model import Task
from loguru import logger

class TaskHandler(ABC):
    """
    Abstract base class for all task handlers.
    Each handler is responsible for resuming a specific type of task.
    """
    
    @abstractmethod
    def resume(self, task: Task, background_tasks: BackgroundTasks) -> None:
        """
        Resume the given task.
        
        Args:
            task: The task model containing request parameters and state.
            background_tasks: FastAPI BackgroundTasks object to schedule the worker.
        """
        pass
