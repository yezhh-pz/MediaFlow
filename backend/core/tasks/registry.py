from typing import Dict, Type, Optional
from backend.core.tasks.base import TaskHandler
from loguru import logger

class TaskHandlerRegistry:
    """
    Registry for TaskHandlers.
    Allows handlers to register themselves for specific task types.
    """
    _handlers: Dict[str, Type[TaskHandler]] = {}

    @classmethod
    def register(cls, task_type: str):
        """Decorator to register a handler for a task type."""
        def decorator(handler_cls: Type[TaskHandler]):
            cls._handlers[task_type] = handler_cls
            logger.debug(f"Registered TaskHandler for '{task_type}': {handler_cls.__name__}")
            return handler_cls
        return decorator

    @classmethod
    def get(cls, task_type: str) -> Optional[TaskHandler]:
        """Get an instantiated handler for the given task type."""
        handler_cls = cls._handlers.get(task_type)
        if not handler_cls:
            return None
        return handler_cls()
