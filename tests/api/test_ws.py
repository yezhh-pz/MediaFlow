import pytest
import asyncio
from fastapi.testclient import TestClient
from src.main import app
from src.services.task_manager import task_manager

def test_websocket_connection(client: TestClient):
    with client.websocket_connect("/api/v1/ws/tasks") as websocket:
        # 1. Connection established
        assert len(task_manager.active_connections) == 1
        
        # 2. Simulate task update broadcast
        # Since 'broadcast_task_update' is async, we need to run it. 
        # But in a synchronous test environment, we might not see the message immediately 
        # unless we trigger it via an API or run the loop.
        # However, TestClient websockets run in a separate thread/loop usually.
        
        # Let's try sending a message from client
        websocket.send_json({"action": "ping"})
        
        # 3. Disconnect
        websocket.close()
        assert len(task_manager.active_connections) == 0

@pytest.mark.asyncio
async def test_task_update_broadcast():
    # This test verifies the TaskManager's logic specifically not the full WS transport
    # which is harder to test async without a running server.
    
    class MockWS:
        def __init__(self):
            self.sent_messages = []
            
        async def accept(self):
            pass

        async def send_json(self, data):
            self.sent_messages.append(data)
            
    mock_ws = MockWS()
    await task_manager.connect(mock_ws)
    
    from src.services.task_manager import TaskInfo
    import time
    
    # Create a real TaskInfo object
    task_manager.tasks["test_task"] = TaskInfo(
        id="test_task", 
        type="test", 
        status="pending", 
        created_at=time.time(), 
        message="Created"
    )
    
    await task_manager.update_task("test_task", status="running", message="Test Message")
    
    print(f"DEBUG MESSAGES: {mock_ws.sent_messages}")
    msg = mock_ws.sent_messages[-1]
    assert msg["type"] == "update"
    assert msg["task"]["id"] == "test_task"
    assert msg["task"]["status"] == "running"
    
    task_manager.disconnect(mock_ws)
