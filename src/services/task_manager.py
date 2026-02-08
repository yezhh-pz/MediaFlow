import asyncio
import uuid
import time
import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from pydantic import BaseModel
from fastapi import WebSocket
from loguru import logger
from src.config import settings

class TaskInfo(BaseModel):
    id: str
    name: Optional[str] = None # User friendly name (e.g. Video Title)
    type: str  # "download", "transcribe", etc.
    status: str  # "pending", "running", "completed", "failed", "cancelled", "paused"
    progress: float = 0.0
    message: str = ""
    created_at: float
    result: Optional[Any] = None
    error: Optional[str] = None
    cancelled: bool = False
    request_params: Optional[Dict[str, Any]] = None # Store args for resume

class TaskManager:
    def __init__(self):
        self.tasks: Dict[str, TaskInfo] = {}
        self.active_connections: List[WebSocket] = []
        self.data_file = settings.BASE_DIR / "data" / "tasks.json"
        self.load_tasks()

    def load_tasks(self):
        """Load tasks from JSON file on startup."""
        if not self.data_file.exists():
            return
        
        try:
            with open(self.data_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                for task_dict in data:
                    task = TaskInfo(**task_dict)
                    # Mark any 'running' tasks as 'paused' since service restarted
                    if task.status in ["running", "pending"]:
                        task.status = "paused"
                        task.message = "Interrupted by restart"
                        task.cancelled = True # Ensure loop doesn't pick it up
                    self.tasks[task.id] = task
            logger.info(f"Loaded {len(self.tasks)} tasks from persistence.")
        except Exception as e:
            logger.error(f"Failed to load tasks: {e}")

    def _save_tasks_sync(self):
        """Internal synchronous save."""
        # Ensure data directory exists
        self.data_file.parent.mkdir(parents=True, exist_ok=True)
        try:
            # Use model_dump(mode='json') to ensure proper serialization of Pydantic types (e.g., HttpUrl)
            tasks_list = [task.model_dump(mode='json') for task in self.tasks.values()]
            with open(self.data_file, "w", encoding="utf-8") as f:
                json.dump(tasks_list, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Failed to save tasks: {e}")

    async def save_tasks(self):
        """Async save to file using executor to avoid blocking event loop."""
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self._save_tasks_sync)

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total: {len(self.active_connections)}")
        # Send current tasks snapshot
        await self.send_tasks_snapshot(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients."""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send to client: {e}")
                disconnected.append(connection)
        
        for connection in disconnected:
            self.disconnect(connection)

    async def send_tasks_snapshot(self, websocket: WebSocket):
        """Send all current tasks to a specific client."""
        # Use model_dump(mode='json') to handle HttpUrl and other Pydantic types
        tasks_list = [task.model_dump(mode='json') for task in self.tasks.values()]
        try:
            await websocket.send_json({
                "type": "snapshot",
                "tasks": tasks_list
            })
        except Exception as e:
            logger.error(f"Error sending snapshot: {repr(e)}")
            # If it's a disconnect, we might want to re-raise or handle cleanup
            if "disconnect" in str(e).lower() or "closed" in str(e).lower():
                 raise e

    async def create_task(self, task_type: str, initial_message: str = "Pending...", request_params: Dict = None, task_name: str = None) -> str:
        task_id = str(uuid.uuid4())[:8]
        
        # If no name provided, maybe use ID or type
        final_name = task_name or f"{task_type.capitalize()} {task_id}"

        task = TaskInfo(
            id=task_id,
            name=final_name,
            type=task_type,
            status="pending",
            message=initial_message,
            created_at=time.time(),
            request_params=request_params
        )
        self.tasks[task_id] = task
        await self.save_tasks() # Persist async
        
        # Broadcast creation immediately so UI shows "Pending"
        await self.broadcast({
            "type": "update", # task_monitor uses 'update' to add/update
            "task": task.model_dump(mode='json')
        })
        
        return task_id

    async def update_task(self, task_id: str, **kwargs):
        if task_id not in self.tasks:
            return
        
        task = self.tasks[task_id]
        
        for key, value in kwargs.items():
            if hasattr(task, key):
                setattr(task, key, value)
        
        await self.save_tasks() # Persist updates async
        
        # Broadcast update
        await self.broadcast({
            "type": "update",
            "task": task.model_dump(mode='json')
        })

    async def cancel_task(self, task_id: str):
        if task_id in self.tasks:
            self.tasks[task_id].cancelled = True
            self.tasks[task_id].status = "cancelled" # Update status immediately for UI
            await self.save_tasks()
            # Status update will be handled by the worker checking this flag
            logger.info(f"Task {task_id} marked for cancellation")
            # Force broadcast update
            asyncio.create_task(self.broadcast({"type": "update", "task": self.tasks[task_id].model_dump(mode='json')}))

    async def delete_task(self, task_id: str) -> bool:
        """Remove task from manager and persistence."""
        if task_id in self.tasks:
            # If running, try to cancel first (though caller should probably handle this)
            if self.tasks[task_id].status == "running":
                await self.cancel_task(task_id)
            
            del self.tasks[task_id]
            await self.save_tasks()
            
            # Broadcast deletion (using update with null or a new type)
            # Actually simpler to just send snapshot or specific delete event
            asyncio.create_task(self.broadcast({
                "type": "delete",
                "task_id": task_id
            }))
            logger.info(f"Task {task_id} deleted")
            return True
        return False
    
    async def delete_all_tasks(self) -> int:
        """Delete all tasks from manager and persistence."""
        count = len(self.tasks)
        if count == 0:
            return 0
            
        # Clear dictionary
        self.tasks.clear()
        await self.save_tasks()
        
        # Broadcast snapshot (empty list)
        asyncio.create_task(self.broadcast({
             "type": "snapshot", 
             "tasks": []
        }))
        logger.info(f"Deleted all {count} tasks")
        return count
    
    async def cancel_all_tasks(self):
        """Cancel all pending or running tasks."""
        cancelled_count = 0
        for task_id, task in self.tasks.items():
            if task.status in ["pending", "running"] and not task.cancelled:
                task.cancelled = True
                task.status = "cancelled"
                cancelled_count += 1
        await self.save_tasks()
        logger.info(f"Marked {cancelled_count} tasks for cancellation")
        # Optimization: Broadcast snapshot instead of N updates
        asyncio.create_task(self.broadcast({
             "type": "snapshot", 
             "tasks": [t.model_dump(mode='json') for t in self.tasks.values()]
        }))
        return cancelled_count


    def get_task(self, task_id: str) -> Optional[TaskInfo]:
        return self.tasks.get(task_id)

    def is_cancelled(self, task_id: str) -> bool:
        task = self.tasks.get(task_id)
        return task.cancelled if task else False

    def find_task_by_params(self, task_type: str, request_params: Dict[str, Any]) -> Optional[str]:
        """
        Find an existing task with identical parameters.
        Returns task_id if found, None otherwise.
        """
        if not request_params:
            return None
            
        # Helper to extract comparison key (e.g. URL)
        def get_comparison_key(params: Dict) -> str:
            # For pipeline/download, the key is usually 'steps' -> 'download' -> 'params' -> 'url'
            # Or simplified: check if 'url' is in values recursively?
            # For now, simplistic deep equality on dictionary string representation 
            # might be too strict if timestamp/random nonce is included.
            # But specific to our use case:
            if 'steps' in params:
                 # Pipeline request
                 try:
                     # Find download step
                     for step in params['steps']:
                         if step['step_name'] == 'download' and 'url' in step['params']:
                             return step['params']['url']
                 except:
                     pass
            elif 'url' in params:
                return params['url']
            
            # Fallback: strict JSON string comparison
            return json.dumps(params, sort_keys=True)

        target_key = get_comparison_key(request_params)
        
        for task in self.tasks.values():
            if task.type != task_type:
                continue
            
            if not task.request_params:
                continue
                
            current_key = get_comparison_key(task.request_params)
            if current_key == target_key:
                return task.id
                
        return None

    async def reset_task(self, task_id: str):
        """
        Reset a completed/failed/cancelled task to pending state for reuse.
        """
        if task_id not in self.tasks:
            return
            
        task = self.tasks[task_id]
        task.status = "pending"
        task.progress = 0.0
        task.message = "Resuming..."
        task.created_at = time.time() # Bump to top
        task.result = None
        task.error = None
        task.cancelled = False
        
        await self.save_tasks()
        
        await self.broadcast({
            "type": "update",
            "task": task.model_dump(mode='json')
        })
        logger.info(f"Task {task_id} reset for reuse")


