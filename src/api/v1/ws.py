from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from src.services.task_manager import task_manager

router = APIRouter(prefix="/ws", tags=["WebSocket"])

@router.websocket("/tasks")
async def websocket_endpoint(websocket: WebSocket):
    await task_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and handle incoming messages (e.g. cancel requests)
            data = await websocket.receive_json()
            # Handle client messages if needed
            if data.get("action") == "cancel":
                task_id = data.get("task_id")
                if task_id:
                    await task_manager.cancel_task(task_id)
    except WebSocketDisconnect:
        task_manager.disconnect(websocket)
    except Exception as e: # Handle other disconnect scenarios
        task_manager.disconnect(websocket)
