
import sys
import os
import asyncio
from unittest.mock import MagicMock

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from backend.core.tasks.registry import TaskHandlerRegistry
from backend.models.task_model import Task
import backend.core.tasks.handlers.transcribe_handler
import backend.core.tasks.handlers.synthesis_handler
import backend.core.tasks.handlers.pipeline_handler
import backend.core.tasks.handlers.preprocessing_handler

class MockBackgroundTasks:
    def __init__(self):
        self.tasks = []
    
    def add_task(self, func, *args, **kwargs):
        self.tasks.append((func, args, kwargs))

def verify_registry():
    print("Verifying TaskHandlerRegistry...")
    
    # Test cases: (task_type, expected_handler_class)
    cases = [
        ("transcribe", "TranscribeHandler"),
        ("synthesis", "SynthesisHandler"),
        ("enhancement", "EnhancementHandler"),
        ("cleanup", "CleanupHandler"),
        ("pipeline", "PipelineHandler"),
    ]
    
    for t_type, handler_name in cases:
        handler = TaskHandlerRegistry.get(t_type)
        if handler and handler.__class__.__name__ == handler_name:
            print(f"✅ Registry.get('{t_type}') -> {handler_name}")
        else:
            print(f"❌ Registry.get('{t_type}') failed. Got: {handler}")

def verify_resume():
    print("\nVerifying TaskHandler.resume()...")
    bg_tasks = MockBackgroundTasks()
    
    # Mock Task using SQLModel
    task = Task(
        id="test-123",
        type="transcribe",
        status="failed",
        request_params={
            "audio_path": "test.wav",
            "model": "base",
            "language": "en"
        }
    )
    
    handler = TaskHandlerRegistry.get("transcribe")
    try:
        handler.resume(task, bg_tasks)
        if len(bg_tasks.tasks) == 1:
            print("✅ TranscribeHandler.resume scheduled a background task.")
        else:
            print(f"❌ TranscribeHandler.resume failed to schedule task. Count: {len(bg_tasks.tasks)}")
    except Exception as e:
        print(f"❌ TranscribeHandler.resume raised exception: {e}")

if __name__ == "__main__":
    verify_registry()
    verify_resume()
