import asyncio
import uuid
import time
import json
from typing import Dict, List, Optional, Any
from fastapi import WebSocket
from loguru import logger
from sqlmodel import select, delete

from src.core.database import get_session_context, init_db
from src.models.task_model import Task

class TaskManager:
    def __init__(self):
        self.tasks: Dict[str, Task] = {}
        self.active_connections: List[WebSocket] = []
        # No more data_file
        
    async def init_async(self):
        """Initialize DB and load tasks."""
        await init_db()
        await self.load_tasks()

    async def load_tasks(self):
        """Load tasks from DB on startup."""
        try:
            async with get_session_context() as session:
                statement = select(Task)
                result = await session.execute(statement)
                tasks = result.scalars().all()
                
                for task in tasks:
                    # Mark any 'running' tasks as 'paused' since service restarted
                    if task.status in ["running", "pending"]:
                        task.status = "paused"
                        task.message = "Interrupted by restart"
                        task.cancelled = True # Ensure loop doesn't pick it up
                        
                        # We need to update this status in DB too
                        session.add(task)
                    
                    self.tasks[task.id] = task
                
                if tasks:
                    await session.commit()
                    
            logger.info(f"Loaded {len(self.tasks)} tasks from SQLite.")
        except Exception as e:
            logger.error(f"Failed to load tasks from DB: {e}")

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
        # Use model_dump to ensure serialization
        tasks_list = [task.model_dump(mode='json') for task in self.tasks.values()]
        try:
            await websocket.send_json({
                "type": "snapshot",
                "tasks": tasks_list
            })
        except Exception as e:
            logger.error(f"Error sending snapshot: {repr(e)}")
            if "disconnect" in str(e).lower() or "closed" in str(e).lower():
                 raise e

    async def create_task(self, task_type: str, initial_message: str = "Pending...", request_params: Dict = None, task_name: str = None) -> str:
        task_id = str(uuid.uuid4())[:8]
        final_name = task_name or f"{task_type.capitalize()} {task_id}"

        # Ensure request_params are JSON serializable (handle HttpUrl, etc.)
        if request_params:
            try:
                # If request_params is a Pydantic model, dump it
                if hasattr(request_params, "model_dump"):
                    request_params = request_params.model_dump(mode="json")
                # If it's a dict containing Pydantic models or types, we might need more robust handling
                # For now, let's assume the caller passes a dict. 
                # The error "Object of type HttpUrl is not JSON serializable" suggests we have raw Pydantic types.
                # Let's use json.loads(json.dumps(..., default=str)) as a brute-force sanitizer for now
                request_params = json.loads(json.dumps(request_params, default=str))
            except Exception as e:
                logger.warning(f"Failed to serialize request_params: {e}")
                request_params = {}

        task = Task(
            id=task_id,
            name=final_name,
            type=task_type,
            status="pending",
            message=initial_message,
            created_at=time.time(),
            request_params=request_params
        )
        
        # 1. Update In-Memory
        self.tasks[task_id] = task
        
        # 2. Persist to DB
        async with get_session_context() as session:
            session.add(task)
            await session.commit()
        
        # 3. Broadcast
        await self.broadcast({
            "type": "update",
            "task": task.model_dump(mode='json')
        })
        
        return task_id

    async def update_task(self, task_id: str, **kwargs):
        if task_id not in self.tasks:
            return
        
        task = self.tasks[task_id]
        
        # 1. Update In-Memory Object
        for key, value in kwargs.items():
            if hasattr(task, key):
                setattr(task, key, value)
        
        # 2. Persist to DB
        # Since we modified the object in self.tasks, we need to merge it 
        # or load clean one and update. Merging is safer if session is transient.
        async with get_session_context() as session:
            # We can use update statement for efficiency, or add the modified object
            # BUT: task object in memory is detached. verify if merging works with SQLModel
            # Simplest: Update specific fields via statement
            # session.add(task) might raise error if detached.
            # Safe way: fetch and update
            db_task = await session.get(Task, task_id)
            if db_task:
                for key, value in kwargs.items():
                    if hasattr(db_task, key):
                        setattr(db_task, key, value)
                session.add(db_task)
                await session.commit()
        
        # 3. Broadcast
        await self.broadcast({
            "type": "update",
            "task": task.model_dump(mode='json')
        })

    async def cancel_task(self, task_id: str):
        if task_id in self.tasks:
            task = self.tasks[task_id]
            task.cancelled = True
            task.status = "cancelled"
            
            # DB Update
            async with get_session_context() as session:
                db_task = await session.get(Task, task_id)
                if db_task:
                    db_task.cancelled = True
                    db_task.status = "cancelled"
                    session.add(db_task)
                    await session.commit()

            logger.info(f"Task {task_id} marked for cancellation")
            await self.broadcast({"type": "update", "task": task.model_dump(mode='json')})

    async def delete_task(self, task_id: str) -> bool:
        if task_id in self.tasks:
            if self.tasks[task_id].status == "running":
                await self.cancel_task(task_id)
            
            # Remove from Memory
            del self.tasks[task_id]
            
            # Remove from DB
            async with get_session_context() as session:
                statement = delete(Task).where(Task.id == task_id)
                await session.execute(statement)
                await session.commit()
            
            await self.broadcast({
                "type": "delete",
                "task_id": task_id
            })
            logger.info(f"Task {task_id} deleted")
            return True
        return False
    
    async def delete_all_tasks(self) -> int:
        count = len(self.tasks)
        if count == 0:
            return 0
            
        self.tasks.clear()
        
        async with get_session_context() as session:
            statement = delete(Task)
            await session.execute(statement)
            await session.commit()
        
        await self.broadcast({
             "type": "snapshot", 
             "tasks": []
        })
        logger.info(f"Deleted all {count} tasks")
        return count
    
    async def cancel_all_tasks(self):
        cancelled_count = 0
        async with get_session_context() as session:
            # We need to iterate to update both memory and DB
            # Or bulk update DB and reload memory?
            # Iterating is safer for now to keep them in sync
            for task_id, task in self.tasks.items():
                if task.status in ["pending", "running"] and not task.cancelled:
                    task.cancelled = True
                    task.status = "cancelled"
                    cancelled_count += 1
                    
                    # Update DB (Batching this would be better but keeping it simple)
                    db_task = await session.get(Task, task_id)
                    if db_task:
                        db_task.cancelled = True
                        db_task.status = "cancelled"
                        session.add(db_task)
            
            if cancelled_count > 0:
                await session.commit()

        logger.info(f"Marked {cancelled_count} tasks for cancellation")
        await self.broadcast({
             "type": "snapshot", 
             "tasks": [t.model_dump(mode='json') for t in self.tasks.values()]
        })
        return cancelled_count

    def get_task(self, task_id: str) -> Optional[Task]:
        return self.tasks.get(task_id)

    def is_cancelled(self, task_id: str) -> bool:
        task = self.tasks.get(task_id)
        return task.cancelled if task else False

    def find_task_by_params(self, task_type: str, request_params: Dict[str, Any]) -> Optional[str]:
        if not request_params:
            return None
            
        def get_comparison_key(params: Dict) -> str:
            if 'steps' in params:
                 try:
                     for step in params['steps']:
                         if step['step_name'] == 'download' and 'url' in step['params']:
                             return step['params']['url']
                 except:
                     pass
            elif 'url' in params:
                return params['url']
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
        if task_id not in self.tasks:
            return
            
        task = self.tasks[task_id]
        task.status = "pending"
        task.progress = 0.0
        task.message = "Resuming..."
        task.created_at = time.time()
        task.result = None
        task.error = None
        task.cancelled = False
        
        # DB Update
        async with get_session_context() as session:
            db_task = await session.get(Task, task_id)
            if db_task:
                db_task.status = "pending"
                db_task.progress = 0.0
                db_task.message = "Resuming..."
                db_task.created_at = task.created_at
                db_task.result = None
                db_task.error = None
                db_task.cancelled = False
                session.add(db_task)
                await session.commit()
        
        await self.broadcast({
            "type": "update",
            "task": task.model_dump(mode='json')
        })
        logger.info(f"Task {task_id} reset for reuse")


