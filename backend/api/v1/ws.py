from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.core.container import container, Services

router = APIRouter(prefix="/ws", tags=["WebSocket"])


def _get_notifier():
    return container.get(Services.WS_NOTIFIER)


def _get_task_manager():
    return container.get(Services.TASK_MANAGER)


@router.websocket("/tasks")
async def websocket_endpoint(websocket: WebSocket):
    from loguru import logger
    try:
        notifier = _get_notifier()
        tm = _get_task_manager()

        await notifier.connect(websocket)
        
        # Snapshot generation might fail if DB/serialization has issues
        try:
            snapshot = tm.get_tasks_snapshot()
            await notifier.send_snapshot(websocket, snapshot)
        except Exception as e:
            logger.error(f"Failed to send initial snapshot: {e}")
            # Don't close connection, just log error? 
            # If snapshot fails, maybe we still want live updates?
            # But likely something is fundamentally wrong.
            raise e

        while True:
            data = await websocket.receive_json()
            if data.get("action") == "cancel":
                task_id = data.get("task_id")
                if task_id:
                    await tm.cancel_task(task_id)
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected normally")
        _get_notifier().disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        # Ensure we try to disconnect cleanly if possible
        try:
            _get_notifier().disconnect(websocket)
        except Exception:
            pass

